"""Read tools: account, playlists, likes, search, unfiled audit."""

from typing import Literal

from ..ytclient import LIKED_PLAYLIST, SYSTEM_PLAYLISTS, get_playlist, slim_playlist, slim_track


def register(mcp, deps) -> None:
    @mcp.tool
    def whoami() -> dict:
        """Check the authenticated YouTube Music account (name, handle)."""
        return deps.get_yt().get_account_info()

    @mcp.tool
    def list_playlists(limit: int = 0) -> list[dict]:
        """List the playlists in the user's library. limit=0 returns all."""
        playlists = deps.get_yt().get_library_playlists(limit=limit or None)
        return [slim_playlist(p) for p in playlists]

    @mcp.tool
    def playlist_tracks(playlist_id: str, limit: int = 0) -> dict:
        """Get the tracks of a playlist ('LM' = liked songs). limit=0 returns all."""
        pl = get_playlist(deps.get_yt(), playlist_id, limit or None)
        pl.pop("_raw_tracks")
        return pl

    @mcp.tool
    def liked_songs(limit: int = 0) -> dict:
        """Get the user's liked songs, most recently liked first. limit=0 returns all."""
        pl = get_playlist(deps.get_yt(), LIKED_PLAYLIST, limit or None)
        pl.pop("_raw_tracks")
        return pl

    @mcp.tool
    def search(
        query: str,
        filter: Literal["songs", "videos", "albums", "artists", "playlists"] = "songs",
        limit: int = 20,
    ) -> list[dict]:
        """Search YouTube Music."""
        results = deps.get_yt().search(query, filter=filter, limit=limit)
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
        yt = deps.get_yt()
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
