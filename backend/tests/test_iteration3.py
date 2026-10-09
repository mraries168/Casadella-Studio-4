"""Iteration 3 backend tests: permissions, extended reports, export, upload, payroll, attendance monthly."""
import os
import io
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://photo-studio-control.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

PINS = {
    "Super Admin": "123456",
    "Admin 1": "111111",
    "Admin 2": "222222",
    "Rina (Fotografer)": "333333",
    "Budi (Editor)": "444444",
}

ALIAS_TO_SUBROLE = {
    "Super Admin": "super_admin",
    "Admin 1": "admin1",
    "Admin 2": "admin2",
    "Rina (Fotografer)": "photographer",
    "Budi (Editor)": "editor",
}

ALL_ON = {"booking": True, "expense": True, "reports": True}
ALL_OFF = {"booking": False, "expense": False, "reports": False}


@pytest.fixture(scope="module")
def users_list():
    r = requests.get(f"{API}/auth/users", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    by_sub = {u["sub_role"]: u for u in data}
    out = {u["name"]: u for u in data}
    for alias, sr in ALIAS_TO_SUBROLE.items():
        if sr in by_sub:
            out[alias] = by_sub[sr]
    return out


@pytest.fixture(scope="module")
def tokens(users_list):
    out = {}
    for n in PINS:
        uid = users_list[n]["id"]
        r = requests.post(f"{API}/auth/login", json={"user_id": uid, "pin": PINS[n]}, timeout=15)
        assert r.status_code == 200, f"login failed for {n}: {r.text}"
        out[n] = {"token": r.json()["access_token"], "user": r.json()["user"],
                  "headers": {"Authorization": f"Bearer {r.json()['access_token']}"}}
    return out


def today():
    # Backend transactions use Asia/Jakarta (UTC+7) for 'date'; match that so queries line up
    return (datetime.now(timezone.utc) + timedelta(hours=7)).strftime("%Y-%m-%d")


# ===== Permissions =====
class TestPermissions:
    def test_default_admin_me_has_all_perms(self, tokens):
        p = tokens["Admin 1"]["user"].get("permissions", {})
        assert p.get("booking") and p.get("expense") and p.get("reports"), f"admin defaults: {p}"

    def test_default_staff_me_has_none(self, users_list):
        # re-login staff fresh to grab permissions
        r = requests.post(f"{API}/auth/login",
                          json={"user_id": users_list["Rina (Fotografer)"]["id"], "pin": "333333"}).json()
        p = r["user"].get("permissions", {})
        assert p == {"booking": False, "expense": False, "reports": False}, f"staff defaults: {p}"

    def test_admin_cannot_update_perms(self, tokens):
        r = requests.put(f"{API}/users/{tokens['Admin 2']['user']['id']}/permissions",
                         headers=tokens["Admin 1"]["headers"], json=ALL_ON)
        assert r.status_code == 403

    def test_toggle_admin2_expense_off_blocks_expense(self, tokens):
        a2_id = tokens["Admin 2"]["user"]["id"]
        # Turn off expense for Admin 2
        r = requests.put(f"{API}/users/{a2_id}/permissions",
                         headers=tokens["Super Admin"]["headers"],
                         json={"booking": True, "expense": False, "reports": True})
        assert r.status_code == 200
        # Re-login Admin 2 to get updated session
        rl = requests.post(f"{API}/auth/login",
                           json={"user_id": a2_id, "pin": "222222"}).json()
        hdr = {"Authorization": f"Bearer {rl['access_token']}"}
        # expense create -> 403
        rexp = requests.post(f"{API}/transactions", headers=hdr,
                             json={"type": "expense", "category": "operasional",
                                   "amount": 10000, "date": today(), "description": "TEST_block"})
        assert rexp.status_code == 403
        # income (booking perm on) -> allowed
        rinc = requests.post(f"{API}/transactions", headers=hdr,
                             json={"type": "income", "category": "lainnya",
                                   "amount": 1000, "date": today(), "description": "TEST_ok"})
        assert rinc.status_code == 200
        tid = rinc.json()["id"]
        # cleanup
        requests.delete(f"{API}/transactions/{tid}", headers=tokens["Super Admin"]["headers"])
        # restore defaults
        requests.put(f"{API}/users/{a2_id}/permissions",
                     headers=tokens["Super Admin"]["headers"], json=ALL_ON)

    def test_staff_booking_toggle_on_can_create_booking(self, tokens, users_list):
        rid = users_list["Rina (Fotografer)"]["id"]
        requests.put(f"{API}/users/{rid}/permissions",
                     headers=tokens["Super Admin"]["headers"],
                     json={"booking": True, "expense": False, "reports": False})
        rl = requests.post(f"{API}/auth/login", json={"user_id": rid, "pin": "333333"}).json()
        hdr = {"Authorization": f"Bearer {rl['access_token']}"}
        pkgs = requests.get(f"{API}/packages", headers=hdr).json()
        pkg = next(p for p in pkgs if p["duration_min"] == 30)
        future = (datetime.now(timezone.utc) + timedelta(days=90)).strftime("%Y-%m-%d")
        rb = requests.post(f"{API}/bookings", headers=hdr,
                           json={"client_name": "TEST_StaffBook", "date": future,
                                 "start_time": "09:00", "package_id": pkg["id"]})
        assert rb.status_code == 200, rb.text
        bid = rb.json()["id"]
        # reports still forbidden
        rr = requests.get(f"{API}/reports", headers=hdr,
                         params={"period": "daily", "date": today()})
        assert rr.status_code == 403
        # cleanup via admin
        requests.post(f"{API}/bookings/{bid}/cancel",
                      headers=tokens["Admin 1"]["headers"])
        # restore defaults
        requests.put(f"{API}/users/{rid}/permissions",
                     headers=tokens["Super Admin"]["headers"], json=ALL_OFF)

    def test_staff_default_reports_403(self, tokens):
        r = requests.get(f"{API}/reports", headers=tokens["Budi (Editor)"]["headers"],
                        params={"period": "daily", "date": today()})
        assert r.status_code == 403


# ===== Reports fields =====
class TestReportFields:
    def test_report_contains_new_fields(self, tokens):
        # Create booking + DP + expense all on today's date for current-month report
        pkgs = requests.get(f"{API}/packages", headers=tokens["Admin 1"]["headers"]).json()
        pkg = next(p for p in pkgs if p["duration_min"] == 30)
        t = today()
        # Future booking date so slot free; but to count turnover for current month,
        # just use today for the booking date
        rb = requests.post(f"{API}/bookings", headers=tokens["Admin 1"]["headers"],
                           json={"client_name": "TEST_RepoCheck", "date": t,
                                 "start_time": "14:00", "package_id": pkg["id"]})
        # If today's 14:00 taken, try other times
        if rb.status_code != 200:
            for hr in range(9, 20):
                rb = requests.post(f"{API}/bookings", headers=tokens["Admin 1"]["headers"],
                                   json={"client_name": "TEST_RepoCheck", "date": t,
                                         "start_time": f"{hr:02d}:00", "package_id": pkg["id"]})
                if rb.status_code == 200:
                    break
        assert rb.status_code == 200, rb.text
        bid = rb.json()["id"]
        price = rb.json()["price"]
        # DP
        requests.post(f"{API}/bookings/{bid}/payments", headers=tokens["Admin 1"]["headers"],
                      json={"amount": 100000, "method": "cash", "type": "dp"})
        # Expense
        rx = requests.post(f"{API}/transactions", headers=tokens["Admin 1"]["headers"],
                           json={"type": "expense", "category": "operasional",
                                 "amount": 30000, "description": "TEST_rep", "date": t})
        assert rx.status_code == 200
        tid = rx.json()["id"]
        rep = requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                          params={"period": "daily", "date": t}).json()
        # new fields present
        for k in ["turnover", "income", "dp_total", "pelunasan_total", "net_profit", "operational", "rental"]:
            assert k in rep, f"missing {k} in report"
        assert rep["dp_total"] >= 100000
        assert rep["operational"] >= 30000
        assert rep["net_profit"] == rep["income"] - rep["expenses"]
        # turnover should include today's booking price
        assert rep["turnover"] >= price
        # Monthly report should also work
        rm = requests.get(f"{API}/reports", headers=tokens["Admin 1"]["headers"],
                          params={"period": "monthly", "date": t[:7] + "-01"}).json()
        assert rm["turnover"] >= price
        # cleanup
        requests.post(f"{API}/bookings/{bid}/cancel", headers=tokens["Admin 1"]["headers"])
        requests.delete(f"{API}/transactions/{tid}", headers=tokens["Super Admin"]["headers"])


