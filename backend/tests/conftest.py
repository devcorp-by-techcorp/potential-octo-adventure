"""Pytest fixtures for the studio-suite backend.

Tests run through in-process ASGI handlers. TEST_MONGODB_URI selects isolated
real MongoDB databases (used in CI); otherwise mongomock_motor provides unit
fixtures. Each test receives a fresh database and settings cache. Provider
replacements and identities stay confined to tests.
"""

import os
from uuid import uuid4

# Provide a canonical MongoDB config so config/db resolution is deterministic in
# tests. The fresh_state fixture injects the selected persistence provider.
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB_NAME", "studio_suite_test")
os.environ.setdefault("ENVIRONMENT", "test")

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from mongomock_motor import AsyncMongoMockClient  # noqa: E402

import db as db_module  # noqa: E402
from config import Settings, get_settings  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch):
    """Give every test isolated persistence and a cleared settings cache."""
    real_uri = os.environ.get("TEST_MONGODB_URI")
    # Test fixtures must never inherit live provider keys from process/.env.
    monkeypatch.setitem(Settings.model_config, "env_file", None)
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("RESEND_API_KEY", "")
    database_name = "studio_suite_test_" + uuid4().hex
    if real_uri:
        from motor.motor_asyncio import AsyncIOMotorClient

        db_module._client = AsyncIOMotorClient(real_uri)
        db_module._db = db_module._client[database_name]
    else:
        db_module._db = AsyncMongoMockClient()["studio_suite_test"]
    get_settings.cache_clear()
    yield
    db_module.close_database_client()
    if real_uri:
        from pymongo import MongoClient

        with MongoClient(real_uri) as cleanup:
            cleanup.drop_database(database_name)
    get_settings.cache_clear()


@pytest_asyncio.fixture
async def client():
    """An ASGI test client bound to a freshly built app instance."""
    from httpx import ASGITransport, AsyncClient

    from server import create_app

    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
