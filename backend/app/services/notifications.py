"""Notifications: the in-app inbox, device registration, and push fan-out.

The in-app :class:`Notification` row is the **durable record**; push is a nudge on
top of it. Every event therefore writes the row first and attempts delivery
second, and a failed send never rolls back or hides the row — a user who had no
network still finds the message in their inbox.

Push is dispatched **after the caller commits**, so a delivery attempt can never
sit inside a transaction holding locks.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFound
from app.core.time import utcnow
from app.integrations import push
from app.models.enums import NotificationType, UserRole
from app.models.notification import Notification
from app.models.user import Device, User
from app.services import pagination

# --- writing ----------------------------------------------------------------


def queue(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str = "",
    notification_type: NotificationType = NotificationType.GENERIC,
    data: dict | None = None,
) -> Notification:
    """Add an inbox row. Does not commit and does not send — see :func:`deliver`.

    Callers that are already inside a transaction use this, then call
    :func:`deliver` once they have committed.
    """
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title[:150],
        body=body[:500],
        data=data or {},
    )
    db.add(notification)
    return notification


async def notify(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str = "",
    notification_type: NotificationType = NotificationType.GENERIC,
    data: dict | None = None,
    send_push: bool = True,
) -> Notification:
    """Write the inbox row, commit it, then attempt push. Convenience for simple callers."""
    notification = queue(
        db,
        user_id=user_id,
        title=title,
        body=body,
        notification_type=notification_type,
        data=data,
    )
    await db.commit()
    await db.refresh(notification)

    if send_push:
        await deliver(db, notification)
    return notification


async def deliver(db: AsyncSession, notification: Notification) -> push.PushResult:
    """Push one already-persisted notification to the owner's devices."""
    tokens = await _tokens_for(db, [notification.user_id])
    result = await push.safe_send(
        tokens,
        title=notification.title,
        body=notification.body,
        data={
            "notification_id": str(notification.id),
            "type": notification.notification_type,
            **{key: value for key, value in (notification.data or {}).items()},
        },
    )
    await _prune(db, result.invalid_tokens)
    return result


async def deliver_many(db: AsyncSession, notifications: list[Notification]) -> push.PushResult:
    """Push a batch written in one pass, grouped so identical copy sends once.

    The nightly roll-up writes thousands of near-identical rows; sending them one
    at a time would be thousands of round trips instead of a handful of multicasts.
    """
    if not notifications:
        return push.PushResult()

    grouped: dict[tuple[str, str], list[uuid.UUID]] = {}
    for item in notifications:
        grouped.setdefault((item.title, item.body), []).append(item.user_id)

    total = push.PushResult()
    for (title, body), user_ids in grouped.items():
        tokens = await _tokens_for(db, user_ids)
        total = total.merge(await push.safe_send(tokens, title=title, body=body))

    await _prune(db, total.invalid_tokens)
    return total


async def broadcast(
    db: AsyncSession,
    *,
    title: str,
    body: str,
    role: UserRole | None = None,
    notification_type: NotificationType = NotificationType.GENERIC,
    data: dict | None = None,
) -> int:
    """Write the same notification for every active user (optionally one role)."""
    query = select(User.id).where(User.is_active.is_(True), User.is_blocked.is_(False))
    if role is not None:
        query = query.where(User.role == role)

    user_ids = list((await db.scalars(query)).all())
    for user_id in user_ids:
        queue(
            db,
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type,
            data=data,
        )
    await db.commit()

    tokens = await _tokens_for(db, user_ids)
    result = await push.safe_send(tokens, title=title, body=body, data=data)
    await _prune(db, result.invalid_tokens)
    return len(user_ids)


# --- reading ----------------------------------------------------------------


async def inbox_page(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    cursor: str | None = None,
    limit: int = 20,
    unread_only: bool = False,
) -> tuple[list[Notification], str | None, bool]:
    query = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    return await pagination.fetch_page(db, query, Notification, cursor=cursor, limit=limit)


async def unread_count(db: AsyncSession, *, user_id: uuid.UUID) -> int:
    total = await db.scalar(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
    )
    return int(total or 0)


async def mark_read(
    db: AsyncSession, *, user_id: uuid.UUID, notification_id: uuid.UUID
) -> Notification:
    notification = await db.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user_id
        )
    )
    if notification is None:
        raise NotFound("Notification not found.")

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = utcnow()
        await db.commit()
        await db.refresh(notification)
    return notification


async def mark_all_read(db: AsyncSession, *, user_id: uuid.UUID) -> int:
    """One UPDATE rather than a read-modify-write loop — an inbox can be long."""
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read.is_(False))
        .values(is_read=True, read_at=utcnow())
    )
    await db.commit()
    return int(result.rowcount or 0)


# --- devices ----------------------------------------------------------------


async def register_device(
    db: AsyncSession,
    *,
    user: User,
    device_id: str,
    push_token: str,
    platform: str = "",
) -> Device:
    """Attach an FCM token to a device, replacing whatever was there.

    A token is also detached from any *other* account first: on a shared or resold
    handset the previous owner must stop receiving the new owner's notifications.
    """
    if push_token:
        await db.execute(
            update(Device)
            .where(Device.push_token == push_token, Device.user_id != user.id)
            .values(push_token="")
        )

    device = await db.scalar(
        select(Device).where(Device.user_id == user.id, Device.device_id == device_id)
    )
    if device is None:
        device = Device(user_id=user.id, device_id=device_id)
        db.add(device)

    device.push_token = push_token
    device.platform = platform
    device.last_used_at = utcnow()

    await db.commit()
    await db.refresh(device)
    return device


async def unregister_device(db: AsyncSession, *, user: User, device_id: str) -> None:
    """Clear the token on sign-out. The device row stays for history."""
    await db.execute(
        update(Device)
        .where(Device.user_id == user.id, Device.device_id == device_id)
        .values(push_token="")
    )
    await db.commit()


async def list_devices(db: AsyncSession, *, user_id: uuid.UUID) -> list[Device]:
    rows = await db.scalars(
        select(Device).where(Device.user_id == user_id).order_by(Device.created_at.desc())
    )
    return list(rows.all())


async def _tokens_for(db: AsyncSession, user_ids: list[uuid.UUID]) -> list[str]:
    if not user_ids:
        return []
    rows = await db.scalars(
        select(Device.push_token).where(
            Device.user_id.in_(user_ids), Device.push_token != ""
        )
    )
    # One user can have several devices; one token can only be current on one.
    return list({token for token in rows.all() if token})


async def _prune(db: AsyncSession, invalid_tokens: list[str]) -> None:
    """Drop tokens FCM told us are permanently gone."""
    if not invalid_tokens:
        return
    await db.execute(
        update(Device).where(Device.push_token.in_(invalid_tokens)).values(push_token="")
    )
    await db.commit()
