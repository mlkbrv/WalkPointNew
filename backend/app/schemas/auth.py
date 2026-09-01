"""Auth request/response schemas."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.common import ORMModel


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=150)
    referral_code: str = Field(default="", max_length=16)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class SMSRequest(BaseModel):
    phone: str = Field(min_length=5, max_length=20)


class SMSVerifyRequest(BaseModel):
    phone: str = Field(min_length=5, max_length=20)
    code: str = Field(min_length=4, max_length=6)
    referral_code: str = Field(default="", max_length=16)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserPublic(ORMModel):
    id: uuid.UUID
    email: str | None
    phone: str | None
    full_name: str
    role: UserRole
    city: str
    country: str
    avatar_path: str | None
    referral_code: str
    is_active: bool


class ProfileUpdate(BaseModel):
    """Everything a consumer may change about themselves.

    Every field is optional and `None` means "leave alone", so a client that
    only edits the name never has to send — or risk clobbering — the rest.
    Role, email and referral code are deliberately absent: those are not the
    account holder's to edit.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    city: str | None = Field(default=None, max_length=120)
    country: str | None = Field(default=None, max_length=120)


class AuthResponse(BaseModel):
    user: UserPublic
    tokens: TokenPair
    is_new_user: bool = False
