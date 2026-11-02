"""Tests for issue #6/#9 scope - PMS-FR-07 manage project members, plus the
admin user and inactive-account rules that this PR changes.

Proposed test cases: TC-Proj-10 (member add/remove), TC-Proj-11 (eligible members),
TC-Admin-01 (admin user management), TC-Auth-04 (inactive accounts).
Runs against mongomock.
"""
from bson import ObjectId
import mongomock
import pytest
from fastapi.testclient import TestClient

import app.auth.session as session_module
import app.routes.admin as admin_module
import app.routes.auth as auth_module
import app.routes.project as project_module
from app.auth.password import hash_password
from app.main import app

pytestmark = pytest.mark.project

PASSWORD = "Pass@123"
HASH = hash_password(PASSWORD)  # computed once; bcrypt is slow


@pytest.fixture()
def world(monkeypatch):
    db = mongomock.MongoClient()["pms_members_test"]
    users, sessions, projects = db["users"], db["sessions"], db["projects"]

    def user(email, role, name, active=True):
        return users.insert_one({
            "name": name, "email": email, "password_hash": HASH,
            "role": role, "is_active": active,
        }).inserted_id

    ids = {
        "admin": user("admin@pms.com", "admin", "Admin"),
        "pm": user("pm@pms.com", "project_manager", "Lead PM"),
        "pm2": user("pm2@pms.com", "project_manager", "Other PM"),
        "member": user("member@pms.com", "team_member", "Member One"),
        "member2": user("member2@pms.com", "team_member", "Member Two"),
        "inactive": user("gone@pms.com", "team_member", "Gone", active=False),
    }
    project_id = projects.insert_one({
        "name": "Alpha Project", "created_by": "pm@pms.com",
        "project_lead": ids["pm"], "members": [ids["member"]], "status": "active",
    }).inserted_id

    sids = {}
    for key, uid in ids.items():
        doc = users.find_one({"_id": uid})
        sid = f"sid-{key}"
        sessions.insert_one({"session_id": sid, "user_id": uid,
                             "email": doc["email"], "role": doc["role"]})
        sids[key] = sid

    for module in (session_module, auth_module, project_module, admin_module):
        if hasattr(module, "users_collection"):
            monkeypatch.setattr(module, "users_collection", users)
        if hasattr(module, "sessions_collection"):
            monkeypatch.setattr(module, "sessions_collection", sessions)
        if hasattr(module, "projects_collection"):
            monkeypatch.setattr(module, "projects_collection", projects)

    return {"users": users, "projects": projects, "sessions": sessions,
            "ids": ids, "sids": sids, "pid": project_id}


@pytest.fixture()
def client(world):
    return TestClient(app, raise_server_exceptions=False)


def members_url(w):
    return f"/projects/{w['pid']}/members"


def as_session(w, who):
    return {"session_id": w["sids"][who]}


# ---------- Member management (PMS-FR-07) ----------

def test_assigned_pm_lists_current_members(client, world):
    r = client.get(members_url(world), params=as_session(world, "pm"))
    assert r.status_code == 200
    assert [m["email"] for m in r.json()["members"]] == ["member@pms.com"]


def test_assigned_pm_adds_active_team_member(client, world):
    r = client.post(members_url(world), params=as_session(world, "pm"),
                    json={"user_id": str(world["ids"]["member2"])})
    assert r.status_code == 201
    stored = world["projects"].find_one({"_id": world["pid"]})["members"]
    assert world["ids"]["member2"] in stored


def test_adding_existing_member_returns_409(client, world):
    r = client.post(members_url(world), params=as_session(world, "pm"),
                    json={"user_id": str(world["ids"]["member"])})
    assert r.status_code == 409
    assert r.json()["detail"] == "User is already a project member"


