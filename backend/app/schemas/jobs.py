"""Scheduled-job trigger schemas."""

from __future__ import annotations

from pydantic import BaseModel


class JobResult(BaseModel):
    job: str
    #: Whatever the job counted — rows processed, coins paid, records expired.
    stats: dict[str, int]
