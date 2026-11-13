"""Explicit MongoDB provisioning command. Defaults to a read-only plan."""

import argparse
import asyncio
import json
from pathlib import Path

from dotenv import load_dotenv

from database_schema import COLLECTIONS, initialize_database, inspect_database
from db import close_database_client, get_database


async def run(args):
    load_dotenv(args.env_file or Path(__file__).parent / ".env", override=False)
    try:
        database = get_database()
        report = await (initialize_database(database) if args.apply else inspect_database(database))
        print(json.dumps(report, indent=2))
        return 0 if not args.check or report["ready"] else 1
    finally:
        close_database_client()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Create collections and indexes")
    mode.add_argument("--check", action="store_true", help="Read only; exit 1 if incomplete")
    mode.add_argument("--manifest", action="store_true", help="Print schema without connecting")
    parser.add_argument("--env-file", type=Path, help="Optional private environment file")
    args = parser.parse_args()
    if args.manifest:
        print(json.dumps({name: [dict(item.document) for item in models]
                          for name, models in COLLECTIONS.items()}, indent=2))
        return 0
    try:
        return asyncio.run(run(args))
    except Exception as exc:
        # Driver errors can contain addresses, queries or credentials. Keep logs private.
        print(json.dumps({
            "ok": False,
            "error_type": type(exc).__name__,
            "message": "Initialization failed; inspect configuration and index plan.",
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
