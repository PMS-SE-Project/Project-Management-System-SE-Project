from fastapi import FastAPI
from app.database.connection import client
from app.routes.auth import router as auth_router

app = FastAPI(title="Project Management System")


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