"""Operator-only client reset/disable. Enrollment occurs only through invitations."""

import asyncio
import getpass
import sys
import warnings
from uuid import uuid4

from pymongo.errors import PyMongoError

import server  # noqa: F401 — load backend environment
from auth import normalize_email, now, password_hash
from client_auth import ensure_indexes
from db import close_database_client, get_database
from staff import OperatorParser


class ClientParser(OperatorParser):
    def error(self, message):
        self.exit(2, "Invalid operator command. Run clients.py --help.\n")


async def change_client(action, email, password=None):
    database = get_database()
    await ensure_indexes(database)
    updates = {"auth_version": str(uuid4()), "updated_at": now()}
    if action == "reset":
        updates["password_hash"] = password_hash(password)
    elif action == "disable":
        updates["enabled"] = False
    else:
        raise ValueError("Unknown operator action.")
    result = await database.client_identities.update_one(
        {"email": normalize_email(email), "role": "client"}, {"$set": updates}
    )
    if not result.matched_count:
        raise ValueError("Client identity was not found.")


def main():
    parser = ClientParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    for action in ("reset", "disable"):
        command = commands.add_parser(action)
        command.add_argument("email")
    args = parser.parse_args()
    try:
        password = None
        if args.action == "reset":
            if not sys.stdin.isatty():
                raise ValueError("Use an interactive terminal to read the password securely.")
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                try:
                    password = getpass.getpass("New password (12–1024 characters): ")
                    if password != getpass.getpass("Confirm password: "):
                        raise ValueError("Passwords did not match.")
                except getpass.GetPassWarning:
                    raise ValueError("Secure terminal password entry is unavailable.") from None
        asyncio.run(change_client(args.action, args.email, password))
    except (PyMongoError, RuntimeError):
        print(
            "Database unavailable; no successful change confirmed. Check identity state.",
            file=sys.stderr,
        )
        return 1
    except (ValueError, EOFError, KeyboardInterrupt) as exc:
        print(str(exc) or "Cancelled.", file=sys.stderr)
        return 1
    finally:
        close_database_client()
    print(f"Client {args.action} completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
