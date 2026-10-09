"""Iteration 8 backend tests — Daily checklist + Workflow stages.

Covers:
- Login + role tokens
- POST /api/bookings/{id}/stage: order enforcement + role permissions + complete-order paid-in-full
- finish_session sets edit_deadline = +3 working days (skip Sunday)
- Payment on order_received transitions to payment_received
- POST /api/bookings/{id}/addons: only in awaiting_final/addon, raises price, sets stage=addon
- GET /api/workflow admin only (403 for photographer/editor)
- GET /api/attendance/late-today admin only
- GET /api/checklist/today per role, POST increment/complete (complete rejected for target>1)
- GET /api/reports/checklist
- GET/POST/DELETE /api/task-templates (POST/DELETE super admin only)
"""
import os
import datetime as dt
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

PINS = {
    "super_admin": "123456",
    "admin1": "111111",
    "admin2": "222222",
    "photographer": "333333",
    "editor": "444444",
}


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def users():
    r = requests.get(f"{API}/auth/users", timeout=20)
    assert r.status_code == 200, r.text
    out = {u["sub_role"]: u for u in r.json()}
    for k in PINS:
        assert k in out, f"missing seeded user with sub_role {k}: got {list(out)}"
    return out


def _login(user, pin):
    r = requests.post(f"{API}/auth/login", json={"user_id": user["id"], "pin": pin}, timeout=20)
    assert r.status_code == 200, f"login failed for {user['name']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def tokens(users):
    return {k: _login(users[k], PINS[k]) for k in PINS}


