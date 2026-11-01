from datetime import datetime, timezone
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.session import get_current_session
from app.database.connection import projects_collection
from app.schemas.project import ProjectCreate

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_project(
    project: ProjectCreate,
    session=Depends(get_current_session),
):
    if session.get("role") != "project_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Project Managers can create projects",
        )

    project_name = project.name.strip()

# Reject duplicate project names, ignoring case
    existing_project = projects_collection.find_one({"name": project_name},collation={"locale": "en", "strength": 2},)

    if existing_project:
        raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="A project with this name already exists",
    )

    project_data = {
        "name": project_name,
        "description": project.description,
        "created_by": session["email"],
        "members": [],
        "status": "active",
        "created_at": datetime.now(timezone.utc),
    }

    try:
        result = projects_collection.insert_one(project_data)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A project with this name already exists",
        )

    return {
        "message": "Project created successfully",
        "project": {
            "id": str(result.inserted_id),
            "name": project_data["name"],
            "description": project_data["description"],
            "created_by": project_data["created_by"],
            "members": project_data["members"],
            "status": project_data["status"],
            "created_at": project_data["created_at"].isoformat(),
        },
    }