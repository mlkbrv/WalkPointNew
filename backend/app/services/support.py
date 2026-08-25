"""Support chat: one conversation per user, plus the canned answers staff reply from.

The mobile app shows a single chat thread, not a ticket queue, so the consumer
API never asks the user to open or pick a ticket — posting a message finds their
open ticket or starts one. Tickets still exist underneath, because staff need
something to close, count, and page through.

Closing is a staff-side idea of "handled". A user who writes again after a close
gets a **new** ticket rather than reopening the old one, so the closed thread
stays an accurate record of what was resolved and when.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import BusinessRuleError, Conflict, NotFound
from app.core.time import utcnow
from app.models.enums import MessageSender, NotificationType, TicketStatus
from app.models.support import FAQTemplate, SupportChatMessage, SupportTicket
from app.models.user import User
from app.services import notifications, pagination

MAX_OPEN_MESSAGES = 200


# --- the user's side --------------------------------------------------------


async def open_ticket_for(db: AsyncSession, *, user: User, subject: str = "") -> SupportTicket:
    """Return the user's open ticket, starting one if they have none."""
    ticket = await db.scalar(
        select(SupportTicket)
        .where(SupportTicket.user_id == user.id, SupportTicket.status == TicketStatus.OPEN)
        .order_by(SupportTicket.created_at.desc())
        .limit(1)
    )
    if ticket is not None:
        return ticket

    ticket = SupportTicket(user_id=user.id, subject=subject[:200], status=TicketStatus.OPEN)
    db.add(ticket)
    await db.flush()
    return ticket


async def post_user_message(
    db: AsyncSession, *, user: User, body: str, subject: str = ""
) -> tuple[SupportTicket, SupportChatMessage]:
    """Append a message from the user, opening their thread if needed."""
    text = body.strip()
    if not text:
        raise BusinessRuleError("Write something first.", code="EMPTY_MESSAGE")

    ticket = await open_ticket_for(db, user=user, subject=subject or text)

    count = await db.scalar(
        select(func.count())
        .select_from(SupportChatMessage)
        .where(SupportChatMessage.ticket_id == ticket.id)
    )
    if int(count or 0) >= MAX_OPEN_MESSAGES:
        raise BusinessRuleError(
            "This conversation is too long. Support will follow up.",
            code="THREAD_TOO_LONG",
        )

    message = SupportChatMessage(
        ticket_id=ticket.id,
        sender=MessageSender.USER,
        author_id=user.id,
        body=text,
    )
    db.add(message)
    ticket.last_message_at = utcnow()

    await db.commit()
    await db.refresh(message)
    await db.refresh(ticket)
    return ticket, message


async def get_thread(
    db: AsyncSession, *, user_id: uuid.UUID, ticket_id: uuid.UUID | None = None
) -> SupportTicket | None:
    """Load one thread with its messages. Defaults to the user's open one."""
    query = (
        select(SupportTicket)
        .where(SupportTicket.user_id == user_id)
        .options(selectinload(SupportTicket.messages))
    )
    if ticket_id is not None:
        query = query.where(SupportTicket.id == ticket_id)
    else:
        query = query.where(SupportTicket.status == TicketStatus.OPEN)

    ticket = await db.scalar(query.order_by(SupportTicket.created_at.desc()).limit(1))
    if ticket is None and ticket_id is not None:
        raise NotFound("Conversation not found.")
    return ticket


async def mark_thread_read(db: AsyncSession, *, ticket: SupportTicket, reader: MessageSender) -> int:
    """Stamp the other side's unread messages as seen by ``reader``."""
    other = MessageSender.ADMIN if reader == MessageSender.USER else MessageSender.USER
    result = await db.execute(
        update(SupportChatMessage)
        .where(
            SupportChatMessage.ticket_id == ticket.id,
            SupportChatMessage.sender == other,
            SupportChatMessage.read_at.is_(None),
        )
        .values(read_at=utcnow())
    )
    await db.commit()
    return int(result.rowcount or 0)


async def unread_for_user(db: AsyncSession, *, user_id: uuid.UUID) -> int:
    """Staff replies the user has not seen — drives the chat badge."""
    ticket_ids = select(SupportTicket.id).where(SupportTicket.user_id == user_id).scalar_subquery()
    total = await db.scalar(
        select(func.count())
        .select_from(SupportChatMessage)
        .where(
            SupportChatMessage.ticket_id.in_(ticket_ids),
            SupportChatMessage.sender == MessageSender.ADMIN,
            SupportChatMessage.read_at.is_(None),
        )
    )
    return int(total or 0)


async def list_user_tickets(db: AsyncSession, *, user_id: uuid.UUID) -> list[SupportTicket]:
    rows = await db.scalars(
        select(SupportTicket)
        .where(SupportTicket.user_id == user_id)
        .order_by(SupportTicket.created_at.desc())
    )
    return list(rows.all())


