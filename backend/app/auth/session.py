from fastapi import HTTPException

from app.database.connection import sessions_collection, users_collection


def get_current_session(session_id: str):
    session = sessions_collection.find_one({
        "session_id": session_id
    })

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    user = None
    if "user_id" in session:
        user = users_collection.find_one({"_id": session["user_id"]})
    else:
        user = users_collection.find_one({"email": session.get("email")})

    if user and user.get("is_active", True) is False:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    return session


def get_current_session_or_unauthorized(session_id: str | None = None):
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )
    return get_current_session(session_id)


def get_current_session_or_401(session_id: str | None = None):
    if not session_id:
        raise HTTPException(
            status_code=422,
            detail="Session ID is required"
        )
    return get_current_session(session_id)