"""Development-only seed: one staff account and one client account with an enquiry.

Refuses to run when ENVIRONMENT=production. Everything goes through the real paths:
staff are provisioned as ``staff.py`` does, and the client is enrolled by a public
enquiry, a staff-issued invitation and invitation acceptance. Passwords are read
from an interactive terminal, never argv or the environment.
"""

import argparse
import asyncio
import getpass
import os
import sys
import warnings
from datetime import date, timedelta
from uuid import uuid4

from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import get_settings

# server, db and staff are imported only after the production refusal: importing server
# builds the app, which fails noisily (or worse, connects) under a production configuration.


def refuse_production():
    # Read the raw environment first: a production Settings object may itself fail to build.
    if os.environ.get("ENVIRONMENT", "").strip().lower() == "production":
        raise RuntimeError("seed_dev_accounts.py refuses to run when ENVIRONMENT=production.")
    try:
        production = get_settings().is_production
    except ValidationError:
        raise RuntimeError("Settings are invalid; refusing to seed.") from None
    if production:
        raise RuntimeError("seed_dev_accounts.py refuses to run when ENVIRONMENT=production.")


def _check(response, step):
    if response.status_code >= 400:
        raise RuntimeError(f"Seed step '{step}' failed with HTTP {response.status_code}.")
    return response


async def seed(staff_email, staff_password, client_email, client_password, staff_name="Dev Staff"):
    """Provision both accounts. Returns the new enquiry id, or None if the client existed."""
    refuse_production()
    import server
    from db import get_database
    from staff import change_staff

    settings = get_settings()
    origin = settings.auth_origin_list()[0]
    database = get_database()
    try:
        await change_staff("provision", staff_email, staff_name, staff_password)
    except DuplicateKeyError:
        pass  # Already provisioned; keep its password.
    if await database.client_identities.find_one({"email": client_email.strip().lower()}):
        return {"enquiry_id": None}
    transport = ASGITransport(app=server.create_app())
    async with AsyncClient(transport=transport, base_url="http://seed.invalid") as http:
        enquiry_id = str(uuid4())
        _check(
            await http.post(
                "/api/bookings",
                json={
                    "name": "Dev Client",
                    "email": client_email,
                    "event_type": "Wedding",
                    "preferred_date": (date.today() + timedelta(days=120)).isoformat(),
                    "collection": "signature",
                    "consent": True,
                    "request_id": enquiry_id,
                },
            ),
            "public enquiry",
        )
        login = _check(
            await http.post(
                "/api/auth/login",
                headers={"Origin": origin},
                json={"email": staff_email, "password": staff_password},
            ),
            "staff sign-in",
        )
        invitation = _check(
            await http.post(
                f"/api/studio/enquiries/{enquiry_id}/client-invitations",
                headers={"Origin": origin, "X-CSRF-Token": login.json()["csrf_token"]},
                json={},
            ),
            "invitation",
        )
        invitation_token = invitation.json()["link"].split("#")[1]
        http.cookies.clear()
        _check(
            await http.post(
                "/api/auth/client/invitations/accept",
                headers={"Origin": origin},
                json={"token": invitation_token, "password": client_password},
            ),
            "invitation acceptance",
        )
    return {"enquiry_id": enquiry_id}


def _password(label):
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        try:
            first = getpass.getpass(f"{label} password (12–1024 characters): ")
            if first != getpass.getpass(f"Confirm {label} password: "):
                raise ValueError("Passwords did not match.")
        except getpass.GetPassWarning:
            raise ValueError("Secure terminal password entry is unavailable.") from None
    return first


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--staff-email", default="staff@example.test")
    parser.add_argument("--client-email", default="client@example.test")
    args = parser.parse_args()
    try:
        refuse_production()
        if not sys.stdin.isatty():
            raise ValueError("Use an interactive terminal to read passwords securely.")
        staff_password = _password("Staff")
        client_password = _password("Client")
        result = asyncio.run(
            seed(args.staff_email, staff_password, args.client_email, client_password)
        )
    except (PyMongoError, RuntimeError, ValueError, EOFError, KeyboardInterrupt) as exc:
        print(str(exc) or "Cancelled.", file=sys.stderr)
        return 1
    finally:
        if "db" in sys.modules:
            sys.modules["db"].close_database_client()
    if result["enquiry_id"]:
        print("Seeded the staff account and a client account with one enquiry.")
    else:
        print("Client already exists; staff ensured, nothing else changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
