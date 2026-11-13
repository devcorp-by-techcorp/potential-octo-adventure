"""Phase 2 handlers: authorization, persistence, privacy, races and keyset evidence."""

import asyncio
import json
import os
import statistics
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pymongo.errors import ServerSelectionTimeoutError

import auth
import entry
import studio_enquiries as inbox
from db import get_database
from server import create_app
from staff import change_staff
from tests.test_auth import EMAIL, ORIGIN, PASSWORD, login


@pytest.fixture
async def staff():
    await change_staff("provision", EMAIL, "Test Staff", PASSWORD)
    return await get_database().staff_identities.find_one({"email": EMAIL})


@pytest.fixture
async def authorized(client, staff):
    entry._buckets.clear()
    response = await login(client)
    return {"Origin": ORIGIN, "X-CSRF-Token": response.json()["csrf_token"]}


def record(index=1, **extra):
    return {
        "_id": str(UUID(int=index)),
        "reference": f"IS-TEST-{index}",
        "name": "Test Customer",
        "email": "private@example.test",
        "phone": "private phone",
        "event_type": "Wedding",
        "preferred_date": "2099-12-20",
        "collection": "signature",
        "venue": "private venue",
        "message": "private customer message",
        "consent": True,
        "payload_hash": "private payload hash",
        "state": "awaiting_studio_confirmation",
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
        "notification_state": "not_configured",
        **extra,
    }


async def seed(**extra):
    item = record(**extra)
    await get_database().booking_requests.insert_one(item)
    return "/api/studio/enquiries/" + item["_id"]


async def test_legacy_reads_defaults_details_and_empty(client, authorized):
    assert (await client.get("/api/studio/enquiries")).json() == {"items": [], "next_cursor": None}
    path = await seed()
    before = await get_database().booking_requests.find_one({})
    listed = await client.get("/api/studio/enquiries")
    assert listed.headers["cache-control"] == "no-store"
    summary = listed.json()["items"][0]
    assert summary["studio_status"] == "new" and summary["studio_revision"] == 0
    assert set(summary) == {"id", *inbox.LIST_FIELDS}
    detail = (await client.get(path)).json()
    assert set(detail) == {"id", *inbox.DETAIL_FIELDS}
    assert detail["studio_note"] == "" and detail["studio_updated_by"] is None
    assert detail["message"] == "private customer message" and detail["consent"] is True
    assert detail["created_at"].endswith("Z")
    assert await get_database().booking_requests.find_one({}) == before


@pytest.mark.parametrize("kind", ["absent", "expired", "revoked", "reset", "disabled", "nonstaff"])
async def test_authorization_every_endpoint(client, authorized, kind, monkeypatch):
    path = await seed()
    database = get_database()
    before = await database.booking_requests.find_one({})
    expected = 401
    if kind == "absent":
        client.cookies.clear()
    elif kind == "expired":
        future = auth.now() + timedelta(days=1)
        monkeypatch.setattr(auth, "now", lambda: future)
    elif kind == "revoked":
        await database.staff_sessions.update_many({}, {"$set": {"revoked_at": auth.now()}})
    elif kind in ("reset", "disabled"):
        await change_staff("disable" if kind == "disabled" else "reset", EMAIL, password=PASSWORD)
    else:
        await database.staff_identities.update_many({}, {"$set": {"role": "client"}})
        expected = 403
    headers = {**authorized, "X-Role": "staff", "X-Actor-Id": "browser-admin"}
    for method, endpoint in [("GET", "/api/studio/enquiries"), ("GET", path), ("PATCH", path)]:
        response = await client.request(
            method,
            endpoint,
            headers=headers,
            **({"json": {"expected_revision": 0, "studio_note": "x"}} if method == "PATCH" else {}),
        )
        assert response.status_code == expected
        assert "private" not in response.text
        assert response.headers["cache-control"] == "no-store"
    assert await database.booking_requests.find_one({}) == before


