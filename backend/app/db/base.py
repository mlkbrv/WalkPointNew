"""Declarative base and the mixins every table shares."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.time import utcnow


class Base(DeclarativeBase):
    pass


class UUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    """Creation and update stamps.

    The Python-side ``default`` is what the ORM actually writes, and it is there on
    purpose: it stamps microsecond precision in the same format the driver binds
    query parameters with. Relying on the server default alone lets a backend store
    a coarser value than it compares against, which quietly breaks keyset
    pagination on ``created_at``. The server defaults remain for rows inserted
    outside the ORM (migrations, raw SQL).
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        server_default=func.now(),
        nullable=False,
    )


class BaseModel(Base, UUIDMixin, TimestampMixin):
    __abstract__ = True
