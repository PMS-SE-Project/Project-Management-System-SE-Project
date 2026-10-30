
from fastapi import Depends, HTTPException

from app.auth.session import get_current_session

ALL_ROLES = {"admin", "project_manager", "team_member"}

PERMISSIONS = {
    "manage_users": {"admin"},
    "manage_projects": {"project_manager"},
    "manage_tasks": {"project_manager"},
    "update_task_status": {"project_manager", "team_member"},
    "add_task_comment": {"project_manager", "team_member"},
    "manage_milestones": {"project_manager"},
    "view_dashboard": ALL_ROLES,
    "view_report": {"project_manager"},
}


def require_permission(action: str):
    allowed_roles = PERMISSIONS.get(action)

    if allowed_roles is None:
        raise ValueError(f"Unknown permission: {action}")

    def checker(session=Depends(get_current_session)):
        role = session.get("role")

        if role not in ALL_ROLES or role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Forbidden",
            )

        return session

    return checker