@pytest.mark.parametrize("kind", ["missing", "csrf", "origin"])
async def test_write_verification_zero_changes(client, authorized, kind):
    path = await seed()
    before = await get_database().booking_requests.find_one({})
    headers = {} if kind == "missing" else {**authorized}
    if kind == "csrf":
        headers["X-CSRF-Token"] = "bad"
    elif kind == "origin":
        headers["Origin"] = "https://evil.example"
    response = await client.patch(
        path, headers=headers, json={"expected_revision": 0, "studio_note": "secret"}
    )
    assert response.status_code == 403
    assert await get_database().booking_requests.find_one({}) == before


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"expected_revision": 0},
        {"expected_revision": -1, "studio_status": "new"},
        {"expected_revision": True, "studio_status": "new"},
        {"expected_revision": "0", "studio_status": "new"},
        {"expected_revision": 0, "studio_status": "confirmed"},
        {"expected_revision": 0, "studio_note": None},
        {"expected_revision": 0, "studio_note": "private" * 334},
        *[
            {"expected_revision": 0, "studio_note": "private", key: "private injected"}
            for key in [
                "studio_updated_by",
                "studio_updated_at",
                "role",
                "state",
                "email",
                "consent",
                "payload_hash",
                "owner",
                "$set",
            ]
        ],
    ],
)
async def test_private_validation_and_injected_fields(client, authorized, body, caplog):
    path = await seed()
    response = await client.patch(path, headers=authorized, json=body)
    assert response.status_code == 422 and "private" not in response.text
    assert "private" not in caplog.text
    assert "studio_revision" not in await get_database().booking_requests.find_one({})


@pytest.mark.parametrize(
    "query",
    ["limit=0", "limit=101", "limit=x", "status=confirmed", "cursor=bad", "cursor=" + "x" * 513],
)
async def test_list_invalid_bounds(client, authorized, query):
    assert (await client.get("/api/studio/enquiries?" + query)).status_code == 422


async def test_missing_invalid_ids_and_cursor_schema(client, authorized):
    for method in ["get", "patch"]:
        for value, expected in [("bad", 422), (str(uuid4()), 404)]:
            kwargs = (
                {"headers": authorized, "json": {"expected_revision": 0, "studio_note": ""}}
                if method == "patch"
                else {}
            )
            assert (
                await getattr(client, method)("/api/studio/enquiries/" + value, **kwargs)
            ).status_code == expected
    import base64

    valid = {
        "version": 1,
        "status": None,
        "sort": "created_at_desc_id_desc",
        "created_at": "2026-01-01T00:00:00Z",
        "id": str(uuid4()),
    }
    for value in [
        {},
        [],
        {"version": 2},
        {"$where": "private"},
        {**valid, "sort": "email"},
        {**valid, "created_at": "2026-01-01"},
        {**valid, "id": "private invalid"},
        {**valid, "injected": "private"},
    ]:
        cursor = base64.urlsafe_b64encode(json.dumps(value).encode()).decode()
        response = await client.get("/api/studio/enquiries", params={"cursor": cursor})
        assert response.status_code == 422 and "private" not in response.text


async def test_atomic_writers_persistence_archival_and_literal_note(client, authorized, staff):
    path = await seed()
    before = await get_database().booking_requests.find_one({})
    async with AsyncClient(
        transport=ASGITransport(app=create_app()),
        base_url="http://testserver",
        cookies=client.cookies,
    ) as other:
        responses = await asyncio.gather(
            *[
                actor.patch(
                    path,
                    headers=authorized,
                    json={
                        "expected_revision": 0,
                        "studio_status": "in_review",
                        "studio_note": note,
                    },
                )
                for actor, note in [(client, "$literal customer"), (other, "second writer")]
            ]
        )
        assert sorted(response.status_code for response in responses) == [200, 409]
        saved = next(response.json() for response in responses if response.status_code == 200)
        assert saved["studio_revision"] == 1
        assert saved["studio_updated_by"] == str(staff["_id"])
        assert datetime.fromisoformat(
            saved["studio_updated_at"].replace("Z", "+00:00")
        ).utcoffset() == timedelta(0)
        assert (await other.get(path)).json() == saved
        for revision, status in [(1, "archived"), (2, "new")]:
            result = await other.patch(
                path,
                headers=authorized,
                json={"expected_revision": revision, "studio_status": status},
            )
            assert result.status_code == 200 and result.json()["studio_revision"] == revision + 1
            assert result.json()["studio_note"] == saved["studio_note"]
            listed = (await client.get("/api/studio/enquiries", params={"status": status})).json()
            assert len(listed["items"]) == 1
    after = await get_database().booking_requests.find_one({})
    assert {key: after[key] for key in before} == before