# ===== Export =====
class TestExport:
    def test_export_pdf_with_header_auth(self, tokens):
        t = today()
        r = requests.get(f"{API}/reports/export", headers=tokens["Admin 1"]["headers"],
                        params={"period": "daily", "date": t, "format": "pdf"})
        assert r.status_code == 200
        assert "application/pdf" in r.headers.get("Content-Type", "")
        assert r.content[:4] == b"%PDF"

    def test_export_xlsx_with_token_query(self, tokens):
        t = today()
        tok = tokens["Admin 1"]["token"]
        r = requests.get(f"{API}/reports/export",
                        params={"period": "monthly", "date": t[:7] + "-01",
                                "format": "xlsx", "token": tok})
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("Content-Type", "")
        # xlsx -> zip (PK\x03\x04)
        assert r.content[:2] == b"PK"

    def test_export_requires_reports_perm(self, tokens):
        r = requests.get(f"{API}/reports/export", headers=tokens["Rina (Fotografer)"]["headers"],
                        params={"period": "daily", "date": today(), "format": "pdf"})
        assert r.status_code == 403


# ===== Upload / files =====
class TestUpload:
    uploaded_path = None

    def test_upload_requires_expense_perm(self, tokens):
        # staff default no expense -> 403
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
        files = {"file": ("x.png", png, "image/png")}
        r = requests.post(f"{API}/upload", headers=tokens["Rina (Fotografer)"]["headers"],
                         files=files)
        assert r.status_code == 403

    def test_upload_and_fetch(self, tokens):
        png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
        files = {"file": ("receipt.png", png, "image/png")}
        r = requests.post(f"{API}/upload", headers=tokens["Admin 1"]["headers"], files=files)
        if r.status_code in (502, 503):
            pytest.skip(f"storage backend unavailable: {r.status_code}")
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        TestUpload.uploaded_path = path
        # GET with reports perm (header auth)
        r2 = requests.get(f"{API}/files/{path}", headers=tokens["Admin 1"]["headers"])
        assert r2.status_code == 200
        # Query token auth also works
        r3 = requests.get(f"{API}/files/{path}", params={"token": tokens["Admin 1"]["token"]})
        assert r3.status_code == 200
        # staff (no reports perm) 403
        r4 = requests.get(f"{API}/files/{path}", headers=tokens["Rina (Fotografer)"]["headers"])
        assert r4.status_code == 403

    def test_unknown_file_404(self, tokens):
        r = requests.get(f"{API}/files/does/not/exist.jpg",
                        headers=tokens["Admin 1"]["headers"])
        assert r.status_code == 404

    def test_create_expense_with_receipt_path(self, tokens):
        if not TestUpload.uploaded_path:
            pytest.skip("no uploaded path")
        r = requests.post(f"{API}/transactions", headers=tokens["Admin 1"]["headers"],
                         json={"type": "expense", "category": "operasional", "amount": 1234,
                               "method": "cash", "description": "TEST_receipt",
                               "date": today(), "receipt_path": TestUpload.uploaded_path})
        assert r.status_code == 200
        assert r.json().get("receipt_path") == TestUpload.uploaded_path
        requests.delete(f"{API}/transactions/{r.json()['id']}",
                        headers=tokens["Super Admin"]["headers"])


