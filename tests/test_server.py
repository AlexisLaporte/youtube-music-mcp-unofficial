"""In-memory smoke tests: tool registration and explicit auth errors."""

import asyncio

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from ytmusic_mcp.server import build_mcp

EXPECTED_TOOLS = {
    "whoami",
    "list_playlists",
    "playlist_tracks",
    "liked_songs",
    "search",
    "unfiled_liked_songs",
    "create_playlist",
    "edit_playlist",
    "add_tracks",
    "remove_tracks",
    "delete_playlist",
    "like",
    "unlike",
}


def test_all_tools_registered():
    async def run():
        async with Client(build_mcp()) as client:
            return {t.name for t in await client.list_tools()}

    assert asyncio.run(run()) == EXPECTED_TOOLS


def test_missing_auth_is_explicit(monkeypatch, tmp_path):
    monkeypatch.setenv("YTMUSIC_AUTH_FILE", str(tmp_path / "absent.json"))

    async def run():
        async with Client(build_mcp()) as client:
            with pytest.raises(ToolError, match="No YouTube Music auth"):
                await client.call_tool("whoami", {})

    asyncio.run(run())
