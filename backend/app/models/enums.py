"""Domain enumerations shared across models and schemas."""

from enum import StrEnum


class UserRole(StrEnum):
    USER = "user"
    PARTNER = "partner"
    SUPERADMIN = "superadmin"


class ModerationStatus(StrEnum):
    DRAFT = "draft"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PartnerStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class CoinSource(StrEnum):
    """Every way a coin balance can move. The ledger is append-only."""

    STEPS = "steps"
    DAILY_ROLLUP = "daily_rollup"
    WORKOUT_BONUS = "workout_bonus"
    COUPON_PURCHASE = "coupon_purchase"
    REFERRAL = "referral"
    STORY_VIEW = "story_view"
    ADMIN_ADJUST = "admin_adjust"
    REFUND = "refund"


class UserCouponStatus(StrEnum):
    ACTIVE = "active"
    USED = "used"
    EXPIRED = "expired"


class StoryMediaType(StrEnum):
    IMAGE = "image"
    VIDEO = "video"


class NotificationType(StrEnum):
    GENERIC = "generic"
    COINS_AWARDED = "coins_awarded"
    STEPS_MISSED = "steps_missed"
    MODERATION_RESULT = "moderation_result"
    NEW_COUPON = "new_coupon"
    SUPPORT_REPLY = "support_reply"


class FlagType(StrEnum):
    IMPLAUSIBLE_DAILY_STEPS = "implausible_daily_steps"
    STEP_SPIKE = "step_spike"
    SUSPICIOUS_REFERRAL = "suspicious_referral"
    SUSPICIOUS_PARTNER_ACTIVITY = "suspicious_partner_activity"


class FlagStatus(StrEnum):
    OPEN = "open"
    APPROVED = "approved"
    REJECTED = "rejected"


class FlagSeverity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TicketStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class MessageSender(StrEnum):
    USER = "user"
    ADMIN = "admin"
