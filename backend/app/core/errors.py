"""Typed application errors and the single response shape the API is contracted to.

Every failure leaves the API as ``{"error": {"code": ..., "message": ...}}``
(docs/BACKEND_API.md section 1.7). FastAPI's default ``{"detail": ...}`` shape is
overridden in ``app.main``.
"""

from fastapi import status


class AppError(Exception):
    """Base class for every error the API deliberately returns."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "ERROR"
    message: str = "Something went wrong."

    def __init__(self, message: str | None = None, *, code: str | None = None) -> None:
        if message:
            self.message = message
        if code:
            self.code = code
        super().__init__(self.message)


class ValidationError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "VALIDATION_ERROR"
    message = "Request payload is invalid."


class Unauthorized(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"
    message = "Authentication required."


class Forbidden(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"
    message = "You do not have access to this resource."


class NotFound(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"
    message = "Resource not found."


class Conflict(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"
    message = "Resource is in a conflicting state."


class BusinessRuleError(AppError):
    """422 — the request was well-formed but a domain rule rejects it."""

    status_code = 422
    code = "BUSINESS_RULE"
    message = "This action is not allowed right now."


class InsufficientCoins(BusinessRuleError):
    code = "INSUFFICIENT_COINS"
    message = "Not enough coins to purchase this coupon."


class NotApproved(BusinessRuleError):
    code = "NOT_APPROVED"
    message = "This item has not been approved yet."


class NotPublished(BusinessRuleError):
    code = "NOT_PUBLISHED"
    message = "This item is not published."


class Expired(BusinessRuleError):
    code = "EXPIRED"
    message = "This item has expired."


class AlreadyUsed(Conflict):
    code = "ALREADY_USED"
    message = "This coupon has already been used."


class SoldOut(BusinessRuleError):
    code = "SOLD_OUT"
    message = "This coupon is sold out."


class StepCapExceeded(BusinessRuleError):
    code = "STEP_CAP_EXCEEDED"
    message = "Reported step count exceeds the accepted daily limit."


class InvalidCredentials(Unauthorized):
    code = "INVALID_CREDENTIALS"
    message = "Email or password is incorrect."


class InvalidSMSCode(Unauthorized):
    code = "INVALID_SMS_CODE"
    message = "The SMS code is invalid or has expired."


class RateLimited(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "RATE_LIMITED"
    message = "Too many requests. Try again later."


def error_body(code: str, message: str) -> dict[str, dict[str, str]]:
    return {"error": {"code": code, "message": message}}
