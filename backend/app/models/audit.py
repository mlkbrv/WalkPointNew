"""Staff action log and the anti-fraud flag queue."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel
from app.models.enums import FlagSeverity, FlagStatus, FlagType


class AdminActionLog(BaseModel):
    """Who approved/rejected/adjusted what, and when. Append-only."""

    __tablename__ = "admin_action_logs"
    __table_args__ = (Index("ix_admin_logs_actor_created", "actor_id", "created_at"),)

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    changes: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    ip_address: Mapped[str] = mapped_column(String(45), default="", nullable=False)


class FlaggedEvent(BaseModel):
    """An anti-fraud signal awaiting human review.

    Flagging never blocks a user automatically — a superadmin approves or rejects
    the underlying record, and only an approval releases the withheld coins.
    """

    __tablename__ = "flagged_events"
    __table_args__ = (Index("ix_flagged_events_status_created", "status", "created_at"),)

    event_type: Mapped[FlagType] = mapped_column(String(40), nullable=False)
    severity: Mapped[FlagSeverity] = mapped_column(String(10), default=FlagSeverity.LOW, nullable=False)
    status: Mapped[FlagStatus] = mapped_column(String(10), default=FlagStatus.OPEN, nullable=False)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    partner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=True
    )
    target_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)

    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    event_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict, nullable=False)

    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
