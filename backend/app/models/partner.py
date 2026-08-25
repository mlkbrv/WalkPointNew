"""Partner businesses and their branches."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import JSON, Boolean, ForeignKey, Index, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel
from app.models.enums import PartnerStatus


class Partner(BaseModel):
    __tablename__ = "partners"
    __table_args__ = (Index("ix_partners_status", "status"),)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    company_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    website: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    social_links: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    status: Mapped[PartnerStatus] = mapped_column(
        String(20), default=PartnerStatus.PENDING, nullable=False
    )
    rejection_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)

    branches: Mapped[list[Branch]] = relationship(
        back_populates="partner", cascade="all, delete-orphan"
    )


class Branch(BaseModel):
    """A physical location where a coupon can be redeemed."""

    __tablename__ = "branches"

    partner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    working_hours: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    partner: Mapped[Partner] = relationship(back_populates="branches")
