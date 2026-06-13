"""In-memory smoke tests: tool registration and explicit auth errors."""

import asyncio

import pytest
from fastmcp import Client
from fastmcp.exceptions import ToolError

from ytmusic_mcp.server import build_mcp

EXPECTED_TOOLS = {
    "get_claude_md",
    "whoami",
    "list_playlists",
    "playlist_tracks",
    "liked_songs",
    "play_history",
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


RECOMMEND_TOOLS = {"track_tags", "similar_tracks", "recommend_for_playlist"}


def test_all_tools_registered():
    async def run():
        async with Client(build_mcp()) as client:
            return {t.name for t in await client.list_tools()}

    assert asyncio.run(run()) == EXPECTED_TOOLS


def test_recommend_tools_need_repo_and_key(monkeypatch, tmp_path):
    """Last.fm tools appear only with both storage AND LASTFM_API_KEY."""
    from ytmusic_mcp.db.repo import Repo

    repo = Repo("sqlite://")
    repo.create_all()

    async def tools(**kwargs):
        async with Client(build_mcp(repo=repo, **kwargs)) as client:
            return {t.name for t in await client.list_tools()}

    monkeypatch.delenv("LASTFM_API_KEY", raising=False)
    assert RECOMMEND_TOOLS.isdisjoint(asyncio.run(tools()))  # key missing → absent

    monkeypatch.setenv("LASTFM_API_KEY", "k")
    assert RECOMMEND_TOOLS <= asyncio.run(tools())  # repo + key → present

    # Key set but no repo → still absent (history layer is off).
    async def no_repo():
        async with Client(build_mcp()) as client:
            return {t.name for t in await client.list_tools()}

    assert RECOMMEND_TOOLS.isdisjoint(asyncio.run(no_repo()))


def test_missing_auth_is_explicit(monkeypatch, tmp_path):
    monkeypatch.setenv("YTMUSIC_AUTH_FILE", str(tmp_path / "absent.json"))

    async def run():
        async with Client(build_mcp()) as client:
            with pytest.raises(ToolError, match="No YouTube Music auth"):
                await client.call_tool("whoami", {})

    asyncio.run(run())
