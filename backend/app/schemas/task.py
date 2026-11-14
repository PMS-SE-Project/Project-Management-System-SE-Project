from datetime import date, datetime, timezone
from typing import Literal

from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    assigned_to: str | None = None
    priority: Literal["low", "medium", "high"] = "medium"
    deadline: date | None = None
    status: Literal["To Do", "In Progress", "Completed"] = "To Do"

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title must not be empty")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("assigned_to")
    @classmethod
    def validate_assigned_to(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not ObjectId.is_valid(value):
            raise ValueError("Invalid assignee ID")
        return value

    @field_validator("priority", mode="before")
    @classmethod
    def validate_priority(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Priority must be low, medium, or high")
        value = value.strip().lower()
        if value not in {"low", "medium", "high"}:
            raise ValueError("Priority must be low, medium, or high")
        return value

    @field_validator("deadline", mode="before")
    @classmethod
    def validate_deadline(cls, value: str | date | None) -> str | date | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Deadline must use YYYY-MM-DD format")
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Deadline must use YYYY-MM-DD format") from exc
        if parsed.isoformat() != value:
            raise ValueError("Deadline must use YYYY-MM-DD format")
        if parsed < datetime.now(timezone.utc).date():
            raise ValueError("Deadline cannot be earlier than today")
        return parsed


class TaskUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    assigned_to: str | None = None
    priority: Literal["low", "medium", "high"] | None = None
    deadline: date | None = None
    status: Literal["To Do", "In Progress", "Completed"] = Field(default="To Do")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Task title must not be empty")
        value = value.strip()
        if not value:
            raise ValueError("Task title must not be empty")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("assigned_to")
    @classmethod
    def validate_assigned_to(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not ObjectId.is_valid(value):
            raise ValueError("Invalid assignee ID")
        return value

    @field_validator("priority", mode="before")
    @classmethod
    def validate_priority(cls, value: str | None) -> str:
        if not isinstance(value, str):
            raise ValueError("Priority must be low, medium, or high")
        value = value.strip().lower()
        if value not in {"low", "medium", "high"}:
            raise ValueError("Priority must be low, medium, or high")
        return value

    @field_validator("deadline", mode="before")
    @classmethod
    def validate_deadline(cls, value: str | date | None) -> str | date | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Deadline must use YYYY-MM-DD format")
        try:
            parsed = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Deadline must use YYYY-MM-DD format") from exc
        if parsed.isoformat() != value:
            raise ValueError("Deadline must use YYYY-MM-DD format")
        if parsed < datetime.now(timezone.utc).date():
            raise ValueError("Deadline cannot be earlier than today")
        return parsed


class TaskStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["To Do", "In Progress", "Completed"]


class TaskCommentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("Comment content must be a non-empty string")
        value = value.strip()
        if not value:
            raise ValueError("Comment content must not be empty")
        return value
