"""Scheduled-jobs process.

Runs the APScheduler jobs — the nightly coin roll-up, the story sweeper, voucher
expiry — and nothing else. It exists as a separate entry point because gunicorn
forks several API workers and each would otherwise start its own scheduler, so
every job would run once per worker.

    python -m app.worker

Exactly one instance of this may run. Deploy it as a single replica.
"""

from __future__ import annotations

import asyncio
import logging
import signal

from app.core.config import settings
from app.workers.scheduler import shutdown_scheduler, start_scheduler

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s",
)
logger = logging.getLogger("worker")


async def main() -> None:
    if not settings.scheduler_enabled:
        logger.warning("SCHEDULER_ENABLED is false — this process has nothing to do.")
        return

    scheduler = start_scheduler()
    for job in scheduler.get_jobs():
        logger.info("Job %s -> next run %s", job.id, job.next_run_time)

    stop = asyncio.Event()

    def request_stop(*_: object) -> None:
        logger.info("Shutting down")
        stop.set()

    loop = asyncio.get_running_loop()
    for name in ("SIGINT", "SIGTERM"):
        received = getattr(signal, name, None)
        if received is None:
            continue
        try:
            loop.add_signal_handler(received, request_stop)
        except NotImplementedError:
            # Windows has no signal handlers on the event loop; Ctrl-C still works.
            signal.signal(received, request_stop)

    try:
        await stop.wait()
    finally:
        shutdown_scheduler()


if __name__ == "__main__":
    asyncio.run(main())
