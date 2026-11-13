"""Real socket coverage for Railway IPv4 health checks and IPv6 private traffic."""

import socket

import pytest

from deploy_server import create_listener


@pytest.mark.skipif(not socket.has_dualstack_ipv6(), reason="IPv6 unavailable")
@pytest.mark.parametrize("host", ["127.0.0.1", "::1"])
def test_listener_accepts_both_address_families(host):
    with create_listener(0) as listener:
        listener.settimeout(2)
        port = listener.getsockname()[1]
        with socket.create_connection((host, port), timeout=2) as client:
            connection, _ = listener.accept()
            with connection:
                client.sendall(b"network probe")
                assert connection.recv(32) == b"network probe"
