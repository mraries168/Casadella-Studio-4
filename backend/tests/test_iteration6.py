"""Iteration 6 backend tests:
Covers public booking link, approve/reject flow, pending exclusion from turnover,
audit log, auto-rent transaction, geofenced attendance, extended payroll (overrides + kasbon/denda),
and admin WA number setting.
"""
import os
import re
from datetime import datetime, timedelta, timezone

import pytest
import requests


def _wib_today():
    return (datetime.now(timezone.utc) + timedelta(hours=7)).strftime("%Y-%m-%d")


BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://casadella-studio.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

PINS = {"Super Admin": "123456", "Admin 1": "111111", "Admin 2": "222222",
        "Rina (Fotografer)": "333333", "Budi (Editor)": "444444"}
ALIAS_TO_SUBROLE = {"Super Admin": "super_admin", "Admin 1": "admin1", "Admin 2": "admin2",
                    "Rina (Fotografer)": "photographer", "Budi (Editor)": "editor"}


@pytest.fixture(scope="session")
def users_list():
    r = requests.get(f"{API}/auth/users", timeout=15)
    assert r.status_code == 200
    data = r.json()
    by_sub = {u["sub_role"]: u for u in data}
    out = {u["name"]: u for u in data}
    for alias, sr in ALIAS_TO_SUBROLE.items():
        if sr in by_sub:
            out[alias] = by_sub[sr]
    return out


def _put_settings(headers, patch):
    """SettingsIn requires studio_name — merge patch over current settings."""
    cur = requests.get(f"{API}/settings", headers=headers).json()
    cur.pop("_id", None)
    cur.pop("key", None)
    cur.update(patch)
    r = requests.put(f"{API}/settings", headers=headers, json=cur)
    assert r.status_code == 200, f"settings PUT failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def tokens(users_list):
    out = {}
    for n in PINS:
        uid = users_list[n]["id"]
        r = requests.post(f"{API}/auth/login", json={"user_id": uid, "pin": PINS[n]}, timeout=15)
        assert r.status_code == 200, f"login failed for {n}"
        d = r.json()
        out[n] = {"token": d["access_token"], "user": d["user"],
                  "headers": {"Authorization": f"Bearer {d['access_token']}"}}
    return out


