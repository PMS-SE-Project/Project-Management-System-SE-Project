"""Tests for task status updates and task comments."""
from datetime import datetime, timezone

import mongomock
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth import session as session_auth
from app.main import app
from app.routes import project as project_routes


@pytest.fixture
def status_comments_db(monkeypatch):
    db = mongomock.MongoClient()["task_status_comments_test"]
    users, sessions = db["users"], db["sessions"]
    projects, tasks, comments = db["projects"], db["tasks"], db["task_comments"]
    monkeypatch.setattr(session_auth, "users_collection", users)
    monkeypatch.setattr(session_auth, "sessions_collection", sessions)
    monkeypatch.setattr(project_routes, "users_collection", users)
    monkeypatch.setattr(project_routes, "projects_collection", projects)
    monkeypatch.setattr(project_routes, "tasks_collection", tasks)
    monkeypatch.setattr(project_routes, "task_comments_collection", comments)
    tasks.create_index([("project_id", 1), ("title", 1)], unique=True)

    pm_id, other_pm_id, member_id, outsider_id, admin_id = [ObjectId() for _ in range(5)]
    users.insert_many([
        {"_id": pm_id, "email": "pm@example.com", "role": "project_manager"},
        {"_id": other_pm_id, "email": "other-pm@example.com", "role": "project_manager"},
        {"_id": member_id, "email": "member@example.com", "role": "team_member"},
        {"_id": outsider_id, "email": "outsider@example.com", "role": "team_member"},
        {"_id": admin_id, "email": "admin@example.com", "role": "admin"},
    ])
    project_id, other_project_id = ObjectId(), ObjectId()
    projects.insert_many([
        {"_id": project_id, "project_lead": pm_id, "members": [member_id]},
        {"_id": other_project_id, "project_lead": other_pm_id, "members": []},
    ])
    task_id, other_task_id = ObjectId(), ObjectId()
    tasks.insert_many([
        {"_id": task_id, "project_id": project_id, "title": "Primary task", "status": "To Do"},
        {"_id": other_task_id, "project_id": other_project_id, "title": "Other project task", "status": "To Do"},
    ])
    return {"db": db, "pm_id": pm_id, "other_pm_id": other_pm_id, "member_id": member_id,
            "outsider_id": outsider_id, "admin_id": admin_id, "project_id": project_id,
            "other_project_id": other_project_id, "task_id": task_id, "other_task_id": other_task_id}


@pytest.fixture
def client(status_comments_db):
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def authenticate(client, data, role, email):
    session_id = f"{role}-{email}"
    data["db"]["sessions"].insert_one({"session_id": session_id, "email": email, "role": role})
    # The app's session dependency reads session_id from the query string.
    client.params = {"session_id": session_id}


def task_url(data, task_id=None, project_id=None, suffix=""):
    return f"/projects/{project_id or data['project_id']}/tasks/{task_id or data['task_id']}{suffix}"


@pytest.mark.parametrize("new_status", ["To Do", "In Progress", "Completed"])
@pytest.mark.parametrize("role,email", [
    ("project_manager", "pm@example.com"),
    ("team_member", "member@example.com"),
])
def test_project_lead_and_member_can_update_task_status(client, status_comments_db, role, email, new_status):
    authenticate(client, status_comments_db, role, email)
    response = client.patch(task_url(status_comments_db, suffix="/status"), json={"status": new_status})
    assert response.status_code == 200, response.text
    task = response.json()["task"]
    assert task["status"] == new_status
    assert task["id"] == str(status_comments_db["task_id"])
    stored = status_comments_db["db"]["tasks"].find_one({"_id": status_comments_db["task_id"]})
    assert stored["status"] == new_status
    assert stored["updated_at"] is not None


@pytest.mark.parametrize("role,email", [
    ("project_manager", "other-pm@example.com"),
    ("team_member", "outsider@example.com"),
    ("admin", "admin@example.com"),
])
def test_only_project_lead_or_member_can_update_status(client, status_comments_db, role, email):
    authenticate(client, status_comments_db, role, email)
    response = client.patch(task_url(status_comments_db, suffix="/status"), json={"status": "Completed"})
    assert response.status_code == 403, response.text


def test_status_update_requires_authentication(client, status_comments_db):
    response = client.patch(task_url(status_comments_db, suffix="/status"), json={"status": "Completed"})
    assert response.status_code == 401


@pytest.mark.parametrize("payload", [
    {"status": "Blocked"}, {"status": "completed"}, {"status": None},
    {"status": "Completed", "extra": True}, {},
])
def test_invalid_status_payload_is_rejected(client, status_comments_db, payload):
    authenticate(client, status_comments_db, "team_member", "member@example.com")
    response = client.patch(task_url(status_comments_db, suffix="/status"), json=payload)
    assert response.status_code == 422


@pytest.mark.parametrize("task_id", ["bad-id", str(ObjectId())])
def test_status_update_returns_404_for_invalid_or_missing_task(client, status_comments_db, task_id):
    authenticate(client, status_comments_db, "team_member", "member@example.com")
    response = client.patch(task_url(status_comments_db, task_id=task_id, suffix="/status"),
                            json={"status": "In Progress"})
    assert response.status_code == 404