async def test_public_defaults_retries_preserve_triage_no_leak(client, authorized, monkeypatch):
    async def no_delivery(*args):
        return None

    monkeypatch.setattr(entry, "notify_studio", no_delivery)
    body = {
        "request_id": str(uuid4()),
        "name": "Customer",
        "email": "customer@example.test",
        "event_type": "Wedding",
        "preferred_date": "2099-12-20",
        "collection": "signature",
        "consent": True,
        "message": "customer original",
    }
    submitted = await client.post("/api/bookings", json=body)
    assert submitted.status_code == 201
    path = "/api/studio/enquiries/" + body["request_id"]
    initial = (await client.get(path)).json()
    assert initial["studio_revision"] == 0 and initial["studio_status"] == "new"
    assert initial["reference"] == submitted.json()["reference"]
    updated = await client.patch(
        path,
        headers=authorized,
        json={
            "expected_revision": 0,
            "studio_status": "archived",
            "studio_note": "private internal secret",
        },
    )
    assert updated.status_code == 200
    before = await get_database().booking_requests.find_one({})
    retry = await client.post("/api/bookings", json=body)
    assert (
        retry.json()
        == submitted.json()
        == {"reference": initial["reference"], "booking_state": "awaiting_studio_confirmation"}
    )
    assert (
        await client.post("/api/bookings", json={**body, "message": "changed"})
    ).status_code == 409
    assert await get_database().booking_requests.find_one({}) == before
    assert "private" not in retry.text and "studio_note" not in retry.text
    # Notifications explicitly read only customer fields.
    from types import SimpleNamespace

    import httpx

    import notifications

    captured = []

    class ProviderFixture:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, **kwargs):
            captured.append(kwargs["json"])
            return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(
        notifications,
        "get_settings",
        lambda: SimpleNamespace(
            resend_api_key="fixture-only",
            booking_notification_email="staff@example.test",
            booking_from_email="fixture@example.test",
        ),
    )
    monkeypatch.setattr(notifications.httpx, "AsyncClient", lambda **kwargs: ProviderFixture())
    await notifications._notify_studio(body["request_id"])
    assert captured and "private internal secret" not in str(captured)
    assert "studio_status" not in str(captured)


@pytest.mark.parametrize("operation", ["list", "detail", "update"])
@pytest.mark.parametrize("failure_at", ["connection", "operation"])
async def test_database_failure_generic_no_false_save(
    client, authorized, monkeypatch, operation, failure_at, caplog
):
    path = await seed()

    def fail():
        raise ServerSelectionTimeoutError("private note contact secret")

    if failure_at == "connection":
        monkeypatch.setattr(inbox, "get_database", fail)
    else:
        from types import SimpleNamespace

        collection = get_database().booking_requests

        class FailedOperation:
            def __getattr__(self, key):
                return getattr(collection, key)

            def find(self, *args):
                return self

            def sort(self, *args):
                return self

            def limit(self, *args):
                return self

            async def to_list(self, **kwargs):
                fail()

            async def find_one(self, *args):
                fail()

            async def find_one_and_update(self, *args, **kwargs):
                fail()

        monkeypatch.setattr(
            inbox, "get_database", lambda: SimpleNamespace(booking_requests=FailedOperation())
        )
    response = await (
        client.patch(
            path, headers=authorized, json={"expected_revision": 0, "studio_note": "private"}
        )
        if operation == "update"
        else client.get("/api/studio/enquiries" if operation == "list" else path)
    )
    assert response.status_code == 503 and "private" not in response.text + caplog.text
    assert "studio_revision" not in await get_database().booking_requests.find_one({})


