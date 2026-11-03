from pydantic import BaseModel, EmailStr
from typing import Literal


class User(BaseModel):
    name: str | None = None
    email: EmailStr
    password_hash: str
    role: Literal["admin", "project_manager", "team_member"]
    is_active: bool = True