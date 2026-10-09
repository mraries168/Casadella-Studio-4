"""Backend API tests for Casadella Photo Studio."""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone


def _wib_today():
    """Backend stores transaction.date in Asia/Jakarta (UTC+7). Use that for queries."""
    return (datetime.now(timezone.utc) + timedelta(hours=7)).strftime("%Y-%m-%d")

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://photo-studio-control.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

PINS = {
    "Super Admin": "123456",
    "Admin 1": "111111",
    "Admin 2": "222222",
    "Rina (Fotografer)": "333333",
    "Budi (Editor)": "444444",
}

# Map legacy test aliases -> sub_role (actual display names may differ in each env)
ALIAS_TO_SUBROLE = {
    "Super Admin": "super_admin",
    "Admin 1": "admin1",
    "Admin 2": "admin2",
    "Rina (Fotografer)": "photographer",
    "Budi (Editor)": "editor",
}


@pytest.fixture(scope="session")
def users_list():
    r = requests.get(f"{API}/auth/users", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list) and len(data) >= 5
    by_sub = {u["sub_role"]: u for u in data}
    # Expose both the actual display name AND the legacy alias as keys
    out = {u["name"]: u for u in data}
    for alias, sr in ALIAS_TO_SUBROLE.items():
        if sr in by_sub:
            out[alias] = by_sub[sr]
    return out


def _login(users_list, name):
    uid = users_list[name]["id"]
    r = requests.post(f"{API}/auth/login", json={"user_id": uid, "pin": PINS[name]}, timeout=15)
    assert r.status_code == 200, f"login failed for {name}: {r.text}"
    return r.json()["access_token"], r.json()["user"]


@pytest.fixture(scope="session")
def tokens(users_list):
    out = {}
    for n in PINS:
        tok, u = _login(users_list, n)
        out[n] = {"token": tok, "user": u, "headers": {"Authorization": f"Bearer {tok}"}}
    return out


# ---------- auth ----------
class TestAuth:
    def test_users_list_hides_pin(self, users_list):
        for u in users_list.values():
            assert "pin_hash" not in u
            assert "id" in u and "name" in u and "sub_role" in u

    def test_login_wrong_pin(self, users_list):
        uid = users_list["Admin 1"]["id"]
        r = requests.post(f"{API}/auth/login", json={"user_id": uid, "pin": "123456"})
        assert r.status_code == 401

    def test_me(self, tokens):
        r = requests.get(f"{API}/auth/me", headers=tokens["Admin 1"]["headers"])
        assert r.status_code == 200
        assert r.json()["sub_role"] == "admin1"
        assert r.json()["role"] == "admin"

    def test_me_no_auth(self):
        assert requests.get(f"{API}/auth/me").status_code == 401


# ---------- role enforcement ----------
class TestRoles:
    def test_staff_cannot_create_booking(self, tokens):
        r = requests.post(f"{API}/bookings", headers=tokens["Rina (Fotografer)"]["headers"],
                          json={"client_name": "X", "date": "2026-02-01", "start_time": "09:00",
                                "package_id": "000000000000000000000000"})
        assert r.status_code == 403

    def test_staff_cannot_create_tx(self, tokens):
        r = requests.post(f"{API}/transactions", headers=tokens["Budi (Editor)"]["headers"],
                          json={"type": "income", "category": "lainnya", "amount": 1000, "date": "2026-02-01"})
        assert r.status_code == 403

    def test_staff_cannot_create_package(self, tokens):
        r = requests.post(f"{API}/packages", headers=tokens["Rina (Fotografer)"]["headers"],
                          json={"name": "x", "duration_min": 15, "price": 1000})
        assert r.status_code == 403

    def test_admin_cannot_create_user(self, tokens):
        r = requests.post(f"{API}/users", headers=tokens["Admin 1"]["headers"],
                          json={"name": "TEST_x", "sub_role": "photographer", "pin": "123456"})
        assert r.status_code == 403

    def test_admin_cannot_update_settings(self, tokens):
        r = requests.put(f"{API}/settings", headers=tokens["Admin 1"]["headers"],
                         json={"studio_name": "x"})
        assert r.status_code == 403

    def test_super_admin_can_update_settings(self, tokens):
        r = requests.put(f"{API}/settings", headers=tokens["Super Admin"]["headers"],
                         json={"studio_name": "Casadella Photo Studio", "open_time": "09:00",
                               "close_time": "20:00", "slot_interval": 15, "default_dp_percent": 50})
        assert r.status_code == 200
        assert r.json()["studio_name"] == "Casadella Photo Studio"


