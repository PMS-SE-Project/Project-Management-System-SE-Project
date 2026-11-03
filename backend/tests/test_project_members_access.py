"""Access-control tests added after review of PR #53 (PMS-FR-07).
Original docstring follows.

Tests for issue #6/#9 scope - PMS-FR-07 manage project members, plus the
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



def members_url(w):
    return f"/projects/{w['pid']}/members"


def as_session(w, who):
    return {"session_id": w["sids"][who]}


# ---------- Eligible-members endpoint: unauthorized roles ----------

@pytest.mark.parametrize("who,detail", [
    ("member", "Only the assigned Project Manager can manage project members"),
    ("pm2", "Only the assigned Project Manager can manage project members"),
    ("admin", "Only the assigned Project Manager can manage project members"),
])
def test_eligible_members_forbidden_for_unauthorized_roles(client, world, who, detail):
    r = client.get(f"/projects/{world['pid']}/eligible-members", params=as_session(world, who))
    assert r.status_code == 403
    assert r.json()["detail"] == detail


# ---------- Admin user routes: non-admins are blocked ----------

@pytest.mark.parametrize("who", ["pm", "member"])
def test_non_admins_cannot_list_users(client, world, who):
    r = client.get("/admin/users", params=as_session(world, who))
    assert r.status_code == 403
    assert r.json()["detail"] == "Forbidden"


@pytest.mark.parametrize("who", ["pm", "member"])
def test_non_admins_cannot_update_users(client, world, who):
    r = client.put(f"/admin/users/{world['ids']['member2']}", params=as_session(world, who),
                   json={"name": "Hacked"})
    assert r.status_code == 403
    assert world["users"].find_one({"_id": world["ids"]["member2"]})["name"] == "Member Two"


@pytest.mark.parametrize("who", ["pm", "member"])
def test_non_admins_cannot_change_user_status(client, world, who):
    r = client.patch(f"/admin/users/{world['ids']['member2']}/status",
                     params=as_session(world, who), json={"is_active": False})
    assert r.status_code == 403
    assert world["users"].find_one({"_id": world["ids"]["member2"]})["is_active"] is True


# ---------- Project lead and other PMs cannot be members ----------

def test_project_lead_cannot_be_added_as_member(client, world):
    r = client.post(members_url(world), params=as_session(world, "pm"),
                    json={"user_id": str(world["ids"]["pm"])})
    assert r.status_code == 403
    assert r.json()["detail"] == "Only team members can be added to a project"
    assert world["ids"]["pm"] not in world["projects"].find_one({"_id": world["pid"]})["members"]


def test_other_pm_cannot_add_members_to_this_project(client, world):
    r = client.post(members_url(world), params=as_session(world, "pm2"),
                    json={"user_id": str(world["ids"]["member2"])})
    assert r.status_code == 403
    assert world["ids"]["member2"] not in world["projects"].find_one({"_id": world["pid"]})["members"]
