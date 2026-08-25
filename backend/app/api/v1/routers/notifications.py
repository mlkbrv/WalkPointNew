"""The in-app inbox and FCM device registration."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession, PageParams
from app.schemas.common import Message
from app.schemas.notifications import (
    DevicePublic,
    DeviceRegisterRequest,
    DeviceUnregisterRequest,
    InboxPage,
    MarkedRead,
    NotificationPublic,
    UnreadCount,
)
from app.services import notifications as notifications_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=InboxPage)
async def inbox(
    db: DbSession,
    user: CurrentUser,
    page: PageParams,
    unread_only: Annotated[bool, Query()] = False,
) -> InboxPage:
    items, next_cursor, has_more = await notifications_service.inbox_page(
        db, user_id=user.id, cursor=page.cursor, limit=page.limit, unread_only=unread_only
    )
    return InboxPage(
        items=[NotificationPublic.model_validate(row) for row in items],
        next_cursor=next_cursor,
        has_more=has_more,
        unread=await notifications_service.unread_count(db, user_id=user.id),
    )


@router.get("/unread-count", response_model=UnreadCount)
async def unread(db: DbSession, user: CurrentUser) -> UnreadCount:
    """Cheap enough for the tab badge to poll."""
    return UnreadCount(unread=await notifications_service.unread_count(db, user_id=user.id))


@router.post("/read-all", response_model=MarkedRead)
async def read_all(db: DbSession, user: CurrentUser) -> MarkedRead:
    return MarkedRead(marked=await notifications_service.mark_all_read(db, user_id=user.id))


@router.post("/{notification_id}/read", response_model=NotificationPublic)
async def read_one(
    notification_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> NotificationPublic:
    notification = await notifications_service.mark_read(
        db, user_id=user.id, notification_id=notification_id
    )
    return NotificationPublic.model_validate(notification)


# --- devices ----------------------------------------------------------------


@router.post("/push-token", response_model=DevicePublic)
async def register_push_token(
    payload: DeviceRegisterRequest, db: DbSession, user: CurrentUser
) -> DevicePublic:
    """Register or rotate this device's FCM token.

    Safe to call on every launch: the same ``device_id`` updates in place, and the
    token is detached from any other account that previously claimed it.
    """
    device = await notifications_service.register_device(
        db,
        user=user,
        device_id=payload.device_id,
        push_token=payload.push_token,
        platform=payload.platform,
    )
    return DevicePublic(
        id=device.id,
        device_id=device.device_id,
        platform=device.platform,
        has_push_token=bool(device.push_token),
        last_used_at=device.last_used_at,
        created_at=device.created_at,
    )


@router.post("/push-token/revoke", response_model=Message)
async def revoke_push_token(
    payload: DeviceUnregisterRequest, db: DbSession, user: CurrentUser
) -> Message:
    """Stop pushing to this device. Call on sign-out."""
    await notifications_service.unregister_device(
        db, user=user, device_id=payload.device_id
    )
    return Message(message="Push disabled for this device.")


@router.get("/devices", response_model=list[DevicePublic])
async def list_devices(db: DbSession, user: CurrentUser) -> list[DevicePublic]:
    rows = await notifications_service.list_devices(db, user_id=user.id)
    return [
        DevicePublic(
            id=row.id,
            device_id=row.device_id,
            platform=row.platform,
            has_push_token=bool(row.push_token),
            last_used_at=row.last_used_at,
            created_at=row.created_at,
        )
        for row in rows
    ]
