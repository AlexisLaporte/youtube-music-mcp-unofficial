"""MCP server exposing YouTube Music library management tools.

Transport is decided by MCP_TRANSPORT at import time: stdio (default, no auth)
or http (remote personal instance, OAuth resource server — see auth.py).
"""

import json
import os
import time
from typing import Literal

from fastmcp import FastMCP

from .client import (
    LIKED_PLAYLIST,
    SYSTEM_PLAYLISTS,
    WRITE_THROTTLE_S,
    get_client,
    get_playlist,
    slim_playlist,
    slim_track,
)

TRANSPORT = os.environ.get("MCP_TRANSPORT", "stdio")

if TRANSPORT in ("http", "streamable_http"):
    from .auth import build_auth

    _auth = build_auth()
else:
    _auth = None

mcp = FastMCP(
    "YouTube Music",
    auth=_auth,
    instructions=(
        "Manage the user's YouTube Music library. "
        "Main workflow: `unfiled_liked_songs` to find liked songs missing from every "
        "playlist, then propose a filing plan and ALWAYS get the user's approval before "
        "any write (add/create). Batch writes: one `add_tracks` call with many videoIds. "
        "Destructive tools (delete_playlist, remove_tracks, unlike) require explicit "
        "user confirmation, listing what will be removed."
    ),
)


@mcp.tool
def whoami() -> dict:
    """Check the authenticated YouTube Music account (name, handle)."""
    return get_client().get_account_info()


@mcp.tool
def list_playlists(limit: int = 0) -> list[dict]:
    """List the playlists in the user's library. limit=0 returns all."""
    playlists = get_client().get_library_playlists(limit=limit or None)
    return [slim_playlist(p) for p in playlists]


@mcp.tool
def playlist_tracks(playlist_id: str, limit: int = 0) -> dict:
    """Get the tracks of a playlist ('LM' = liked songs). limit=0 returns all."""
    pl = get_playlist(get_client(), playlist_id, limit or None)
    pl.pop("_raw_tracks")
    return pl


@mcp.tool
def liked_songs(limit: int = 0) -> dict:
    """Get the user's liked songs, most recently liked first. limit=0 returns all."""
    pl = get_playlist(get_client(), LIKED_PLAYLIST, limit or None)
    pl.pop("_raw_tracks")
    return pl


@mcp.tool
def search(
    query: str,
    filter: Literal["songs", "videos", "albums", "artists", "playlists"] = "songs",
    limit: int = 20,
) -> list[dict]:
    """Search YouTube Music."""
    results = get_client().search(query, filter=filter, limit=limit)
    slim = []
    for r in results:
        if r.get("resultType") in ("song", "video"):
            slim.append(slim_track(r) | {"resultType": r["resultType"]})
        else:
            slim.append(
                {
                    "resultType": r.get("resultType"),
                    "title": r.get("title"),
                    "browseId": r.get("browseId"),
                    "playlistId": r.get("playlistId"),
                    "artists": [a["name"] for a in (r.get("artists") or []) if a.get("name")],
                }
            )
    return slim


@mcp.tool
def unfiled_liked_songs(include_followed: bool = False) -> dict:
    """Find liked songs that are not in any playlist of the library.

    Slow on large libraries (scans every playlist) — call once and reuse the result.
    """
    yt = get_client()
    liked = get_playlist(yt, LIKED_PLAYLIST, None)["tracks"]
    liked_by_id = {t["videoId"]: t for t in liked if t.get("videoId")}

    filed: set[str] = set()
    scanned = []
    for p in yt.get_library_playlists(limit=None):
        pid = p.get("playlistId")
        if not pid or pid in SYSTEM_PLAYLISTS:
            continue
        pl = get_playlist(yt, pid, None)
        if not pl.get("owned") and not include_followed:
            continue
        filed |= {t["videoId"] for t in pl["tracks"] if t.get("videoId")}
        scanned.append(pid)

    unfiled = [t for vid, t in liked_by_id.items() if vid not in filed]
    return {
        "stats": {
            "liked": len(liked_by_id),
            "filed": len(liked_by_id) - len(unfiled),
            "unfiled": len(unfiled),
            "playlists_scanned": len(scanned),
        },
        "tracks": unfiled,
    }