async def test_uncertain_save_retry_recovery(client, authorized, monkeypatch):
    path = await seed()
    original = type(get_database().booking_requests).find_one_and_update

    async def uncertain(self, *args, **kwargs):
        result = await original(self, *args, **kwargs)
        if self.name == "booking_requests":
            raise ServerSelectionTimeoutError("private uncertain response")
        return result

    monkeypatch.setattr(type(get_database().booking_requests), "find_one_and_update", uncertain)
    body = {"expected_revision": 0, "studio_note": "persisted once"}
    assert (await client.patch(path, headers=authorized, json=body)).status_code == 503
    monkeypatch.setattr(type(get_database().booking_requests), "find_one_and_update", original)
    assert (await client.patch(path, headers=authorized, json=body)).status_code == 409
    detail = (await client.get(path)).json()
    assert detail["studio_revision"] == 1 and detail["studio_note"] == "persisted once"


async def test_10000_pagination_indexes_and_latency(client, authorized):
    if not os.environ.get("TEST_MONGODB_URI"):
        pytest.skip("Performance/index verification requires real MongoDB")
    collection = get_database().booking_requests
    documents = [
        record(
            i + 1,
            **({} if i % 4 == 0 else {"studio_status": ["new", "in_review", "archived"][i % 3]}),
            created_at=datetime(2026, 1, 1, tzinfo=UTC) + timedelta(seconds=i // 10),
        )
        for i in range(10000)
    ]
    await collection.insert_many(documents)
    evidence = {"dataset": 10000, "legacy": 2500, "page_size": 100, "queries": {}}
    for status in [None, "new", "in_review", "archived"]:
        eligible = [
            item
            for item in documents
            if status is None or item.get("studio_status", "new") == status
        ]
        expected = [
            item["_id"]
            for item in sorted(
                eligible, key=lambda item: (item["created_at"], item["_id"]), reverse=True
            )
        ]
        seen, cursor = [], None
        while True:
            params = {
                "limit": 100,
                **({"status": status} if status else {}),
                **({"cursor": cursor} if cursor else {}),
            }
            response = await client.get("/api/studio/enquiries", params=params)
            assert response.status_code == 200
            page = response.json()
            assert 0 < len(page["items"]) <= 100
            seen.extend(item["id"] for item in page["items"])
            cursor = page["next_cursor"]
            if not cursor:
                break
        assert seen == expected and len(seen) == len(set(seen))
        explain = await get_database().command(
            "explain",
            {
                "find": "booking_requests",
                "filter": inbox.page_query(status, None),
                "projection": inbox.projection(inbox.LIST_FIELDS),
                "sort": dict(inbox.SORT),
                "limit": 101,
            },
            verbosity="executionStats",
        )
        plan = explain["queryPlanner"]["winningPlan"]
        assert "IXSCAN" in json.dumps(plan) and "COLLSCAN" not in json.dumps(plan)
        assert '"stage": "SORT"' not in json.dumps(plan)
        stats = explain["executionStats"]
        evidence["queries"][status or "all"] = {
            "plan": plan,
            **{
                key: stats[key]
                for key in [
                    "nReturned",
                    "totalKeysExamined",
                    "totalDocsExamined",
                    "executionTimeMillis",
                ]
            },
        }
        position = inbox.next_cursor(eligible[len(eligible) // 2], status)
        explain = await get_database().command(
            "explain",
            {
                "find": "booking_requests",
                "filter": inbox.page_query(status, position),
                "projection": inbox.projection(inbox.LIST_FIELDS),
                "sort": dict(inbox.SORT),
                "limit": 101,
            },
            verbosity="executionStats",
        )
        plan = explain["queryPlanner"]["winningPlan"]
        assert "IXSCAN" in json.dumps(plan) and "COLLSCAN" not in json.dumps(plan)
        assert '"stage": "SORT"' not in json.dumps(plan)
        stats = explain["executionStats"]
        evidence["queries"][(status or "all") + "_cursor"] = {
            "plan": plan,
            **{
                key: stats[key]
                for key in [
                    "nReturned",
                    "totalKeysExamined",
                    "totalDocsExamined",
                    "executionTimeMillis",
                ]
            },
        }
    for insert_number, status in enumerate([None, "new", "in_review", "archived"]):
        query = {"status": status} if status else {}
        # Snapshot only the expected IDs in this isolated test; production is bounded.
        expected = {
            item["_id"]
            async for item in collection.find(inbox.page_query(status, None), {"_id": 1})
        }
        first = (await client.get("/api/studio/enquiries", params={**query, "limit": 25})).json()
        cursor = first["next_cursor"]
        if status is None:
            assert (
                await client.get(
                    "/api/studio/enquiries", params={"cursor": cursor, "status": "new"}
                )
            ).status_code == 422
        await collection.insert_one(
            record(
                10001 + insert_number,
                created_at=datetime(2099, 1, 1, tzinfo=UTC),
                studio_status=status or "new",
            )
        )
        seen = [item["id"] for item in first["items"]]
        while cursor:
            page = (
                await client.get(
                    "/api/studio/enquiries", params={**query, "cursor": cursor, "limit": 100}
                )
            ).json()
            assert len(page["items"]) <= 100
            seen.extend(item["id"] for item in page["items"])
            cursor = page["next_cursor"]
        assert set(seen) == expected and len(seen) == len(expected)
    evidence["latency_dataset"] = await collection.count_documents({})
    for operation, url in [
        ("list", "/api/studio/enquiries"),
        ("detail", "/api/studio/enquiries/" + documents[0]["_id"]),
    ]:
        samples = []
        for _ in range(30):
            start = time.perf_counter()
            assert (await client.get(url)).status_code == 200
            samples.append((time.perf_counter() - start) * 1000)
        evidence[operation + "_milliseconds"] = {
            "median": statistics.median(samples),
            "p95": sorted(samples)[28],
            "samples": 30,
        }
    output = os.environ.get("INBOX_PERFORMANCE_OUTPUT")
    if output:
        Path(output).write_text(json.dumps(evidence, indent=2, default=str) + "\n")


async def test_note_boundaries_literal_and_luma_privacy(client, authorized, monkeypatch):
    from config import get_settings
    from tests.test_entry import create_session

    monkeypatch.setenv("OPENAI_API_KEY", "fixture-only")
    get_settings.cache_clear()
    session = await create_session("awaiting_studio_confirmation")
    path = await seed()
    for revision, note in [(0, "$studio_status"), (1, "x" * 2000), (2, "")]:
        response = await client.patch(
            path, headers=authorized, json={"expected_revision": revision, "studio_note": note}
        )
        assert response.status_code == 200 and response.json()["studio_note"] == note
    assert (
        await client.patch(
            path, headers=authorized, json={"expected_revision": 2**100, "studio_note": "private"}
        )
    ).status_code == 422

    async def answer(messages):
        assert '"booking_state": "awaiting_studio_confirmation"' in messages[0]["content"]
        assert "studio_note" not in str(messages) and "studio_status" not in str(messages)
        return {
            "reply": "Your tentative enquiry is with the studio, pending confirmation.",
            "draft": {},
        }

    monkeypatch.setattr(entry, "generate", answer)
    response = await client.post(
        "/api/luma/chat", json={"message": "Status?", "session_id": session["_id"]}
    )
    assert response.status_code == 200
    assert response.json()["booking_state"] == "awaiting_studio_confirmation"
    assert "studio_note" not in response.text and "studio_status" not in response.text
