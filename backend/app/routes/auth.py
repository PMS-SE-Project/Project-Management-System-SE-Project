from fastapi import APIRouter, HTTPException
import uuid

from app.database.connection import users_collection, sessions_collection
from app.schemas.auth import LoginRequest
from app.auth.password import verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
def login(credentials: LoginRequest):
    user = users_collection.find_one({"email": credentials.email})

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    session_id = str(uuid.uuid4())

    sessions_collection.insert_one({
        "session_id": session_id,
        "email": user["email"],
        "role": user["role"]
    })

    return {
        "message": "Login successful",
        "session_id": session_id,
        "user": {
            "email": user["email"],
            "role": user["role"]
        }
    }


@router.post("/logout")
def logout(session_id: str):
    result = sessions_collection.delete_one({
        "session_id": session_id
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Session not found"
        )

    return {
        "message": "Logout successful"
    }