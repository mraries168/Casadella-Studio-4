"""Iteration 11: Admin/Super Admin can CRUD clients without booking + audit."""
import os
import time
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://casadella-studio-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

PINS = {"Super Admin": "123456", "Admin 1": "111111", "Rina (Fotografer)": "333333"}


def _login(name):
    users = requests.get(f"{API}/auth/users").json()
    u = next(x for x in users if x["name"] == name)
    r = requests.post(f"{API}/auth/login", json={"user_id": u["id"], "pin": PINS[name]})
    assert r.status_code == 200, (name, r.text)
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def super_tok():
    return _login("Super Admin")


@pytest.fixture(scope="module")
def admin_tok():
    return _login("Admin 1")


@pytest.fixture(scope="module")
def staff_tok():
    return _login("Rina (Fotografer)")


def H(t):
    return {"Authorization": f"Bearer {t}"}


SUFFIX = str(int(time.time()))[-6:]


def test_staff_cannot_create_client(staff_tok):
    r = requests.post(f"{API}/clients", headers=H(staff_tok), json={"name": f"TEST_Staff_{SUFFIX}", "phone": "081200000000"})
    assert r.status_code == 403


def test_admin_create_client(admin_tok):
    name = f"TEST_Manual_{SUFFIX}"
    phone = f"08120999{SUFFIX}"
    r = requests.post(f"{API}/clients", headers=H(admin_tok),
                      json={"name": name, "phone": phone, "instagram": "@test", "address": "Jl Test", "notes": "note"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == name
    assert data["manual"] is True
    assert data["total_bookings"] == 0
    assert data["instagram"] == "@test"
    # Appears in /clients
    lst = requests.get(f"{API}/clients", headers=H(admin_tok)).json()
    assert any(c["key"] == data["key"] and c.get("manual") for c in lst)
    pytest.manual_key = data["key"]
    pytest.manual_name = name
    pytest.manual_phone = phone


def test_duplicate_phone_normalized(admin_tok):
    name = pytest.manual_name
    phone = pytest.manual_phone  # starts 0812...
    alt_phone = "62" + phone[1:]  # 62812...
    r = requests.post(f"{API}/clients", headers=H(admin_tok),
                      json={"name": f"TEST_Dup_{SUFFIX}", "phone": alt_phone})
    assert r.status_code == 409, r.text


def test_update_client_phone_changes_key(admin_tok):
    old_key = pytest.manual_key
    new_phone = f"08120888{SUFFIX}"
    r = requests.put(f"{API}/clients/{old_key}", headers=H(admin_tok),
                     json={"name": pytest.manual_name, "phone": new_phone, "instagram": "@upd", "address": "", "notes": ""})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["key"] != old_key
    # old key gone
    assert requests.get(f"{API}/clients/{old_key}", headers=H(admin_tok)).status_code == 404
    assert requests.get(f"{API}/clients/{data['key']}", headers=H(admin_tok)).status_code == 200
    pytest.manual_key = data["key"]
    pytest.manual_phone = new_phone


def test_update_unknown_key(admin_tok):
    r = requests.put(f"{API}/clients/doesnotexist_999", headers=H(admin_tok),
                     json={"name": "TEST_X", "phone": "0810000"})
    assert r.status_code == 404


def test_update_collision(admin_tok):
    # create a 2nd client
    name2 = f"TEST_Collide_{SUFFIX}"
    phone2 = f"08121111{SUFFIX}"
    r = requests.post(f"{API}/clients", headers=H(admin_tok), json={"name": name2, "phone": phone2})
    assert r.status_code == 200
    k2 = r.json()["key"]
    # try to rename k2 to use first client's phone
    r = requests.put(f"{API}/clients/{k2}", headers=H(admin_tok),
                     json={"name": name2, "phone": pytest.manual_phone})
    assert r.status_code == 409


def test_booking_derived_client_edit_propagates(admin_tok):
    # create a booking (unique client)
    cname = f"TEST_Bk_{SUFFIX}"
    cphone = f"08127777{SUFFIX}"
    # Need a package id - fetch packages
    pkgs = requests.get(f"{API}/packages", headers=H(admin_tok)).json()
    pkg = pkgs[0]
    r = requests.post(f"{API}/bookings", headers=H(admin_tok), json={
        "client_name": cname, "client_phone": cphone, "package_id": pkg["id"],
        "date": "2027-03-15", "start_time": "10:00", "payment_method": "cash"
    })
    assert r.status_code in (200, 201), r.text
    bid = r.json()["id"]
    bkey = r.json()["id"] if False else None  # just placeholder
    # find derived client key
    lst = requests.get(f"{API}/clients", headers=H(admin_tok)).json()
    derived = next(c for c in lst if c["name"] == cname)
    old_key = derived["key"]
    assert derived["total_bookings"] >= 1
    # edit this client
    new_name = f"TEST_Bk_RENAMED_{SUFFIX}"
    new_phone = f"08127776{SUFFIX}"
    r = requests.put(f"{API}/clients/{old_key}", headers=H(admin_tok),
                     json={"name": new_name, "phone": new_phone})
    assert r.status_code == 200
    new_key = r.json()["key"]
    # fetch booking: should have updated client_name/phone
    b = requests.get(f"{API}/bookings/{bid}", headers=H(admin_tok)).json()
    assert b["client_name"] == new_name
    assert b["client_phone"] == new_phone
    # client detail still has that booking in history
    cd = requests.get(f"{API}/clients/{new_key}", headers=H(admin_tok)).json()
    assert any(bb["id"] == bid for bb in cd["bookings"])
    # cleanup -> cancel booking
    requests.post(f"{API}/bookings/{bid}/cancel", headers=H(admin_tok), json={"reason": "test cleanup"})


def test_audit_log_client(super_tok):
    r = requests.get(f"{API}/audit?entity=client", headers=H(super_tok))
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    actions = {i["action"] for i in items}
    assert "create" in actions
    assert "update" in actions
    # check an update has changes diff
    upd = next((i for i in items if i["action"] == "update" and i.get("changes")), None)
    assert upd is not None
    assert all("field" in c and "from" in c and "to" in c for c in upd["changes"])


def test_export_still_works(admin_tok):
    r = requests.get(f"{API}/clients/export?format=pdf", headers=H(admin_tok))
    assert r.status_code == 200 and r.headers.get("content-type", "").startswith("application/pdf")
    r = requests.get(f"{API}/clients/export?format=xlsx", headers=H(admin_tok))
    assert r.status_code == 200