# ---------- slots ----------
class TestSlots:
    def test_44_slots_and_unavailable_after_20(self, tokens):
        pkgs = requests.get(f"{API}/packages", headers=tokens["Admin 1"]["headers"]).json()
        p60 = next(p for p in pkgs if p["duration_min"] == 60)
        future = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
        r = requests.get(f"{API}/slots", params={"date": future, "package_id": p60["id"]},
                         headers=tokens["Admin 1"]["headers"])
        assert r.status_code == 200
        slots = r.json()
        assert len(slots) == 44, f"expected 44 got {len(slots)}"
        assert slots[0]["time"] == "09:00"
        assert slots[-1]["time"] == "19:45"
        # 60-min package starting at 19:15 -> ends 20:15 -> unavailable
        s_1915 = next(s for s in slots if s["time"] == "19:15")
        assert s_1915["available"] is False


# ---------- bookings & payments ----------
class TestBookingsAndPayments:
    booking_id = None
    pkg_id = None

    def test_create_booking_overlap_and_cancel(self, tokens):
        pkgs = requests.get(f"{API}/packages", headers=tokens["Admin 1"]["headers"]).json()
        pkg = next(p for p in pkgs if p["duration_min"] == 30)
        TestBookingsAndPayments.pkg_id = pkg["id"]
        users = requests.get(f"{API}/users", headers=tokens["Admin 1"]["headers"],
                             params={"sub_role": "photographer"}).json()
        photo_id = users[0]["id"] if users else None
        future = (datetime.now(timezone.utc) + timedelta(days=45)).strftime("%Y-%m-%d")

        payload = {"client_name": "TEST_Client", "client_phone": "0812", "date": future,
                   "start_time": "10:00", "package_id": pkg["id"], "photographer_id": photo_id,
                   "notes": "test"}
        r = requests.post(f"{API}/bookings", headers=tokens["Admin 1"]["headers"], json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["end_time"] == "10:30"
        assert b["payment_status"] == "belum_bayar"
        assert b["price"] == pkg["price"]
        if photo_id:
            assert b["photographer_name"]
        TestBookingsAndPayments.booking_id = b["id"]

        # overlap -> 409
        r2 = requests.post(f"{API}/bookings", headers=tokens["Admin 1"]["headers"],
                           json={**payload, "start_time": "10:15"})
        assert r2.status_code == 409

    def test_dp_then_pelunasan(self, tokens):
        bid = TestBookingsAndPayments.booking_id
        assert bid
        # DP 100000
        r = requests.post(f"{API}/bookings/{bid}/payments", headers=tokens["Admin 1"]["headers"],
                          json={"amount": 100000, "method": "cash", "type": "dp"})
        assert r.status_code == 200
        assert r.json()["payment_status"] == "dp"
        # overpay
        r2 = requests.post(f"{API}/bookings/{bid}/payments", headers=tokens["Admin 1"]["headers"],
                           json={"amount": 1234569, "method": "cash", "type": "pelunasan"})
        assert r2.status_code == 400
        # pelunasan remaining
        remaining = 250000 - 100000
        r3 = requests.post(f"{API}/bookings/{bid}/payments", headers=tokens["Admin 1"]["headers"],
                           json={"amount": remaining, "method": "transfer", "type": "pelunasan"})
        assert r3.status_code == 200
        assert r3.json()["payment_status"] == "lunas"
        assert r3.json()["paid_total"] == 250000

        # verify POS income tx auto-created
        today = _wib_today()
        txs = requests.get(f"{API}/transactions", headers=tokens["Admin 1"]["headers"],
                           params={"start": today, "end": today}).json()
        booking_txs = [t for t in txs if t.get("booking_id") == bid]
        assert len(booking_txs) >= 2
        assert sum(t["amount"] for t in booking_txs) == 250000

    def test_cancel_booking(self, tokens):
        bid = TestBookingsAndPayments.booking_id
        r = requests.post(f"{API}/bookings/{bid}/cancel", headers=tokens["Admin 1"]["headers"])
        assert r.status_code == 200
        assert r.json()["ok"] is True
        # Booking should be removed from DB
        r2 = requests.get(f"{API}/bookings/{bid}", headers=tokens["Admin 1"]["headers"])
        assert r2.status_code == 404

    def test_cancel_deletes_transactions_and_updates_report(self, tokens):
        # Create a fresh booking + DP, then cancel and verify tx removed from report
        pkgs = requests.get(f"{API}/packages", headers=tokens["Admin 1"]["headers"]).json()
        pkg = next(p for p in pkgs if p["duration_min"] == 30)
        future = (datetime.now(timezone.utc) + timedelta(days=60)).strftime("%Y-%m-%d")
        payload = {"client_name": "TEST_CancelCascade", "client_phone": "0812",
                   "date": future, "start_time": "11:00", "package_id": pkg["id"]}
        rb = requests.post(f"{API}/bookings", headers=tokens["Admin 1"]["headers"], json=payload)
        assert rb.status_code == 200
        bid = rb.json()["id"]
        # DP
        rp = requests.post(f"{API}/bookings/{bid}/payments", headers=tokens["Admin 1"]["headers"],
                           json={"amount": 50000, "method": "cash", "type": "dp"})
        assert rp.status_code == 200
        today = _wib_today()
        rep_before = requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                                   params={"period": "daily", "date": today}).json()
        # Cancel -> deletes booking + transactions
        rc = requests.post(f"{API}/bookings/{bid}/cancel", headers=tokens["Admin 1"]["headers"])
        assert rc.status_code == 200
        assert rc.json()["ok"] is True
        assert rc.json()["deleted_transactions"] >= 1
        # Verify tx with this booking_id is gone
        txs = requests.get(f"{API}/transactions", headers=tokens["Admin 1"]["headers"],
                           params={"start": today, "end": today}).json()
        assert not any(t.get("booking_id") == bid for t in txs)
        rep_after = requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                                  params={"period": "daily", "date": today}).json()
        assert rep_after["revenue"] == rep_before["revenue"] - 50000


