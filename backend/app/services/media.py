"""Media uploads.

Only staff upload: partners attach images to their own coupons and stories, and
superadmins do the same on their behalf. Consumers have nothing to upload, so the
endpoint is not open to them at all.

Three checks, in this order, because each is cheaper than the next:

1. the declared content type is on the allow-list;
2. the body is within the size limit;
3. the bytes actually start with the magic number for that type.

The third is the one that matters: a browser-declared content type is attacker
controlled, and an HTML file served from the media domain is a stored-XSS
primitive. Extensions come from the *verified* type, never from the upload name.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BusinessRuleError, NotFound, ValidationError
from app.models.media import Media
from app.models.user import User
from app.storage.factory import get_storage

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_VIDEO_BYTES = 64 * 1024 * 1024

# Declared type -> (extension, magic-number prefixes)
ALLOWED_TYPES: dict[str, tuple[str, tuple[bytes, ...]]] = {
    "image/jpeg": (".jpg", (b"\xff\xd8\xff",)),
    "image/png": (".png", (b"\x89PNG\r\n\x1a\n",)),
    "image/webp": (".webp", (b"RIFF",)),
    "image/gif": (".gif", (b"GIF87a", b"GIF89a")),
    "video/mp4": (".mp4", (b"\x00\x00\x00",)),
}

VALID_PURPOSES = {"coupon", "story", "logo", "avatar", "general"}


def _limit_for(content_type: str) -> int:
    return MAX_VIDEO_BYTES if content_type.startswith("video/") else MAX_IMAGE_BYTES


def validate(content_type: str, data: bytes) -> str:
    """Return the extension for a body that passes every check, or raise."""
    entry = ALLOWED_TYPES.get(content_type)
    if entry is None:
        raise BusinessRuleError(
            f"{content_type or 'This file type'} is not accepted.", code="UNSUPPORTED_MEDIA_TYPE"
        )

    extension, signatures = entry

    limit = _limit_for(content_type)
    if len(data) > limit:
        raise BusinessRuleError(
            f"File is larger than the {limit // (1024 * 1024)} MB limit.", code="FILE_TOO_LARGE"
        )
    if not data:
        raise ValidationError("The file is empty.", code="EMPTY_FILE")

    # mp4 declares its brand a few bytes in rather than at offset 0.
    if content_type == "video/mp4":
        if b"ftyp" not in data[:32]:
            raise BusinessRuleError(
                "This file is not a valid MP4.", code="CONTENT_TYPE_MISMATCH"
            )
    elif not any(data.startswith(signature) for signature in signatures):
        raise BusinessRuleError(
            "The file contents do not match the declared type.", code="CONTENT_TYPE_MISMATCH"
        )

    return extension


async def upload(
    db: AsyncSession,
    *,
    owner: User,
    data: bytes,
    content_type: str,
    original_name: str = "",
    purpose: str = "general",
) -> Media:
    if purpose not in VALID_PURPOSES:
        raise ValidationError(f"Unknown purpose '{purpose}'.", code="BAD_PURPOSE")

    extension = validate(content_type, data)

    # The key is server-generated: an attacker-supplied name could traverse
    # directories or collide with someone else's file.
    key = f"{purpose}/{uuid.uuid4().hex}{extension}"
    await get_storage().save(key, data, content_type)

    media = Media(
        owner_id=owner.id,
        key=key,
        content_type=content_type,
        size_bytes=len(data),
        original_name=original_name[:255],
        purpose=purpose,
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return media


async def get_owned(db: AsyncSession, *, owner_id: uuid.UUID, media_id: uuid.UUID) -> Media:
    media = await db.scalar(
        select(Media).where(Media.id == media_id, Media.owner_id == owner_id)
    )
    if media is None:
        raise NotFound("File not found.")
    return media


async def delete(db: AsyncSession, *, media: Media) -> None:
    await get_storage().delete(media.key)
    await db.delete(media)
    await db.commit()


async def list_for_owner(
    db: AsyncSession, *, owner_id: uuid.UUID, purpose: str | None = None, limit: int = 50
) -> list[Media]:
    query = select(Media).where(Media.owner_id == owner_id)
    if purpose:
        query = query.where(Media.purpose == purpose)
    rows = await db.scalars(query.order_by(Media.created_at.desc()).limit(limit))
    return list(rows.all())


def public_url(media: Media) -> str:
    return get_storage().url(media.key)
