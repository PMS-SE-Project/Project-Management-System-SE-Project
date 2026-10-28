"""Tests for issue #7 - [S1-T01] Authentication test cases.
SRS: PMS-FR-01 (login), PMS-FR-02 (logout)  |  Test cases: TC-Auth-01, TC-Auth-02
"""
import pytest

from tests.conftest import USERS, login

pytestmark = pytest.mark.auth


# ---------- TC-Auth-01: User login (PMS-FR-01) ----------

@pytest.mark.parametrize("key", ["admin", "pm", "member"])
def test_login_valid_credentials_each_role(client, key):
    email, password, role = USERS[key]
    r = login(client, email, password)
    assert r.status_code == 200
    body = r.json()
    assert body["message"] == "Login successful"
    assert body["session_id"]
    assert body["user"] == {"email": email, "role": role}


def test_login_creates_session_in_db(client, db):
    email, password, role = USERS["admin"]
    sid = login(client, email, password).json()["session_id"]
    stored = db["sessions"].find_one({"session_id": sid})
    assert stored is not None
    assert stored["email"] == email and stored["role"] == role


def test_login_wrong_password_rejected(client, db):
    r = login(client, USERS["admin"][0], "WrongPass1")
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid email or password"
    assert db["sessions"].count_documents({}) == 0


def test_login_unknown_email_rejected(client):
    r = login(client, "nobody@pms.com", "Admin@123")
    assert r.status_code == 401


def test_login_error_does_not_reveal_which_field_was_wrong(client):
    wrong_pw = login(client, USERS["admin"][0], "WrongPass1")
    wrong_email = login(client, "nobody@pms.com", "Admin@123")
    assert wrong_pw.json() == wrong_email.json()


def test_login_empty_password_rejected(client):
    assert login(client, USERS["admin"][0], "").status_code == 401


@pytest.mark.parametrize("bad_email", ["notanemail", "admin@", "@pms.com", "", "a b@pms.com"])
def test_login_invalid_email_format_rejected(client, bad_email):
    assert login(client, bad_email, "Admin@123").status_code == 422


@pytest.mark.parametrize("payload", [{}, {"email": "admin@pms.com"}, {"password": "Admin@123"}])
def test_login_missing_fields_rejected(client, payload):
    assert client.post("/auth/login", json=payload).status_code == 422


def test_login_password_is_case_sensitive(client):
    assert login(client, USERS["admin"][0], "admin@123").status_code == 401



def test_login_very_long_password_does_not_crash(client):
    r = login(client, USERS["admin"][0], "A" * 5000)
    assert r.status_code in (401, 422)  # must never be a 500


def test_each_login_gets_a_unique_session_id(client):
    email, password, _ = USERS["admin"]
    ids = {login(client, email, password).json()["session_id"] for _ in range(5)}
    assert len(ids) == 5



def test_login_email_is_case_insensitive(client):
    assert login(client, "ADMIN@PMS.COM", USERS["admin"][1]).status_code == 200


# ---------- TC-Auth-02: User logout (PMS-FR-02) ----------

def test_logout_valid_session_succeeds_and_removes_session(client, db):
    email, password, _ = USERS["member"]
    sid = login(client, email, password).json()["session_id"]
    r = client.post("/auth/logout", params={"session_id": sid})
    assert r.status_code == 200
    assert r.json()["message"] == "Logout successful"
    assert db["sessions"].find_one({"session_id": sid}) is None


def test_logout_unknown_session_returns_404(client):
    r = client.post("/auth/logout", params={"session_id": "does-not-exist"})
    assert r.status_code == 404


def test_logout_twice_second_attempt_fails(client):
    email, password, _ = USERS["pm"]
    sid = login(client, email, password).json()["session_id"]
    assert client.post("/auth/logout", params={"session_id": sid}).status_code == 200
    assert client.post("/auth/logout", params={"session_id": sid}).status_code == 404


def test_logout_without_session_id_rejected(client):
    assert client.post("/auth/logout").status_code == 422


def test_logout_only_ends_that_session(client, db):
    email, password, _ = USERS["admin"]
    s1 = login(client, email, password).json()["session_id"]
    s2 = login(client, email, password).json()["session_id"]
    client.post("/auth/logout", params={"session_id": s1})
    assert db["sessions"].find_one({"session_id": s1}) is None
    assert db["sessions"].find_one({"session_id": s2}) is not None
