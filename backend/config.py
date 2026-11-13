"""Application settings (pydantic-settings).

Reads configuration from the process environment and an optional ``backend/.env``
file. Field names map case-insensitively to environment variable names, so
``mongodb_uri`` reads ``MONGODB_URI``.

The Cloudflare R2 fields are *reserved by name* for the later media-pipeline task;
no R2 client is constructed in task 01.0.0.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    """Typed application configuration."""

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_ignore_empty=True,
    )

    # ---- Environment ----
    environment: str = "development"

    # ---- Database (canonical names only; no legacy aliases) ----
    mongodb_uri: str | None = None
    mongodb_db_name: str | None = None
    mongodb_app_name: str = "studio-suite"
    mongodb_max_pool_size: int = 20
    mongodb_server_selection_timeout_ms: int = 10000

    # ---- Luma (server only; never exposed through Vite) ----
    openai_api_key: str | None = None
    openai_model: str = "gpt-4.1-mini"

    # ---- Optional booking email notifications (Resend) ----
    resend_api_key: str | None = None
    booking_notification_email: str | None = None
    booking_from_email: str | None = None

    # ---- CORS ----
    cors_origins: str = ""
    cors_origin_regex: str | None = None

    # Staff auth uses explicit origins only, never the preview CORS regex.
    auth_allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    auth_session_seconds: int = Field(default=28800, ge=60, le=604800)
    client_invitation_seconds: int = Field(default=86400, ge=60, le=604800)

    @model_validator(mode="after")
    def validate_auth_origins(self):
        from urllib.parse import urlsplit

        origins = self.auth_origin_list()
        if not origins or "*" in origins:
            raise ValueError("AUTH_ALLOWED_ORIGINS requires explicit frontend origins")
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or parsed.path
                or parsed.query
                or parsed.fragment
                or parsed.username
            ):
                raise ValueError("AUTH_ALLOWED_ORIGINS must contain origins only")
            if self.is_production and parsed.scheme != "https":
                raise ValueError("Production staff authentication requires HTTPS origins")
        if self.is_production and ("*" in self.cors_origin_list() or self.cors_origin_regex):
            raise ValueError("Production credentialed CORS requires explicit origins")
        return self

    def auth_origin_list(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.auth_allowed_origins.split(",")
            if origin.strip()
        ]

    # ---- Cloudflare R2 (RESERVED — adapter implemented in a later task) ----
    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket_originals: str | None = None
    r2_bucket_derivatives: str | None = None

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    def cors_origin_list(self) -> list[str]:
        """Explicit CORS origins parsed from the comma-separated ``CORS_ORIGINS``.

        Each origin is trimmed and has any trailing slash removed so browser
        ``Origin`` headers match exactly.
        """
        return [
            origin.strip().rstrip("/") for origin in self.cors_origins.split(",") if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Return a cached ``Settings`` instance.

    Tests that need to vary the environment can clear the cache via
    ``get_settings.cache_clear()`` and set the relevant variables in the
    process environment.
    """
    return Settings()
