"""Password hashing and JWT issuing/verification.

Access tokens are short-lived and stateless; refresh tokens are long-lived and are
additionally persisted (hashed) in ``refresh_tokens`` so they can be revoked.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

from app.core.config import settings
from app.core.errors import Unauthorized

_hasher = PasswordHasher()

TokenType = Literal["access", "refresh"]


def hash_password(raw_password: str) -> str:
    return _hasher.hash(raw_password)


def verify_password(raw_password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    try:
        return _hasher.verify(password_hash, raw_password)
    except (VerifyMismatchError, VerificationError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(*, user_id: uuid.UUID, role: str, partner_id: uuid.UUID | None = None) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_ttl_minutes)).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    if partner_id:
        payload["partner_id"] = str(partner_id)
    return _encode(payload)


def create_refresh_token(*, user_id: uuid.UUID) -> tuple[str, str, datetime]:
    """Return ``(token, token_hash, expires_at)``. Only the hash is stored."""
    now = datetime.now(UTC)
    expires_at = now + timedelta(days=settings.refresh_token_ttl_days)
    token = _encode(
        {
            "sub": str(user_id),
            "type": "refresh",
            "iat": int(now.timestamp()),
            "exp": int(expires_at.timestamp()),
            "jti": uuid.uuid4().hex,
        }
    )
    return token, hash_token(token), expires_at


def hash_token(token: str) -> str:
    """Refresh tokens are stored as a digest so a database leak cannot replay them."""
    return hashlib.sha256(token.encode()).hexdigest()


def decode_token(token: str, *, expected_type: TokenType) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise Unauthorized("Token has expired.", code="TOKEN_EXPIRED") from exc
    except jwt.PyJWTError as exc:
        raise Unauthorized("Token is invalid.") from exc

    if payload.get("type") != expected_type:
        raise Unauthorized("Token is invalid.")
    return payload


def generate_numeric_code(length: int = 6) -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(length))


def generate_referral_code(length: int = 8) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))