# ===== Attendance monthly + Payroll =====
class TestAttendanceMonthly:
    def test_admin_can_get_monthly_recap(self, tokens):
        t = today()
        r = requests.get(f"{API}/attendance/monthly", headers=tokens["Admin 1"]["headers"],
                        params={"month": t[:7]})
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        for row in rows:
            for k in ["user_id", "name", "days_worked", "late_count",
                      "late_minutes", "overtime_minutes", "overtime_pay"]:
                assert k in row

    def test_staff_cannot_get_monthly(self, tokens):
        t = today()
        r = requests.get(f"{API}/attendance/monthly",
                        headers=tokens["Rina (Fotografer)"]["headers"],
                        params={"month": t[:7]})
        assert r.status_code == 403


class TestPayroll:
    def test_admin_cannot_access_payroll(self, tokens):
        t = today()
        r = requests.get(f"{API}/payroll", headers=tokens["Admin 1"]["headers"],
                        params={"month": t[:7]})
        assert r.status_code == 403

    def test_super_admin_payroll_meal_and_turnover(self, tokens):
        t = today()
        m = t[:7]
        r = requests.get(f"{API}/payroll", headers=tokens["Super Admin"]["headers"],
                        params={"month": m})
        assert r.status_code == 200
        data = r.json()
        assert data["month"] == m
        assert data["meal_allowance_per_day"] == 25000
        # verify meal = days_worked * 25000 for each row
        for row in data["rows"]:
            assert row["meal_allowance"] == row["days_worked"] * 25000

    def test_payroll_put_persist_and_bonus_calc(self, tokens):
        t = today()
        m = t[:7]
        # pick a staff user id
        before = requests.get(f"{API}/payroll", headers=tokens["Super Admin"]["headers"],
                             params={"month": m}).json()
        if not before["rows"]:
            pytest.skip("no users")
        row = before["rows"][0]
        uid = row["user_id"]
        payload = {"base_salary": 1000000, "turnover_bonus_pct": 10,
                   "misc_bonus": 50000, "overtime_pay_override": 77777, "note": "TEST"}
        rp = requests.put(f"{API}/payroll/{uid}", headers=tokens["Super Admin"]["headers"],
                         params={"month": m}, json=payload)
        assert rp.status_code == 200
        after = requests.get(f"{API}/payroll", headers=tokens["Super Admin"]["headers"],
                            params={"month": m}).json()
        new_row = next(r for r in after["rows"] if r["user_id"] == uid)
        assert new_row["base_salary"] == 1000000
        assert new_row["turnover_bonus_pct"] == 10
        assert new_row["misc_bonus"] == 50000
        assert new_row["overtime_pay"] == 77777  # override takes effect
        assert new_row["saved"] is True
        # bonus
        expected_bonus = round(after["turnover"] * 10 / 100)
        assert new_row["turnover_bonus"] == expected_bonus
        expected_total = (new_row["base_salary"] + new_row["meal_allowance"] +
                          new_row["overtime_pay"] + new_row["turnover_bonus"] +
                          new_row["misc_bonus"])
        assert new_row["total"] == expected_total
        # cleanup: zero out saved entry
        requests.put(f"{API}/payroll/{uid}", headers=tokens["Super Admin"]["headers"],
                    params={"month": m},
                    json={"base_salary": 0, "turnover_bonus_pct": 0, "misc_bonus": 0,
                          "overtime_pay_override": None, "note": ""})


# ===== Settings extended =====
class TestSettingsExtended:
    def test_super_can_update_new_fields(self, tokens):
        body = {"studio_name": "Casadella Photo Studio", "open_time": "09:00",
                "close_time": "20:00", "slot_interval": 15, "default_dp_percent": 50,
                "work_start": "09:00", "work_end": "18:00", "late_tolerance_min": 10,
                "overtime_min_minutes": 30, "overtime_rate_per_hour": 20000,
                "meal_allowance_per_day": 25000}
        r = requests.put(f"{API}/settings", headers=tokens["Super Admin"]["headers"], json=body)
        assert r.status_code == 200
        got = r.json()
        for k in ["work_start", "work_end", "late_tolerance_min", "overtime_min_minutes",
                  "overtime_rate_per_hour", "meal_allowance_per_day"]:
            assert k in got, f"missing {k} in settings response"
        assert got["meal_allowance_per_day"] == 25000

    def test_admin_cannot_update_settings(self, tokens):
        r = requests.put(f"{API}/settings", headers=tokens["Admin 1"]["headers"],
                        json={"studio_name": "x"})
        assert r.status_code == 403
