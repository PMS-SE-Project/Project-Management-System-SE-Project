"""Security checks for the auth module.
SRS: PMS-SR-001, PMS-SR-002, PMS-SR-004  |  Test cases: TC-Sec-01, TC-Sec-02, TC-Sec-04
"""
import pytest

from app.auth.password import hash_password, verify_password
from tests.conftest import USERS, login

pytestmark = pytest.mark.security


# ---------- TC-Sec-02: passwords stored hashed only (PMS-SR-002) ----------

def test_seeded_passwords_are_stored_as_bcrypt_hashes(db):
    for email, password, _ in USERS.values():
        stored = db["users"].find_one({"email": email})["password_hash"]
        assert stored != password
        assert stored.startswith("$2")  # bcrypt prefix
        assert len(stored) == 60


def test_hash_is_salted_same_password_gives_different_hashes():
    assert hash_password("Same@123") != hash_password("Same@123")


def test_verify_password_accepts_right_and_rejects_wrong():
    h = hash_password("Right@123")
    assert verify_password("Right@123", h) is True
    assert verify_password("Wrong@123", h) is False


def test_login_response_never_contains_password_or_hash(client):
    email, password, _ = USERS["admin"]
    text = login(client, email, password).text
    assert password not in text
    assert "password_hash" not in text and "$2b$" not in text


def test_failed_login_response_does_not_echo_password(client):
    text = login(client, USERS["admin"][0], "SuperSecret999").text
    assert "SuperSecret999" not in text


# ---------- TC-Sec-01: injection attempts on login (PMS-SR-001) ----------

@pytest.mark.parametrize("payload", [
    {"email": {"$ne": ""}, "password": "x"},
    {"email": "admin@pms.com", "password": {"$ne": ""}},
    {"email": {"$gt": ""}, "password": {"$gt": ""}},
])
def test_nosql_injection_in_login_is_rejected(client, payload):
    r = client.post("/auth/login", json=payload)
    assert r.status_code == 422


@pytest.mark.parametrize("pw", ["' OR '1'='1", "admin@pms.com' --", "<script>alert(1)</script>"])
def test_injection_strings_as_password_do_not_log_in(client, pw):
    assert login(client, USERS["admin"][0], pw).status_code == 401


# ---------- TC-Sec-04: logout invalidates session (PMS-SR-004) ----------

def test_logged_out_session_no_longer_exists(client, db):
    email, password, _ = USERS["admin"]
    sid = login(client, email, password).json()["session_id"]
    client.post("/auth/logout", params={"session_id": sid})
    assert db["sessions"].count_documents({"session_id": sid}) == 0


@pytest.mark.skip(reason="No protected endpoint exists yet - enable once a route checks session_id")
def test_old_session_cannot_access_protected_route(client):
    ...
