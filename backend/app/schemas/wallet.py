"""Wallet and ledger schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import CoinSource
from app.schemas.common import ORMModel


class LedgerEntryPublic(ORMModel):
    id: uuid.UUID
    amount: int
    source: CoinSource
    note: str
    reference_id: uuid.UUID | None
    created_at: datetime


class WalletResponse(BaseModel):
    """Balance plus a small breakdown the wallet screen renders as headline numbers."""

    balance: int
    earned_total: int
    spent_total: int


class LedgerPage(BaseModel):
    items: list[LedgerEntryPublic]
    next_cursor: str | None = None
    has_more: bool = False
