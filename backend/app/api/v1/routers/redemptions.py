"""Buying coupons, holding them in the wallet, and redeeming them at a counter."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request

from app.core.deps import CurrentPartner, CurrentUser, DbSession, PartnerUser
from app.core.errors import NotFound
from app.models.coupon import Coupon
from app.models.enums import UserCouponStatus
from app.models.user import User
from app.schemas.vouchers import (
    CouponSales,
    PurchaseResponse,
    RedemptionRecord,
    ScanPreview,
    ScanRequest,
    ScanResult,
    VoucherPublic,
    WalletSummary,
)
from app.services import coupons as coupons_service
from app.services import redemptions as redemptions_service

# Purchase hangs off the coupon it buys; the wallet and the till get their own trees.
purchase_router = APIRouter(prefix="/coupons", tags=["coupons"])
wallet_router = APIRouter(prefix="/wallet/vouchers", tags=["wallet"])
till_router = APIRouter(prefix="/redemptions", tags=["coupons"])


# --- buying -----------------------------------------------------------------


@purchase_router.post("/{coupon_id}/purchase", response_model=PurchaseResponse)
async def purchase(coupon_id: uuid.UUID, db: DbSession, user: CurrentUser) -> PurchaseResponse:
    """Spend coins on a coupon. One transaction: balance, stock, ledger, voucher."""
    voucher, balance = await redemptions_service.purchase_coupon(
        db, user=user, coupon_id=coupon_id
    )
    return PurchaseResponse(voucher=VoucherPublic.model_validate(voucher), balance=balance)


# --- the buyer's wallet -----------------------------------------------------


@wallet_router.get("", response_model=list[VoucherPublic])
async def list_vouchers(
    db: DbSession,
    user: CurrentUser,
    status: Annotated[UserCouponStatus | None, Query()] = None,
) -> list[VoucherPublic]:
    rows = await redemptions_service.list_vouchers(db, user_id=user.id, status=status)
    return [VoucherPublic.model_validate(row) for row in rows]


@wallet_router.get("/summary", response_model=WalletSummary)
async def wallet_summary(db: DbSession, user: CurrentUser) -> WalletSummary:
    rows = await redemptions_service.list_vouchers(db, user_id=user.id)
    return WalletSummary(
        active=sum(1 for row in rows if row.status == UserCouponStatus.ACTIVE),
        used=sum(1 for row in rows if row.status == UserCouponStatus.USED),
        expired=sum(1 for row in rows if row.status == UserCouponStatus.EXPIRED),
    )


@wallet_router.get("/{voucher_id}", response_model=VoucherPublic)
async def get_voucher(
    voucher_id: uuid.UUID, db: DbSession, user: CurrentUser
) -> VoucherPublic:
    """The full voucher including its redemption code. Owner only."""
    voucher = await redemptions_service.get_voucher(
        db, user_id=user.id, voucher_id=voucher_id
    )
    return VoucherPublic.model_validate(voucher)


# --- the merchant's till ----------------------------------------------------


@till_router.post("/preview", response_model=ScanPreview)
async def preview_code(
    payload: ScanRequest, db: DbSession, partner: CurrentPartner
) -> ScanPreview:
    """Look at a code without burning it, so the cashier can confirm first."""
    voucher = await redemptions_service.preview(db, qr_token=payload.qr_token, partner=partner)
    coupon = await db.get(Coupon, voucher.coupon_id)
    return ScanPreview(
        voucher_id=voucher.id,
        coupon_title=coupon.title,
        status=voucher.status,
        cost_paid=voucher.cost_paid,
        valid_until=coupon.ends_at,
        used_at=voucher.used_at,
    )


@till_router.post("/scan", response_model=ScanResult)
async def scan_code(
    payload: ScanRequest,
    db: DbSession,
    partner: CurrentPartner,
    staff: PartnerUser,
    request: Request,
) -> ScanResult:
    """Redeem the coupon. Irreversible, and only ever succeeds once per code."""
    voucher = await redemptions_service.scan(
        db,
        qr_token=payload.qr_token,
        partner=partner,
        scanned_by_id=staff.id,
        branch_id=payload.branch_id,
    )
    coupon = await db.get(Coupon, voucher.coupon_id)
    customer = await db.get(User, voucher.user_id)

    return ScanResult(
        voucher_id=voucher.id,
        coupon_title=coupon.title,
        customer_label=(customer.full_name or customer.email or customer.phone or "")
        if customer
        else "",
        cost_paid=voucher.cost_paid,
        used_at=voucher.used_at,
        status=voucher.status,
    )


@till_router.get("", response_model=list[RedemptionRecord])
async def redemption_history(
    db: DbSession,
    partner: CurrentPartner,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[RedemptionRecord]:
    rows = await redemptions_service.partner_redemptions(
        db, partner_id=partner.id, limit=limit, offset=offset
    )
    return [
        RedemptionRecord(
            voucher_id=row.id,
            coupon_id=row.coupon_id,
            coupon_title=row.coupon.title,
            cost_paid=row.cost_paid,
            used_at=row.used_at,
            branch_id=row.used_at_branch_id,
        )
        for row in rows
    ]


@till_router.get("/coupons/{coupon_id}/sales", response_model=CouponSales)
async def coupon_sales(
    coupon_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> CouponSales:
    """Issued, redeemed, and coins collected for one of the partner's coupons."""
    coupon = await coupons_service.get_owned_coupon(db, partner=partner, coupon_id=coupon_id)
    if coupon is None:
        raise NotFound("Coupon not found.")
    return CouponSales(**await redemptions_service.coupon_sales(db, coupon_id=coupon.id))
