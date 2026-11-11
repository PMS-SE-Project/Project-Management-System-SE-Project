from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.connection import client
from app.routes.auth import router as auth_router
from app.routes.project import router as projects_router
from app.routes.admin import router as admin_router

app = FastAPI(title="Project Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.get("/")
def root():
    return {"message": "Project Management System API is running"}


@app.get("/health")
def health():
    try:
        client.admin.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}


app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(admin_router)