def H(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- helpers ----------------
def _wib_today():
    return (dt.datetime.utcnow() + dt.timedelta(hours=7)).strftime("%Y-%m-%d")


def _future_date(days=14):
    d = dt.datetime.utcnow() + dt.timedelta(hours=7) + dt.timedelta(days=days)
    # avoid Sundays just in case
    if d.weekday() == 6:
        d += dt.timedelta(days=1)
    return d.strftime("%Y-%m-%d")


def _pick_package(tok, min_price=None):
    r = requests.get(f"{API}/packages", headers=H(tok), timeout=20)
    assert r.status_code == 200, r.text
    pks = [p for p in r.json() if p.get("active", True)]
    assert pks
    pks.sort(key=lambda p: p["price"])
    return pks[0] if min_price is None else next(p for p in pks if p["price"] >= min_price)


def _pick_slot(tok, date, pkg):
    r = requests.get(f"{API}/public/slots", params={"date": date, "package_id": pkg["id"]}, timeout=20)
    assert r.status_code == 200, r.text
    free = [s for s in r.json() if s.get("available")]
    assert free, f"no free slots on {date}"
    # pick a slot later in the day to avoid conflicts (per prior iteration advice)
    return free[-1]["time"]


def _create_booking(tok, date=None, prefix="TEST_IT8", photographer_id=None, editor_id=None):
    date = date or _future_date()
    pkg = _pick_package(tok)
    t = _pick_slot(tok, date, pkg)
    body = {
        "client_name": f"{prefix}_{os.urandom(3).hex()}",
        "client_phone": "081200001111",
        "date": date,
        "start_time": t,
        "package_id": pkg["id"],
        "photographer_id": photographer_id,
        "editor_id": editor_id,
    }
    r = requests.post(f"{API}/bookings", headers=H(tok), json=body, timeout=20)
    assert r.status_code == 200, f"create booking: {r.status_code} {r.text}"
    bk = r.json()
    bk["_price"] = pkg["price"]
    return bk


def _stage(tok, bid, action, expect=200):
    r = requests.post(f"{API}/bookings/{bid}/stage", headers=H(tok), json={"action": action}, timeout=20)
    assert r.status_code == expect, f"stage {action} expected {expect} got {r.status_code}: {r.text}"
    return r.json() if r.ok else r


def _pay(tok, bid, amount, typ="dp"):
    r = requests.post(f"{API}/bookings/{bid}/payments", headers=H(tok),
                      json={"amount": amount, "method": "cash", "type": typ, "note": ""}, timeout=20)
    assert r.status_code == 200, f"payment: {r.status_code} {r.text}"
    return r.json()


def _get_booking(tok, bid):
    r = requests.get(f"{API}/bookings/{bid}", headers=H(tok), timeout=20)
    assert r.status_code == 200
    return r.json()


# ---------------- cleanup ----------------
CREATED = []


@pytest.fixture(scope="session", autouse=True)
def cleanup(tokens):
    yield
    tok = tokens["super_admin"]
    for bid in CREATED:
        try:
            requests.post(f"{API}/bookings/{bid}/cancel", headers=H(tok), timeout=10)
        except Exception:
            pass


# ============== TESTS ==============

# ---- auth / baseline ----
class TestAuth:
    def test_login_all_roles(self, tokens):
        assert all(tokens.values())


# ---- stage transitions + roles ----
class TestStageTransitions:
    def test_full_happy_path(self, tokens):
        tok_admin = tokens["admin1"]
        bk = _create_booking(tok_admin)
        bid = bk["id"]
        CREATED.append(bid)
        price = bk["_price"]

        # 1) order_received -> check_schedule
        r = _stage(tok_admin, bid, "check_schedule")
        assert r["stage"] == "check_schedule"

        # 2) check_schedule -> client_arrived
        r = _stage(tok_admin, bid, "client_arrived")
        assert r["stage"] == "client_arrived"

        # 3) start_session must be photographer; admin should also be allowed (eff_perms booking)
        r = _stage(tokens["photographer"], bid, "start_session")
        assert r["stage"] == "photo_session"

        # 4) finish_session -> editing, sets edit_deadline +3 working days skipping Sunday
        r = _stage(tokens["photographer"], bid, "finish_session")
        assert r["stage"] == "editing"
        assert r.get("edit_received_date") and r.get("edit_deadline")
        rec = dt.datetime.strptime(r["edit_received_date"], "%Y-%m-%d")
        due = dt.datetime.strptime(r["edit_deadline"], "%Y-%m-%d")
        # count working days (skipping Sundays) between rec+1 and due inclusive
        working = 0
        cur = rec
        while cur < due:
            cur += dt.timedelta(days=1)
            if cur.weekday() != 6:
                working += 1
        assert working == 3, f"edit_deadline should be +3 working days from {rec.date()} -> {due.date()}, got {working}"

        # 5) finish_editing -> awaiting_final (editor)
        r = _stage(tokens["editor"], bid, "finish_editing")
        assert r["stage"] == "awaiting_final"

        # 6) complete_order requires paid-in-full
        r = requests.post(f"{API}/bookings/{bid}/stage", headers=H(tok_admin), json={"action": "complete_order"}, timeout=20)
        assert r.status_code == 400, f"should reject unpaid: {r.status_code} {r.text}"

        # pay DP + pelunasan to reach price
        _pay(tok_admin, bid, price * 0.3, "dp")
        _pay(tok_admin, bid, price - price * 0.3, "pelunasan")

        # 7) now complete_order works -> label = "<client> - Paid in Full"
        r = _stage(tok_admin, bid, "complete_order")
        assert r["stage"] == "completed"
        assert r["stage_label"].endswith("- Paid in Full"), r["stage_label"]
        assert bk["client_name"] in r["stage_label"]

    def test_order_enforcement_cannot_skip(self, tokens):
        tok = tokens["admin1"]
        bk = _create_booking(tok)
        CREATED.append(bk["id"])
        # cannot start_session before client_arrived
        r = requests.post(f"{API}/bookings/{bk['id']}/stage", headers=H(tokens["photographer"]),
                          json={"action": "start_session"}, timeout=20)
        assert r.status_code == 400
        # cannot finish_editing before editing stage
        r = requests.post(f"{API}/bookings/{bk['id']}/stage", headers=H(tokens["editor"]),
                          json={"action": "finish_editing"}, timeout=20)
        assert r.status_code == 400

    def test_role_permissions(self, tokens):
        tok = tokens["admin1"]
        bk = _create_booking(tok)
        bid = bk["id"]
        CREATED.append(bid)
        # photographer cannot do admin step check_schedule
        r = requests.post(f"{API}/bookings/{bid}/stage", headers=H(tokens["photographer"]),
                          json={"action": "check_schedule"}, timeout=20)
        assert r.status_code == 403, f"photographer should not do admin stage: {r.status_code} {r.text}"
        # editor cannot start session
        _stage(tok, bid, "client_arrived")
        r = requests.post(f"{API}/bookings/{bid}/stage", headers=H(tokens["editor"]),
                          json={"action": "start_session"}, timeout=20)
        assert r.status_code == 403, f"editor should not start session: {r.status_code} {r.text}"


# ---- payment -> stage transition ----
class TestPaymentStage:
    def test_payment_on_order_received_advances_stage(self, tokens):
        tok = tokens["admin1"]
        bk = _create_booking(tok)
        bid = bk["id"]
        CREATED.append(bid)
        assert _get_booking(tok, bid)["stage"] == "order_received"
        _pay(tok, bid, bk["_price"] * 0.3, "dp")
        got = _get_booking(tok, bid)
        assert got["stage"] == "payment_received", got


# ---- addon ----
class TestAddon:
    def test_addon_only_after_editing(self, tokens):
        tok = tokens["admin1"]
        bk = _create_booking(tok)
        bid = bk["id"]
        CREATED.append(bid)
        # not allowed in order_received
        r = requests.post(f"{API}/bookings/{bid}/addons", headers=H(tok),
                          json={"name": "Extra print", "price": 50000}, timeout=20)
        assert r.status_code == 400, r.text

        # advance to awaiting_final
        _stage(tok, bid, "client_arrived")
        _stage(tokens["photographer"], bid, "start_session")
        _stage(tokens["photographer"], bid, "finish_session")
        _stage(tokens["editor"], bid, "finish_editing")

        old_price = bk["_price"]
        r = requests.post(f"{API}/bookings/{bid}/addons", headers=H(tok),
                          json={"name": "Frame kayu", "price": 75000}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["stage"] == "addon"
        assert abs(body["price"] - (old_price + 75000)) < 0.01, body


# ---- workflow access ----
class TestWorkflowAccess:
    def test_workflow_admin_ok(self, tokens):
        r = requests.get(f"{API}/workflow", headers=H(tokens["admin1"]), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert "stages" in j and "items" in j
        assert {s["key"] for s in j["stages"]} >= {
            "order_received", "payment_received", "check_schedule", "client_arrived",
            "photo_session", "editing", "awaiting_final", "addon", "completed"
        }

    def test_workflow_photographer_forbidden(self, tokens):
        r = requests.get(f"{API}/workflow", headers=H(tokens["photographer"]), timeout=20)
        assert r.status_code == 403

    def test_workflow_editor_forbidden(self, tokens):
        r = requests.get(f"{API}/workflow", headers=H(tokens["editor"]), timeout=20)
        assert r.status_code == 403


# ---- late-today ----
class TestLateToday:
    def test_admin_ok(self, tokens):
        r = requests.get(f"{API}/attendance/late-today", headers=H(tokens["admin1"]), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert "work_start" in j and "items" in j

    def test_photographer_forbidden(self, tokens):
        r = requests.get(f"{API}/attendance/late-today", headers=H(tokens["photographer"]), timeout=20)
        assert r.status_code == 403


# ---- checklist ----
class TestChecklist:
    def test_checklist_today_admin_has_tasks(self, tokens):
        r = requests.get(f"{API}/checklist/today", headers=H(tokens["admin1"]), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert "tasks" in j and "jobs" in j
        # 4 seeded admin tasks (Input booking harian/Follow up klien/Siapkan konten/Kirim broadcast)
        titles = [t["title"] for t in j["tasks"]]
        assert len(titles) >= 4, titles
        follow = next((t for t in j["tasks"] if "Follow up" in t["title"]), None)
        assert follow and follow["target"] == 10, follow

    def test_increment_follow_up_counter_to_complete(self, tokens):
        tok = tokens["admin2"]
        j = requests.get(f"{API}/checklist/today", headers=H(tok), timeout=20).json()
        follow = next(t for t in j["tasks"] if "Follow up" in t["title"])
        tid = follow["template_id"]
        # complete should be rejected because target>1
        r = requests.post(f"{API}/checklist/{tid}/complete", headers=H(tok), timeout=20)
        assert r.status_code == 400, r.text
        # if already partially incremented from prior runs, reset by seeing current count then increment to target
        cur = follow["count"]
        for _ in range(10 - cur):
            rr = requests.post(f"{API}/checklist/{tid}/increment", headers=H(tok), timeout=20)
            assert rr.status_code == 200, rr.text
        final = requests.get(f"{API}/checklist/today", headers=H(tok), timeout=20).json()
        f2 = next(t for t in final["tasks"] if "Follow up" in t["title"])
        assert f2["done"] is True and f2["count"] >= 10, f2

    def test_complete_single_target_task(self, tokens):
        tok = tokens["admin2"]
        j = requests.get(f"{API}/checklist/today", headers=H(tok), timeout=20).json()
        single = next(t for t in j["tasks"] if t["target"] == 1 and not t["done"])
        r = requests.post(f"{API}/checklist/{single['template_id']}/complete", headers=H(tok), timeout=20)
        assert r.status_code == 200, r.text
        got = next(t for t in r.json()["tasks"] if t["template_id"] == single["template_id"])
        assert got["done"] is True

    def test_photographer_has_no_templates_but_jobs(self, tokens):
        r = requests.get(f"{API}/checklist/today", headers=H(tokens["photographer"]), timeout=20)
        assert r.status_code == 200
        j = r.json()
        # photographer has no seeded templates by default
        assert isinstance(j["tasks"], list) and isinstance(j["jobs"], list)

    def test_checklist_report_admin_only(self, tokens):
        d = _wib_today()
        r = requests.get(f"{API}/reports/checklist", headers=H(tokens["admin1"]), params={"date": d}, timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert j["date"] == d and "staff" in j
        for s in j["staff"]:
            # must have note; either Great/Lalai/no tasks
            assert "note" in s and s["status"] in {"great", "lazy", "none"}
        # editor cannot access
        r = requests.get(f"{API}/reports/checklist", headers=H(tokens["editor"]), params={"date": d}, timeout=20)
        assert r.status_code == 403


# ---- task-templates ----
class TestTaskTemplates:
    def test_list_admin_ok(self, tokens):
        r = requests.get(f"{API}/task-templates", headers=H(tokens["admin1"]), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_post_super_only(self, tokens):
        payload = {"title": "TEST_IT8 task tmpl", "role": "photographer", "target": 1}
        # admin1 cannot create
        r = requests.post(f"{API}/task-templates", headers=H(tokens["admin1"]), json=payload, timeout=20)
        assert r.status_code == 403, r.text
        # super admin can
        r = requests.post(f"{API}/task-templates", headers=H(tokens["super_admin"]), json=payload, timeout=20)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        try:
            # photographer should now see this template
            j = requests.get(f"{API}/checklist/today", headers=H(tokens["photographer"]), timeout=20).json()
            assert any(t["template_id"] == tid for t in j["tasks"]), j
            # admin1 cannot delete
            d = requests.delete(f"{API}/task-templates/{tid}", headers=H(tokens["admin1"]), timeout=20)
            assert d.status_code == 403, d.text
        finally:
            # super admin deletes
            dd = requests.delete(f"{API}/task-templates/{tid}", headers=H(tokens["super_admin"]), timeout=20)
            assert dd.status_code == 200, dd.text
