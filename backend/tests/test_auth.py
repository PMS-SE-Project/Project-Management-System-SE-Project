import pytest
from fastapi.testclient import TestClient

from app.auth.password import hash_password
from app.main import app
import app.routes.auth as auth_routes


class InMemoryCollection:
    def __init__(self):
        self.documents = []

    def find_one(self, query):
        return next(
            (document for document in self.documents
             if all(document.get(key) == value for key, value in query.items())),
            None,
        )

    def insert_one(self, document):
        self.documents.append(document)


@pytest.fixture
def client(monkeypatch):
    users = InMemoryCollection()
    sessions = InMemoryCollection()
    users.insert_one({
        "email": "admin@pms.com",
        "password_hash": hash_password("Admin@123"),
        "role": "admin",
    })
    monkeypatch.setattr(auth_routes, "users_collection", users)
    monkeypatch.setattr(auth_routes, "sessions_collection", sessions)
    return TestClient(app)


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_login_very_long_password_returns_invalid_credentials(client):
    response = login(client, "admin@pms.com", "A" * 5000)

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}


def test_login_correct_password_still_succeeds(client):
    response = login(client, "admin@pms.com", "Admin@123")

    assert response.status_code == 200


def test_login_incorrect_password_returns_invalid_credentials(client):
    response = login(client, "admin@pms.com", "WrongPass1")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}


def test_login_email_matching_is_case_sensitive(client):
    response = login(client, "ADMIN@PMS.COM", "Admin@123")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid email or password"}
