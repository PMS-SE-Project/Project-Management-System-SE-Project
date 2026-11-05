"""Tests for issue #9 scope - PMS-FR-08 create task.
Proposed test cases: TC-Task-01 (create), TC-Task-02 (validation), TC-Task-03 (assignment rules),
TC-Task-04 (authorization). To be added to the test plan.
Runs against mongomock.
"""
from datetime import date, datetime, timedelta, timezone

import mongomock
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

import app.auth.session as session_module
import app.routes.project as project_module
from app.auth.password import hash_password
from app.main import app

pytestmark = pytest.mark.project

HASH = hash_password("Pass@123")
FUTURE = (date.today() + timedelta(days=30)).isoformat()


@pytest.fixture()
def world(monkeypatch):
    db = mongomock.MongoClient()["pms_tasks_test"]
    users, sessions = db["users"], db["sessions"]
    projects, tasks = db["projects"], db["tasks"]

    def user(email, role, active=True):
        return users.insert_one({"name": email, "email": email, "password_hash": HASH,
                                 "role": role, "is_active": active}).inserted_id

    ids = {
        "pm": user("pm@pms.com", "project_manager"),
        "pm2": user("pm2@pms.com", "project_manager"),
        "member": user("member@pms.com", "team_member"),
        "member2": user("member2@pms.com", "team_member"),
        "outsider": user("outsider@pms.com", "team_member"),
        "inactive": user("gone@pms.com", "team_member", active=False),
        "admin": user("admin@pms.com", "admin"),
    }
    pid = projects.insert_one({
        "name": "Alpha Project", "created_by": "pm@pms.com",
        "project_lead": ids["pm"], "members": [ids["member"], ids["member2"], ids["inactive"]],
        "status": "active",
    }).inserted_id
    other_pid = projects.insert_one({
        "name": "Beta Project", "created_by": "pm2@pms.com",
        "project_lead": ids["pm2"], "members": [], "status": "active",
    }).inserted_id

    sids = {}
    for key, uid in ids.items():
        doc = users.find_one({"_id": uid})
        sids[key] = f"sid-{key}"
        sessions.insert_one({"session_id": sids[key], "user_id": uid,
                             "email": doc["email"], "role": doc["role"]})

    for module in (session_module, project_module):
        for name, coll in (("users_collection", users), ("sessions_collection", sessions),
                           ("projects_collection", projects), ("tasks_collection", tasks)):
            if hasattr(module, name):
                monkeypatch.setattr(module, name, coll)

    return {"users": users, "projects": projects, "tasks": tasks, "ids": ids,
            "sids": sids, "pid": pid, "other_pid": other_pid}


@pytest.fixture()
def client(world):
    return TestClient(app, raise_server_exceptions=False)


def url(w, pid=None):
    return f"/projects/{pid or w['pid']}/tasks"


def body(**overrides):
    data = {"title": "Design login page", "description": "Wireframes first",
            "priority": "medium", "deadline": FUTURE}
    data.update(overrides)
    return data


def post(client, w, who, pid=None, **overrides):
    return client.post(url(w, pid), params={"session_id": w["sids"][who]}, json=body(**overrides))


# ---------- TC-Task-01: create ----------

def test_pm_creates_task_with_defaults_and_saves_it(client, world):
    r = client.post(url(world), params={"session_id": world["sids"]["pm"]},
                    json={"title": "Write spec"})
    assert r.status_code == 201
    task = r.json()["task"]
    assert task["title"] == "Write spec"
    assert task["priority"] == "medium"
    assert task["assigned_to"] is None
    assert task["deadline"] is None
    assert task["created_by"] == "pm@pms.com"
    stored = world["tasks"].find_one({"_id": ObjectId(task["id"])})
    assert stored["project_id"] == world["pid"]


def test_task_with_assignee_and_deadline_is_saved(client, world):
    r = post(client, world, "pm", assigned_to=str(world["ids"]["member"]))
    assert r.status_code == 201
    task = r.json()["task"]
    assert task["assigned_to"] == str(world["ids"]["member"])
    assert task["deadline"] == FUTURE
    assert isinstance(world["tasks"].find_one({"_id": ObjectId(task["id"])})["deadline"], datetime)


