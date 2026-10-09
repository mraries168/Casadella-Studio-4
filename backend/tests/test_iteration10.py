"""Iteration 10 tests: WITA timezone, unpaid-finished, mark-billed, late-today."""
import os
import requests
import pytest
from datetime import datetime, timezone, timedelta

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://casadella-studio-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"
WITA = timedelta(hours=8)

SEED_BOOKING_ID = "6ac8661543ea6e8a7da1d76c"


def login(pin):
    users = requests.get(f"{API}/auth/users").json()
    # find any user with matching pin via brute - but we have mapping
    return users


@pytest.fixture(scope="module")
def super_token():
    users = requests.get(f"{API}/auth/users").json()
    # Super Admin PIN 123456 - try all users
    for u in users:
        r = requests.post(f"{API}/auth/login", json={"user_id": u["id"], "pin": "123456"})
        if r.status_code == 200 and r.json()["user"]["role"] == "super_admin":
            return r.json()["access_token"], r.json()["user"]
    pytest.skip("super admin not found")


@pytest.fixture(scope="module")
def admin_token():
    users = requests.get(f"{API}/auth/users").json()
    for u in users:
        r = requests.post(f"{API}/auth/login", json={"user_id": u["id"], "pin": "111111"})
        if r.status_code == 200 and r.json()["user"]["role"] == "admin":
            return r.json()["access_token"], r.json()["user"]
    pytest.skip("admin1 not found")


@pytest.fixture(scope="module")
def staff_token():
    users = requests.get(f"{API}/auth/users").json()
    for u in users:
        r = requests.post(f"{API}/auth/login", json={"user_id": u["id"], "pin": "333333"})
        if r.status_code == 200 and r.json()["user"]["role"] == "staff":
            return r.json()["access_token"], r.json()["user"]
    pytest.skip("staff not found")


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- WITA timezone ----------
def test_attendance_today_uses_wita(super_token):
    tok, _ = super_token
    # Just assert the endpoint responds; date derived server-side using WITA
    r = requests.get(f"{API}/attendance/today", headers=h(tok))
    assert r.status_code == 200
    expected_date = (datetime.now(timezone.utc) + WITA).strftime("%Y-%m-%d")
    # verify local_date through public info
    pi = requests.get(f"{API}/public/info").json()
    assert pi["today"] == expected_date, f"Expected WITA today={expected_date}, got {pi['today']}"


def test_late_today_shape(admin_token):
    tok, _ = admin_token
    r = requests.get(f"{API}/attendance/late-today", headers=h(tok))
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and "work_start" in data
    assert isinstance(data["items"], list)
    for it in data["items"]:
        assert it["status"] in ("late", "absent")
        assert "name" in it and "user_id" in it and "sub_role" in it


def test_late_today_forbidden_for_staff(staff_token):
    tok, _ = staff_token
    r = requests.get(f"{API}/attendance/late-today", headers=h(tok))
    assert r.status_code == 403


# ---------- unpaid-finished ----------
def test_unpaid_finished_returns_seeded(admin_token):
    tok, _ = admin_token
    r = requests.get(f"{API}/bookings/unpaid-finished", headers=h(tok))
    assert r.status_code == 200
    lst = r.json()
    ids = [b["id"] for b in lst]
    # seeded booking should appear
    assert SEED_BOOKING_ID in ids, f"Seed booking {SEED_BOOKING_ID} missing. Got {ids}"
    seed = next(b for b in lst if b["id"] == SEED_BOOKING_ID)
    assert seed["status"] == "confirmed"
    assert seed["payment_status"] != "lunas"


def test_unpaid_finished_filters_by_wita(admin_token):
    """All items must be either date<today WITA, or date==today with end_time<=now WITA."""
    tok, _ = admin_token
    r = requests.get(f"{API}/bookings/unpaid-finished", headers=h(tok))
    now = datetime.now(timezone.utc) + WITA
    d = now.strftime("%Y-%m-%d")
    t = now.strftime("%H:%M")
    for b in r.json():
        assert b["date"] < d or (b["date"] == d and b["end_time"] <= t), \
            f"Booking {b['id']} date={b['date']} end={b['end_time']} not finished vs {d} {t}"


# ---------- balance-requested ----------
def test_balance_requested_staff_forbidden(staff_token):
    tok, _ = staff_token
    r = requests.post(f"{API}/bookings/{SEED_BOOKING_ID}/balance-requested", headers=h(tok))
    assert r.status_code == 403


def test_balance_requested_bad_id(admin_token):
    tok, _ = admin_token
    r = requests.post(f"{API}/bookings/notavalidid/balance-requested", headers=h(tok))
    assert r.status_code in (404, 400)


def test_balance_requested_not_found(admin_token):
    tok, _ = admin_token
    # valid ObjectId format but not existing
    r = requests.post(f"{API}/bookings/000000000000000000000000/balance-requested", headers=h(tok))
    assert r.status_code == 404


def test_balance_requested_marks_and_persists(admin_token):
    tok, user = admin_token
    r = requests.post(f"{API}/bookings/{SEED_BOOKING_ID}/balance-requested", headers=h(tok))
    assert r.status_code == 200
    data = r.json()
    assert "balance_requested_at" in data
    assert data["balance_requested_by"] == user["name"]
    # verify GET returns same
    g = requests.get(f"{API}/bookings/{SEED_BOOKING_ID}", headers=h(tok)).json()
    assert g["balance_requested_at"] == data["balance_requested_at"]
    assert g["balance_requested_by"] == user["name"]
    # verify unpaid-finished list contains it
    lst = requests.get(f"{API}/bookings/unpaid-finished", headers=h(tok)).json()
    seed = next(b for b in lst if b["id"] == SEED_BOOKING_ID)
    assert seed.get("balance_requested_at") == data["balance_requested_at"]
    assert seed.get("balance_requested_by") == user["name"]
