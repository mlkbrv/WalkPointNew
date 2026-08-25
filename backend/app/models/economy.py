"""Steps, the coin ledger, and the tunable economy settings.

Two invariants hold across this module:

* the coin ledger (:class:`CoinTransaction`) is **append-only** — a balance is
  ``SUM(amount)``, never a stored mutable number;
* :class:`DailySteps` is unique per ``(user_id, date)``, so re-syncing a day can only
  ever award the *delta* of the reward, never the whole reward again.
"""

from __future__ import annotations

import uuid
from datetime import date as date_type

from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel
from app.models.enums import CoinSource


class EconomySettings(BaseModel):
    """Singleton row holding every tunable number, so rates change without a deploy.

    Read it through ``app.services.economy.get_settings_row``; never hardcode these
    values in business logic.
    """

    __tablename__ = "economy_settings"

    # Steps -> coins
    minimum_steps_threshold: Mapped[int] = mapped_column(Integer, default=5_000, nullable=False)
    reward_at_threshold: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    reward_per_extra_thousand_steps: Mapped[int] = mapped_column(Integer, default=10, nullable=False)

    # Anti-fraud
    suspicious_steps_per_day: Mapped[int] = mapped_column(Integer, default=35_000, nullable=False)
    hard_cap_steps_per_day: Mapped[int] = mapped_column(Integer, default=50_000, nullable=False)
    max_steps_per_hour: Mapped[int] = mapped_column(Integer, default=12_000, nullable=False)
    max_sync_age_days: Mapped[int] = mapped_column(Integer, default=3, nullable=False)

    # Other rewards
    coins_per_story_view: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    coins_per_referral: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    referral_activity_steps_required: Mapped[int] = mapped_column(Integer, default=10_000, nullable=False)

    # Stories
    story_lifetime_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)
    max_stories_per_partner: Mapped[int] = mapped_column(Integer, default=5, nullable=False)


class DailySteps(BaseModel):
    """One row per user per calendar day. Unique, so syncs are idempotent."""

    __tablename__ = "daily_steps"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_daily_steps_user_date"),
        Index("ix_daily_steps_suspicious", "is_suspicious"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)

    steps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    source: Mapped[str] = mapped_column(String(30), default="health_connect", nullable=False)

    coins_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_rolled_up: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Anti-fraud: flagged days never accrue automatically; a superadmin reviews them.
    is_suspicious: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suspicion_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)


class CoinTransaction(BaseModel):
    """Append-only ledger entry. Positive credits, negative debits. Never updated."""

    __tablename__ = "coin_transactions"
    __table_args__ = (Index("ix_coin_transactions_user_created", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    source: Mapped[CoinSource] = mapped_column(String(30), nullable=False)
    note: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    # Free-form pointer to what caused the entry (coupon id, daily_steps id, ...)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)