@pytest.mark.parametrize("who", ["admin", "pm2"])
def test_only_team_members_can_be_added(client, world, who):
    r = client.post(members_url(world), params=as_session(world, "pm"),
                    json={"user_id": str(world["ids"][who])})
    assert r.status_code == 403
    assert r.json()["detail"] == "Only team members can be added to a project"


def test_inactive_team_member_cannot_be_added(client, world):
    r = client.post(members_url(world), params=as_session(world, "pm"),
                    json={"user_id": str(world["ids"]["inactive"])})
    assert r.status_code == 403
    assert r.json()["detail"] == "Inactive users cannot be added to a project"


def test_adding_unknown_user_returns_404(client, world):
    r = client.post(members_url(world), params=as_session(world, "pm"),
                    json={"user_id": str(ObjectId())})
    assert r.status_code == 404


def test_adding_malformed_user_id_returns_422(client, world):
    r = client.post(members_url(world), params=as_session(world, "pm"),
                    json={"user_id": "not-an-id"})
    assert r.status_code == 422


@pytest.mark.parametrize("who", ["pm2", "member", "admin"])
def test_only_assigned_pm_can_manage_members(client, world, who):
    r = client.get(members_url(world), params=as_session(world, who))
    assert r.status_code == 403
    assert r.json()["detail"] == "Only the assigned Project Manager can manage project members"


def test_assigned_pm_removes_member(client, world):
    r = client.delete(f"{members_url(world)}/{world['ids']['member']}",
                      params=as_session(world, "pm"))
    assert r.status_code == 200
    stored = world["projects"].find_one({"_id": world["pid"]})["members"]
    assert world["ids"]["member"] not in stored


def test_project_lead_cannot_be_removed(client, world):
    r = client.delete(f"{members_url(world)}/{world['ids']['pm']}",
                      params=as_session(world, "pm"))
    assert r.status_code == 409
    assert r.json()["detail"] == "The assigned Project Lead cannot be removed"


def test_removing_non_member_returns_404(client, world):
    r = client.delete(f"{members_url(world)}/{world['ids']['member2']}",
                      params=as_session(world, "pm"))
    assert r.status_code == 404


def test_removing_malformed_user_id_returns_422(client, world):
    r = client.delete(f"{members_url(world)}/not-an-id", params=as_session(world, "pm"))
    assert r.status_code == 422


def test_unknown_project_returns_404(client, world):
    r = client.get(f"/projects/{ObjectId()}/members", params=as_session(world, "pm"))
    assert r.status_code == 404


# ---------- Eligible team members (dropdown source) ----------

def test_eligible_members_excludes_members_lead_inactive_and_non_team(client, world):
    r = client.get(f"/projects/{world['pid']}/eligible-members", params=as_session(world, "pm"))
    assert r.status_code == 200
    emails = {m["email"] for m in r.json()["eligible_members"]}
    assert emails == {"member2@pms.com"}


# ---------- Authentication responses (PMS-FR-07 "Fixes") ----------

@pytest.mark.xfail(reason="BUG: PR #52 says missing session returns 401, but get_current_session_or_401 raises 422 (strict)", strict=True)
def test_missing_session_on_member_route_returns_401(client, world):
    """PR #52 says missing session IDs return 401. The code's session helper raises 422."""
    r = client.get(members_url(world))
    assert r.status_code == 401


# ---------- Admin user management (PMS-FR-07 scope) ----------

def create_payload(**overrides):
    body = {"name": "New Person", "email": "new@pms.com", "password": "Secret@1", "role": "team_member"}
    body.update(overrides)
    return body


def test_admin_creates_user_with_active_status_and_no_hash_in_response(client, world):
    r = client.post("/admin/users", params=as_session(world, "admin"), json=create_payload())
    assert r.status_code == 201
    user = r.json()["user"]
    assert user["is_active"] is True
    assert "password_hash" not in user and "password" not in user
    stored = world["users"].find_one({"email": "new@pms.com"})
    assert stored["password_hash"] != "Secret@1"


