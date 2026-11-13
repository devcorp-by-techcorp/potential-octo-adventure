"""MongoDB connection — lazy, validated, canonical env names only.

The Motor client is created on first use (not at import) so the FastAPI app can be
imported before any environment variables are present, and a missing variable
raises a clear error at use-time rather than an opaque failure at import.

Canonical environment variables (no legacy aliases):

* ``MONGODB_URI``     — the Atlas/Railway driver connection string.
* ``MONGODB_DB_NAME`` — the application database name.
"""

import os
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

DEFAULT_APP_NAME = "studio-suite"
DEFAULT_MAX_POOL_SIZE = 20
DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 10000

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def _optional_positive_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"Environment variable {name!r} must be an integer.") from exc
    if value <= 0:
        raise RuntimeError(f"Environment variable {name!r} must be greater than zero.")
    return value


def _mongo_uri() -> str:
    """Resolve and validate the MongoDB connection string from ``MONGODB_URI``."""
    uri = (os.environ.get("MONGODB_URI") or "").strip()
    if not uri:
        raise RuntimeError(
            "Required environment variable 'MONGODB_URI' is not set. "
            "Configure it on the service (see README.md)."
        )
    if not (uri.startswith("mongodb://") or uri.startswith("mongodb+srv://")):
        raise RuntimeError(
            "MONGODB_URI must start with 'mongodb://' or 'mongodb+srv://'. "
            "Copy the driver connection string from MongoDB Atlas/Railway."
        )
    return uri


def _database_name(uri: str) -> str:
    """Resolve the database name from ``MONGODB_DB_NAME`` or the URI path."""
    name = (os.environ.get("MONGODB_DB_NAME") or "").strip()
    if name:
        return name

    uri_db = urlsplit(uri).path.lstrip("/").strip()
    if uri_db:
        return uri_db

    raise RuntimeError(
        "Required environment variable 'MONGODB_DB_NAME' is not set, and no "
        "database name was present in MONGODB_URI. Configure it on the service "
        "(see README.md)."
    )


def _with_default_app_name(uri: str, app_name: str) -> str:
    """Append ``appName`` to the URI when it is not already set.

    MongoDB records ``appName`` in connection metadata, which makes Atlas/Railway
    logs and connection troubleshooting much easier.
    """
    parsed = urlsplit(uri)
    query = parse_qsl(parsed.query, keep_blank_values=True)
    if any(key.lower() == "appname" for key, _ in query):
        return uri
    query.append(("appName", app_name))
    return urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path or "/", urlencode(query), parsed.fragment)
    )


def _client_options() -> dict:
    """Return Motor/PyMongo options tuned for hosted Railway deployments."""
    return {
        "serverSelectionTimeoutMS": _optional_positive_int(
            "MONGODB_SERVER_SELECTION_TIMEOUT_MS", DEFAULT_SERVER_SELECTION_TIMEOUT_MS
        ),
        "connectTimeoutMS": _optional_positive_int("MONGODB_CONNECT_TIMEOUT_MS", 10000),
        "socketTimeoutMS": _optional_positive_int("MONGODB_SOCKET_TIMEOUT_MS", 20000),
        "maxPoolSize": _optional_positive_int("MONGODB_MAX_POOL_SIZE", DEFAULT_MAX_POOL_SIZE),
        "uuidRepresentation": "standard",
    }


def get_database() -> AsyncIOMotorDatabase:
    """Return the application database, creating the client on first call."""
    global _client, _db
    if _db is None:
        uri = _mongo_uri()
        app_name = (os.environ.get("MONGODB_APP_NAME", "").strip() or DEFAULT_APP_NAME)
        _client = AsyncIOMotorClient(
            _with_default_app_name(uri, app_name),
            **_client_options(),
        )
        _db = _client[_database_name(uri)]
    return _db


async def check_database_connection() -> dict:
    """Probe MongoDB connectivity and return a status object.

    This never raises: a missing variable or an unreachable database is reported
    as ``{"ok": False, "status": "unreachable", ...}`` so the readiness endpoint
    stays available and reports the problem instead of returning a 500.
    """
    try:
        database = get_database()
        await database.client.admin.command("ping")
    except Exception as exc:
        # A health probe must report problems, never crash the service.
        return {"ok": False, "status": "unreachable", "error": str(exc)}

    options = _client_options()
    return {
        "ok": True,
        "status": "connected",
        "database": database.name,
        "maxPoolSize": options["maxPoolSize"],
        "serverSelectionTimeoutMS": options["serverSelectionTimeoutMS"],
    }


def close_database_client() -> None:
    """Close the cached Motor client during app shutdown/tests."""
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None
