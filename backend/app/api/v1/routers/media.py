"""Media uploads for partners and staff."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.core.deps import DbSession, require_staff
from app.models.user import User
from app.schemas.common import Message
from app.schemas.media import MediaPublic
from app.services import media as media_service

router = APIRouter(prefix="/media", tags=["media"])

StaffUser = Annotated[User, Depends(require_staff)]


def _to_public(item) -> MediaPublic:
    return MediaPublic(
        id=item.id,
        key=item.key,
        url=media_service.public_url(item),
        content_type=item.content_type,
        size_bytes=item.size_bytes,
        purpose=item.purpose,
        created_at=item.created_at,
    )


@router.post("/uploads", response_model=MediaPublic, status_code=status.HTTP_201_CREATED)
async def upload(
    db: DbSession,
    user: StaffUser,
    file: Annotated[UploadFile, File()],
    purpose: Annotated[str, Form()] = "general",
) -> MediaPublic:
    """Store a file and return the key to put on a coupon, story, or logo.

    The response `key` is what other endpoints expect (`image_path`,
    `media_path`, `logo_path`); `url` is only for previewing it.
    """
    data = await file.read()
    item = await media_service.upload(
        db,
        owner=user,
        data=data,
        content_type=file.content_type or "",
        original_name=file.filename or "",
        purpose=purpose,
    )
    return _to_public(item)


@router.get("", response_model=list[MediaPublic])
async def list_mine(
    db: DbSession, user: StaffUser, purpose: str | None = None
) -> list[MediaPublic]:
    rows = await media_service.list_for_owner(db, owner_id=user.id, purpose=purpose)
    return [_to_public(row) for row in rows]


@router.delete("/{media_id}", response_model=Message)
async def delete(media_id: uuid.UUID, db: DbSession, user: StaffUser) -> Message:
    """Remove a file. Only the uploader can delete their own."""
    item = await media_service.get_owned(db, owner_id=user.id, media_id=media_id)
    await media_service.delete(db, media=item)
    return Message(message="File deleted.")