# ---------------- Public endpoints ----------------
class TestPublicEndpoints:
    def test_public_info_no_auth(self):
        r = requests.get(f"{API}/public/info", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "packages" in d and isinstance(d["packages"], list) and len(d["packages"]) >= 1
        assert "studio_name" in d and "open_time" in d and "close_time" in d and "today" in d
        p = d["packages"][0]
        for k in ("id", "name", "duration_min", "price"):
            assert k in p

    def test_public_slots_no_auth_and_past_today(self):
        info = requests.get(f"{API}/public/info").json()
        pkg = info["packages"][0]
        today = info["today"]
        r = requests.get(f"{API}/public/slots", params={"date": today, "package_id": pkg["id"]})
        assert r.status_code == 200
        slots = r.json()
        assert isinstance(slots, list) and len(slots) > 0
        # Past times today should be unavailable
        now_wib = (datetime.now(timezone.utc) + timedelta(hours=7)).strftime("%H:%M")
        for s in slots:
            if s["time"] < now_wib:
                assert s["available"] is False, f"past slot {s['time']} should be unavailable (now {now_wib})"

    def test_public_logo_served(self):
        r = requests.get(f"{API}/public/logo")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")

    def test_booking_html_page(self):
        r = requests.get(f"{BASE}/api/book")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "").lower()
        assert len(r.text) > 100

    def test_public_create_booking_past_date_rejected(self):
        info = requests.get(f"{API}/public/info").json()
        pkg = info["packages"][0]
        past = (datetime.now(timezone.utc) - timedelta(days=5)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/public/bookings", json={
            "client_name": "TEST_PastDate", "client_phone": "081200000001",
            "date": past, "start_time": "10:00", "package_id": pkg["id"]})
        assert r.status_code in (400, 409, 422), r.text

    created_pending_id = None

    def test_public_create_booking_success_and_double_booking_409(self, tokens):
        info = requests.get(f"{API}/public/info").json()
        pkg = next(p for p in info["packages"] if p["duration_min"] == 30)
        # Use a far-future date unique to this run to avoid collisions with prior runs
        future_dt = datetime.now(timezone.utc) + timedelta(days=90)
        future = future_dt.strftime("%Y-%m-%d")
        # Find an available slot in the morning (first available)
        slots = requests.get(f"{API}/public/slots",
                             params={"date": future, "package_id": pkg["id"]}).json()
        start = next(s["time"] for s in slots if s["available"])
        payload = {"client_name": "TEST_Public", "client_phone": "081200000002",
                   "date": future, "start_time": start, "package_id": pkg["id"],
                   "notes": "online test"}
        r = requests.post(f"{API}/public/bookings", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending"
        assert d["package_name"] == pkg["name"]
        TestPublicEndpoints.created_pending_id = d["id"]

        # Same slot -> 409
        r2 = requests.post(f"{API}/public/bookings", json=payload)
        assert r2.status_code == 409

        # Cleanup via super admin cancel
        requests.post(f"{API}/bookings/{d['id']}/cancel",
                      headers=tokens["Super Admin"]["headers"])


# ---------------- Approve / Reject ----------------
class TestApproveReject:
    def test_list_pending_and_approve(self, tokens):
        # Create our own pending (loadscope xdist runs classes on separate workers; can't share state)
        info = requests.get(f"{API}/public/info").json()
        pkg = next(p for p in info["packages"] if p["duration_min"] == 30)
        future = (datetime.now(timezone.utc) + timedelta(days=22)).strftime("%Y-%m-%d")
        rc = requests.post(f"{API}/public/bookings", json={
            "client_name": "TEST_ApprovePending", "client_phone": "081200000010",
            "date": future, "start_time": "15:00", "package_id": pkg["id"]})
        assert rc.status_code == 200
        pid = rc.json()["id"]
        assert rc.json()["status"] == "pending"

        # Staff cannot approve
        rs = requests.post(f"{API}/bookings/{pid}/approve", headers=tokens["Rina (Fotografer)"]["headers"])
        assert rs.status_code == 403

        # Admin can list pending
        r = requests.get(f"{API}/bookings", headers=tokens["Admin 1"]["headers"], params={"status": "pending"})
        assert r.status_code == 200
        assert any(b["id"] == pid for b in r.json())

        # Reports exclude pending from turnover
        today = _wib_today()
        rep = requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                           params={"period": "monthly", "date": today}).json()
        turnover_before = rep["turnover"]

        # Approve
        ra = requests.post(f"{API}/bookings/{pid}/approve", headers=tokens["Admin 1"]["headers"])
        assert ra.status_code == 200
        got = requests.get(f"{API}/bookings/{pid}", headers=tokens["Admin 1"]["headers"]).json()
        assert got["status"] == "confirmed"

        rep2 = requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                            params={"period": "monthly", "date": today}).json()
        # Turnover should include this booking now (price added)
        assert rep2["turnover"] >= turnover_before + got["price"] - 1

        # Cleanup
        requests.post(f"{API}/bookings/{pid}/cancel", headers=tokens["Super Admin"]["headers"])

    def test_reject_deletes_booking_and_frees_slot(self, tokens):
        # Create a fresh pending via public
        info = requests.get(f"{API}/public/info").json()
        pkg = next(p for p in info["packages"] if p["duration_min"] == 30)
        future = (datetime.now(timezone.utc) + timedelta(days=25)).strftime("%Y-%m-%d")
        payload = {"client_name": "TEST_Reject", "client_phone": "081200000003",
                   "date": future, "start_time": "14:00", "package_id": pkg["id"]}
        r = requests.post(f"{API}/public/bookings", json=payload)
        assert r.status_code == 200
        bid = r.json()["id"]

        # Reject (admin)
        rr = requests.post(f"{API}/bookings/{bid}/reject", headers=tokens["Admin 1"]["headers"])
        assert rr.status_code == 200

        # Booking deleted
        g = requests.get(f"{API}/bookings/{bid}", headers=tokens["Admin 1"]["headers"])
        assert g.status_code == 404

        # Slot available again
        slots = requests.get(f"{API}/public/slots",
                             params={"date": future, "package_id": pkg["id"]}).json()
        s = next(x for x in slots if x["time"] == "14:00")
        assert s["available"] is True


