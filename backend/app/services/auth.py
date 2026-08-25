"""Authentication flows: email+password, phone+SMS, refresh rotation.

Two entry paths produce the same session:

* ``register`` / ``login_with_password`` — consumers, partners and staff by email;
* ``request_sms_code`` + ``verify_sms_code`` — consumers by phone, creating the
  account on first successful verification.

Refresh tokens rotate on every use: the presented token is revoked and a new pair
is issued, so a stolen token is usable at most once before the real client's next
refresh invalidates it.
"""

from __future__ import annotations

import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import Conflict, InvalidCredentials, InvalidSMSCode, Unauthorized
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_numeric_code,
    hash_password,
    hash_token,
    verify_password,
)
from app.core.time import as_aware, utcnow
from app.models.enums import UserRole
from app.models.partner import Partner
from app.models.user import RefreshToken, SMSVerification, User
from app.schemas.auth import TokenPair

MAX_SMS_ATTEMPTS = 5


async def _issue_tokens(db: AsyncSession, user: User, *, user_agent: str = "") -> TokenPair:
    partner_id: uuid.UUID | None = None
    if user.role == UserRole.PARTNER:
        partner_id = await db.scalar(select(Partner.id).where(Partner.owner_id == user.id))

    access = create_access_token(user_id=user.id, role=user.role, partner_id=partner_id)
    refresh, refresh_hash, expires_at = create_refresh_token(user_id=user.id)

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=expires_at,
            user_agent=user_agent[:255],
        )
    )
    user.last_seen_at = utcnow()
    await db.flush()

    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_ttl_minutes * 60,
    )


async def _attach_referrer(db: AsyncSession, user: User, referral_code: str) -> None:
    if not referral_code:
        return
    referrer_id = await db.scalar(
        select(User.id).where(User.referral_code == referral_code, User.id != user.id)
    )
    if referrer_id:
        user.referred_by_id = referrer_id


async def register(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    full_name: str = "",
    referral_code: str = "",
    user_agent: str = "",
) -> tuple[User, TokenPair]:
    existing = await db.scalar(select(User).where(User.email == email.lower()))
    if existing is not None:
        raise Conflict("An account with this email already exists.", code="EMAIL_TAKEN")

    user = User(
        email=email.lower(),
        password_hash=hash_password(password),
        full_name=full_name,
        role=UserRole.USER,
    )
    db.add(user)
    await db.flush()
    await _attach_referrer(db, user, referral_code)

    tokens = await _issue_tokens(db, user, user_agent=user_agent)
    await db.commit()
    await db.refresh(user)
    return user, tokens


async def login_with_password(
    db: AsyncSession, *, email: str, password: str, user_agent: str = ""
) -> tuple[User, TokenPair]:
    user = await db.scalar(select(User).where(User.email == email.lower()))
    # Verify unconditionally-shaped: a missing user and a wrong password look identical.
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentials()
    if not user.is_active or user.is_blocked:
        raise Unauthorized("Account is not active.", code="ACCOUNT_INACTIVE")

    tokens = await _issue_tokens(db, user, user_agent=user_agent)
    await db.commit()
    return user, tokens


async def request_sms_code(db: AsyncSession, *, phone: str) -> SMSVerification:
    """Create and dispatch a one-time code. The provider is behind `app.integrations.sms`."""
    from app.integrations.sms import get_sms_backend

    code = generate_numeric_code()
    verification = SMSVerification(
        phone=phone,
        code=code,
        expires_at=utcnow() + timedelta(minutes=settings.sms_code_ttl_minutes),
    )
    db.add(verification)
    await db.commit()

    await get_sms_backend().send(phone, f"STRIDE code: {code}")
    return verification


async def verify_sms_code(
    db: AsyncSession,
    *,
    phone: str,
    code: str,
    referral_code: str = "",
    user_agent: str = "",
) -> tuple[User, TokenPair, bool]:
    """Consume the code and sign the user in, creating the account on first use."""
    verification = await db.scalar(
        select(SMSVerification)
        .where(SMSVerification.phone == phone, SMSVerification.is_used.is_(False))
        .order_by(SMSVerification.created_at.desc())
        .limit(1)
    )
    if verification is None or as_aware(verification.expires_at) < utcnow():
        raise InvalidSMSCode()
    if verification.attempts >= MAX_SMS_ATTEMPTS:
        raise InvalidSMSCode("Too many attempts. Request a new code.", code="SMS_ATTEMPTS_EXCEEDED")

    if verification.code != code:
        verification.attempts += 1
        await db.commit()
        raise InvalidSMSCode()

    verification.is_used = True

    user = await db.scalar(select(User).where(User.phone == phone))
    is_new = user is None
    if user is None:
        user = User(phone=phone, role=UserRole.USER)
        db.add(user)
        await db.flush()
        await _attach_referrer(db, user, referral_code)
    elif user.is_blocked or not user.is_active:
        raise Unauthorized("Account is not active.", code="ACCOUNT_INACTIVE")

    tokens = await _issue_tokens(db, user, user_agent=user_agent)
    await db.commit()
    await db.refresh(user)
    return user, tokens, is_new


async def refresh_session(
    db: AsyncSession, *, refresh_token: str, user_agent: str = ""
) -> tuple[User, TokenPair]:
    payload = decode_token(refresh_token, expected_type="refresh")
    token_hash = hash_token(refresh_token)

    stored = await db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if stored is None or stored.revoked_at is not None or as_aware(stored.expires_at) < utcnow():
        raise Unauthorized("Refresh token is not valid.", code="REFRESH_INVALID")

    user = await db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active or user.is_blocked:
        raise Unauthorized("Account is not active.", code="ACCOUNT_INACTIVE")

    stored.revoked_at = utcnow()  # rotate: the presented token dies here
    tokens = await _issue_tokens(db, user, user_agent=user_agent)
    await db.commit()
    return user, tokens


async def logout(db: AsyncSession, *, refresh_token: str) -> None:
    stored = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(refresh_token))
    )
    if stored is not None and stored.revoked_at is None:
        stored.revoked_at = utcnow()
        await db.commit()


async def revoke_all_sessions(db: AsyncSession, *, user_id: uuid.UUID) -> None:
    tokens = await db.scalars(
        select(RefreshToken).where(
            RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
        )
    )
    now = utcnow()
    for token in tokens:
        token.revoked_at = now
    await db.commit()
