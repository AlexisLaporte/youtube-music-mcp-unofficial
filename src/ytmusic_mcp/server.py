"""MCP server factory.

`build_mcp()` assembles a server from an optional auth provider and an optional
credentials provider — stdio (no auth, local file) by default; hosted
deployments pass their own. Transport is chosen by the caller (see cli.py).
"""

from fastmcp import FastMCP

from .credentials import CredentialsProvider, LocalFileProvider
from .tools import Deps, register_all

INSTRUCTIONS = (
    "Manage the user's YouTube Music library. "
    "Main workflow: `unfiled_liked_songs` to find liked songs missing from every "
    "playlist, then propose a filing plan and ALWAYS get the user's approval before "
    "any write (add/create). Batch writes: one `add_tracks` call with many videoIds. "
    "Destructive tools (delete_playlist, remove_tracks, unlike) require explicit "
    "user confirmation, listing what will be removed."
)


def build_mcp(auth=None, provider: CredentialsProvider | None = None) -> FastMCP:
    mcp = FastMCP("YouTube Music", auth=auth, instructions=INSTRUCTIONS)
    register_all(mcp, Deps(provider or LocalFileProvider()))
    return mcp
