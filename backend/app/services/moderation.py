"""The shared moderation lifecycle for partner-authored content.

Coupons and stories follow the same path, and it is written once here so the two
cannot drift apart:

    draft -> pending -> approved | rejected
      ^                    |
      +--------------------+   (rejected content is editable again)

Two rules the rest of the codebase depends on:

* **Only a superadmin moves the status forward past ``pending``.** A partner can
  submit and withdraw; they cannot approve their own content.
* **Only ``approved`` content is visible to consumers.** Consumer queries filter
  on it, and single-item lookups raise ``NOT_APPROVED`` rather than pretending
  the item does not exist — a partner following their own link deserves the real
  reason.
"""

from __future__ import annotations

import uuid
from typing import Protocol

from app.core.errors import BusinessRuleError, Conflict, NotApproved
from app.core.time import utcnow
from app.models.enums import ModerationStatus

# Statuses a partner may still edit. Approved content is frozen: editing a live
# offer would let a partner swap the terms after the review that approved them.
EDITABLE_STATUSES = (ModerationStatus.DRAFT, ModerationStatus.REJECTED)


class Moderatable(Protocol):
    """Structural type for anything carrying the moderation columns."""

    id: uuid.UUID
    status: ModerationStatus
    rejection_reason: str
    published_at: object
    reviewed_by_id: uuid.UUID | None
    reviewed_at: object


def ensure_editable(item: Moderatable, *, label: str = "item") -> None:
    """Guard a partner edit. Approved and pending content is locked."""
    if item.status == ModerationStatus.APPROVED:
        raise Conflict(
            f"This {label} is live and can no longer be edited. Withdraw it first.",
            code="ALREADY_APPROVED",
        )
    if item.status == ModerationStatus.PENDING:
        raise Conflict(
            f"This {label} is awaiting review. Withdraw it to make changes.",
            code="UNDER_REVIEW",
        )


def submit(item: Moderatable, *, label: str = "item") -> None:
    """Partner sends the item to the review queue."""
    if item.status == ModerationStatus.PENDING:
        raise Conflict(f"This {label} is already awaiting review.", code="UNDER_REVIEW")
    if item.status == ModerationStatus.APPROVED:
        raise Conflict(f"This {label} is already approved.", code="ALREADY_APPROVED")

    item.status = ModerationStatus.PENDING
    item.rejection_reason = ""
    item.reviewed_by_id = None
    item.reviewed_at = None


def withdraw(item: Moderatable, *, label: str = "item") -> None:
    """Partner pulls the item back to draft, whether pending or already live."""
    if item.status == ModerationStatus.DRAFT:
        raise Conflict(f"This {label} is already a draft.", code="ALREADY_DRAFT")

    item.status = ModerationStatus.DRAFT
    item.published_at = None


def approve(item: Moderatable, *, reviewer_id: uuid.UUID) -> None:
    """Superadmin publishes the item. Only pending content can be approved."""
    if item.status != ModerationStatus.PENDING:
        raise BusinessRuleError(
            "Only content awaiting review can be approved.", code="NOT_PENDING"
        )

    item.status = ModerationStatus.APPROVED
    item.rejection_reason = ""
    item.published_at = utcnow()
    item.reviewed_by_id = reviewer_id
    item.reviewed_at = utcnow()


def reject(item: Moderatable, *, reviewer_id: uuid.UUID, reason: str) -> None:
    """Superadmin sends the item back with a reason the partner will read."""
    if item.status != ModerationStatus.PENDING:
        raise BusinessRuleError(
            "Only content awaiting review can be rejected.", code="NOT_PENDING"
        )
    if not reason.strip():
        raise BusinessRuleError(
            "A rejection must say why, so the partner can fix it.", code="REASON_REQUIRED"
        )

    item.status = ModerationStatus.REJECTED
    item.rejection_reason = reason.strip()
    item.published_at = None
    item.reviewed_by_id = reviewer_id
    item.reviewed_at = utcnow()


def ensure_visible(item: Moderatable, *, label: str = "item") -> None:
    """Guard a consumer read of a single item."""
    if item.status != ModerationStatus.APPROVED:
        raise NotApproved(f"This {label} is not available.")