# ---------------- Audit log ----------------
class TestAudit:
    def test_super_only_and_entries(self, tokens):
        # Admin forbidden
        ra = requests.get(f"{API}/audit", headers=tokens["Admin 1"]["headers"])
        assert ra.status_code == 403

        # Super admin allowed
        r = requests.get(f"{API}/audit", headers=tokens["Super Admin"]["headers"])
        assert r.status_code == 200
        logs = r.json()
        assert isinstance(logs, list)

        # Filter by entity
        for ent in ("booking", "payment", "package"):
            rr = requests.get(f"{API}/audit", headers=tokens["Super Admin"]["headers"],
                              params={"entity": ent})
            assert rr.status_code == 200
            for d in rr.json():
                assert d["entity"] == ent

        # Expect at least some booking entries from prior approve/reject
        bookings_logs = [l for l in logs if l["entity"] == "booking"]
        actions = {l["action"] for l in bookings_logs}
        assert actions, "no booking audit entries found"

    def test_package_price_update_creates_audit(self, tokens):
        # Fetch a package, update its price, verify audit entry
        pkgs = requests.get(f"{API}/packages", headers=tokens["Super Admin"]["headers"]).json()
        p = pkgs[0]
        orig = p["price"]
        new = orig + 1000
        up = requests.put(f"{API}/packages/{p['id']}", headers=tokens["Super Admin"]["headers"],
                          json={"name": p["name"], "duration_min": p["duration_min"], "price": new,
                                "description": p.get("description", ""), "active": p.get("active", True)})
        assert up.status_code == 200
        # Revert
        requests.put(f"{API}/packages/{p['id']}", headers=tokens["Super Admin"]["headers"],
                     json={"name": p["name"], "duration_min": p["duration_min"], "price": orig,
                           "description": p.get("description", ""), "active": p.get("active", True)})

        logs = requests.get(f"{API}/audit", headers=tokens["Super Admin"]["headers"],
                            params={"entity": "package"}).json()
        assert any(l["action"] == "update" and l["entity_id"] == p["id"] for l in logs)


# ---------------- Auto rent ----------------
class TestAutoRent:
    def test_rent_tx_present_once_this_month(self, tokens):
        # Ensure settings have rent_auto_enabled
        _put_settings(tokens["Super Admin"]["headers"],
                      {"rent_auto_enabled": True, "rent_amount": 2500000})
        # Trigger ensure_rent via GET /reports
        today = _wib_today()
        month = today[:7]
        requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                     params={"period": "monthly", "date": today})
        # Query transactions for YYYY-MM-01 and look for description
        start = f"{month}-01"
        end = f"{month}-01"
        txs = requests.get(f"{API}/transactions", headers=tokens["Admin 1"]["headers"],
                           params={"start": start, "end": end}).json()
        rent = [t for t in txs if t.get("category") == "sewa"
                and t.get("auto_rent") == month]
        assert len(rent) == 1, f"expected 1 auto-rent tx, got {len(rent)}: {rent}"
        assert rent[0]["amount"] == 2500000
        assert "otomatis" in rent[0].get("description", "").lower()

        # Call reports again -> still just 1 (idempotent via rent_runs collection)
        requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                     params={"period": "monthly", "date": today})
        txs2 = requests.get(f"{API}/transactions", headers=tokens["Admin 1"]["headers"],
                            params={"start": start, "end": end}).json()
        rent2 = [t for t in txs2 if t.get("category") == "sewa" and t.get("auto_rent") == month]
        assert len(rent2) == 1, "auto rent duplicated!"

    def test_settings_fields_persist(self, tokens):
        # Toggle rent_auto_enabled off then back on, verify persistence
        g1 = _put_settings(tokens["Super Admin"]["headers"],
                           {"rent_auto_enabled": False, "rent_amount": 1234567,
                            "admin_wa_number": "6281111111111"})
        assert g1["rent_auto_enabled"] is False
        assert g1["rent_amount"] == 1234567
        assert g1["admin_wa_number"] == "6281111111111"
        g = requests.get(f"{API}/settings", headers=tokens["Admin 1"]["headers"]).json()
        assert g["rent_auto_enabled"] is False
        assert g["rent_amount"] == 1234567
        assert g["admin_wa_number"] == "6281111111111"
        # Restore
        _put_settings(tokens["Super Admin"]["headers"],
                      {"rent_auto_enabled": True, "rent_amount": 2500000,
                       "admin_wa_number": "6287786098669"})


