"""Application factory: middleware, exception handlers, routers, scheduler lifespan."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.errors import AppError, error_body

logging.basicConfig(level=logging.DEBUG if settings.debug else logging.INFO)
logger = logging.getLogger(__name__)

_STATUS_CODES = {
    400: "VALIDATION_ERROR",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "BUSINESS_RULE",
    429: "RATE_LIMITED",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.scheduler_enabled:
        from app.workers.scheduler import shutdown_scheduler, start_scheduler

        start_scheduler()
        try:
            yield
        finally:
            shutdown_scheduler()
    else:
        yield


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_tags=[
            {"name": "auth", "description": "Registration, sign-in, tokens, SMS codes."},
            {"name": "users", "description": "Profile and preferences."},
            {"name": "steps", "description": "Health Connect sync and step history."},
            {"name": "wallet", "description": "Coin balance and ledger."},
            {"name": "partners", "description": "Partner businesses and branches."},
            {"name": "coupons", "description": "Catalogue, purchase, redemption."},
            {"name": "stories", "description": "Partner stories."},
            {"name": "notifications", "description": "Inbox and push tokens."},
            {"name": "support", "description": "Support chat."},
            {"name": "admin", "description": "Moderation, settings, anti-fraud review."},
        ],
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Error handling: every failure leaves as {"error": {"code", "message"}} ---

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        # FastAPI defaults to 422 + {"detail": [...]}; the contract wants 400 + our shape.
        first = exc.errors()[0] if exc.errors() else {}
        location = ".".join(str(part) for part in first.get("loc", ())[1:])
        message = first.get("msg", "Request payload is invalid.")
        return JSONResponse(
            status_code=400,
            content=error_body("VALIDATION_ERROR", f"{location}: {message}" if location else message),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _STATUS_CODES.get(exc.status_code, "ERROR")
        return JSONResponse(status_code=exc.status_code, content=error_body(code, str(exc.detail)))

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return JSONResponse(
            status_code=500, content=error_body("INTERNAL_ERROR", "Something went wrong.")
        )

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    # In production nginx serves media directly; this keeps local dev self-contained.
    media_root = Path(settings.media_root)
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount(settings.media_url_prefix, StaticFiles(directory=media_root), name="media")

    @app.get("/health", tags=["admin"], include_in_schema=False)
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok", "environment": settings.environment}

    return app


app = create_app()
