"""Tests for issue #9 - [S1-T03] Project management testing: edit project (PMS-FR-06).
Proposed test cases: TC-Proj-04 to TC-Proj-09 (to be added to the test plan).

Runs against mongomock. The case-insensitive duplicate rule depends on MongoDB
collation, which mongomock does not implement, so that test runs only when a real
MongoDB is available via TEST_MONGO_URI.
"""
import os
from datetime import date, datetime, timezone

import mongomock
import pytest
from bson import ObjectId
from fastapi.testclient import TestClient
from pymongo import MongoClient

import app.auth.session as session_module
import app.routes.project as project_module
from app.main import app

pytestmark = pytest.mark.project

PM = {"email": "pm@pms.com", "role": "project_manager", "session_id": "sid-pm"}
PM2 = {"email": "pm2@pms.com", "role": "project_manager", "session_id": "sid-pm2"}
MEMBER = {"email": "member@pms.com", "role": "team_member", "session_id": "sid-member"}
ADMIN = {"email": "admin@pms.com", "role": "admin", "session_id": "sid-admin"}


@pytest.fixture()
def env(monkeypatch):
    db = mongomock.MongoClient()["pms_edit_test"]
    sessions = db["sessions"]
    for s in (PM, PM2, MEMBER, ADMIN):
        sessions.insert_one(dict(s))
    users = db["users"]
    pm_user_id = users.insert_one({"email": PM2["email"], "role": "project_manager", "name": "Second PM"}).inserted_id
    users.insert_one({"email": MEMBER["email"], "role": "team_member"})
    users.insert_one({"email": PM["email"], "role": "project_manager", "name": "First PM"})
    projects = db["projects"]
    monkeypatch.setattr(session_module, "sessions_collection", sessions)
    monkeypatch.setattr(project_module, "projects_collection", projects)
    monkeypatch.setattr(project_module, "users_collection", users)
    return {"projects": projects, "users": users, "pm2_id": pm_user_id}


@pytest.fixture()
def client(env):
    return TestClient(app, raise_server_exceptions=False)


def seed(projects, name="Alpha Project", **extra):
    doc = {
        "name": name,
        "description": "original",
        "created_by": PM["email"],
        "members": [],
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        **extra,
    }
    return projects.insert_one(doc).inserted_id


def put(client, session, project_id, **body):
    return client.put(
        f"/projects/{project_id}",
        params={"session_id": session["session_id"]},
        json=body,
    )


# ---------- TC-Proj-04: a Project Manager edits project details ----------

def test_pm_updates_name_and_description(client, env):
    pid = seed(env["projects"])
    r = put(client, PM, pid, name="Renamed Project", description="new text")
    assert r.status_code == 200
    body = r.json()["project"]
    assert body["name"] == "Renamed Project"
    assert body["description"] == "new text"
    stored = env["projects"].find_one({"_id": pid})
    assert stored["name"] == "Renamed Project"
    assert stored["updated_at"] is not None


def test_partial_update_leaves_other_fields_unchanged(client, env):
    pid = seed(env["projects"])
    r = put(client, PM, pid, status="completed")
    assert r.status_code == 200
    stored = env["projects"].find_one({"_id": pid})
    assert stored["status"] == "completed"
    assert stored["name"] == "Alpha Project"
    assert stored["description"] == "original"


def test_description_can_be_cleared(client, env):
    pid = seed(env["projects"])
    assert put(client, PM, pid, description="   ").status_code == 200
    assert env["projects"].find_one({"_id": pid})["description"] is None


def test_updating_to_own_name_is_not_a_duplicate(client, env):
    pid = seed(env["projects"], name="Same Name")
    assert put(client, PM, pid, name="Same Name").status_code == 200


# ---------- TC-Proj-05: dates ----------

def test_valid_date_range_accepted(client, env):
    pid = seed(env["projects"])
    r = put(client, PM, pid, start_date="2026-01-01", target_end_date="2026-06-30")
    assert r.status_code == 200
    assert r.json()["project"]["start_date"].startswith("2026-01-01")
    assert r.json()["project"]["target_end_date"].startswith("2026-06-30")


def test_end_date_equal_to_start_rejected(client, env):
    pid = seed(env["projects"])
    r = put(client, PM, pid, start_date="2026-03-01", target_end_date="2026-03-01")
    assert r.status_code == 422
    assert r.json()["detail"] == "Target end date must be later than start date"


def test_end_date_before_start_rejected(client, env):
    pid = seed(env["projects"])
    r = put(client, PM, pid, start_date="2026-05-01", target_end_date="2026-04-01")
    assert r.status_code == 422


def test_new_end_date_checked_against_stored_start_date(client, env):
    pid = seed(env["projects"], start_date=datetime(2026, 5, 1, tzinfo=timezone.utc))
    r = put(client, PM, pid, target_end_date="2026-04-01")
    assert r.status_code == 422


def test_new_start_date_checked_against_stored_end_date(client, env):
    pid = seed(env["projects"], target_end_date=datetime(2026, 4, 1, tzinfo=timezone.utc))
    r = put(client, PM, pid, start_date="2026-05-01")
    assert r.status_code == 422


# ---------- TC-Proj-06: status values ----------

@pytest.mark.parametrize("given,stored", [
    ("On Hold", "on_hold"),
    ("active", "active"),
    ("  COMPLETED ", "completed"),
])
def test_status_is_normalised(client, env, given, stored):
    pid = seed(env["projects"])
    assert put(client, PM, pid, status=given).status_code == 200
    assert env["projects"].find_one({"_id": pid})["status"] == stored


