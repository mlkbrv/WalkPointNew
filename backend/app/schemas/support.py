"""Support chat and FAQ schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import MessageSender, TicketStatus
from app.schemas.common import ORMModel


class MessagePublic(ORMModel):
    id: uuid.UUID
    sender: MessageSender
    body: str
    read_at: datetime | None
    created_at: datetime


class SendMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    subject: str = Field(
        default="", max_length=200, description="Only used when this opens a new thread."
    )


class ThreadPublic(BaseModel):
    """One conversation as the app renders it."""

    ticket_id: uuid.UUID
    subject: str
    status: TicketStatus
    created_at: datetime
    last_message_at: datetime | None
    messages: list[MessagePublic]


class ThreadSummary(ORMModel):
    id: uuid.UUID
    subject: str
    status: TicketStatus
    created_at: datetime
    closed_at: datetime | None
    last_message_at: datetime | None


class SupportBadge(BaseModel):
    unread: int
    has_open_thread: bool


# --- staff ------------------------------------------------------------------


class StaffTicketRow(BaseModel):
    """One row in the staff queue, with enough context to triage without opening it."""

    id: uuid.UUID
    user_id: uuid.UUID
    user_label: str
    subject: str
    status: TicketStatus
    message_count: int
    awaiting_reply: bool
    last_message_at: datetime | None
    created_at: datetime


class StaffTicketPage(BaseModel):
    items: list[StaffTicketRow]
    next_cursor: str | None = None
    has_more: bool = False


class StaffThread(ThreadPublic):
    user_id: uuid.UUID
    user_label: str


class StaffReplyRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class SupportQueueCounts(BaseModel):
    open_tickets: int
    awaiting_reply: int


# --- FAQ --------------------------------------------------------------------


class FAQPublic(ORMModel):
    id: uuid.UUID
    question: str
    answer: str
    category: str
    sort_order: int


class FAQCreate(BaseModel):
    question: str = Field(min_length=3, max_length=300)
    answer: str = Field(min_length=1, max_length=5000)
    category: str = Field(default="", max_length=100)
    sort_order: int = Field(default=0, ge=0, le=10_000)


class FAQUpdate(BaseModel):
    question: str | None = Field(default=None, min_length=3, max_length=300)
    answer: str | None = Field(default=None, min_length=1, max_length=5000)
    category: str | None = Field(default=None, max_length=100)
    sort_order: int | None = Field(default=None, ge=0, le=10_000)
