"""Aggregates every v1 router. New domains are registered here."""

from fastapi import APIRouter

from app.api.v1.routers import (
    activity,
    admin,
    auth,
    coupons,
    jobs,
    media,
    notifications,
    partners,
    redemptions,
    steps,
    stories,
    support,
    wallet,
)

api_router = APIRouter()

# Consumer and public
api_router.include_router(auth.router)
api_router.include_router(steps.router)
api_router.include_router(wallet.router)
api_router.include_router(partners.public_router)
api_router.include_router(coupons.public_router)
api_router.include_router(stories.public_router)
api_router.include_router(redemptions.purchase_router)
api_router.include_router(redemptions.wallet_router)
api_router.include_router(notifications.router)
api_router.include_router(activity.leaderboard_router)
api_router.include_router(activity.workouts_router)
api_router.include_router(support.router)

# Partner console
api_router.include_router(partners.business_router)
api_router.include_router(coupons.business_router)
api_router.include_router(stories.business_router)
api_router.include_router(redemptions.till_router)
api_router.include_router(media.router)

# Staff
api_router.include_router(admin.router)
api_router.include_router(jobs.router)
api_router.include_router(support.admin_router)
