"""Iteration 9 — Casadella backend tests
Covers:
  - GET /api/workflow/labels for every logged-in role (9 stages, key/label/default)
  - PUT /api/workflow/labels super-admin only (admin -> 403)
  - Persistence via Mongo settings.stage_labels (verified by direct DB read)
  - '{nama}' placeholder substituted in stage_label from /workflow and /bookings/{id}
  - Audit entry created when labels are changed
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://casadella-studio.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

PINS = {"super": "123456", "admin1": "111111", "admin2": "222222", "rina": "333333", "budi": "444444"}


# ---------- helpers ----------
def _list_users():
    r = requests.get(f"{API}/auth/users", timeout=10)
    r.raise_for_status()
    return r.json()


def _login(sub_role_or_pin: str):
    pin = PINS.get(sub_role_or_pin, sub_role_or_pin)
    users = _list_users()
    # map role shortcuts to user name
    target = None
    role_map = {"super": "super_admin", "admin1": None, "admin2": None, "rina": "photographer", "budi": "editor"}
    name_hints = {"admin1": "Admin 1", "admin2": "Admin 2", "rina": "Rina", "budi": "Budi"}
    for u in users:
        if sub_role_or_pin == "super" and u.get("sub_role") == "super_admin":
            target = u
            break
        if sub_role_or_pin in name_hints and u["name"].startswith(name_hints[sub_role_or_pin]):
            target = u
            break
    assert target, f"user not found for {sub_role_or_pin}"
    r = requests.post(f"{API}/auth/login", json={"user_id": target["id"], "pin": pin}, timeout=10)
    r.raise_for_status()
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def tokens():
    return {k: _login(k) for k in PINS}


# ---------- GET /workflow/labels ----------
STAGES = ["order_received", "payment_received", "check_schedule", "client_arrived", "photo_session",
          "editing", "awaiting_final", "addon", "completed"]
DEFAULTS = {
    "order_received": "Order Received!",
    "completed": "{nama} - Paid in Full",
}


@pytest.mark.parametrize("role", list(PINS.keys()))
def test_get_labels_any_user(tokens, role):
    r = requests.get(f"{API}/workflow/labels", headers=_h(tokens[role]), timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) == 9
    keys = [x["key"] for x in data]
    assert keys == STAGES
    for x in data:
        assert set(x.keys()) == {"key", "label", "default"}
    by = {x["key"]: x for x in data}
    for k, v in DEFAULTS.items():
        assert by[k]["default"] == v


# ---------- PUT /workflow/labels auth ----------
def test_put_labels_admin_forbidden(tokens):
    r = requests.put(f"{API}/workflow/labels", headers=_h(tokens["admin1"]),
                     json={"order_received": "Admin tried"}, timeout=10)
    assert r.status_code == 403, r.text


def test_put_labels_photographer_forbidden(tokens):
    r = requests.put(f"{API}/workflow/labels", headers=_h(tokens["rina"]),
                     json={"order_received": "x"}, timeout=10)
    assert r.status_code == 403


# ---------- PUT /workflow/labels super admin + persistence + audit + {nama} ----------
def test_put_labels_super_persists_and_substitutes_nama(tokens):
    super_tok = tokens["super"]
    custom = {"order_received": "Pesanan Diterima!", "completed": "{nama} - Lunas Penuh ✓"}
    r = requests.put(f"{API}/workflow/labels", headers=_h(super_tok), json=custom, timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    by = {x["key"]: x for x in body}
    assert by["order_received"]["label"] == "Pesanan Diterima!"
    assert by["completed"]["label"] == "{nama} - Lunas Penuh ✓"
    # defaults should still be original defaults
    assert by["order_received"]["default"] == "Order Received!"
    assert by["completed"]["default"] == "{nama} - Paid in Full"

    # Persistence in Mongo settings collection
    mc = MongoClient(MONGO_URL)
    doc = mc[DB_NAME]["settings"].find_one({"key": "stage_labels"})
    assert doc and doc["labels"]["order_received"] == "Pesanan Diterima!"
    assert doc["labels"]["completed"] == "{nama} - Lunas Penuh ✓"

    # Audit entry created
    time.sleep(0.3)
    aud = list(mc[DB_NAME]["audit_logs"].find({"entity": "booking", "action": "labels"}).sort("at", -1).limit(3))
    assert aud, "no audit entry for labels change"
    latest = aud[0]
    changed_fields = {c["field"] for c in latest.get("changes") or []}
    assert "order_received" in changed_fields and "completed" in changed_fields

    # Verify {nama} substitution in /workflow and /bookings/{id}
    # 1. Create a confirmed booking for today (super admin can create). Needs a real package_id and an open slot.
    pkgs = requests.get(f"{API}/packages", headers=_h(super_tok), timeout=10).json()
    assert pkgs, "no packages seeded"
    pkg = pkgs[0]
    today = time.strftime("%Y-%m-%d")
    # find an available slot
    sl = requests.get(f"{API}/slots?date={today}&duration={pkg['duration_min']}", headers=_h(super_tok), timeout=10).json()
    free = next((x for x in sl if x.get("available")), None)
    assert free, f"no free slot for {today}"
    bp = {
        "client_name": "TEST_IT9 Zahra",
        "client_phone": "081234567111",
        "date": today,
        "start_time": free["time"],
        "package_id": pkg["id"],
    }
    cr = requests.post(f"{API}/bookings", headers=_h(super_tok), json=bp, timeout=10)
    assert cr.status_code in (200, 201), cr.text
    bid = cr.json()["id"]
    client_price = cr.json()["price"]

    # bookings created via POST /bookings are auto-confirmed
    # stage order_received -> label uses custom text (no {nama} in order_received)
    gr = requests.get(f"{API}/bookings/{bid}", headers=_h(super_tok), timeout=10).json()
    assert gr["stage_label"] == "Pesanan Diterima!"

    # pay full to let us reach completed stage
    pay = requests.post(f"{API}/bookings/{bid}/payments", headers=_h(super_tok),
                        json={"amount": client_price, "method": "cash", "type": "pelunasan"}, timeout=10)
    assert pay.status_code in (200, 201), pay.text
    # advance through stages
    for action in ["check_schedule", "client_arrived"]:
        s = requests.post(f"{API}/bookings/{bid}/stage", headers=_h(super_tok), json={"action": action}, timeout=10)
        assert s.status_code == 200, (action, s.text)
    # photographer actions start/finish session
    rina_tok = tokens["rina"]
    for action in ["start_session", "finish_session"]:
        s = requests.post(f"{API}/bookings/{bid}/stage", headers=_h(rina_tok), json={"action": action}, timeout=10)
        assert s.status_code == 200, (action, s.text)
    # editor finish editing
    budi_tok = tokens["budi"]
    s = requests.post(f"{API}/bookings/{bid}/stage", headers=_h(budi_tok), json={"action": "finish_editing"}, timeout=10)
    assert s.status_code == 200, s.text
    # complete order
    s = requests.post(f"{API}/bookings/{bid}/stage", headers=_h(super_tok), json={"action": "complete_order"}, timeout=10)
    assert s.status_code == 200, s.text

    detail = requests.get(f"{API}/bookings/{bid}", headers=_h(super_tok), timeout=10).json()
    assert detail["stage"] == "completed"
    assert detail["stage_label"] == "TEST_IT9 Zahra - Lunas Penuh ✓", detail["stage_label"]

    # /workflow with include_completed should show this item too
    wf = requests.get(f"{API}/workflow?include_completed=true", headers=_h(super_tok), timeout=10).json()
    item = next((i for i in wf["items"] if i["id"] == bid), None)
    assert item and item["stage_label"] == "TEST_IT9 Zahra - Lunas Penuh ✓"
    # stages list in /workflow uses custom labels (NOT substituted — raw template)
    stage_label_completed = next(x["label"] for x in wf["stages"] if x["key"] == "completed")
    assert stage_label_completed == "{nama} - Lunas Penuh ✓"
    stage_label_order = next(x["label"] for x in wf["stages"] if x["key"] == "order_received")
    assert stage_label_order == "Pesanan Diterima!"

    # cleanup booking
    requests.post(f"{API}/bookings/{bid}/cancel", headers=_h(super_tok), timeout=10)


# ---------- restore defaults ----------
def test_restore_defaults(tokens):
    super_tok = tokens["super"]
    # Fetch defaults then PUT them all back
    g = requests.get(f"{API}/workflow/labels", headers=_h(super_tok), timeout=10).json()
    payload = {x["key"]: x["default"] for x in g}
    r = requests.put(f"{API}/workflow/labels", headers=_h(super_tok), json=payload, timeout=10)
    assert r.status_code == 200
    after = {x["key"]: x["label"] for x in r.json()}
    assert after["order_received"] == "Order Received!"
    assert after["completed"] == "{nama} - Paid in Full"
