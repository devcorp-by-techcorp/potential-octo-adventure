"""FastAPI app entry for the studio-suite backend.

Loads environment, builds the app via a factory, exposes liveness and DB-readiness
health probes, and configures CORS for explicit production origins plus Railway
preview hosts. ``app`` is exported at module scope for ``uvicorn server:app``.

Note: this module defines route handlers, so it deliberately does **not** use
``from __future__ import annotations`` (which can cause FastAPI to mis-resolve
annotations and return HTTP 422 on affected endpoints).
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Populate os.environ from backend/.env before any module reads configuration.
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI  # noqa: E402 — must follow load_dotenv
from fastapi.exception_handlers import request_validation_exception_handler  # noqa: E402
from fastapi.exceptions import RequestValidationError  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402
from starlette.responses import JSONResponse  # noqa: E402

from account_sessions import router as account_sessions_router  # noqa: E402
from auth import router as auth_router  # noqa: E402
from booking_drafts import router as booking_drafts_router  # noqa: E402
from booking_resources import router as resources_router  # noqa: E402
from bookings import router as bookings_router  # noqa: E402
from client_access import router as client_router  # noqa: E402
from config import get_settings  # noqa: E402
from conversations import router as conversations_router  # noqa: E402
from db import check_database_connection, close_database_client  # noqa: E402
from documents import router as documents_router  # noqa: E402
from enquiry_operations import router as operations_router  # noqa: E402
from entry import router as entry_router  # noqa: E402
from public_content import router as content_router  # noqa: E402
from studio_contacts import router as contacts_router  # noqa: E402
from studio_enquiries import router as enquiries_router  # noqa: E402
from studio_reporting import router as reporting_router  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("studio-suite")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify DB connectivity on startup without blocking the service.

    A briefly-unreachable database must not stop the API from starting, so the
    probe result is logged and startup continues; the Motor client is closed on
    shutdown.
    """
    status = await check_database_connection()
    if status.get("ok"):
        logger.info("MongoDB connection verified (database=%s)", status.get("database"))
    else:
        logger.warning("MongoDB not reachable at startup; check database configuration")
    try:
        yield
    finally:
        close_database_client()


def _configure_cors(app: FastAPI) -> None:
    """Attach CORS middleware using explicit origins plus a preview-host regex.

    ``allow_credentials`` is enabled only when origins are not the ``["*"]``
    wildcard, avoiding the credentials-with-wildcard footgun browsers reject.
    """
    settings = get_settings()
    origins = settings.cors_origin_list() or settings.auth_origin_list()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        # Set CORS_ORIGIN_REGEX for ephemeral Railway preview hosts, e.g.
        # ^https://web-[a-z0-9-]+\.up\.railway\.app$
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=origins != ["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()
    app = FastAPI(title="Studio Suite API", lifespan=lifespan)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # Pydantic's default error includes submitted inputs. Never echo credentials.
        if request.url.path.startswith("/api/auth/"):
            return JSONResponse({"detail": "Please check your sign-in details."}, status_code=422)
        if request.url.path.startswith(("/api/studio/", "/api/client/")):
            return JSONResponse({"detail": "Please check the enquiry input."}, status_code=422)
        return await request_validation_exception_handler(request, exc)

    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(("/api/auth/", "/api/studio/", "/api/client/")):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health")
    async def health() -> dict:
        """Liveness probe used by the Railway health check."""
        return {"ok": True, "name": "Studio Suite API", "environment": settings.environment}

    @app.get("/api/health/db")
    async def health_db() -> dict:
        """Readiness probe reporting MongoDB connectivity as a status object."""
        return await check_database_connection()

    @app.get("/api/ready")
    async def ready():
        """Deployment readiness: fail closed without exposing database details."""
        status = await check_database_connection()
        ok = bool(status.get("ok"))
        return JSONResponse(
            {"ok": ok},
            status_code=200 if ok else 503,
            headers={"Cache-Control": "no-store"},
        )

    app.include_router(entry_router)
    app.include_router(auth_router)
    app.include_router(account_sessions_router)
    app.include_router(enquiries_router)
    app.include_router(bookings_router)
    app.include_router(resources_router)
    app.include_router(client_router)
    app.include_router(reporting_router)
    app.include_router(booking_drafts_router)
    app.include_router(conversations_router)
    app.include_router(content_router)
    app.include_router(operations_router)
    app.include_router(contacts_router)
    app.include_router(documents_router)
    _configure_cors(app)
    return app


app = create_app()
