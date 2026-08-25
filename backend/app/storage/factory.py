from functools import lru_cache

from app.core.config import settings
from app.storage.base import Storage
from app.storage.local import LocalStorage


@lru_cache
def get_storage() -> Storage:
    if settings.storage_backend == "s3":  # pragma: no cover - not wired yet
        raise NotImplementedError("Add an S3Storage implementation of app.storage.base.Storage.")
    return LocalStorage()
