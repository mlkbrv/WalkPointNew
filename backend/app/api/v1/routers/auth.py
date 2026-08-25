"""Authentication endpoints.

Consumers may sign in with either email+password or phone+SMS. Partners and
superadmins use email+password only; their role is carried in the JWT.
"""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.core.deps import CurrentUser, DbSession
from app.core.errors import Forbidden
from app.models.enums import UserRole
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    SMSRequest,
    SMSVerifyRequest,
    TokenPair,
    UserPublic,
)
from app.schemas.common import Message
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: DbSession, request: Request) -> AuthResponse:
    user, tokens = await auth_service.register(
        db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
        referral_code=payload.referral_code,
        user_agent=request.headers.get("user-agent", ""),
    )
    return AuthResponse(user=UserPublic.model_validate(user), tokens=tokens, is_new_user=True)


@router.post("/login", response_model=AuthResponse)
async def login(payload: LoginRequest, db: DbSession, request: Request) -> AuthResponse:
    user, tokens = await auth_service.login_with_password(
        db,
        email=payload.email,
        password=payload.password,
        user_agent=request.headers.get("user-agent", ""),
    )
    return AuthResponse(user=UserPublic.model_validate(user), tokens=tokens)


@router.post("/staff/login", response_model=AuthResponse)
async def staff_login(payload: LoginRequest, db: DbSession, request: Request) -> AuthResponse:
    """Admin-panel sign-in. Rejects plain consumer accounts outright."""
    user, tokens = await auth_service.login_with_password(
        db,
        email=payload.email,
        password=payload.password,
        user_agent=request.headers.get("user-agent", ""),
    )
    if user.role not in (UserRole.PARTNER, UserRole.SUPERADMIN):
        raise Forbidden("This account cannot access the admin panel.")
    return AuthResponse(user=UserPublic.model_validate(user), tokens=tokens)


@router.post("/sms/request", response_model=Message)
async def request_sms(payload: SMSRequest, db: DbSession) -> Message:
    await auth_service.request_sms_code(db, phone=payload.phone)
    return Message(message="Verification code sent.")


@router.post("/sms/verify", response_model=AuthResponse)
async def verify_sms(payload: SMSVerifyRequest, db: DbSession, request: Request) -> AuthResponse:
    user, tokens, is_new = await auth_service.verify_sms_code(
        db,
        phone=payload.phone,
        code=payload.code,
        referral_code=payload.referral_code,
        user_agent=request.headers.get("user-agent", ""),
    )
    return AuthResponse(user=UserPublic.model_validate(user), tokens=tokens, is_new_user=is_new)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: DbSession, request: Request) -> TokenPair:
    _, tokens = await auth_service.refresh_session(
        db,
        refresh_token=payload.refresh_token,
        user_agent=request.headers.get("user-agent", ""),
    )
    return tokens


@router.post("/logout", response_model=Message)
async def logout(payload: RefreshRequest, db: DbSession) -> Message:
    await auth_service.logout(db, refresh_token=payload.refresh_token)
    return Message(message="Signed out.")


@router.get("/me", response_model=UserPublic, tags=["users"])
async def me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)
