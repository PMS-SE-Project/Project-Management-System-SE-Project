"""FR-09 task edit/delete endpoint tests using an isolated mongomock database."""
from datetime import date, datetime, timezone

import mongomock
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth import session as session_auth
from app.main import app
from app.routes import project as project_routes


@pytest.fixture
def fr09_db(monkeypatch):
    db = mongomock.MongoClient()["fr09_test"]
    users, sessions = db["users"], db["sessions"]
    projects, tasks = db["projects"], db["tasks"]
    monkeypatch.setattr(session_auth, "users_collection", users)
    monkeypatch.setattr(session_auth, "sessions_collection", sessions)
    monkeypatch.setattr(project_routes, "users_collection", users)
    monkeypatch.setattr(project_routes, "projects_collection", projects)
    monkeypatch.setattr(project_routes, "tasks_collection", tasks)
    tasks.create_index([("project_id", 1), ("title", 1)], unique=True)

    pm_id, other_pm_id, member_id, admin_id = [ObjectId() for _ in range(4)]
    users.insert_many([
        {"_id": pm_id, "email": "pm@example.com", "role": "project_manager"},
        {"_id": other_pm_id, "email": "other@example.com", "role": "project_manager"},
        {"_id": member_id, "email": "member@example.com", "role": "team_member"},
        {"_id": admin_id, "email": "admin@example.com", "role": "admin"},
    ])
    project_id, other_project_id = ObjectId(), ObjectId()
    projects.insert_many([
        {"_id": project_id, "project_lead": pm_id, "members": [member_id]},
        {"_id": other_project_id, "project_lead": other_pm_id, "members": []},
    ])
    task_id, other_task_id = ObjectId(), ObjectId()
    tasks.insert_many([
        {"_id": task_id, "project_id": project_id, "title": "Original", "description": "old",
         "assigned_to": member_id, "priority": "low", "deadline": None},
        {"_id": other_task_id, "project_id": other_project_id, "title": "Other project task",
         "description": None, "assigned_to": None, "priority": "medium", "deadline": None},
        {"project_id": project_id, "title": "Taken", "description": None,
         "assigned_to": None, "priority": "medium", "deadline": None},
    ])
    return {"db": db, "pm_id": pm_id, "other_pm_id": other_pm_id, "member_id": member_id,
            "admin_id": admin_id, "project_id": project_id, "other_project_id": other_project_id,
            "task_id": task_id, "other_task_id": other_task_id}


@pytest.fixture
def client(fr09_db):
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def authenticate(client, data, role="project_manager", email="pm@example.com"):
    sid = f"{role}-session"
    data["db"]["sessions"].insert_one({"session_id": sid, "email": email, "role": role})
    # The endpoint dependency declares session_id as a query parameter.
    client.params = {"session_id": sid}


def task_url(data, task_id=None, project_id=None):
    return f"/projects/{project_id or data['project_id']}/tasks/{task_id or data['task_id']}"


def test_edit_partial_update_normalizes_values_and_preserves_omitted_fields(client, fr09_db):
    authenticate(client, fr09_db)
    response = client.put(task_url(fr09_db), json={"title": "  Revised  ", "priority": " HIGH ", "description": "  details "})
    assert response.status_code == 200, response.text
    task = response.json()["task"]
    assert (task["title"], task["priority"], task["description"]) == ("Revised", "high", "details")
    assert task["assigned_to"] == str(fr09_db["member_id"])
    assert task["updated_at"]


def test_edit_clears_nullable_fields_and_converts_deadline(client, fr09_db):
    authenticate(client, fr09_db)
    future = date.today().replace(year=date.today().year + 1).isoformat()
    response = client.put(task_url(fr09_db), json={"description": "   ", "assigned_to": None, "deadline": future})
    assert response.status_code == 200, response.text
    task = response.json()["task"]
    assert task["description"] is None and task["assigned_to"] is None
    assert task["deadline"] == future
    assert isinstance(fr09_db["db"]["tasks"].find_one({"_id": fr09_db["task_id"]})["deadline"], datetime)


@pytest.mark.parametrize("payload", [
    {"title": "   "}, {"title": None}, {"title": "x" * 201},
    {"description": "x" * 2001}, {"priority": "urgent"}, {"priority": None},
    {"deadline": "2024-1-1"}, {"deadline": "not-a-date"},
    {"assigned_to": "not-an-object-id"}, {"unexpected": "field"},
])
def test_edit_rejects_invalid_payloads_without_mutation(client, fr09_db, payload):
    authenticate(client, fr09_db)
    before = fr09_db["db"]["tasks"].find_one({"_id": fr09_db["task_id"]})
    response = client.put(task_url(fr09_db), json=payload)
    assert response.status_code == 422, response.text
    after = fr09_db["db"]["tasks"].find_one({"_id": fr09_db["task_id"]})
    assert after["title"] == before["title"]


def test_edit_empty_payload_is_rejected(client, fr09_db):
    authenticate(client, fr09_db)
    response = client.put(task_url(fr09_db), json={})
    assert response.status_code == 422
    assert response.json()["detail"] == "At least one field must be provided"


def test_edit_duplicate_title_returns_conflict(client, fr09_db):
    authenticate(client, fr09_db)
    response = client.put(task_url(fr09_db), json={"title": "Taken"})
    assert response.status_code == 409


@pytest.mark.parametrize("role,email", [
    ("project_manager", "other@example.com"), ("team_member", "member@example.com"),
    ("admin", "admin@example.com"),
])
@pytest.mark.parametrize("method", ["put", "delete"])
def test_only_assigned_project_manager_can_edit_or_delete(client, fr09_db, role, email, method):
    authenticate(client, fr09_db, role, email)
    response = getattr(client, method)(task_url(fr09_db), json={"title": "New"}) if method == "put" else client.delete(task_url(fr09_db))
    assert response.status_code == 403, response.text


@pytest.mark.parametrize("method", ["put", "delete"])
def test_missing_session_is_unauthorized(client, fr09_db, method):
    response = getattr(client, method)(task_url(fr09_db), json={"title": "New"}) if method == "put" else client.delete(task_url(fr09_db))
    assert response.status_code == 401


@pytest.mark.parametrize("method", ["put", "delete"])
def test_task_cannot_be_accessed_through_another_project(client, fr09_db, method):
    # Use the lead of the other project; task lookup is constrained by both IDs.
    authenticate(client, fr09_db, "project_manager", "other@example.com")
    url = task_url(fr09_db, project_id=fr09_db["other_project_id"])
    response = getattr(client, method)(url, json={"title": "Hijack"}) if method == "put" else client.delete(url)
    assert response.status_code == 404, response.text
    assert fr09_db["db"]["tasks"].find_one({"_id": fr09_db["task_id"]}) is not None


@pytest.mark.parametrize("method", ["put", "delete"])
def test_invalid_and_missing_task_ids_return_404(client, fr09_db, method):
    authenticate(client, fr09_db)
    for task_id in ("bad-id", str(ObjectId())):
        url = task_url(fr09_db, task_id=task_id)
        response = getattr(client, method)(url, json={"title": "New"}) if method == "put" else client.delete(url)
        assert response.status_code == 404


def test_delete_removes_task_and_returns_message(client, fr09_db):
    authenticate(client, fr09_db)
    response = client.delete(task_url(fr09_db))
    assert response.status_code == 200
    assert response.json() == {"message": "Task deleted successfully"}
    assert fr09_db["db"]["tasks"].find_one({"_id": fr09_db["task_id"]}) is None
