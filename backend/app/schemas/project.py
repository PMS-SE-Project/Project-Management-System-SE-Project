from datetime import date
from bson import ObjectId
from pydantic import BaseModel, ConfigDict, Field, field_validator



class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Project name must contain at least 2 characters")
        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            return value or None
        return value



class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    start_date: date | None = None
    target_end_date: date | None = None
    project_lead: str | None = None
    status: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Project name cannot be null")
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Project name must contain at least 2 characters")
        return value
    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Project status cannot be null")

        normalized = value.strip().lower().replace(" ", "_")

        if normalized not in {"active", "on_hold", "completed"}:
            raise ValueError("Status must be Active, On Hold, or Completed")

        return normalized

    @field_validator("project_lead")
    @classmethod
    def validate_project_lead(cls, value: str | None) -> str | None:
        if value is None:
            return value

        value = value.strip()

        if not ObjectId.is_valid(value):
            raise ValueError("Invalid project lead ID")

        return value

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        if value is not None:
            value = value.strip()
            return value or None
        return value


class ProjectMemberCreate(BaseModel):
    user_id: str = Field(..., min_length=1)