def test_status_update_cannot_cross_project_boundary(client, status_comments_db):
    authenticate(client, status_comments_db, "project_manager", "pm@example.com")
    response = client.patch(
        task_url(status_comments_db, task_id=status_comments_db["other_task_id"], suffix="/status"),
        json={"status": "Completed"},
    )
    assert response.status_code == 404
    stored = status_comments_db["db"]["tasks"].find_one({"_id": status_comments_db["other_task_id"]})
    assert stored["status"] == "To Do"


@pytest.mark.parametrize("role,email", [
    ("project_manager", "pm@example.com"),
    ("team_member", "member@example.com"),
])
def test_project_lead_and_member_can_add_comment(client, status_comments_db, role, email):
    authenticate(client, status_comments_db, role, email)
    response = client.post(task_url(status_comments_db, suffix="/comments"), json={"content": "  Looks good.  "})
    assert response.status_code == 201, response.text
    comment = response.json()["comment"]
    assert comment["content"] == "Looks good."
    assert comment["project_id"] == str(status_comments_db["project_id"])
    assert comment["task_id"] == str(status_comments_db["task_id"])
    assert comment["author_id"] in {str(status_comments_db["pm_id"]), str(status_comments_db["member_id"])}
    assert comment["created_at"]
    assert status_comments_db["db"]["task_comments"].count_documents({"task_id": status_comments_db["task_id"]}) == 1


@pytest.mark.parametrize("role,email", [
    ("project_manager", "other-pm@example.com"),
    ("team_member", "outsider@example.com"),
    ("admin", "admin@example.com"),
])
def test_only_project_lead_or_member_can_add_comments(client, status_comments_db, role, email):
    authenticate(client, status_comments_db, role, email)
    response = client.post(task_url(status_comments_db, suffix="/comments"), json={"content": "Comment"})
    assert response.status_code == 403, response.text


@pytest.mark.parametrize("payload", [
    {"content": ""}, {"content": "   "}, {"content": 123},
    {"content": "Valid", "extra": "field"}, {},
])
def test_invalid_comment_payload_is_rejected(client, status_comments_db, payload):
    authenticate(client, status_comments_db, "team_member", "member@example.com")
    response = client.post(task_url(status_comments_db, suffix="/comments"), json=payload)
    assert response.status_code == 422
    assert status_comments_db["db"]["task_comments"].count_documents({}) == 0


@pytest.mark.parametrize("method", ["post", "get"])
def test_comment_routes_require_authentication(client, status_comments_db, method):
    url = task_url(status_comments_db, suffix="/comments")
    response = client.post(url, json={"content": "Comment"}) if method == "post" else client.get(url)
    assert response.status_code == 401


@pytest.mark.parametrize("task_id", ["bad-id", str(ObjectId())])
@pytest.mark.parametrize("method", ["post", "get"])
def test_comment_routes_return_404_for_invalid_or_missing_task(client, status_comments_db, task_id, method):
    authenticate(client, status_comments_db, "team_member", "member@example.com")
    url = task_url(status_comments_db, task_id=task_id, suffix="/comments")
    response = client.post(url, json={"content": "Comment"}) if method == "post" else client.get(url)
    assert response.status_code == 404


def test_comment_routes_cannot_cross_project_boundary(client, status_comments_db):
    authenticate(client, status_comments_db, "project_manager", "pm@example.com")
    url = task_url(status_comments_db, task_id=status_comments_db["other_task_id"], suffix="/comments")
    assert client.post(url, json={"content": "Comment"}).status_code == 404
    assert client.get(url).status_code == 404
    assert status_comments_db["db"]["task_comments"].count_documents({}) == 0


def test_list_comments_returns_only_task_comments_in_created_order(client, status_comments_db):
    authenticate(client, status_comments_db, "team_member", "member@example.com")
    comments = status_comments_db["db"]["task_comments"]
    older = datetime(2026, 1, 1, tzinfo=timezone.utc)
    newer = datetime(2026, 1, 2, tzinfo=timezone.utc)
    comments.insert_many([
        {"project_id": status_comments_db["project_id"], "task_id": status_comments_db["task_id"],
         "author_id": status_comments_db["member_id"], "content": "Second", "created_at": newer},
        {"project_id": status_comments_db["project_id"], "task_id": status_comments_db["task_id"],
         "author_id": status_comments_db["pm_id"], "content": "First", "created_at": older},
        {"project_id": status_comments_db["project_id"], "task_id": status_comments_db["other_task_id"],
         "author_id": status_comments_db["member_id"], "content": "Other task", "created_at": older},
        {"project_id": status_comments_db["other_project_id"], "task_id": status_comments_db["task_id"],
         "author_id": status_comments_db["member_id"], "content": "Other project", "created_at": older},
    ])
    response = client.get(task_url(status_comments_db, suffix="/comments"))
    assert response.status_code == 200, response.text
    items = response.json()["comments"]
    assert [comment["content"] for comment in items] == ["First", "Second"]
    assert all(comment["task_id"] == str(status_comments_db["task_id"]) for comment in items)
