"""Users, their devices, and the phone-verification records."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.security import generate_referral_code
from app.db.base import BaseModel
from app.models.enums import UserRole


class User(BaseModel):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        UniqueConstraint("phone", name="uq_users_phone"),
        Index("ix_users_role", "role"),
    )

    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)

    role: Mapped[UserRole] = mapped_column(String(20), default=UserRole.USER, nullable=False)

    full_name: Mapped[str] = mapped_column(String(150), default="", nullable=False)
    avatar_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    city: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    country: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    referral_code: Mapped[str] = mapped_column(
        String(16), unique=True, default=generate_referral_code, nullable=False
    )
    referred_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    devices: Mapped[list[Device]] = relationship(back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<User {self.id} {self.email or self.phone} {self.role}>"


class Device(BaseModel):
    """A physical device, and the FCM token push notifications are delivered to."""

    __tablename__ = "devices"
    __table_args__ = (
        UniqueConstraint("user_id", "device_id", name="uq_devices_user_device"),
        Index("ix_devices_push_token", "push_token"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    device_id: Mapped[str] = mapped_column(String(255), nullable=False)
    platform: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    push_token: Mapped[str] = mapped_column(String(512), default="", nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="devices")


class SMSVerification(BaseModel):
    """One issued SMS code. Codes are single-use and short-lived."""

    __tablename__ = "sms_verifications"
    __table_args__ = (Index("ix_sms_phone_created", "phone", "created_at"),)

    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    code: Mapped[str] = mapped_column(String(6), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RefreshToken(BaseModel):
    """Persisted (hashed) refresh tokens so sessions can be revoked server-side."""

    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_tokens_user", "user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_agent: Mapped[str] = mapped_column(String(255), default="", nullable=False)
