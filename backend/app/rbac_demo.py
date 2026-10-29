"""
Temporary RBAC demo for manual testing.

Run from the backend directory:
    uvicorn app.rbac_demo:app --reload

Open http://127.0.0.1:8000/docs to test the endpoints.
Requires valid login sessions for the respective roles.
"""

from fastapi import FastAPI, Depends

from .auth.rbac import require_permission

app = FastAPI()


@app.get("/demo/admin")
def admin_demo(
    session=Depends(require_permission("manage_users"))
):
    return {
        "message": "Admin permission granted",
        "email": session["email"],
        "role": session["role"],
    }


@app.get("/demo/projects")
def project_demo(
    session=Depends(require_permission("manage_projects"))
):
    return {
        "message": "Project management permission granted",
        "email": session["email"],
        "role": session["role"],
    }


@app.get("/demo/task-status")
def task_status_demo(
    session=Depends(require_permission("update_task_status"))
):
    return {
        "message": "Task status update permission granted",
        "email": session["email"],
        "role": session["role"],
    }