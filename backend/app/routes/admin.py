import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.errors import DuplicateKeyError

from app.auth.password import hash_password
from app.auth.session import get_current_session_or_401
from app.database.connection import projects_collection, sessions_collection, users_collection
from app.schemas.user import AdminUserCreate, AdminUserUpdate, UserStatusUpdate

router = APIRouter(prefix="/admin", tags=["Administration"])


def require_admin(session=Depends(get_current_session_or_401)):
    if session.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return session


def _email_query(email: str):
    return {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}


def _serialize_user(user):
    return {
        "id": str(user["_id"]),
        "name": user.get("name") or user.get("email"),
        "email": user.get("email"),
        "role": user.get("role"),
        "is_active": user.get("is_active", True),
    }


def _get_user(user_id: str):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/users", status_code=status.HTTP_201_CREATED)
def create_user(user: AdminUserCreate, session=Depends(require_admin)):
    if users_collection.find_one(_email_query(str(user.email))):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    document = {
        "name": user.name,
        "email": str(user.email),
        "password_hash": hash_password(user.password),
        "role": user.role,
        "is_active": True,
    }
    try:
        result = users_collection.insert_one(document)
    except DuplicateKeyError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
    document["_id"] = result.inserted_id
    return {"user": _serialize_user(document)}


@router.get("/users")
def list_users(
    session=Depends(require_admin),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=100),
):
    users = [
        _serialize_user(user)
        for user in users_collection.find({}, {"password_hash": 0}).skip(skip).limit(limit)
    ]
    return {"users": users}


@router.put("/users/{user_id}")
def update_user(
    user_id: str,
    changes: AdminUserUpdate,
    session=Depends(require_admin),
):
    existing = _get_user(user_id)
    updates = changes.model_dump(exclude_unset=True)

    if "email" in updates:
        updates["email"] = str(updates["email"])
        duplicate = users_collection.find_one(
            {**_email_query(updates["email"]), "_id": {"$ne": existing["_id"]}}
        )
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")

    if updates.get("role") != "project_manager" and updates.get("role") is not None:
        if projects_collection.find_one({"project_lead": existing["_id"]}):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Project Lead role cannot be removed while assigned to a project",
            )

    role_changed = "role" in updates and updates["role"] != existing.get("role")
    if updates:
        try:
            users_collection.update_one({"_id": existing["_id"]}, {"$set": updates})
        except DuplicateKeyError:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email is already registered")
        if role_changed:
            sessions_collection.delete_many({
                "$or": [
                    {"user_id": existing["_id"]},
                    {"email": existing.get("email")},
                ]
            })
        if "email" in updates and updates["email"] != existing.get("email"):
            sessions_collection.delete_many({"email": existing.get("email")})

    return {"user": _serialize_user(users_collection.find_one({"_id": existing["_id"]}))}


@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: str,
    status_update: UserStatusUpdate,
    session=Depends(require_admin),
):
    user = _get_user(user_id)
    if not status_update.is_active:
        sessions_collection.delete_many({"email": user["email"]})
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_active": status_update.is_active}},
    )
    return {"user": _serialize_user({**user, "is_active": status_update.is_active})}
