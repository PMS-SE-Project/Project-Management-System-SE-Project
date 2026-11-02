from fastapi import HTTPException

from app.database.connection import sessions_collection, users_collection


def get_current_session(session_id: str | None = None):
    if not session_id:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    session = sessions_collection.find_one({
        "session_id": session_id
    })

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    user = users_collection.find_one({"email": session.get("email")})
    if user and user.get("is_active", True) is False:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    return session


def get_current_session_or_401(session_id: str | None = None):
    return get_current_session(session_id)