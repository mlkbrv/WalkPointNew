"""Shared FastAPI dependencies: current user, role guards, pagination."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Forbidden, Unauthorized
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.partner import Partner
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    if credentials is None:
        raise Unauthorized()

    payload = decode_token(credentials.credentials, expected_type="access")
    try:
        user_id = uuid.UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise Unauthorized("Token is invalid.") from exc

    user = await db.get(User, user_id)
    if user is None or not user.is_active:
        raise Unauthorized("Account is not active.")
    if user.is_blocked:
        raise Forbidden("Account is blocked.", code="ACCOUNT_BLOCKED")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_optional_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User | None:
    """For endpoints that are public but personalise their response when signed in."""
    if credentials is None:
        return None
    return await get_current_user(db, credentials)


OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def require_role(*roles: UserRole):
    """Dependency factory guarding an endpoint behind one or more roles."""

    async def _guard(user: CurrentUser) -> User:
        if user.role not in roles:
            raise Forbidden()
        return user

    return _guard


require_superadmin = require_role(UserRole.SUPERADMIN)
require_partner = require_role(UserRole.PARTNER)
require_staff = require_role(UserRole.PARTNER, UserRole.SUPERADMIN)

SuperadminUser = Annotated[User, Depends(require_superadmin)]
PartnerUser = Annotated[User, Depends(require_partner)]


async def get_current_partner(db: DbSession, user: PartnerUser) -> Partner:
    """The single partner business owned by the signed-in partner account."""
    partner = await db.scalar(select(Partner).where(Partner.owner_id == user.id))
    if partner is None:
        raise Forbidden("No partner business is attached to this account.", code="NO_PARTNER")
    return partner


CurrentPartner = Annotated[Partner, Depends(get_current_partner)]


class Pagination:
    """Cursor pagination as specified in docs/BACKEND_API.md section 1.4."""

    def __init__(
        self,
        cursor: Annotated[str | None, Query()] = None,
        limit: Annotated[int, Query(ge=1, le=50)] = 20,
    ) -> None:
        self.cursor = cursor
        self.limit = limit


PageParams = Annotated[Pagination, Depends()]


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else ""
