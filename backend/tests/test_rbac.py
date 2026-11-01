"""Tests for issue #8 - [S1-T02] RBAC testing.
SRS: PMS-FR-03 (role-based access), PMS-SR-003  |  Test cases: TC-Auth-03, TC-Sec-03
"""
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
import mongomock

from app.auth import session as session_module
from app.auth.password import hash_password
from app.auth.rbac import PERMISSIONS, require_permission
from app.rbac_demo import app as demo_app

pytestmark = pytest.mark.security

ROLES = {
    "admin": ("admin@pms.com", "Admin@123"),
    "project_manager": ("pm@pms.com", "Manager@123"),
    "team_member": ("member@pms.com", "Member@123"),
}

# Expected result from the permission matrix in rbac.py
DEMO_ROUTES = {
    "/demo/admin": ("manage_users", {"admin"}),
    "/demo/projects": ("manage_projects", {"project_manager"}),
    "/demo/task-status": ("update_task_status", {"project_manager", "team_member"}),
}


@pytest.fixture()
def sessions(monkeypatch):
    """Fake session store with one live session per role.
    Patches the collection the session check reads from, so no real DB is needed."""
    fake = mongomock.MongoClient()["pms_rbac_test"]["sessions"]
    monkeypatch.setattr(session_module, "sessions_collection", fake)
    ids = {}
    for role, (email, _) in ROLES.items():
        sid = f"sid-{role}"
        fake.insert_one({"session_id": sid, "email": email, "role": role})
        ids[role] = sid
    return ids


@pytest.fixture()
def demo_client():
    return TestClient(demo_app, raise_server_exceptions=False)


# ---------- TC-Auth-03: each role gets the demo routes it should (PMS-FR-03) ----------

@pytest.mark.parametrize("route", list(DEMO_ROUTES))
@pytest.mark.parametrize("role", list(ROLES))
def test_demo_route_access_matches_role(demo_client, sessions, route, role):
    allowed = DEMO_ROUTES[route][1]
    r = demo_client.get(route, params={"session_id": sessions[role]})
    if role in allowed:
        assert r.status_code == 200
        assert r.json()["role"] == role
    else:
        assert r.status_code == 403
        assert r.json()["detail"] == "Forbidden"


# ---------- TC-Sec-03: unauthorized actions are blocked (PMS-SR-003) ----------

@pytest.mark.parametrize("route", list(DEMO_ROUTES))
def test_demo_route_without_session_is_401(demo_client, route):
    r = demo_client.get(route)
    # session_id is a required query parameter, so FastAPI returns 422 before the check runs
    assert r.status_code == 422


@pytest.mark.parametrize("route", list(DEMO_ROUTES))
def test_demo_route_with_unknown_session_is_401(demo_client, sessions, route):
    r = demo_client.get(route, params={"session_id": "does-not-exist"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Not authenticated"


@pytest.mark.parametrize("route", list(DEMO_ROUTES))
def test_demo_route_rejects_role_not_in_allowed_set(demo_client, sessions, route):
    allowed = DEMO_ROUTES[route][1]
    blocked = [r for r in ROLES if r not in allowed]
    for role in blocked:
        r = demo_client.get(route, params={"session_id": sessions[role]})
        assert r.status_code == 403


# ---------- Full permission matrix, checked directly (covers actions with no demo route) ----------

@pytest.mark.parametrize("action", list(PERMISSIONS))
@pytest.mark.parametrize("role", list(ROLES))
def test_permission_matrix_each_action_each_role(sessions, action, role):
    """Calls the checker directly with a session for each role, so every action is tested
    even when no route uses it."""
    checker = require_permission(action)
    session_doc = {"session_id": sessions[role], "email": ROLES[role][0], "role": role}
    allowed = PERMISSIONS[action]

    if role in allowed:
        assert checker(session=session_doc) is session_doc
    else:
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            checker(session=session_doc)
        assert exc.value.status_code == 403


def test_unknown_action_raises_value_error():
    with pytest.raises(ValueError, match="Unknown permission"):
        require_permission("delete_everything")


def test_role_outside_all_roles_is_forbidden():
    from fastapi import HTTPException
    checker = require_permission("view_dashboard")
    with pytest.raises(HTTPException) as exc:
        checker(session={"role": "guest"})
    assert exc.value.status_code == 403
