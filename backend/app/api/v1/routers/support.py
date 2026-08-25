"""Support chat — the user's thread, and the staff console behind it."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession, PageParams, SuperadminUser
from app.models.enums import MessageSender, TicketStatus
from app.models.support import SupportChatMessage
from app.models.user import User
from app.schemas.common import Message
from app.schemas.support import (
    FAQCreate,
    FAQPublic,
    FAQUpdate,
    MessagePublic,
    SendMessageRequest,
    StaffReplyRequest,
    StaffThread,
    StaffTicketPage,
    StaffTicketRow,
    SupportBadge,
    SupportQueueCounts,
    ThreadPublic,
    ThreadSummary,
)
from app.services import support as support_service

router = APIRouter(prefix="/support", tags=["support"])
admin_router = APIRouter(prefix="/admin/support", tags=["support"])


def _thread_payload(ticket) -> ThreadPublic:
    return ThreadPublic(
        ticket_id=ticket.id,
        subject=ticket.subject,
        status=ticket.status,
        created_at=ticket.created_at,
        last_message_at=ticket.last_message_at,
        messages=[MessagePublic.model_validate(m) for m in ticket.messages],
    )


def _label(user: User | None) -> str:
    if user is None:
        return ""
    return user.full_name or user.email or user.phone or str(user.id)


# --- the user's thread ------------------------------------------------------


@router.get("/thread", response_model=ThreadPublic | None)
async def my_thread(
    db: DbSession,
    user: CurrentUser,
    ticket_id: Annotated[uuid.UUID | None, Query()] = None,
) -> ThreadPublic | None:
    """The user's open conversation, or a specific past one.

    Opening the thread marks support's replies as read — that is what reading is.
    """
    ticket = await support_service.get_thread(db, user_id=user.id, ticket_id=ticket_id)
    if ticket is None:
        return None

    await support_service.mark_thread_read(db, ticket=ticket, reader=MessageSender.USER)
    return _thread_payload(ticket)


@router.post("/messages", response_model=MessagePublic, status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: SendMessageRequest, db: DbSession, user: CurrentUser
) -> MessagePublic:
    """Write to support. Opens a thread if the user has none."""
    _, message = await support_service.post_user_message(
        db, user=user, body=payload.body, subject=payload.subject
    )
    return MessagePublic.model_validate(message)


@router.get("/tickets", response_model=list[ThreadSummary])
async def my_tickets(db: DbSession, user: CurrentUser) -> list[ThreadSummary]:
    rows = await support_service.list_user_tickets(db, user_id=user.id)
    return [ThreadSummary.model_validate(row) for row in rows]


@router.get("/badge", response_model=SupportBadge)
async def badge(db: DbSession, user: CurrentUser) -> SupportBadge:
    """Unread count for the chat tab."""
    ticket = await support_service.get_thread(db, user_id=user.id)
    return SupportBadge(
        unread=await support_service.unread_for_user(db, user_id=user.id),
        has_open_thread=ticket is not None,
    )


# --- FAQ (public) -----------------------------------------------------------


@router.get("/faq", response_model=list[FAQPublic])
async def faq(db: DbSession) -> list[FAQPublic]:
    """Public: the app renders this instead of hardcoding its own answers."""
    rows = await support_service.list_faq(db)
    return [FAQPublic.model_validate(row) for row in rows]


# --- staff console ----------------------------------------------------------


@admin_router.get("/tickets", response_model=StaffTicketPage)
async def staff_tickets(
    db: DbSession,
    admin: SuperadminUser,
    page: PageParams,
    ticket_status: Annotated[TicketStatus | None, Query()] = None,
) -> StaffTicketPage:
    tickets, next_cursor, has_more = await support_service.staff_tickets_page(
        db, status=ticket_status, cursor=page.cursor, limit=page.limit
    )

    rows: list[StaffTicketRow] = []
    for ticket in tickets:
        owner = await db.get(User, ticket.user_id)
        count = await db.scalar(
            select(func.count())
            .select_from(SupportChatMessage)
            .where(SupportChatMessage.ticket_id == ticket.id)
        )
        latest_sender = await db.scalar(
            select(SupportChatMessage.sender)
            .where(SupportChatMessage.ticket_id == ticket.id)
            .order_by(SupportChatMessage.created_at.desc(), SupportChatMessage.id.desc())
            .limit(1)
        )
        rows.append(
            StaffTicketRow(
                id=ticket.id,
                user_id=ticket.user_id,
                user_label=_label(owner),
                subject=ticket.subject,
                status=ticket.status,
                message_count=int(count or 0),
                awaiting_reply=latest_sender == MessageSender.USER,
                last_message_at=ticket.last_message_at,
                created_at=ticket.created_at,
            )
        )

    return StaffTicketPage(items=rows, next_cursor=next_cursor, has_more=has_more)


@admin_router.get("/queue", response_model=SupportQueueCounts)
async def staff_queue_counts(db: DbSession, admin: SuperadminUser) -> SupportQueueCounts:
    return SupportQueueCounts(
        open_tickets=await support_service.open_ticket_count(db),
        awaiting_reply=await support_service.awaiting_reply_count(db),
    )


@admin_router.get("/tickets/{ticket_id}", response_model=StaffThread)
async def staff_thread(
    ticket_id: uuid.UUID, db: DbSession, admin: SuperadminUser
) -> StaffThread:
    ticket = await support_service.get_ticket(db, ticket_id=ticket_id)
    await support_service.mark_thread_read(db, ticket=ticket, reader=MessageSender.ADMIN)
    owner = await db.get(User, ticket.user_id)

    payload = _thread_payload(ticket)
    return StaffThread(
        **payload.model_dump(), user_id=ticket.user_id, user_label=_label(owner)
    )


@admin_router.post(
    "/tickets/{ticket_id}/reply",
    response_model=MessagePublic,
    status_code=status.HTTP_201_CREATED,
)
async def staff_reply(
    ticket_id: uuid.UUID,
    payload: StaffReplyRequest,
    db: DbSession,
    admin: SuperadminUser,
) -> MessagePublic:
    """Answer the user. They get an inbox row and a push with a short preview."""
    message = await support_service.post_staff_reply(
        db, ticket_id=ticket_id, author=admin, body=payload.body
    )
    return MessagePublic.model_validate(message)


@admin_router.post("/tickets/{ticket_id}/close", response_model=ThreadSummary)
async def close_ticket(
    ticket_id: uuid.UUID, db: DbSession, admin: SuperadminUser
) -> ThreadSummary:
    """Mark it handled. A user who writes again starts a fresh ticket."""
    ticket = await support_service.set_ticket_status(
        db, ticket_id=ticket_id, status=TicketStatus.CLOSED
    )
    return ThreadSummary.model_validate(ticket)


@admin_router.post("/tickets/{ticket_id}/reopen", response_model=ThreadSummary)
async def reopen_ticket(
    ticket_id: uuid.UUID, db: DbSession, admin: SuperadminUser
) -> ThreadSummary:
    ticket = await support_service.set_ticket_status(
        db, ticket_id=ticket_id, status=TicketStatus.OPEN
    )
    return ThreadSummary.model_validate(ticket)


# --- FAQ management ---------------------------------------------------------


@admin_router.post("/faq", response_model=FAQPublic, status_code=status.HTTP_201_CREATED)
async def create_faq(
    payload: FAQCreate, db: DbSession, admin: SuperadminUser
) -> FAQPublic:
    entry = await support_service.create_faq(db, data=payload.model_dump())
    return FAQPublic.model_validate(entry)


@admin_router.patch("/faq/{faq_id}", response_model=FAQPublic)
async def update_faq(
    faq_id: uuid.UUID, payload: FAQUpdate, db: DbSession, admin: SuperadminUser
) -> FAQPublic:
    entry = await support_service.update_faq(
        db, faq_id=faq_id, changes=payload.model_dump(exclude_none=True)
    )
    return FAQPublic.model_validate(entry)


@admin_router.delete("/faq/{faq_id}", response_model=Message)
async def delete_faq(faq_id: uuid.UUID, db: DbSession, admin: SuperadminUser) -> Message:
    await support_service.delete_faq(db, faq_id=faq_id)
    return Message(message="FAQ entry deleted.")
