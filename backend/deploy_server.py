"""Serve Railway health checks and private traffic on one dual-stack socket."""

import os
import socket

import uvicorn


def create_listener(port: int) -> socket.socket:
    """Accept IPv4 and IPv6 explicitly; asyncio's host='::' is IPv6-only."""
    return socket.create_server(
        ("::", port), family=socket.AF_INET6, dualstack_ipv6=True
    )


def main():
    port = int(os.environ.get("PORT", "8000"))
    with create_listener(port) as listener:
        server = uvicorn.Server(uvicorn.Config("server:app", host="::", port=port))
        server.run(sockets=[listener])


if __name__ == "__main__":
    main()
