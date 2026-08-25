"""Partner, branch, and store schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import PartnerStatus
from app.schemas.auth import TokenPair, UserPublic
from app.schemas.common import ORMModel


class PartnerRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    company_name: str = Field(min_length=2, max_length=200)
    contact_name: str = Field(default="", max_length=150)
    description: str = Field(default="", max_length=5000)
    contact_phone: str = Field(default="", max_length=20)


class PartnerPublic(ORMModel):
    """What a consumer sees: no contract details, no rejection reasons."""

    id: uuid.UUID
    company_name: str
    description: str
    logo_path: str | None
    website: str
    contact_phone: str
    social_links: dict


class PartnerPrivate(PartnerPublic):
    """What the owning partner and staff see."""

    owner_id: uuid.UUID
    status: PartnerStatus
    rejection_reason: str
    contact_email: str
    created_at: datetime


class PartnerRegisterResponse(BaseModel):
    user: UserPublic
    partner: PartnerPrivate
    tokens: TokenPair


class PartnerUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    logo_path: str | None = Field(default=None, max_length=500)
    website: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=20)
    contact_email: str | None = Field(default=None, max_length=255)
    social_links: dict | None = None


class BranchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    address: str = Field(default="", max_length=255)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    phone: str = Field(default="", max_length=20)
    working_hours: dict = Field(default_factory=dict)


class BranchPublic(ORMModel):
    id: uuid.UUID
    name: str
    address: str
    latitude: Decimal | None
    longitude: Decimal | None
    phone: str
    working_hours: dict
    is_active: bool


class PartnerStats(BaseModel):
    live_coupons: int
    pending_coupons: int
    live_stories: int
    coupons_purchased: int
    coupons_redeemed: int


class PartnerReviewDecision(BaseModel):
    reason: str = Field(default="", max_length=500)
