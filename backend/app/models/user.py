from pydantic import BaseModel, EmailStr
from typing import Literal


class User(BaseModel):
    email: EmailStr
    password_hash: str
    role: Literal["admin", "project_manager", "team_member"]