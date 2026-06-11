"""MCP server factory.

`build_mcp()` assembles a server from an optional auth provider and an optional
credentials provider — stdio (no auth, local file) by default; hosted
deployments pass their own. Transport is chosen by the caller (see cli.py).
"""

from fastmcp import FastMCP

from .credentials import CredentialsProvider, LocalFileProvider
from .tools import Deps, register_all

INSTRUCTIONS = (
    "Manage the user's YouTube Music library. **Call `get_claude_md` first** — it is "
    "the orchestration doctrine (mental model, workflows, guardrails). In short: the "
    "library snapshot is kept fresh automatically (don't micro-manage `sync`); prefer "
    "cached reads; ALWAYS get user approval before any write; destructive tools "
    "(delete_playlist, remove_tracks, unlike) need explicit confirmation listing what "
    "will be removed; batch `add_tracks` (one call, many videoIds)."
)


def build_mcp(auth=None, provider: CredentialsProvider | None = None, repo=None) -> FastMCP:
    """repo (db.repo.Repo, optional) enables history: sync/recent_likes/
    library_changes tools, cached reads, write-through event recording and
    the rendered dashboard (library_app, if prefab-ui is installed)."""
    mcp = FastMCP("YouTube Music", auth=auth, instructions=INSTRUCTIONS)
    deps = Deps(provider or LocalFileProvider(), repo=repo)
    register_all(mcp, deps)
    if repo is not None:
        _register_mcp_app(mcp, deps)
    return mcp


def _register_mcp_app(mcp: FastMCP, deps: Deps) -> None:
    """Mount the rendered-UI surface if the optional prefab-ui is installed.
    Graceful: without the [app] extra the JSON tools run alone."""
    try:
        from . import mcp_app

        mcp_app.register(mcp, deps)
    except ImportError as e:
        import logging

        logging.getLogger(__name__).info("MCP App surface disabled: %s", e)