def test_duplicate_email_is_rejected_case_insensitively(client, world):
    r = client.post("/admin/users", params=as_session(world, "admin"),
                    json=create_payload(email="MEMBER@PMS.COM"))
    assert r.status_code == 409
    assert r.json()["detail"] == "Email is already registered"


@pytest.mark.parametrize("who", ["pm", "member"])
def test_non_admins_cannot_create_users(client, world, who):
    r = client.post("/admin/users", params=as_session(world, who), json=create_payload())
    assert r.status_code == 403
    assert world["users"].find_one({"email": "new@pms.com"}) is None


def test_create_user_rejects_blank_name_and_bad_role(client, world):
    admin = as_session(world, "admin")
    assert client.post("/admin/users", params=admin, json=create_payload(name="   ")).status_code == 422
    assert client.post("/admin/users", params=admin, json=create_payload(role="guest")).status_code == 422


def test_admin_lists_users_without_password_hashes(client, world):
    r = client.get("/admin/users", params=as_session(world, "admin"))
    assert r.status_code == 200
    users = r.json()["users"]
    assert len(users) == 6
    assert all("password_hash" not in u for u in users)


def test_admin_updates_name(client, world):
    r = client.put(f"/admin/users/{world['ids']['member2']}", params=as_session(world, "admin"),
                   json={"name": "Renamed"})
    assert r.status_code == 200
    assert r.json()["user"]["name"] == "Renamed"


def test_admin_cannot_change_email_to_an_existing_one(client, world):
    r = client.put(f"/admin/users/{world['ids']['member2']}", params=as_session(world, "admin"),
                   json={"email": "member@pms.com"})
    assert r.status_code == 409


def test_project_lead_cannot_lose_pm_role(client, world):
    r = client.put(f"/admin/users/{world['ids']['pm']}", params=as_session(world, "admin"),
                   json={"role": "team_member"})
    assert r.status_code == 409
    assert r.json()["detail"] == "Project Lead role cannot be removed while assigned to a project"


def test_update_rejects_unknown_fields(client, world):
    r = client.put(f"/admin/users/{world['ids']['member2']}", params=as_session(world, "admin"),
                   json={"is_active": False})
    assert r.status_code == 422


# ---------- Inactive accounts (PMS-FR-07 "Fixes") ----------

def test_deactivated_user_cannot_log_in(client, world):
    client.patch(f"/admin/users/{world['ids']['member2']}/status",
                 params=as_session(world, "admin"), json={"is_active": False})
    r = client.post("/auth/login", json={"email": "member2@pms.com", "password": PASSWORD})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid email or password"


def test_deactivation_ends_existing_sessions(client, world):
    sid_before = world["sids"]["member2"]
    client.patch(f"/admin/users/{world['ids']['member2']}/status",
                 params=as_session(world, "admin"), json={"is_active": False})
    assert world["sessions"].find_one({"session_id": sid_before}) is None


def test_deactivated_user_with_old_session_is_rejected(client, world):
    # Session row still exists (e.g. deactivated directly in the database).
    world["users"].update_one({"_id": world["ids"]["member2"]}, {"$set": {"is_active": False}})
    r = client.get(f"/projects/{world['pid']}/eligible-members", params=as_session(world, "member2"))
    assert r.status_code == 401
    assert r.json()["detail"] == "Not authenticated"


def test_reactivated_user_can_log_in_again(client, world):
    admin = as_session(world, "admin")
    uid = f"/admin/users/{world['ids']['member2']}/status"
    client.patch(uid, params=admin, json={"is_active": False})
    client.patch(uid, params=admin, json={"is_active": True})
    r = client.post("/auth/login", json={"email": "member2@pms.com", "password": PASSWORD})
    assert r.status_code == 200


def test_status_update_rejects_non_boolean(client, world):
    r = client.patch(f"/admin/users/{world['ids']['member2']}/status",
                     params=as_session(world, "admin"), json={"is_active": "maybe"})
    assert r.status_code == 422
