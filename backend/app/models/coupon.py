"""Partner coupons and the vouchers users own after buying one."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel
from app.models.enums import ModerationStatus, UserCouponStatus


class CouponCategory(BaseModel):
    __tablename__ = "coupon_categories"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    icon: Mapped[str] = mapped_column(String(100), default="", nullable=False)


class Coupon(BaseModel):
    """A partner offer. Only ``approved`` coupons are ever exposed to the mobile app."""

    __tablename__ = "coupons"
    __table_args__ = (Index("ix_coupons_status_published", "status", "published_at"),)

    partner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("coupon_categories.id", ondelete="SET NULL"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    rules: Mapped[str] = mapped_column(Text, default="", nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    cost_coins: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_total: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_redeemed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_single_use: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    status: Mapped[ModerationStatus] = mapped_column(
        String(20), default=ModerationStatus.DRAFT, nullable=False
    )
    rejection_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def quantity_remaining(self) -> int:
        return max(self.quantity_total - self.quantity_redeemed, 0)


class UserCoupon(BaseModel):
    """A voucher a user owns. ``qr_token`` is what the partner scans; server-generated only."""

    __tablename__ = "user_coupons"
    __table_args__ = (
        Index("ix_user_coupons_user_status", "user_id", "status"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    coupon_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("coupons.id", ondelete="CASCADE"), nullable=False
    )

    qr_token: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), default=uuid.uuid4, unique=True, nullable=False
    )
    status: Mapped[UserCouponStatus] = mapped_column(
        String(20), default=UserCouponStatus.ACTIVE, nullable=False
    )
    cost_paid: Mapped[int] = mapped_column(Integer, nullable=False)

    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_at_branch_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("branches.id", ondelete="SET NULL"), nullable=True
    )
    scanned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    coupon: Mapped[Coupon] = relationship(lazy="joined")