@pytest.mark.parametrize("bad", ["paused", "", "done"])
def test_unknown_status_rejected(client, env, bad):
    pid = seed(env["projects"])
    assert put(client, PM, pid, status=bad).status_code == 422
    assert env["projects"].find_one({"_id": pid})["status"] == "active"


def test_null_status_rejected(client, env):
    pid = seed(env["projects"])
    assert put(client, PM, pid, status=None).status_code == 422


# ---------- TC-Proj-07: project lead must be a Project Manager ----------

def test_project_manager_can_be_set_as_lead(client, env):
    pid = seed(env["projects"])
    r = put(client, PM, pid, project_lead=str(env["pm2_id"]))
    assert r.status_code == 200
    assert r.json()["project"]["project_lead"] == str(env["pm2_id"])
    assert env["projects"].find_one({"_id": pid})["project_lead"] == env["pm2_id"]


def test_team_member_cannot_be_lead(client, env):
    pid = seed(env["projects"])
    member_id = env["users"].find_one({"email": MEMBER["email"]})["_id"]
    r = put(client, PM, pid, project_lead=str(member_id))
    assert r.status_code == 422
    assert r.json()["detail"] == "Project lead must be a Project Manager"
    assert "project_lead" not in env["projects"].find_one({"_id": pid})


def test_unknown_lead_id_returns_404(client, env):
    pid = seed(env["projects"])
    r = put(client, PM, pid, project_lead=str(ObjectId()))
    assert r.status_code == 404
    assert r.json()["detail"] == "Project lead not found"


def test_malformed_lead_id_rejected(client, env):
    pid = seed(env["projects"])
    assert put(client, PM, pid, project_lead="not-an-id").status_code == 422


# ---------- TC-Proj-08: request validation and duplicates ----------

def test_empty_body_rejected(client, env):
    pid = seed(env["projects"])
    r = put(client, PM, pid)
    assert r.status_code == 422
    assert r.json()["detail"] == "At least one field must be provided"


def test_unknown_field_rejected(client, env):
    pid = seed(env["projects"])
    assert put(client, PM, pid, priority="high").status_code == 422


def test_null_name_rejected(client, env):
    pid = seed(env["projects"])
    assert put(client, PM, pid, name=None).status_code == 422
    assert env["projects"].find_one({"_id": pid})["name"] == "Alpha Project"


def test_one_character_name_rejected(client, env):
    pid = seed(env["projects"])
    assert put(client, PM, pid, name="A").status_code == 422


def test_duplicate_name_of_another_project_rejected(client, env):
    seed(env["projects"], name="Taken Name")
    pid = seed(env["projects"], name="Other Project")
    r = put(client, PM, pid, name="Taken Name")
    assert r.status_code == 409
    assert r.json()["detail"] == "A project with this name already exists"
    assert env["projects"].find_one({"_id": pid})["name"] == "Other Project"


# ---------- TC-Proj-09: authorization and missing resources ----------

@pytest.mark.parametrize("session", [MEMBER, ADMIN], ids=["team_member", "admin"])
def test_non_pm_roles_cannot_edit(client, env, session):
    pid = seed(env["projects"])
    r = put(client, session, pid, name="Hijacked")
    assert r.status_code == 403
    assert r.json()["detail"] == "Only Project Managers can edit projects"
    assert env["projects"].find_one({"_id": pid})["name"] == "Alpha Project"


def test_unknown_session_cannot_edit(client, env):
    pid = seed(env["projects"])
    r = client.put(f"/projects/{pid}", params={"session_id": "nobody"}, json={"name": "X Name"})
    assert r.status_code == 401


def test_missing_project_returns_404(client, env):
    r = put(client, PM, ObjectId(), name="Ghost Project")
    assert r.status_code == 404
    assert r.json()["detail"] == "Project not found"


def test_malformed_project_id_returns_404(client, env):
    r = client.put("/projects/not-an-id", params={"session_id": PM["session_id"]}, json={"name": "X Name"})
    assert r.status_code == 404


# ---------- Eligible project leads endpoint (used by the FR-06 dropdown) ----------

def test_eligible_leads_lists_only_project_managers(client, env):
    r = client.get("/projects/eligible-leads", params={"session_id": PM["session_id"]})
    assert r.status_code == 200
    emails = {lead["email"] for lead in r.json()["eligible_leads"]}
    assert emails == {PM["email"], PM2["email"]}
    assert MEMBER["email"] not in emails


# ---------- Case-insensitive duplicate rule (needs real MongoDB collation) ----------

REAL_URI = os.getenv("TEST_MONGO_URI") or os.getenv("MONGO_URI")


@pytest.mark.skipif(not REAL_URI, reason="needs a real MongoDB; set TEST_MONGO_URI")
def test_update_duplicate_name_ignores_case_with_real_mongo(monkeypatch):
    real = MongoClient(REAL_URI)
    coll = real[os.getenv("DATABASE_NAME", "pms_test_projects")]["projects_edit_case_test"]
    coll.drop()
    coll.create_index([("name", 1)], unique=True, collation={"locale": "en", "strength": 2})
    coll.insert_one({"name": "Delta Team", "created_by": PM["email"]})
    other = coll.insert_one({"name": "Epsilon Team", "created_by": PM["email"]}).inserted_id

    sessions = mongomock.MongoClient()["s"]["sessions"]
    sessions.insert_one(dict(PM))
    users = mongomock.MongoClient()["u"]["users"]
    monkeypatch.setattr(session_module, "sessions_collection", sessions)
    monkeypatch.setattr(project_module, "projects_collection", coll)
    monkeypatch.setattr(project_module, "users_collection", users)
    client = TestClient(app, raise_server_exceptions=False)
    try:
        r = put(client, PM, other, name="DELTA TEAM")
        assert r.status_code == 409
    finally:
        coll.drop()
        real.close()
