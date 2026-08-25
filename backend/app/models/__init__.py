"""Import every model so Alembic's autogenerate sees the full metadata."""

from app.db.base import Base
from app.models.audit import AdminActionLog, FlaggedEvent
from app.models.coupon import Coupon, CouponCategory, UserCoupon
from app.models.economy import CoinTransaction, DailySteps, EconomySettings
from app.models.media import Media
from app.models.notification import Notification
from app.models.partner import Branch, Partner
from app.models.story import Story, StoryView
from app.models.support import FAQTemplate, SupportChatMessage, SupportTicket
from app.models.user import Device, RefreshToken, SMSVerification, User

__all__ = [
    "AdminActionLog",
    "Base",
    "Branch",
    "CoinTransaction",
    "Coupon",
    "CouponCategory",
    "DailySteps",
    "Device",
    "EconomySettings",
    "FAQTemplate",
    "FlaggedEvent",
    "Media",
    "Notification",
    "Partner",
    "RefreshToken",
    "SMSVerification",
    "Story",
    "StoryView",
    "SupportChatMessage",
    "SupportTicket",
    "User",
    "UserCoupon",
]