# ---------------- Geofenced attendance ----------------
class TestGeofence:
    def test_outside_radius_rejected(self, tokens):
        # Ensure geofence enabled
        _put_settings(tokens["Super Admin"]["headers"],
                      {"geofence_enabled": True, "studio_lat": -10.158988,
                       "studio_lng": 123.605584, "attendance_radius_m": 100})
        h = tokens["Admin 1"]["headers"]
        # Far-away coords
        r = requests.post(f"{API}/attendance/clock-in", headers=h,
                          json={"lat": -6.2, "lng": 106.8})
        # Could be 400 if already clocked-in today, else 403 for distance
        assert r.status_code in (403,), f"expected 403, got {r.status_code}: {r.text}"
        assert "m dari studio" in r.text or "radius" in r.text

    def test_no_body_rejected_when_geofence_on(self, tokens):
        _put_settings(tokens["Super Admin"]["headers"], {"geofence_enabled": True})
        h = tokens["Admin 2"]["headers"]
        r = requests.post(f"{API}/attendance/clock-in", headers=h)
        assert r.status_code in (400,), f"expected 400 no-body, got {r.status_code}"

    def test_inside_radius_stores_distance(self, tokens):
        _put_settings(tokens["Super Admin"]["headers"],
                      {"geofence_enabled": True, "studio_lat": -10.158988,
                       "studio_lng": 123.605584, "attendance_radius_m": 100})
        # Use Admin 2 (so Admin 1 outside test is independent). Clean up today's attendance via direct insert check.
        h = tokens["Admin 2"]["headers"]
        r = requests.post(f"{API}/attendance/clock-in", headers=h,
                          json={"lat": -10.1590, "lng": 123.6056})
        # Could 400 if already clocked-in today (test re-run)
        assert r.status_code in (200, 400), r.text
        if r.status_code == 200:
            assert "clock_in_distance_m" in r.json()
            assert r.json()["clock_in_distance_m"] is not None
            assert r.json()["clock_in_distance_m"] <= 100

    def test_geofence_disabled_allows_no_body(self, tokens):
        _put_settings(tokens["Super Admin"]["headers"], {"geofence_enabled": False})
        try:
            h = tokens["Rina (Fotografer)"]["headers"]
            r = requests.post(f"{API}/attendance/clock-in", headers=h)
            # 200 (new) or 400 (already clocked-in today)
            assert r.status_code in (200, 400), r.text
        finally:
            # Restore
            _put_settings(tokens["Super Admin"]["headers"], {"geofence_enabled": True})


# ---------------- Payroll overrides ----------------
class TestPayrollOverrides:
    def test_put_payroll_with_overrides_and_kasbon_denda(self, tokens):
        # Pick Rina
        uid = next(u for u in requests.get(f"{API}/users",
                   headers=tokens["Super Admin"]["headers"]).json()
                   if u["sub_role"] == "photographer")["id"]
        today = _wib_today()
        month = today[:7]
        payload = {"base_salary": 2000000, "turnover_bonus_pct": 1.5, "misc_bonus": 100000,
                   "overtime_pay_override": None, "days_worked_override": 20,
                   "meal_allowance_override": 300000, "kasbon": 50000, "denda": 25000,
                   "note": "TEST_override"}
        r = requests.put(f"{API}/payroll/{uid}", headers=tokens["Super Admin"]["headers"],
                         params={"month": month}, json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # GET payroll and verify row reflects overrides
        g = requests.get(f"{API}/payroll", headers=tokens["Super Admin"]["headers"],
                         params={"month": month})
        assert g.status_code == 200
        rows = g.json()["rows"]
        row = next(x for x in rows if x["user_id"] == uid)
        assert row["days_worked"] == 20
        assert row["days_worked_override"] == 20
        assert row["meal_allowance"] == 300000
        assert row["meal_allowance_override"] == 300000
        assert row["base_salary"] == 2000000
        assert row["kasbon"] == 50000
        assert row["denda"] == 25000
        assert row["misc_bonus"] == 100000
        # total = base + meal + ot + turnover_bonus + misc - kasbon - denda
        expected_total = (row["base_salary"] + row["meal_allowance"] + row["overtime_pay"]
                         + row["turnover_bonus"] + row["misc_bonus"]
                         - row["kasbon"] - row["denda"])
        assert row["total"] == expected_total, f"total mismatch: {row['total']} vs {expected_total}"

    def test_payslip_pdf(self, tokens):
        uid = next(u for u in requests.get(f"{API}/users",
                   headers=tokens["Super Admin"]["headers"]).json()
                   if u["sub_role"] == "photographer")["id"]
        month = _wib_today()[:7]
        r = requests.get(f"{API}/payroll/{uid}/payslip",
                         headers=tokens["Super Admin"]["headers"],
                         params={"month": month})
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500

    def test_payroll_super_only(self, tokens):
        month = _wib_today()[:7]
        r = requests.get(f"{API}/payroll", headers=tokens["Admin 1"]["headers"],
                         params={"month": month})
        assert r.status_code == 403
