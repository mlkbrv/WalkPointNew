"""Voucher schemas: the buyer's wallet and the merchant's till."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, computed_field

from app.models.enums import UserCouponStatus
from app.schemas.common import ORMModel
from app.schemas.content import CouponPublic


class VoucherPublic(ORMModel):
    """A coupon the user owns.

    ``qr_token`` is the redemption code. It is server-generated and only ever
    returned to the owner and to the merchant scanning it.
    """

    id: uuid.UUID
    coupon_id: uuid.UUID
    qr_token: uuid.UUID
    status: UserCouponStatus
    cost_paid: int
    used_at: datetime | None
    created_at: datetime
    coupon: CouponPublic


class PurchaseResponse(BaseModel):
    voucher: VoucherPublic
    balance: int


class ScanRequest(BaseModel):
    """What the merchant's scanner posts. The code is the QR payload."""

    qr_token: uuid.UUID
    branch_id: uuid.UUID | None = None


class ScanResult(BaseModel):
    voucher_id: uuid.UUID
    coupon_title: str
    customer_label: str
    cost_paid: int
    used_at: datetime | None
    status: UserCouponStatus


class ScanPreview(BaseModel):
    """A read-only look at a code before burning it."""

    voucher_id: uuid.UUID
    coupon_title: str
    status: UserCouponStatus
    cost_paid: int
    valid_until: datetime
    used_at: datetime | None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def is_redeemable(self) -> bool:
        return self.status == UserCouponStatus.ACTIVE


class RedemptionRecord(BaseModel):
    voucher_id: uuid.UUID
    coupon_id: uuid.UUID
    coupon_title: str
    cost_paid: int
    used_at: datetime | None
    branch_id: uuid.UUID | None


class CouponSales(BaseModel):
    issued: int
    redeemed: int
    coins_collected: int


class WalletSummary(BaseModel):
    active: int = Field(description="Vouchers ready to use.")
    used: int
    expired: int
