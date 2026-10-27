"""Shared fixtures. Tests run against an in-memory fake MongoDB (mongomock),
so no real database needs to be running."""
import mongomock
import pytest
from fastapi.testclient import TestClient

from app.auth.password import hash_password
from app.main import app
import app.routes.auth as auth_routes

USERS = {
    "admin": ("admin@pms.com", "Admin@123", "admin"),
    "pm": ("pm@pms.com", "Manager@123", "project_manager"),
    "member": ("member@pms.com", "Member@123", "team_member"),
}


@pytest.fixture()
def db(monkeypatch):
    """Fresh fake DB per test, swapped into the auth routes."""
    fake = mongomock.MongoClient()["pms_test_db"]
    monkeypatch.setattr(auth_routes, "users_collection", fake["users"])
    monkeypatch.setattr(auth_routes, "sessions_collection", fake["sessions"])
    for email, password, role in USERS.values():
        fake["users"].insert_one(
            {"email": email, "password_hash": hash_password(password), "role": role}
        )
    return fake


@pytest.fixture()
def client(db):
    return TestClient(app, raise_server_exceptions=False)


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})
