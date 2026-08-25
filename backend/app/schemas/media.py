"""Media schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class MediaPublic(BaseModel):
    id: uuid.UUID
    #: Relative storage key — this is what goes on a coupon or story.
    key: str
    #: Where to fetch it for a preview. Not a stable identifier.
    url: str
    content_type: str
    size_bytes: int
    purpose: str
    created_at: datetime
