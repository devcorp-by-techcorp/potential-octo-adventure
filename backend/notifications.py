"""Optional studio email alerts. Persisted enquiries remain the source of truth.

Run ``python notifications.py`` to retry pending/failed alerts after configuring
Resend. Provider idempotency keys protect against repeated delivery on retries.
No email failure is reported to the visitor as a failed booking submission.
"""

import asyncio
import logging
from datetime import UTC, datetime

import httpx
from pymongo import ReturnDocument

from config import get_settings
from db import close_database_client, get_database


async def notify_studio(booking_id: str):
    try:
        await _notify_studio(booking_id)
    except Exception:
        # Submission already succeeded; pending alerts remain retryable.
        logging.getLogger("studio-suite").warning("Studio email alert could not be completed")


async def _notify_studio(booking_id: str):
    settings = get_settings()
    if not (
        settings.resend_api_key
        and settings.booking_notification_email
        and settings.booking_from_email
    ):
        return
    db = get_database()
    # Atomic claim prevents simultaneous receipt retries from sending twice.
    document = await db.booking_requests.find_one_and_update(
        {"_id": booking_id, "notification_state": {"$in": ["pending", "failed", "not_configured"]}},
        {"$set": {"notification_state": "sending", "notification_attempted_at": datetime.now(UTC)}},
        return_document=ReturnDocument.AFTER,
    )
    if not document:
        return
    lines = [f"Tentative enquiry {document['reference']} — pending studio confirmation.", ""]
    for key in [
        "name",
        "email",
        "phone",
        "event_type",
        "preferred_date",
        "collection",
        "venue",
        "message",
    ]:
        lines.append(f"{key.replace('_', ' ').title()}: {document.get(key, '')}")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Idempotency-Key": f"studio-enquiry-{booking_id}",
                },
                json={
                    "from": settings.booking_from_email,
                    "to": [settings.booking_notification_email],
                    "reply_to": document["email"],
                    "subject": f"New studio enquiry · {document['reference']}",
                    "text": "\n".join(lines),
                },
            )
        response.raise_for_status()
    except httpx.HTTPError:
        state = "failed"
    else:
        state = "sent"
    await db.booking_requests.update_one(
        {"_id": booking_id}, {"$set": {"notification_state": state}}
    )


async def retry_notifications():
    # A process may stop after claiming an alert; release old claims for retry.
    from datetime import timedelta

    db = get_database()
    await db.booking_requests.update_many(
        {
            "notification_state": "sending",
            "notification_attempted_at": {"$lt": datetime.now(UTC) - timedelta(minutes=5)},
        },
        {"$set": {"notification_state": "failed"}},
    )
    async for document in db.booking_requests.find(
        {"notification_state": {"$in": ["pending", "failed", "not_configured"]}}
    ).limit(100):
        await notify_studio(document["_id"])


if __name__ == "__main__":
    from pathlib import Path

    from dotenv import load_dotenv

    load_dotenv(Path(__file__).parent / ".env")
    get_settings.cache_clear()
    try:
        asyncio.run(retry_notifications())
    finally:
        close_database_client()