def test_title_is_trimmed(client, world):
    r = post(client, world, "pm", title="   Trimmed   ")
    assert r.status_code == 201
    assert r.json()["task"]["title"] == "Trimmed"


def test_blank_description_is_stored_as_none(client, world):
    r = post(client, world, "pm", description="    ")
    assert r.status_code == 201
    assert r.json()["task"]["description"] is None


def test_priority_is_case_insensitive(client, world):
    r = post(client, world, "pm", priority="HIGH")
    assert r.status_code == 201
    assert r.json()["task"]["priority"] == "high"


# ---------- TC-Task-02: validation ----------

@pytest.mark.parametrize("title", ["", "   ", "x" * 201])
def test_invalid_title_rejected(client, world, title):
    assert post(client, world, "pm", title=title).status_code == 422
    assert world["tasks"].count_documents({}) == 0


def test_description_over_limit_rejected(client, world):
    assert post(client, world, "pm", description="d" * 2001).status_code == 422


@pytest.mark.parametrize("priority", ["urgent", "", None])
def test_invalid_priority_rejected(client, world, priority):
    assert post(client, world, "pm", priority=priority).status_code == 422


@pytest.mark.parametrize("deadline", ["2000-01-01", "01-12-2099", "2099-1-5", "tomorrow"])
def test_bad_deadline_rejected(client, world, deadline):
    assert post(client, world, "pm", deadline=deadline).status_code == 422


def test_unknown_field_rejected(client, world):
    assert post(client, world, "pm", status="done").status_code == 422


def test_malformed_assignee_id_rejected(client, world):
    assert post(client, world, "pm", assigned_to="not-an-id").status_code == 422


def test_duplicate_title_in_same_project_rejected(client, world):
    assert post(client, world, "pm", title="Same Title").status_code == 201
    r = post(client, world, "pm", title="Same Title")
    assert r.status_code == 409
    assert r.json()["detail"] == "A task with this title already exists in the project"


def test_same_title_allowed_in_a_different_project(client, world):
    assert post(client, world, "pm", title="Shared Title").status_code == 201
    assert post(client, world, "pm2", pid=world["other_pid"], title="Shared Title").status_code == 201


# ---------- TC-Task-03: assignment rules ----------

@pytest.mark.parametrize("who", ["pm", "admin"])
def test_assignee_must_be_team_member(client, world, who):
    r = post(client, world, "pm", assigned_to=str(world["ids"][who]))
    assert r.status_code == 403
    assert r.json()["detail"] == "Assigned user must be a team member"


def test_inactive_assignee_rejected(client, world):
    r = post(client, world, "pm", assigned_to=str(world["ids"]["inactive"]))
    assert r.status_code == 403
    assert r.json()["detail"] == "Inactive users cannot be assigned to a task"


def test_unknown_assignee_returns_404(client, world):
    r = post(client, world, "pm", assigned_to=str(ObjectId()))
    assert r.status_code == 404
    assert r.json()["detail"] == "Assigned user not found"


def test_team_member_outside_project_cannot_be_assigned(client, world):
    r = post(client, world, "pm", assigned_to=str(world["ids"]["outsider"]))
    assert r.status_code == 403
    assert r.json()["detail"] == "Assigned user is not a member of this project"


# ---------- TC-Task-04: authorization ----------

@pytest.mark.parametrize("who", ["pm2", "member", "admin"])
def test_only_assigned_pm_can_create_tasks(client, world, who):
    r = post(client, world, who)
    assert r.status_code == 403
    assert r.json()["detail"] == "Only the assigned Project Manager can create tasks"
    assert world["tasks"].count_documents({}) == 0


def test_unknown_session_cannot_create_task(client, world):
    r = client.post(url(world), params={"session_id": "nobody"}, json=body())
    assert r.status_code == 401


def test_missing_session_cannot_create_task(client, world):
    assert client.post(url(world), json=body()).status_code == 422


def test_unknown_project_returns_404(client, world):
    r = post(client, world, "pm", pid=str(ObjectId()))
    assert r.status_code == 404
