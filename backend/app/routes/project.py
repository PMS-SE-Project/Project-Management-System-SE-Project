from datetime import date, datetime, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.session import get_current_session
from app.database.connection import projects_collection, users_collection
from app.schemas.project import ProjectCreate, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["Projects"])


def _as_date(value):
    if isinstance(value, datetime):
        return value.date()
    return value


def _as_datetime(value):
    if isinstance(value, date) and not isinstance(value, datetime):
        return datetime.combine(
            value,
            datetime.min.time(),
            tzinfo=timezone.utc
        )
    return value


def _serialize_project(project):
    result = dict(project)
    result["id"] = str(result.pop("_id"))

    for field in ("created_at", "updated_at"):
        if isinstance(result.get(field), datetime):
            result[field] = result[field].isoformat()

    for field in ("start_date", "target_end_date"):
        if isinstance(result.get(field), (date, datetime)):
            result[field] = result[field].isoformat()

    if isinstance(result.get("project_lead"), ObjectId):
        result["project_lead"] = str(result["project_lead"])

    return result


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


@router.get("/eligible-leads")
def get_eligible_project_leads(
    session=Depends(get_current_session),
):
    eligible_leads = []

    for user in users_collection.find(
        {"role": "project_manager"},
        {"name": 1, "email": 1},
    ):
        eligible_leads.append(
            {
                "id": str(user["_id"]),
                "name": user.get("name") or user["email"],
                "email": user.get("email"),
            }
        )

    return {"eligible_leads": eligible_leads}



@router.put("/{project_id}")
def update_project(
    project_id: str,
    project: ProjectUpdate,
    session=Depends(get_current_session),
):
    # Authorization
    if session.get("role") != "project_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Project Managers can edit projects",
        )

    # Validate project ID
    if not ObjectId.is_valid(project_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    project_object_id = ObjectId(project_id)

    # Find existing project
    existing = projects_collection.find_one({"_id": project_object_id})

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Extract only fields supplied in the request
    changes = project.model_dump(exclude_unset=True)

    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one field must be provided",
        )

    # Validate date range using updated values or existing values
    effective_start = changes.get(
        "start_date",
        _as_date(existing.get("start_date"))
    )

    effective_end = changes.get(
        "target_end_date",
        _as_date(existing.get("target_end_date"))
    )

    if (
        effective_start is not None
        and effective_end is not None
        and effective_end <= effective_start
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Target end date must be later than start date",
        )

    # Validate project lead
    if "project_lead" in changes and changes["project_lead"] is not None:
        lead_id = changes["project_lead"]

        if not ObjectId.is_valid(lead_id):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid project lead ID",
            )

        lead = users_collection.find_one({"_id": ObjectId(lead_id)})

        if not lead:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project lead not found",
            )

        # Only Project Managers can be project leads
        if lead.get("role") != "project_manager":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Project lead must be a Project Manager",
            )

        changes["project_lead"] = lead["_id"]

    # Convert date values for MongoDB storage
    for field in ("start_date", "target_end_date"):
        if field in changes and changes[field] is not None:
            changes[field] = _as_datetime(changes[field])

    # Check duplicate project name, ignoring case
    if "name" in changes:
        duplicate = projects_collection.find_one(
            {
                "name": changes["name"],
                "_id": {"$ne": project_object_id},
            },
            collation={"locale": "en", "strength": 2},
        )

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A project with this name already exists",
            )

    # Update project
    changes["updated_at"] = datetime.now(timezone.utc)

    projects_collection.update_one(
        {"_id": project_object_id},
        {"$set": changes},
    )

    updated = projects_collection.find_one(
        {"_id": project_object_id}
    )

    return {
        "message": "Project updated successfully",
        "project": _serialize_project(updated),
    }
