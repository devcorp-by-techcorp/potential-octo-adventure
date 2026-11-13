"""Test-only backend: real isolated MongoDB, deterministic Luma, no email."""

import os
import sys
from pathlib import Path

import uvicorn
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["OPENAI_API_KEY"] = "integration-test-key"
os.environ["RESEND_API_KEY"] = ""
os.environ["ENVIRONMENT"] = "test"
os.environ["MONGODB_URI"] = os.environ["BROWSER_MONGODB_URI"]
os.environ["MONGODB_DB_NAME"] = "studio_suite_browser_test"
os.environ["AUTH_ALLOWED_ORIGINS"] = "http://127.0.0.1:5173,http://localhost:5173"
os.environ["CORS_ORIGINS"] = os.environ["AUTH_ALLOWED_ORIGINS"]
os.environ["CORS_ORIGIN_REGEX"] = ""
os.environ["AUTH_SESSION_SECONDS"] = "28800"
os.environ["RESEND_API_KEY"] = ""

import entry  # noqa: E402
from auth import password_hash  # noqa: E402
from config import Settings  # noqa: E402

# Empty provider placeholders must not fall through to a developer's .env.
Settings.model_config["env_file"] = None

from server import app  # noqa: E402

with MongoClient(os.environ["MONGODB_URI"]) as mongo:
    mongo.drop_database("studio_suite_browser_test")
    mongo["studio_suite_browser_test"].staff_identities.insert_one(
        {
            "_id": "browser-staff",
            "email": "staff@example.test",
            "name": "Browser Staff",
            "role": "staff",
            "enabled": True,
            "password_hash": password_hash("browser-test-password"),
            "auth_version": "fixture-v1",
        }
    )


async def answer(messages):
    pending = '"booking_state": "awaiting_studio_confirmation"' in messages[0]["content"]
    if pending:
        return {
            "reply": "Your tentative enquiry is with the studio, pending confirmation.",
            "draft": {},
        }
    return {
        "reply": "Would you like to review your Signature enquiry in the form?",
        "draft": {
            "name": "Alex Example",
            "email": "alex@example.com",
            "collection": "signature",
            "preferred_date": "2099-12-20",
            "event_type": "Wedding",
        },
    }


entry.generate = answer

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning", access_log=False)
