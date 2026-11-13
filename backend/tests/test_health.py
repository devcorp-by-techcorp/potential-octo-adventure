"""Tests for the liveness and DB-readiness health endpoints."""

import pytest

import db as db_module


async def test_health_liveness(client):
    """GET /api/health returns a 200 liveness payload."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["name"] == "Studio Suite API"
    assert "environment" in body


async def test_health_db_reports_connected(client):
    """GET /api/health/db reports a connected status against the in-memory DB."""
    response = await client.get("/api/health/db")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["status"] == "connected"
    from db import get_database

    assert body["database"] == get_database().name


async def test_health_db_reports_status_when_unreachable(client, monkeypatch):
    """The DB probe reports a status object instead of crashing when DB is down."""

    def _boom():
        raise RuntimeError("no database configured")

    # Force the resolver to fail as if the database were unreachable.
    monkeypatch.setattr(db_module, "get_database", _boom)

    response = await client.get("/api/health/db")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert body["status"] == "unreachable"
    assert "error" in body


@pytest.mark.parametrize("path", ["/api/health", "/api/health/db", "/api/ready"])
async def test_health_endpoints_are_json(client, path):
    """Both health endpoints return JSON objects."""
    response = await client.get(path)
    assert response.headers["content-type"].startswith("application/json")
    assert isinstance(response.json(), dict)


async def test_readiness_connected(client):
    response = await client.get("/api/ready")
    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert response.headers["cache-control"] == "no-store"


async def test_readiness_unavailable_is_503_and_redacted(client, monkeypatch):
    def unavailable():
        raise RuntimeError("private database connection details")

    monkeypatch.setattr(db_module, "get_database", unavailable)
    response = await client.get("/api/ready")
    assert response.status_code == 503
    assert response.json() == {"ok": False}
    assert response.headers["cache-control"] == "no-store"
