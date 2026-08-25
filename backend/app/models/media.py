"""Uploaded media: images and video referenced by coupons, stories, and logos.

The row is the record; the bytes live behind :mod:`app.storage`, addressed by a
relative ``key``. Nothing outside the storage layer ever sees a filesystem path,
which is what lets local disk become S3 without touching callers.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import BaseModel


class Media(BaseModel):
    __tablename__ = "media"
    __table_args__ = (Index("ix_media_owner_created", "owner_id", "created_at"),)

    owner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    key: Mapped[str] = mapped_column(String(500), unique=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    purpose: Mapped[str] = mapped_column(String(30), default="general", nullable=False)
