"""Partner onboarding, the partner's own dashboard, and the public store list.

Three audiences share this module, separated by prefix:

* ``/v1/partners``          — public: approved stores only
* ``/v1/business``          — the signed-in partner managing their own business
* onboarding is public, because a merchant signs themselves up for review
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Request, status

from app.core.deps import CurrentPartner, DbSession, PartnerUser
from app.schemas.auth import UserPublic
from app.schemas.common import Message
from app.schemas.content import CouponPrivate, StoryPrivate
from app.schemas.partners import (
    BranchCreate,
    BranchPublic,
    PartnerPrivate,
    PartnerPublic,
    PartnerRegisterRequest,
    PartnerRegisterResponse,
    PartnerStats,
    PartnerUpdate,
)
from app.services import auth as auth_service
from app.services import coupons as coupons_service
from app.services import partners as partners_service
from app.services import stories as stories_service

public_router = APIRouter(prefix="/partners", tags=["partners"])
business_router = APIRouter(prefix="/business", tags=["partners"])


# --- onboarding -------------------------------------------------------------


@public_router.post(
    "/register", response_model=PartnerRegisterResponse, status_code=status.HTTP_201_CREATED
)
async def register_partner(
    payload: PartnerRegisterRequest, db: DbSession, request: Request
) -> PartnerRegisterResponse:
    """Sign up a business. It starts unapproved and invisible to consumers."""
    owner, partner = await partners_service.register_partner(
        db,
        email=payload.email,
        password=payload.password,
        company_name=payload.company_name,
        contact_name=payload.contact_name,
        description=payload.description,
        contact_phone=payload.contact_phone,
    )
    _, tokens = await auth_service.login_with_password(
        db,
        email=payload.email,
        password=payload.password,
        user_agent=request.headers.get("user-agent", ""),
    )
    return PartnerRegisterResponse(
        user=UserPublic.model_validate(owner),
        partner=PartnerPrivate.model_validate(partner),
        tokens=tokens,
    )


# --- public store list ------------------------------------------------------


@public_router.get("", response_model=list[PartnerPublic])
async def list_stores(
    db: DbSession,
    search: Annotated[str, Query(max_length=100)] = "",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[PartnerPublic]:
    """Approved businesses. Public — the catalogue is browsable before sign-in."""
    rows = await partners_service.list_public_partners(
        db, search=search, limit=limit, offset=offset
    )
    return [PartnerPublic.model_validate(row) for row in rows]


@public_router.get("/{partner_id}", response_model=PartnerPublic)
async def get_store(partner_id: uuid.UUID, db: DbSession) -> PartnerPublic:
    partner = await partners_service.get_public_partner(db, partner_id=partner_id)
    return PartnerPublic.model_validate(partner)


@public_router.get("/{partner_id}/branches", response_model=list[BranchPublic])
async def get_store_branches(partner_id: uuid.UUID, db: DbSession) -> list[BranchPublic]:
    await partners_service.get_public_partner(db, partner_id=partner_id)
    rows = await partners_service.list_branches(db, partner_id=partner_id)
    return [BranchPublic.model_validate(row) for row in rows if row.is_active]


# --- the partner's own business ---------------------------------------------


@business_router.get("/profile", response_model=PartnerPrivate)
async def get_own_profile(partner: CurrentPartner) -> PartnerPrivate:
    return PartnerPrivate.model_validate(partner)


@business_router.patch("/profile", response_model=PartnerPrivate)
async def update_own_profile(
    payload: PartnerUpdate, db: DbSession, partner: CurrentPartner
) -> PartnerPrivate:
    changes = payload.model_dump(exclude_none=True)
    updated = await partners_service.update_profile(db, partner=partner, changes=changes)
    return PartnerPrivate.model_validate(updated)


@business_router.get("/stats", response_model=PartnerStats)
async def get_own_stats(db: DbSession, partner: CurrentPartner) -> PartnerStats:
    return PartnerStats(**await partners_service.partner_stats(db, partner_id=partner.id))


@business_router.get("/branches", response_model=list[BranchPublic])
async def list_own_branches(db: DbSession, partner: CurrentPartner) -> list[BranchPublic]:
    rows = await partners_service.list_branches(db, partner_id=partner.id)
    return [BranchPublic.model_validate(row) for row in rows]


@business_router.post(
    "/branches", response_model=BranchPublic, status_code=status.HTTP_201_CREATED
)
async def create_own_branch(
    payload: BranchCreate, db: DbSession, partner: CurrentPartner
) -> BranchPublic:
    branch = await partners_service.add_branch(db, partner=partner, data=payload.model_dump())
    return BranchPublic.model_validate(branch)


@business_router.delete("/branches/{branch_id}", response_model=Message)
async def delete_own_branch(
    branch_id: uuid.UUID, db: DbSession, partner: CurrentPartner
) -> Message:
    branch = await partners_service.get_owned_branch(db, partner=partner, branch_id=branch_id)
    await db.delete(branch)
    await db.commit()
    return Message(message="Branch removed.")


@business_router.get("/content", response_model=dict)
async def own_content_summary(
    db: DbSession, partner: CurrentPartner, user: PartnerUser
) -> dict:
    """Everything this partner has authored, with its review status."""
    coupons = await coupons_service.list_partner_coupons(db, partner_id=partner.id)
    stories = await stories_service.list_partner_stories(db, partner_id=partner.id)
    return {
        "coupons": [CouponPrivate.model_validate(row).model_dump(mode="json") for row in coupons],
        "stories": [StoryPrivate.model_validate(row).model_dump(mode="json") for row in stories],
    }
