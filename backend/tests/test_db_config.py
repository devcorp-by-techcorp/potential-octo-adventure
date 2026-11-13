"""Tests for the canonical MongoDB configuration resolver (no legacy aliases)."""

import pytest

import db as db_module


def test_mongo_uri_reads_canonical_variable(monkeypatch):
    monkeypatch.setenv(
        "MONGODB_URI", "mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true"
    )
    assert db_module._mongo_uri() == "mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true"


def test_mongo_uri_rejects_legacy_alias(monkeypatch):
    """Only MONGODB_URI is honoured — the legacy MONGO_URL alias is not."""
    monkeypatch.delenv("MONGODB_URI", raising=False)
    monkeypatch.setenv("MONGO_URL", "mongodb://legacy.example:27017")
    with pytest.raises(RuntimeError, match="MONGODB_URI"):
        db_module._mongo_uri()


def test_mongo_uri_validates_scheme(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "postgres://nope")
    with pytest.raises(RuntimeError, match="mongodb"):
        db_module._mongo_uri()


def test_database_name_prefers_env_then_uri_path(monkeypatch):
    monkeypatch.setenv("MONGODB_DB_NAME", "configured_db")
    assert (
        db_module._database_name("mongodb+srv://u:p@cluster.mongodb.net/from_uri")
        == "configured_db"
    )

    monkeypatch.delenv("MONGODB_DB_NAME")
    assert db_module._database_name("mongodb+srv://u:p@cluster.mongodb.net/from_uri") == "from_uri"


def test_database_name_rejects_legacy_alias(monkeypatch):
    """The legacy DB_NAME alias is not honoured."""
    monkeypatch.delenv("MONGODB_DB_NAME", raising=False)
    monkeypatch.setenv("DB_NAME", "legacy_db")
    with pytest.raises(RuntimeError, match="MONGODB_DB_NAME"):
        db_module._database_name("mongodb+srv://u:p@cluster.mongodb.net/?retryWrites=true")


def test_default_app_name_appended_without_overwriting():
    from pymongo.uri_parser import parse_uri

    uri = db_module._with_default_app_name("mongodb://127.0.0.1:27017", "App")
    assert parse_uri(uri)["options"]["appname"] == "App"
    assert (
        db_module._with_default_app_name(
            "mongodb+srv://u:p@cluster.mongodb.net/?retryWrites=true", "App"
        )
        == "mongodb+srv://u:p@cluster.mongodb.net/?retryWrites=true&appName=App"
    )
    assert (
        db_module._with_default_app_name(
            "mongodb+srv://u:p@cluster.mongodb.net/?appName=Existing", "App"
        )
        == "mongodb+srv://u:p@cluster.mongodb.net/?appName=Existing"
    )


def test_positive_integer_options_validated(monkeypatch):
    monkeypatch.setenv("MONGODB_MAX_POOL_SIZE", "12")
    assert db_module._client_options()["maxPoolSize"] == 12

    monkeypatch.setenv("MONGODB_MAX_POOL_SIZE", "0")
    with pytest.raises(RuntimeError, match="greater than zero"):
        db_module._client_options()
