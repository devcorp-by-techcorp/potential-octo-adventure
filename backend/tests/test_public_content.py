"""Real MongoDB transactional website draft/publication behaviour."""

import asyncio
from uuid import uuid4

import pytest
from motor.motor_asyncio import AsyncIOMotorCollection

from db import get_database
from public_content import DEFAULTS
from staff import change_staff
from tests.test_auth import EMAIL, ORIGIN, PASSWORD, login

PATH = "/api/studio/content"
PUBLIC = "/api/public/content"


@pytest.fixture
async def editor(client):
    assert (await get_database().client.admin.command("hello")).get("setName")
    await change_staff("provision", EMAIL, "Test Staff", PASSWORD)
    session = await login(client)
    return {"Origin": ORIGIN, "X-CSRF-Token": session.json()["csrf_token"]}


def command(revision, **extra):
    return {"expected_revision": revision, "command_id": str(uuid4()), **extra}


async def test_draft_publish_restore_and_private_history(client, editor):
    assert (await client.get(PUBLIC)).json() == {"content": DEFAULTS, "revision": None}
    copy = {**DEFAULTS, "hero_description": "<script>plain text only</script>"}
    payload = command(0, content=copy)
    saved = await client.post(PATH + "/draft", headers=editor, json=payload)
    assert saved.status_code == 200, saved.text
    assert saved.json()["revision"] == 1
    assert (await client.post(PATH + "/draft", headers=editor, json=payload)).json() == saved.json()
    assert (await client.get(PUBLIC)).json()["content"] == DEFAULTS
    published = await client.post(PATH + "/publish", headers=editor, json=command(1))
    assert published.status_code == 200
    assert (await client.get(PUBLIC)).json() == {"content": copy, "revision": 2}
    await client.post(PATH + "/draft", headers=editor, json=command(2, content=DEFAULTS))
    await client.post(PATH + "/publish", headers=editor, json=command(3))
    restored = await client.post(
        PATH + "/restore", headers=editor, json=command(4, source_revision=1)
    )
    assert restored.status_code == 200 and restored.json()["draft"] == copy
    assert (await client.get(PUBLIC)).json()["content"] == DEFAULTS
    history = (await client.get(PATH + "/history")).json()["items"]
    assert [row["action"] for row in history] == ["save", "publish", "save", "publish", "restore"]
    assert all(row["actor_id"] and row["at"].endswith("+00:00") for row in history)
    assert "actor_id" not in (await client.get(PUBLIC)).text
    client.cookies.clear()
    assert (await client.get(PATH)).status_code == 401
    assert (await client.get(PATH + "/history")).status_code == 401
    assert (
        await client.post(PATH + "/publish", headers=editor, json=command(5))
    ).status_code == 401


async def test_concurrent_changes_stale_revisions_and_command_misuse(client, editor):
    payload = command(0, content=DEFAULTS)
    results = await asyncio.gather(
        *[client.post(PATH + "/draft", headers=editor, json=payload) for _ in range(2)]
    )
    assert all(row.status_code == 200 for row in results)
    assert results[0].json() == results[1].json()
    changed = {**payload, "content": {**DEFAULTS, "hero_footnote": "different"}}
    assert (await client.post(PATH + "/draft", headers=editor, json=changed)).status_code == 409
    competing = await asyncio.gather(
        *[
            client.post(
                PATH + "/draft",
                headers=editor,
                json=command(1, content={**DEFAULTS, "hero_footnote": str(value)}),
            )
            for value in range(2)
        ]
    )
    assert sorted(row.status_code for row in competing) == [200, 409]
    assert await get_database().public_content_history.count_documents({}) == 2
    assert (
        await client.post(PATH + "/publish", headers=editor, json=command(1))
    ).status_code == 409
    assert (
        await client.post(PATH + "/restore", headers=editor, json=command(2, source_revision=999))
    ).status_code == 404


@pytest.mark.parametrize("mutation", ["disable", "reset", "logout"])
async def test_validation_csrf_and_staff_disable_race(client, editor, monkeypatch, mutation):
    for content in [
        {**DEFAULTS, "price": 99},
        {**DEFAULTS, "hero_footnote": " "},
        {**DEFAULTS, "hero_footnote": "x" * 201},
    ]:
        assert (
            await client.post(PATH + "/draft", headers=editor, json=command(0, content=content))
        ).status_code == 422
    assert (
        await client.post(PATH + "/draft", json=command(0, content=DEFAULTS))
    ).status_code == 403
    ready, proceed = asyncio.Event(), asyncio.Event()
    original = AsyncIOMotorCollection.update_one
    paused = False

    async def snapshot(self, *args, **kwargs):
        nonlocal paused
        if self.name == "staff_identities" and kwargs.get("session") and not paused:
            paused = True
            ready.set()
            await proceed.wait()
        return await original(self, *args, **kwargs)

    monkeypatch.setattr(AsyncIOMotorCollection, "update_one", snapshot)
    task = asyncio.create_task(
        client.post(PATH + "/draft", headers=editor, json=command(0, content=DEFAULTS))
    )
    await asyncio.wait_for(ready.wait(), 10)
    if mutation == "logout":
        assert (await client.post("/api/auth/logout", headers=editor)).status_code == 204
    else:
        await change_staff(mutation, EMAIL, password=PASSWORD if mutation == "reset" else None)
    proceed.set()
    assert (await asyncio.wait_for(task, 10)).status_code == 401
    assert await get_database().public_content_history.count_documents({}) == 0
