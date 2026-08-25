"""Wallet: balance and ledger history."""

from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select

from app.core.deps import CurrentUser, DbSession, PageParams
from app.models.economy import CoinTransaction
from app.schemas.wallet import LedgerEntryPublic, LedgerPage, WalletResponse
from app.services import economy
from app.services import wallet as wallet_service

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("", response_model=WalletResponse)
async def get_wallet(db: DbSession, user: CurrentUser) -> WalletResponse:
    """Balance plus lifetime earned and spent, all derived from the ledger."""
    balance = await economy.get_balance(db, user.id)

    earned = await db.scalar(
        select(func.coalesce(func.sum(CoinTransaction.amount), 0)).where(
            CoinTransaction.user_id == user.id, CoinTransaction.amount > 0
        )
    )
    spent = await db.scalar(
        select(func.coalesce(func.sum(CoinTransaction.amount), 0)).where(
            CoinTransaction.user_id == user.id, CoinTransaction.amount < 0
        )
    )

    return WalletResponse(
        balance=balance,
        earned_total=int(earned or 0),
        spent_total=abs(int(spent or 0)),
    )


@router.get("/ledger", response_model=LedgerPage)
async def get_ledger(db: DbSession, user: CurrentUser, page: PageParams) -> LedgerPage:
    entries, next_cursor, has_more = await wallet_service.ledger_page(
        db, user_id=user.id, cursor=page.cursor, limit=page.limit
    )
    return LedgerPage(
        items=[LedgerEntryPublic.model_validate(entry) for entry in entries],
        next_cursor=next_cursor,
        has_more=has_more,
    )
