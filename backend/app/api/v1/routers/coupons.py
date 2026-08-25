"""Coupons: the public catalogue and the partner's authoring endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentPartner, DbSession
from app.models.enums import ModerationStatus
from app.schemas.common import Message
from app.schemas.content import (
    CouponCategoryPublic,
    CouponCreate,
    CouponPrivate,
    CouponPublic,
    CouponUpdate,
)
from app.services import coupons as coupons_service

public_router = APIRouter(prefix="/coupons", tags=["coupons"])
business_router = APIRouter(prefix="/business/coupons", tags=["coupons"])


# --- consumer catalogue -----------------------------------------------------


@public_router.get("", response_model=list[CouponPublic])
async def browse_coupons(
    db: DbSession,
    partner_id: Annotated[uuid.UUID | None, Query()] = None,
    category_id: Annotated[uuid.UUID | None, Query()] = None,
    max_cost: Annotated[int | None, Query(ge=0)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[CouponPublic]:
    """Approved, in-window, in-stock coupons only."""
    rows = await coupons_service.list_catalogue(
        db,
        partner_id=partner_id,
        category_id=category_id,
        max_cost=max_cost,
        limit=limit,
        offset=offset,
    )
    return [CouponPublic.model_validate(row) for row in rows]


@public_router.get("/categories", response_model=list[CouponCategoryPublic])
async def list_categories(db: DbSession) -> list[CouponCategoryPublic]:
    rows = await coupons_service.list_categories(db)
    return [CouponCategoryPublic.model_validate(row) for row in rows]


@public_router.get("/{coupon_id}", response_model=CouponPublic)
async def get_coupon(coupon_id: uuid.UUID, db: DbSession) -> CouponPublic:
    coupon = await coupons_service.get_public_coupon(db, coupon_id=coupon_id)
    return CouponPublic.model_validate(coupon)


# --- partner authoring ------------------------------------------------------


@business_router.get("", response_model=list[CouponPrivate])
async def list_own_coupons(
    db: DbSession,
    partner: CurrentPartner,
    review_status: Annotated[ModerationStatus | None, Query()] = None,
) -> list[CouponPrivate]:
    rows = await coupons_service.list_partner_coupons(
        db, partner_id=partner.id, status=review_status
    )
    return [CouponPrivate.model_validate(row) for row in rows]


@business_router.post("", response_model=CouponPrivate, status_code=status.HTTP_201_CREATED)
async def create_coupon(
    payload: CouponCreate, db: DbSession, partner: CurrentPartner
) -> CouponPrivate:
    """Create a draft. Submit it separately when it is ready for review."""
    coupon = await coupons_service.create_coupon(db, partner=partner, data=payload.model_dump())
    return CouponPrivate.model_validate(coupon)


@business_router.get("/{coupon_id}", response_model=CouponPrivate)
async def get_own_coupon(
    coupon_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> CouponPrivate:
    coupon = await coupons_service.get_owned_coupon(db, partner=partner, coupon_id=coupon_id)
    return CouponPrivate.model_validate(coupon)


@business_router.patch("/{coupon_id}", response_model=CouponPrivate)
async def update_own_coupon(
    coupon_id: uuid.UUID, payload: CouponUpdate, db: DbSession, partner: CurrentPartner
) -> CouponPrivate:
    coupon = await coupons_service.get_owned_coupon(db, partner=partner, coupon_id=coupon_id)
    updated = await coupons_service.update_coupon(
        db, coupon=coupon, changes=payload.model_dump(exclude_unset=True, exclude_none=True)
    )
    return CouponPrivate.model_validate(updated)


@business_router.post("/{coupon_id}/submit", response_model=CouponPrivate)
async def submit_own_coupon(
    coupon_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> CouponPrivate:
    """Send the coupon to the moderation queue."""
    coupon = await coupons_service.get_owned_coupon(db, partner=partner, coupon_id=coupon_id)
    submitted = await coupons_service.submit_coupon(db, partner=partner, coupon=coupon)
    return CouponPrivate.model_validate(submitted)


@business_router.post("/{coupon_id}/withdraw", response_model=CouponPrivate)
async def withdraw_own_coupon(
    coupon_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> CouponPrivate:
    """Pull the coupon back to draft, whether it is pending or already live."""
    coupon = await coupons_service.get_owned_coupon(db, partner=partner, coupon_id=coupon_id)
    withdrawn = await coupons_service.withdraw_coupon(db, coupon=coupon)
    return CouponPrivate.model_validate(withdrawn)


@business_router.delete("/{coupon_id}", response_model=Message)
async def delete_own_coupon(
    coupon_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> Message:
    coupon = await coupons_service.get_owned_coupon(db, partner=partner, coupon_id=coupon_id)
    await coupons_service.delete_coupon(db, coupon=coupon)
    return Message(message="Coupon deleted.")
