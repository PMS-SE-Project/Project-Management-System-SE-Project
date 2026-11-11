"""Tests for FR task listing, assignment, and priority behavior."""
import mongomock
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient

from app.auth import session as session_auth
from app.main import app
from app.routes import project as project_routes


@pytest.fixture
def task_db(monkeypatch):
    db = mongomock.MongoClient()["task_list_test"]
    users, sessions = db["users"], db["sessions"]
    projects, tasks = db["projects"], db["tasks"]
    monkeypatch.setattr(session_auth, "users_collection", users)
    monkeypatch.setattr(session_auth, "sessions_collection", sessions)
    monkeypatch.setattr(project_routes, "users_collection", users)
    monkeypatch.setattr(project_routes, "projects_collection", projects)
    monkeypatch.setattr(project_routes, "tasks_collection", tasks)
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

    task_rows = [
        {"_id": ObjectId(), "project_id": project_id, "title": "Todo assigned", "assigned_to": member_id,
         "priority": "high", "status": "To Do"},
        {"_id": ObjectId(), "project_id": project_id, "title": "In progress assigned", "assigned_to": member_id,
         "priority": "medium", "status": "In Progress"},
        {"_id": ObjectId(), "project_id": project_id, "title": "Completed unassigned", "assigned_to": None,
         "priority": "low", "status": "Completed"},
        # Older tasks without a status are treated as To Do by the list endpoint.
        {"_id": ObjectId(), "project_id": project_id, "title": "Legacy task", "assigned_to": None,
         "priority": "medium"},
        {"_id": ObjectId(), "project_id": other_project_id, "title": "Other project", "assigned_to": member_id,
         "priority": "high", "status": "To Do"},
    ]
    tasks.insert_many(task_rows)
    return {"db": db, "pm_id": pm_id, "other_pm_id": other_pm_id, "member_id": member_id,
            "outsider_id": outsider_id, "admin_id": admin_id, "project_id": project_id,
            "other_project_id": other_project_id, "rows": task_rows}


@pytest.fixture
def client(task_db):
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


def authenticate(client, data, role, email):
    session_id = f"{role}-{email}"
    data["db"]["sessions"].insert_one({"session_id": session_id, "email": email, "role": role})
    # The app's session dependency reads session_id from the query string.
    client.params = {"session_id": session_id}


def project_tasks_url(data, project_id=None):
    return f"/projects/{project_id or data['project_id']}/tasks"


@pytest.mark.parametrize("role,email", [
    ("project_manager", "pm@example.com"),
    ("team_member", "member@example.com"),
    ("admin", "admin@example.com"),
])
def test_project_task_list_is_available_to_authorized_viewers(client, task_db, role, email):
    authenticate(client, task_db, role, email)
    response = client.get(project_tasks_url(task_db))
    assert response.status_code == 200, response.text
    tasks = response.json()["tasks"]
    assert len(tasks) == 4
    assert all(task["project_id"] == str(task_db["project_id"]) for task in tasks)
    assert {task["status"] for task in tasks} == {"To Do", "In Progress", "Completed"}


@pytest.mark.parametrize("role,email", [
    ("project_manager", "other-pm@example.com"),
    ("team_member", "outsider@example.com"),
])
def test_project_task_list_forbidden_without_project_access(client, task_db, role, email):
    authenticate(client, task_db, role, email)
    response = client.get(project_tasks_url(task_db))
    assert response.status_code == 403


def test_project_task_list_requires_authentication(client, task_db):
    response = client.get(project_tasks_url(task_db))
    assert response.status_code == 422


def test_task_filters_can_be_combined(client, task_db):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.get(project_tasks_url(task_db), params={
        "status": "To Do", "assigned_to": str(task_db["member_id"]), "priority": " HIGH "
    })
    assert response.status_code == 200, response.text
    tasks = response.json()["tasks"]
    assert [task["title"] for task in tasks] == ["Todo assigned"]


@pytest.mark.parametrize("status_value,expected_titles", [
    ("To Do", {"Todo assigned", "Legacy task"}),
    ("In Progress", {"In progress assigned"}),
    ("Completed", {"Completed unassigned"}),
])
def test_status_filter_returns_matching_tasks(client, task_db, status_value, expected_titles):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.get(project_tasks_url(task_db), params={"status": status_value})
    assert response.status_code == 200, response.text
    assert {task["title"] for task in response.json()["tasks"]} == expected_titles


