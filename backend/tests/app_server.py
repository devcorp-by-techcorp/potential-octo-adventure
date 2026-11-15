"""Test-only backend for the app web build: real isolated MongoDB, seeded identities, no email."""

import os
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import uvicorn
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["OPENAI_API_KEY"] = "integration-test-key"
os.environ["RESEND_API_KEY"] = ""
os.environ["ENVIRONMENT"] = "test"
os.environ["MONGODB_URI"] = os.environ["BROWSER_MONGODB_URI"]
os.environ["MONGODB_DB_NAME"] = "studio_suite_app_test"
os.environ["AUTH_ALLOWED_ORIGINS"] = os.environ["APP_TEST_ORIGIN"]
os.environ["CORS_ORIGINS"] = os.environ["AUTH_ALLOWED_ORIGINS"]
os.environ["CORS_ORIGIN_REGEX"] = ""
os.environ["AUTH_SESSION_SECONDS"] = "28800"

import auth  # noqa: E402
import client_auth  # noqa: E402
from auth import password_hash  # noqa: E402
from config import Settings  # noqa: E402

# Empty provider placeholders must not fall through to a developer's .env.
Settings.model_config["env_file"] = None

from server import app  # noqa: E402

DB_NAME = "studio_suite_app_test"
PASSWORD = "app-test-password"

# The suites sign in far more often than the real 5-per-email budget allows.
for module in (auth, client_auth):
    original = module.throttle

    async def relaxed(database, kind, value, limit, collection=None, _original=original):
        args = (database, kind, value, 100_000)
        return await (_original(*args, collection) if collection else _original(*args))

    module.throttle = relaxed

with MongoClient(os.environ["MONGODB_URI"]) as mongo:
    mongo.drop_database(DB_NAME)
    db = mongo[DB_NAME]
    db.staff_identities.insert_one(
        {
            "_id": "app-staff",
            "email": "staff@example.test",
            "name": "App Staff",
            "role": "staff",
            "enabled": True,
            "password_hash": password_hash(PASSWORD),
            "auth_version": "fixture-v1",
        }
    )
    db.client_identities.insert_one(
        {
            "_id": "app-client",
            "email": "client@example.test",
            "name": "App Client",
            "role": "client",
            "enabled": True,
            "password_hash": password_hash(PASSWORD),
            "auth_version": "fixture-v1",
        }
    )


@app.post("/__test/expire-sessions")
async def expire_sessions():
    """Test-only (this file, never the real app): put every staff and client session in the past."""
    past = {"$set": {"expires_at": datetime.now(UTC) - timedelta(seconds=1)}}
    with MongoClient(os.environ["MONGODB_URI"]) as mongo:
        for name in ("staff_sessions", "client_sessions"):
            mongo[DB_NAME][name].update_many({}, past)
    return {"ok": True}


if __name__ == "__main__":
    port = int(os.environ.get("APP_TEST_BACKEND_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)