# --- the staff side ---------------------------------------------------------


async def staff_tickets_page(
    db: AsyncSession,
    *,
    status: TicketStatus | None = None,
    cursor: str | None = None,
    limit: int = 20,
) -> tuple[list[SupportTicket], str | None, bool]:
    query = select(SupportTicket)
    if status is not None:
        query = query.where(SupportTicket.status == status)
    return await pagination.fetch_page(db, query, SupportTicket, cursor=cursor, limit=limit)


async def get_ticket(db: AsyncSession, *, ticket_id: uuid.UUID) -> SupportTicket:
    ticket = await db.scalar(
        select(SupportTicket)
        .where(SupportTicket.id == ticket_id)
        .options(selectinload(SupportTicket.messages))
    )
    if ticket is None:
        raise NotFound("Ticket not found.")
    return ticket


async def post_staff_reply(
    db: AsyncSession, *, ticket_id: uuid.UUID, author: User, body: str
) -> SupportChatMessage:
    """Reply as support, and notify the user so they come back to read it."""
    text = body.strip()
    if not text:
        raise BusinessRuleError("Write something first.", code="EMPTY_MESSAGE")

    ticket = await db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise NotFound("Ticket not found.")
    if ticket.status == TicketStatus.CLOSED:
        raise Conflict("This ticket is closed. Reopen it to reply.", code="TICKET_CLOSED")

    message = SupportChatMessage(
        ticket_id=ticket.id,
        sender=MessageSender.ADMIN,
        author_id=author.id,
        body=text,
    )
    db.add(message)
    ticket.last_message_at = utcnow()

    note = notifications.queue(
        db,
        user_id=ticket.user_id,
        title="Support replied",
        # The preview is short on purpose: a lock-screen banner is not the place
        # for a full support answer, and it may contain account details.
        body=text[:120] + ("…" if len(text) > 120 else ""),
        notification_type=NotificationType.SUPPORT_REPLY,
        data={"ticket_id": str(ticket.id)},
    )

    await db.commit()
    await db.refresh(message)

    await notifications.deliver(db, note)
    return message


async def set_ticket_status(
    db: AsyncSession, *, ticket_id: uuid.UUID, status: TicketStatus
) -> SupportTicket:
    ticket = await db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise NotFound("Ticket not found.")
    if ticket.status == status:
        raise Conflict(f"Ticket is already {status}.", code="NO_STATUS_CHANGE")

    ticket.status = status
    ticket.closed_at = utcnow() if status == TicketStatus.CLOSED else None

    await db.commit()
    await db.refresh(ticket)
    return ticket


async def open_ticket_count(db: AsyncSession) -> int:
    total = await db.scalar(
        select(func.count())
        .select_from(SupportTicket)
        .where(SupportTicket.status == TicketStatus.OPEN)
    )
    return int(total or 0)


async def awaiting_reply_count(db: AsyncSession) -> int:
    """Open tickets whose newest message came from the user — the real work queue.

    One correlated subquery rather than a query per ticket: this drives a dashboard
    badge that gets polled, so it must not scale with the number of open tickets.
    """
    latest_sender = (
        select(SupportChatMessage.sender)
        .where(SupportChatMessage.ticket_id == SupportTicket.id)
        .order_by(SupportChatMessage.created_at.desc(), SupportChatMessage.id.desc())
        .limit(1)
        .correlate(SupportTicket)
        .scalar_subquery()
    )
    total = await db.scalar(
        select(func.count())
        .select_from(SupportTicket)
        .where(
            SupportTicket.status == TicketStatus.OPEN,
            latest_sender == MessageSender.USER,
        )
    )
    return int(total or 0)


# --- FAQ --------------------------------------------------------------------


async def list_faq(db: AsyncSession) -> list[FAQTemplate]:
    rows = await db.scalars(
        select(FAQTemplate).order_by(FAQTemplate.sort_order, FAQTemplate.question)
    )
    return list(rows.all())


async def create_faq(db: AsyncSession, *, data: dict) -> FAQTemplate:
    entry = FAQTemplate(**data)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def update_faq(db: AsyncSession, *, faq_id: uuid.UUID, changes: dict) -> FAQTemplate:
    entry = await db.get(FAQTemplate, faq_id)
    if entry is None:
        raise NotFound("FAQ entry not found.")
    for field, value in changes.items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


async def delete_faq(db: AsyncSession, *, faq_id: uuid.UUID) -> None:
    entry = await db.get(FAQTemplate, faq_id)
    if entry is None:
        raise NotFound("FAQ entry not found.")
    await db.delete(entry)
    await db.commit()
