"""Inbox, device registration, and broadcast schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import NotificationType, UserRole
from app.schemas.common import ORMModel


class NotificationPublic(ORMModel):
    id: uuid.UUID
    notification_type: NotificationType
    title: str
    body: str
    data: dict
    is_read: bool
    read_at: datetime | None
    created_at: datetime


class InboxPage(BaseModel):
    items: list[NotificationPublic]
    next_cursor: str | None = None
    has_more: bool = False
    unread: int = 0


class UnreadCount(BaseModel):
    unread: int


class MarkedRead(BaseModel):
    marked: int


class DeviceRegisterRequest(BaseModel):
    """Sent after the app obtains an FCM token, and again whenever it rotates."""

    device_id: str = Field(min_length=1, max_length=255)
    push_token: str = Field(min_length=1, max_length=512)
    platform: str = Field(default="", max_length=20)


class DeviceUnregisterRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=255)


class DevicePublic(ORMModel):
    id: uuid.UUID
    device_id: str
    platform: str
    has_push_token: bool = False
    last_used_at: datetime | None
    created_at: datetime


class BroadcastRequest(BaseModel):
    title: str = Field(min_length=1, max_length=150)
    body: str = Field(default="", max_length=500)
    role: UserRole | None = Field(
        default=None, description="Limit to one role. Omit to reach everyone active."
    )
    notification_type: NotificationType = Field(
        default=NotificationType.GENERIC,
        description=(
            "Where tapping the notification takes the user. The app routes on "
            "this; an unknown value opens the inbox rather than failing."
        ),
    )
    data: dict = Field(default_factory=dict)


class BroadcastResult(BaseModel):
    recipients: int
