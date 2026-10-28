from fastapi import APIRouter, Depends, HTTPException
import re
import uuid

from app.database.connection import users_collection, sessions_collection
from app.schemas.auth import LoginRequest
from app.auth.password import verify_password
from app.auth.session import get_current_session

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login")
def login(credentials: LoginRequest):
    email_pattern = f"^{re.escape(str(credentials.email))}$"
    user = users_collection.find_one({
        "email": {
            "$regex": email_pattern,
            "$options": "i"
        }
    })

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

@router.get("/me")
def me(session=Depends(get_current_session)):
    return {"email": session["email"], "role": session["role"]}