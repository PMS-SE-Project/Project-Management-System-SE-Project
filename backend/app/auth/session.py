from fastapi import HTTPException

from app.database.connection import sessions_collection


def get_current_session(session_id: str):
    session = sessions_collection.find_one({
        "session_id": session_id
    })

    if not session:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )

    return session