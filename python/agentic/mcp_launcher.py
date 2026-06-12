"""
mcp_launcher.py — Ensure the agentic MCP server (server.py) is running
======================================================================
The agentic pipeline talks to a *separate* MCP tool server over HTTP
(default ``http://localhost:8003/mcp``). In development this is started
manually (``python server.py``); in production (e.g. Linux) nothing starts
it automatically, so every analysis silently fails when the background task
cannot connect to port 8003.

This module lets the main FastAPI app guarantee the MCP server is up:
  - ``ensure_mcp_server_running()`` is a no-op if something already listens
    on the configured host:port (e.g. it was started manually, or by another
    worker / a previous reload).
  - Otherwise it spawns ``server.py`` as a child process using the same
    Python interpreter, cross-platform (Windows + POSIX).
  - ``stop_mcp_server()`` terminates a process we started (used on shutdown).

It is intentionally dependency-free and safe to import even if the agentic
system itself failed to load.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from urllib.parse import urlparse

# Handle to the child process we spawned (None if we didn't start it).
_mcp_process: "subprocess.Popen | None" = None

_AGENTIC_DIR = os.path.dirname(os.path.abspath(__file__))
_SERVER_SCRIPT = os.path.join(_AGENTIC_DIR, "server.py")


def _resolve_host_port() -> tuple[str, int]:
    """Derive the MCP server host/port from MCP_SERVER_URL (default :8003)."""
    url = os.getenv("MCP_SERVER_URL", "http://localhost:8003/mcp")
    parsed = urlparse(url)
    host = parsed.hostname or "localhost"
    port = parsed.port or 8003
    return host, port


def _is_port_open(host: str, port: int, timeout: float = 0.5) -> bool:
    """Return True if a TCP connection to host:port succeeds (server is up)."""
    # localhost may resolve to ::1 first; probe the loopback explicitly too.
    candidates = {host}
    if host in ("localhost", ""):
        candidates.update({"127.0.0.1", "::1"})
    for candidate in candidates:
        try:
            with socket.create_connection((candidate, port), timeout=timeout):
                return True
        except OSError:
            continue
    return False


def ensure_mcp_server_running(wait_seconds: float = 8.0) -> bool:
    """Make sure the MCP server is reachable, starting it if necessary.

    Returns True if the server is (now) reachable, False otherwise. Never
    raises — failures are logged via print and reported through the return
    value so the caller can degrade gracefully.
    """
    global _mcp_process

    host, port = _resolve_host_port()

    if _is_port_open(host, port):
        print(f"✅ MCP server already running on {host}:{port}")
        return True

    if not os.path.exists(_SERVER_SCRIPT):
        print(f"⚠️  Cannot start MCP server — script not found: {_SERVER_SCRIPT}")
        return False

    print(f"🚀 Starting MCP server: {sys.executable} {_SERVER_SCRIPT}")

    # Detach into its own process group/session so a signal to the API
    # parent doesn't accidentally kill it, and vice-versa during reloads.
    popen_kwargs: dict = {"cwd": _AGENTIC_DIR}
    if os.name == "nt":
        popen_kwargs["creationflags"] = getattr(
            subprocess, "CREATE_NEW_PROCESS_GROUP", 0
        )
    else:
        popen_kwargs["start_new_session"] = True

    try:
        _mcp_process = subprocess.Popen(
            [sys.executable, _SERVER_SCRIPT], **popen_kwargs
        )
    except Exception as exc:  # pragma: no cover - defensive
        print(f"❌ Failed to spawn MCP server: {exc}")
        _mcp_process = None
        return False

    # Wait until the port accepts connections (or the process dies early).
    deadline = time.time() + wait_seconds
    while time.time() < deadline:
        if _mcp_process.poll() is not None:
            print(
                f"❌ MCP server exited early (code {_mcp_process.returncode}) "
                "during startup."
            )
            _mcp_process = None
            return False
        if _is_port_open(host, port):
            print(f"✅ MCP server is up on {host}:{port}")
            return True
        time.sleep(0.3)

    print(f"⚠️  MCP server did not become reachable on {host}:{port} in time.")
    return False


def stop_mcp_server() -> None:
    """Terminate the MCP server if (and only if) we started it."""
    global _mcp_process
    if _mcp_process is None:
        return
    if _mcp_process.poll() is None:
        print("🛑 Stopping MCP server we started...")
        try:
            _mcp_process.terminate()
            try:
                _mcp_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                _mcp_process.kill()
        except Exception as exc:  # pragma: no cover - defensive
            print(f"⚠️  Error stopping MCP server: {exc}")
    _mcp_process = None