@pytest.mark.parametrize("priority", ["low", "medium", "high", " HIGH "])
def test_priority_filter_is_case_normalized(client, task_db, priority):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.get(project_tasks_url(task_db), params={"priority": priority})
    assert response.status_code == 200, response.text
    expected_priority = priority.strip().lower()
    assert response.json()["tasks"]
    assert {task["priority"] for task in response.json()["tasks"]} == {expected_priority}


def test_assignee_filter_returns_only_assigned_tasks(client, task_db):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.get(project_tasks_url(task_db), params={"assigned_to": str(task_db["member_id"])})
    assert response.status_code == 200, response.text
    tasks = response.json()["tasks"]
    assert {task["title"] for task in tasks} == {"Todo assigned", "In progress assigned"}


@pytest.mark.parametrize("params,detail", [
    ({"status": "Blocked"}, "Status must be To Do, In Progress, or Completed"),
    ({"priority": "urgent"}, "Priority must be low, medium, or high"),
    ({"assigned_to": "bad-id"}, "Invalid assignee ID"),
])
def test_invalid_task_filters_return_422(client, task_db, params, detail):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.get(project_tasks_url(task_db), params=params)
    assert response.status_code == 422
    assert response.json()["detail"] == detail


def test_project_task_list_does_not_leak_tasks_from_other_projects(client, task_db):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.get(project_tasks_url(task_db))
    assert response.status_code == 200
    assert "Other project" not in {task["title"] for task in response.json()["tasks"]}


def test_my_tasks_returns_only_current_members_tasks(client, task_db):
    authenticate(client, task_db, "team_member", "member@example.com")
    response = client.get("/projects/tasks/my-tasks")
    assert response.status_code == 200, response.text
    tasks = response.json()["tasks"]
    assert {task["title"] for task in tasks} == {"Todo assigned", "In progress assigned", "Other project"}
    assert all(task["assigned_to"] == str(task_db["member_id"]) for task in tasks)


@pytest.mark.parametrize("role,email", [
    ("project_manager", "pm@example.com"), ("admin", "admin@example.com")
])
def test_my_tasks_is_limited_to_team_members(client, task_db, role, email):
    authenticate(client, task_db, role, email)
    response = client.get("/projects/tasks/my-tasks")
    assert response.status_code == 403


def test_create_task_persists_priority_assignee_and_default_status(client, task_db):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.post(f"/projects/{task_db['project_id']}/tasks", json={
        "title": "New assigned task", "assigned_to": str(task_db["member_id"]), "priority": " HIGH "
    })
    assert response.status_code == 201, response.text
    task = response.json()["task"]
    assert task["assigned_to"] == str(task_db["member_id"])
    assert task["priority"] == "high"
    assert task["status"] == "To Do"


@pytest.mark.parametrize("payload,expected_status", [
    ({"title": "Missing user", "assigned_to": str(ObjectId())}, 404),
    ({"title": "Assign PM", "assigned_to": str(ObjectId())}, 404),
    ({"title": "Bad ID", "assigned_to": "not-an-object-id"}, 422),
])
def test_create_task_rejects_invalid_assignee(client, task_db, payload, expected_status):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    if payload["title"] == "Assign PM":
        payload["assigned_to"] = str(task_db["pm_id"])
        expected_status = 403
    response = client.post(f"/projects/{task_db['project_id']}/tasks", json=payload)
    assert response.status_code == expected_status, response.text


def test_create_task_rejects_assignee_outside_project(client, task_db):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.post(f"/projects/{task_db['project_id']}/tasks", json={
        "title": "Outside member", "assigned_to": str(task_db["outsider_id"])
    })
    assert response.status_code == 403


def test_create_task_defaults_to_medium_priority_and_unassigned(client, task_db):
    authenticate(client, task_db, "project_manager", "pm@example.com")
    response = client.post(f"/projects/{task_db['project_id']}/tasks", json={"title": "Default values"})
    assert response.status_code == 201, response.text
    task = response.json()["task"]
    assert task["priority"] == "medium"
    assert task["assigned_to"] is None
    assert task["status"] == "To Do"