@mcp.tool
def create_playlist(
    title: str,
    description: str = "",
    privacy: Literal["PRIVATE", "PUBLIC", "UNLISTED"] = "PRIVATE",
) -> dict:
    """Create a playlist and return its playlistId."""
    result = get_client().create_playlist(title, description, privacy_status=privacy)
    if not isinstance(result, str):
        raise RuntimeError(f"create failed: {json.dumps(result, ensure_ascii=False)}")
    return {"playlistId": result, "title": title}


@mcp.tool
def edit_playlist(
    playlist_id: str,
    title: str | None = None,
    description: str | None = None,
    privacy: Literal["PRIVATE", "PUBLIC", "UNLISTED"] | None = None,
) -> dict:
    """Rename or edit a playlist (title, description, privacy)."""
    if not (title or description or privacy):
        raise ValueError("nothing to edit (title / description / privacy)")
    result = get_client().edit_playlist(
        playlist_id, title=title, description=description, privacyStatus=privacy
    )
    if result != "STATUS_SUCCEEDED":
        raise RuntimeError(f"edit failed: {json.dumps(result, ensure_ascii=False)}")
    return {"playlistId": playlist_id, "status": result}


@mcp.tool
def add_tracks(playlist_id: str, video_ids: list[str], allow_duplicates: bool = False) -> dict:
    """Add tracks to a playlist. Batch: pass all videoIds in one call."""
    result = get_client().add_playlist_items(
        playlist_id, videoIds=video_ids, duplicates=allow_duplicates
    )
    status = result.get("status") if isinstance(result, dict) else result
    if status != "STATUS_SUCCEEDED":
        raise RuntimeError(f"add failed: {json.dumps(result, ensure_ascii=False)}")
    return {"playlistId": playlist_id, "added": video_ids, "status": status}


@mcp.tool
def remove_tracks(playlist_id: str, video_ids: list[str]) -> dict:
    """Remove tracks from an owned playlist (every occurrence of each videoId).

    Destructive: confirm with the user first, listing the tracks.
    """
    yt = get_client()
    pl = get_playlist(yt, playlist_id, None)
    if not pl.get("owned"):
        raise ValueError("playlist not owned: cannot remove")
    by_video: dict[str, list[dict]] = {}
    for t in pl["_raw_tracks"]:
        if t.get("videoId") and t.get("setVideoId"):
            by_video.setdefault(t["videoId"], []).append(t)
    targets = []
    for vid in video_ids:
        if vid not in by_video:
            raise ValueError(f"videoId not in playlist: {vid}")
        targets.extend(by_video[vid])
    result = yt.remove_playlist_items(playlist_id, targets)
    if result != "STATUS_SUCCEEDED":
        raise RuntimeError(f"remove failed: {json.dumps(result, ensure_ascii=False)}")
    return {
        "playlistId": playlist_id,
        "removed": [slim_track(t) for t in targets],
        "status": result,
    }


@mcp.tool
def delete_playlist(playlist_id: str, confirm: bool = False) -> dict:
    """Delete a playlist. Destructive: requires confirm=true after explicit user approval."""
    if not confirm:
        raise ValueError("refused without confirm=true (ask the user first)")
    yt = get_client()
    title = yt.get_playlist(playlist_id, limit=0).get("title")
    yt.delete_playlist(playlist_id)
    return {"deleted": playlist_id, "title": title}


def _rate(video_ids: list[str], rating: str) -> dict:
    yt = get_client()
    for i, vid in enumerate(video_ids):
        if i:
            time.sleep(WRITE_THROTTLE_S)
        yt.rate_song(vid, rating)
    return {"rating": rating, "videoIds": video_ids}


@mcp.tool
def like(video_ids: list[str]) -> dict:
    """Like tracks (adds them to liked songs)."""
    return _rate(video_ids, "LIKE")


@mcp.tool
def unlike(video_ids: list[str]) -> dict:
    """Remove the like from tracks. Destructive: confirm with the user first."""
    return _rate(video_ids, "INDIFFERENT")
