"""Tests for issue #9 - [S1-T03] Project management testing.
SRS: PMS-FR-05 (create project)  |  Test cases: TC-Proj-01, TC-Proj-02, TC-Proj-03

Runs against mongomock. The case-insensitive duplicate rule depends on MongoDB
collation, which mongomock does not implement, so that one test runs only when a
real MongoDB is available via TEST_MONGO_URI (the CI service container provides one).
"""
import os

import mongomock
import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

import app.auth.session as session_module
import app.routes.project as project_module
from app.auth.password import hash_password
from app.main import app

pytestmark = pytest.mark.project

PM = {"email": "pm@pms.com", "role": "project_manager", "session_id": "sid-pm"}
MEMBER = {"email": "member@pms.com", "role": "team_member", "session_id": "sid-member"}
ADMIN = {"email": "admin@pms.com", "role": "admin", "session_id": "sid-admin"}


@pytest.fixture()
def projects(monkeypatch):
    fake_db = mongomock.MongoClient()["pms_projects_test"]
    sessions = fake_db["sessions"]
    for s in (PM, MEMBER, ADMIN):
        sessions.insert_one(dict(s))
    monkeypatch.setattr(session_module, "sessions_collection", sessions)
    coll = fake_db["projects"]
    monkeypatch.setattr(project_module, "projects_collection", coll)
    return coll


@pytest.fixture()
def client(projects):
    return TestClient(app, raise_server_exceptions=False)


def create(client, session, **body):
    return client.post("/projects/", params={"session_id": session["session_id"]}, json=body)


# ---------- TC-Proj-01: valid creation by a Project Manager ----------

def test_pm_creates_project_with_valid_details(client, projects):
    r = create(client, PM, name="Website Revamp", description="Q4 redesign")
    assert r.status_code == 201
    body = r.json()["project"]
    assert body["name"] == "Website Revamp"
    assert body["description"] == "Q4 redesign"
    assert body["created_by"] == PM["email"]
    assert body["status"] == "active"
    assert body["members"] == []
    assert projects.count_documents({"name": "Website Revamp"}) == 1


def test_project_without_description_is_allowed(client):
    r = create(client, PM, name="No Description Project")
    assert r.status_code == 201
    assert r.json()["project"]["description"] is None


def test_name_is_trimmed_before_saving(client, projects):
    r = create(client, PM, name="   Spaced Name   ")
    assert r.status_code == 201
    assert projects.find_one({"name": "Spaced Name"}) is not None


# ---------- TC-Proj-02: input validation and duplicate names ----------

@pytest.mark.parametrize("name", ["", " ", "A"])
def test_name_too_short_rejected(client, projects, name):
    assert create(client, PM, name=name).status_code == 422
    assert projects.count_documents({}) == 0


def test_name_too_long_rejected(client, projects):
    assert create(client, PM, name="x" * 101).status_code == 422
    assert projects.count_documents({}) == 0


def test_name_at_maximum_length_accepted(client):
    assert create(client, PM, name="x" * 100).status_code == 201


def test_description_too_long_rejected(client, projects):
    assert create(client, PM, name="Valid Name", description="d" * 501).status_code == 422
    assert projects.count_documents({}) == 0


def test_missing_name_rejected(client):
    r = client.post("/projects/", params={"session_id": PM["session_id"]}, json={"description": "x"})
    assert r.status_code == 422


def test_duplicate_exact_name_rejected_with_409(client, projects):
    assert create(client, PM, name="Alpha Team").status_code == 201
    r = create(client, PM, name="Alpha Team")
    assert r.status_code == 409
    assert r.json()["detail"] == "A project with this name already exists"
    assert projects.count_documents({"name": "Alpha Team"}) == 1


def test_duplicate_check_ignores_surrounding_spaces(client, projects):
    assert create(client, PM, name="Beta Team").status_code == 201
    assert create(client, PM, name="  Beta Team  ").status_code == 409


# ---------- TC-Proj-03: only Project Managers may create projects ----------

@pytest.mark.parametrize("session", [MEMBER, ADMIN], ids=["team_member", "admin"])
def test_non_pm_roles_forbidden_from_creating(client, projects, session):
    r = create(client, session, name="Should Not Exist")
    assert r.status_code == 403
    assert r.json()["detail"] == "Only Project Managers can create projects"
    assert projects.count_documents({}) == 0


def test_missing_session_rejected(client):
    r = client.post("/projects/", json={"name": "No Session"})
    assert r.status_code == 422  # session_id query parameter is required


def test_unknown_session_rejected(client, projects):
    r = client.post("/projects/", params={"session_id": "no-such"}, json={"name": "Ghost"})
    assert r.status_code == 401
    assert projects.count_documents({}) == 0


# ---------- Case-insensitive duplicate rule (needs real MongoDB collation) ----------

REAL_URI = os.getenv("TEST_MONGO_URI") or os.getenv("MONGO_URI")


@pytest.mark.skipif(not REAL_URI, reason="needs a real MongoDB; set TEST_MONGO_URI (CI provides one)")
def test_duplicate_name_ignores_case_with_real_mongo(monkeypatch):
    real = MongoClient(REAL_URI)
    db = real[os.getenv("DATABASE_NAME", "pms_test_projects")]
    coll = db["projects_case_test"]
    coll.drop()
    coll.create_index([("name", 1)], unique=True, collation={"locale": "en", "strength": 2})

    sessions = mongomock.MongoClient()["s"]["sessions"]
    sessions.insert_one(dict(PM))
    monkeypatch.setattr(session_module, "sessions_collection", sessions)
    monkeypatch.setattr(project_module, "projects_collection", coll)
    client = TestClient(app, raise_server_exceptions=False)
    try:
        assert create(client, PM, name="Gamma Team").status_code == 201
        r = create(client, PM, name="GAMMA TEAM")
        assert r.status_code == 409
    finally:
        coll.drop()
        real.close()
