from datetime import date, datetime, timezone

from bson import ObjectId
from pymongo.errors import DuplicateKeyError
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.session import get_current_session, get_current_session_or_401
from app.database.connection import projects_collection, users_collection
from app.schemas.project import ProjectCreate, ProjectMemberCreate, ProjectUpdate

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


def _serialize_user(user):
    return {
        "id": str(user["_id"]),
        "name": user.get("name") or user.get("email"),
        "email": user.get("email"),
        "role": user.get("role"),
    }


def _as_object_id(value):
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and ObjectId.is_valid(value):
        return ObjectId(value)
    return None


def _get_project_for_membership(project_id: str):
    if not ObjectId.is_valid(project_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    project = projects_collection.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )
    return project


def _require_project_manager(project, session):
    if session.get("role") != "project_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned Project Manager can manage project members",
        )

    assigned = users_collection.find_one(
        {"email": session.get("email"), "role": "project_manager"}
    )
    lead_id = _as_object_id(project.get("project_lead"))
    if not assigned or lead_id is None or lead_id != _as_object_id(assigned.get("_id")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned Project Manager can manage project members",
        )


@router.get("/{project_id}/members")
def list_project_members(
    project_id: str,
    session=Depends(get_current_session_or_401),
):
    project = _get_project_for_membership(project_id)
    _require_project_manager(project, session)
    member_ids = project.get("members", [])
    members = []
    for member_id in member_ids:
        if isinstance(member_id, str) and ObjectId.is_valid(member_id):
            member_id = ObjectId(member_id)
        if isinstance(member_id, ObjectId):
            user = users_collection.find_one({"_id": member_id})
            if user:
                members.append(_serialize_user(user))
    return {"members": members}


@router.get("/{project_id}/eligible-members")
def get_eligible_project_members(
    project_id: str,
    session=Depends(get_current_session_or_401),
):
    project = _get_project_for_membership(project_id)
    _require_project_manager(project, session)

    excluded_ids = {
        member_id
        for member_id in (_as_object_id(value) for value in project.get("members", []))
        if member_id is not None
    }
    project_lead_id = _as_object_id(project.get("project_lead"))
    if project_lead_id is not None:
        excluded_ids.add(project_lead_id)

    eligible_members = []
    for user in users_collection.find(
        {"role": "team_member"},
        {"name": 1, "email": 1, "is_active": 1},
    ):
        user_id = _as_object_id(user.get("_id"))
        if (
            user_id is None
            or user_id in excluded_ids
            or user.get("is_active", True) is not True
        ):
            continue
        eligible_members.append(
            {
                "id": str(user_id),
                "name": user.get("name") or user.get("email"),
                "email": user.get("email"),
            }
        )

    return {"eligible_members": eligible_members}


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
def add_project_member(
    project_id: str,
    member: ProjectMemberCreate,
    session=Depends(get_current_session_or_401),
):
    project = _get_project_for_membership(project_id)
    _require_project_manager(project, session)
    if not ObjectId.is_valid(member.user_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid user ID",
        )

    user_id = ObjectId(member.user_id)
    user = users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.get("role") != "team_member":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only team members can be added to a project",
        )
    if user.get("is_active", True) is not True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive users cannot be added to a project",
        )

    members = project.get("members", [])
    if user_id in members or str(user_id) in members:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a project member",
        )

    projects_collection.update_one(
        {"_id": project["_id"]},
        {"$addToSet": {"members": user_id}},
    )
    return {"message": "Project member added successfully", "member": _serialize_user(user)}


@router.delete("/{project_id}/members/{user_id}")
def remove_project_member(
    project_id: str,
    user_id: str,
    session=Depends(get_current_session_or_401),
):
    project = _get_project_for_membership(project_id)
    _require_project_manager(project, session)
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid user ID",
        )

    member_id = ObjectId(user_id)
    if member_id == _as_object_id(project.get("project_lead")):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The assigned Project Lead cannot be removed",
        )

    members = project.get("members", [])
    if member_id not in members and user_id not in members:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User is not a project member")

    projects_collection.update_one(
        {"_id": project["_id"]},
        {"$pull": {"members": {"$in": [member_id, user_id]}}},
    )
    return {"message": "Project member removed successfully"}


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
    session=Depends(get_current_session_or_401),
):
    if session.get("role") != "project_manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Project Managers can view eligible project leads",
        )

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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Target end date must be later than start date",
        )

    # Validate project lead
    if "project_lead" in changes and changes["project_lead"] is not None:
        lead_id = changes["project_lead"]

        if not ObjectId.is_valid(lead_id):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
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
