import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class UserLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6)
    remember_me: bool = False


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    role: str
    is_active: bool
    created_at: datetime


class LoginResponse(BaseModel):
    status: str
    message: str
    user: UserRead
    token: str


class BootstrapAdminRequest(BaseModel):
    email: str = "admin@agentplatform.local"
    password: str = Field(default="adminpassword123", min_length=8)
    full_name: str = "System Administrator"
