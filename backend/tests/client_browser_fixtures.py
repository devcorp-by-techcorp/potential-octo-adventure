"""Test-only persistence/failure helpers for the client browser regression."""

import time
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from playwright.sync_api import Error as BrowserError


class ClientBrowserFixture:
    def __init__(self, database):
        self.db = database
        self.pending_reads = []
        for name in (
            "client_identities",
            "client_sessions",
            "client_login_limits",
            "client_invitations",
            "client_invitation_heads",
            "client_access",
        ):
            database[name].delete_many({})
        database.staff_login_limits.delete_many({})

    def delay_private_read(self, route):
        actual = route.fetch()
        assert actual.status == 200
        self.pending_reads.append((route, actual))

    def wait_for_delayed_read(self, page):
        deadline = time.monotonic() + 5
        while not self.pending_reads and time.monotonic() < deadline:
            page.wait_for_timeout(20)
        assert self.pending_reads

    def release_private_reads(self):
        for route, actual in self.pending_reads:
            try:
                route.fulfill(response=actual)
            except BrowserError:
                pass  # Navigation/sign-out intentionally aborted the original request.
        self.pending_reads.clear()

    def reset_limits(self):
        self.db.client_login_limits.delete_many({})

    def enquiry(self, reference):
        return self.db.booking_requests.find_one({"reference": reference})

    def client_enquiry(self, source, email, name):
        # Extra recovery scenarios use fixture records without consuming the
        # public submission budget retained by the combined browser runner.
        enquiry = {
            **source, "_id": str(uuid4()), "reference": "IS-" + uuid4().hex[:12].upper(),
            "email": email, "name": name,
        }
        self.db.booking_requests.insert_one(enquiry)
        return enquiry

    def private_fields(self, enquiry_id):
        self.db.booking_requests.update_one(
            {"_id": enquiry_id},
            {
                "$set": {
                    "studio_note": "client-must-never-see-studio-secret",
                    "future_private_field": "client-must-never-see-future-secret",
                }
            },
        )

    def expire_invitation(self, invitation_id):
        self.db.client_invitations.update_one(
            {"_id": invitation_id},
            {
                "$set": {
                    "expires_at": datetime.now(UTC) - timedelta(seconds=1),
                }
            },
        )

    def invalidate_client(self, email, kind):
        identity = self.db.client_identities.find_one({"email": email})
        if kind == "expired":
            self.db.client_sessions.update_many(
                {"identity_id": identity["_id"]},
                {
                    "$set": {
                        "expires_at": datetime.now(UTC) - timedelta(seconds=1),
                    }
                },
            )
        elif kind == "revoked":
            self.db.client_sessions.update_many(
                {"identity_id": identity["_id"]},
                {
                    "$set": {
                        "revoked_at": datetime.now(UTC),
                    }
                },
            )
        else:
            updates = {"auth_version": str(uuid4())}
            if kind == "disabled":
                updates["enabled"] = False
            self.db.client_identities.update_one({"_id": identity["_id"]}, {"$set": updates})

    def restore_client(self, email):
        self.db.client_identities.update_one({"email": email}, {"$set": {"enabled": True}})
        self.db.client_login_limits.delete_many({})


def service_failure(route):
    route.fulfill(
        status=503, json={"detail": "Client access is temporarily unavailable. Please try again."}
    )


def lose_acceptance_response(route, context, keep_cookie=False):
    actual = route.fetch()
    assert actual.status == 200
    if keep_cookie:
        # Model a lost body after the real committed handler set its cookie.
        route.fulfill(
            status=503,
            headers={"set-cookie": actual.headers["set-cookie"]},
            json={"detail": "Client access is temporarily unavailable. Please try again."},
        )
    else:
        context.clear_cookies(name="client_session")
        service_failure(route)
