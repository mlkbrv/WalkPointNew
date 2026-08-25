"""Local-disk storage. nginx serves MEDIA_ROOT at MEDIA_URL_PREFIX in production."""

from __future__ import annotations

from pathlib import Path

import aiofiles

from app.core.config import settings
from app.storage.base import Storage


class LocalStorage(Storage):
    def __init__(self, root: str | None = None, url_prefix: str | None = None) -> None:
        self.root = Path(root or settings.media_root).resolve()
        self.url_prefix = (url_prefix or settings.media_url_prefix).rstrip("/")
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError(f"Refusing to write outside the media root: {key}")
        return path

    async def save(self, key: str, data: bytes, content_type: str = "") -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        async with aiofiles.open(path, "wb") as fh:
            await fh.write(data)
        return key

    async def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def url(self, key: str) -> str:
        return f"{self.url_prefix}/{key.lstrip('/')}"