# ---------- POS ----------
class TestPOS:
    tx_ids = []

    def test_create_expenses_and_report(self, tokens):
        today = _wib_today()
        for cat, amt in [("operasional", 50000), ("sewa", 200000)]:
            r = requests.post(f"{API}/transactions", headers=tokens["Admin 1"]["headers"],
                              json={"type": "expense", "category": cat, "amount": amt,
                                    "method": "cash", "description": f"TEST_{cat}", "date": today})
            assert r.status_code == 200
            TestPOS.tx_ids.append(r.json()["id"])

        r = requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                        params={"period": "daily", "date": today})
        assert r.status_code == 200
        rep = r.json()
        assert rep["net_income"] == rep["revenue"] - rep["expenses"]
        assert rep["expenses"] == rep["operational"] + rep["rental"]
        assert rep["operational"] >= 50000
        assert rep["rental"] >= 200000

    def test_admin_cannot_delete_tx(self, tokens):
        # New requirement: Only super admin can delete transactions
        if not TestPOS.tx_ids:
            pytest.skip("no tx")
        r = requests.delete(f"{API}/transactions/{TestPOS.tx_ids[0]}",
                            headers=tokens["Admin 1"]["headers"])
        assert r.status_code == 403, f"admin should get 403 for tx delete, got {r.status_code}"

    def test_staff_cannot_read_tx_or_report(self, tokens):
        today = _wib_today()
        h = tokens["Rina (Fotografer)"]["headers"]
        r1 = requests.get(f"{API}/transactions", headers=h, params={"start": today, "end": today})
        assert r1.status_code == 403
        r2 = requests.get(f"{API}/reports", headers=h, params={"period": "daily", "date": today})
        assert r2.status_code == 403

    def test_super_admin_can_delete_tx_cleanup(self, tokens):
        # Cleanup created test tx via super admin per new rule
        for tid in TestPOS.tx_ids:
            r = requests.delete(f"{API}/transactions/{tid}", headers=tokens["Super Admin"]["headers"])
            assert r.status_code == 200


# ---------- attendance ----------
class TestAttendance:
    def test_clock_in_out_duplicate(self, tokens):
        # Use Budi (Editor) to avoid interfering with other tests
        h = tokens["Budi (Editor)"]["headers"]
        # Geofence is enabled by default -> must send in-radius lat/lng
        loc = {"lat": -10.159000, "lng": 123.605600}
        r1 = requests.post(f"{API}/attendance/clock-in", headers=h, json=loc)
        # First call might be 200 or 400 if already clocked-in today
        assert r1.status_code in (200, 400)
        # Duplicate clock-in
        r2 = requests.post(f"{API}/attendance/clock-in", headers=h, json=loc)
        assert r2.status_code == 400
        # Clock-out should succeed if not yet done; else 400
        r3 = requests.post(f"{API}/attendance/clock-out", headers=h, json=loc)
        assert r3.status_code in (200, 400)
        # Duplicate clock-out
        r4 = requests.post(f"{API}/attendance/clock-out", headers=h, json=loc)
        assert r4.status_code == 400


# ---------- users CRUD by super admin ----------
class TestUsersCRUD:
    created_id = None

    def test_create_photographer(self, tokens):
        r = requests.post(f"{API}/users", headers=tokens["Super Admin"]["headers"],
                          json={"name": "TEST_Photo", "sub_role": "photographer", "pin": "555555"})
        assert r.status_code == 200
        TestUsersCRUD.created_id = r.json()["id"]
        assert r.json()["role"] == "staff"

        # verify appears in users listing
        r2 = requests.get(f"{API}/users", headers=tokens["Admin 1"]["headers"],
                          params={"sub_role": "photographer"})
        assert any(u["id"] == TestUsersCRUD.created_id for u in r2.json())

    def test_delete_photographer(self, tokens):
        r = requests.delete(f"{API}/users/{TestUsersCRUD.created_id}",
                            headers=tokens["Super Admin"]["headers"])
        assert r.status_code == 200
