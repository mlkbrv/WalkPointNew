"""Media storage behind an interface so local disk can be swapped for S3 later.

Callers only ever see a relative key (``coupons/<uuid>.jpg``) and a public URL —
never a filesystem path.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class Storage(ABC):
    @abstractmethod
    async def save(self, key: str, data: bytes, content_type: str = "") -> str:
        """Persist ``data`` under ``key`` and return the stored key."""

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    def url(self, key: str) -> str:
        """Public URL for a stored key."""
