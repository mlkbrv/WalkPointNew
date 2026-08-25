"""Support chat: user-to-staff tickets, plus reusable FAQ answer templates."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import BaseModel
from app.models.enums import MessageSender, TicketStatus


class SupportTicket(BaseModel):
    __tablename__ = "support_tickets"
    __table_args__ = (Index("ix_support_tickets_status_updated", "status", "updated_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String(200), default="", nullable=False)
    status: Mapped[TicketStatus] = mapped_column(String(20), default=TicketStatus.OPEN, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    messages: Mapped[list[SupportChatMessage]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan", order_by="SupportChatMessage.created_at"
    )


class SupportChatMessage(BaseModel):
    __tablename__ = "support_chat_messages"
    __table_args__ = (Index("ix_support_messages_ticket_created", "ticket_id", "created_at"),)

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False
    )
    sender: Mapped[MessageSender] = mapped_column(String(10), nullable=False)
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    ticket: Mapped[SupportTicket] = relationship(back_populates="messages")


class FAQTemplate(BaseModel):
    """Canned answers staff can insert into a reply, managed from the admin panel."""

    __tablename__ = "faq_templates"

    question: Mapped[str] = mapped_column(String(300), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
