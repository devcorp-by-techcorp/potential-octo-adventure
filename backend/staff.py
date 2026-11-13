"""Operator-only staff lifecycle CLI. Passwords are read from a terminal, never argv."""

import argparse
import asyncio
import getpass
import sys
import warnings
from uuid import uuid4

from pymongo.errors import DuplicateKeyError, PyMongoError

# Loads backend/.env before database/configuration use; does not start the API.
import server  # noqa: F401
from auth import ensure_indexes, normalize_email, now, password_hash
from db import close_database_client, get_database


async def change_staff(action, email, name=None, password=None):
    database = get_database()
    await ensure_indexes(database)
    email = normalize_email(email)
    if not email or "@" not in email or len(email) > 254:
        raise ValueError("Provide a valid staff email address.")
    if action == "provision":
        if not name or not name.strip() or len(name) > 100:
            raise ValueError("Provide a staff name of 1–100 characters.")
        await database.staff_identities.insert_one(
            {
                "_id": str(uuid4()),
                "email": email,
                "name": name.strip(),
                "role": "staff",
                "enabled": True,
                "password_hash": password_hash(password),
                "auth_version": str(uuid4()),
                "created_at": now(),
            }
        )
        return
    updates = {"auth_version": str(uuid4()), "updated_at": now()}
    if action == "reset":
        updates["password_hash"] = password_hash(password)
    elif action == "disable":
        updates["enabled"] = False
    else:
        raise ValueError("Unknown operator action.")
    result = await database.staff_identities.update_one(
        {"email": email, "role": "staff"}, {"$set": updates}
    )
    if not result.matched_count:
        raise ValueError("Staff identity was not found.")
    # Version changes invalidate all sessions immediately, without a multi-document transaction.


class OperatorParser(argparse.ArgumentParser):
    def error(self, message):
        # Do not echo unknown argv: an operator may accidentally supply a password.
        self.exit(2, "Invalid operator command. Run staff.py --help.\n")


def main():
    parser = OperatorParser(description=__doc__)
    commands = parser.add_subparsers(dest="action", required=True)
    for action in ("provision", "reset", "disable"):
        command = commands.add_parser(action)
        command.add_argument("email")
        if action == "provision":
            command.add_argument("--name", required=True)
    args = parser.parse_args()
    try:
        password = None
        if args.action in {"provision", "reset"}:
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
        asyncio.run(change_staff(args.action, args.email, getattr(args, "name", None), password))
    except DuplicateKeyError:
        print("Staff identity already exists; use reset for recovery.", file=sys.stderr)
        return 1
    except (PyMongoError, RuntimeError):
        print(
            "Database unavailable; no successful change confirmed. Check configuration.",
            file=sys.stderr,
        )
        return 1
    except (ValueError, EOFError, KeyboardInterrupt) as exc:
        print(str(exc) or "Cancelled.", file=sys.stderr)
        return 1
    finally:
        close_database_client()
    print(f"Staff {args.action} completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
