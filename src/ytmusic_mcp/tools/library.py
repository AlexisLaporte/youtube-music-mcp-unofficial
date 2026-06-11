"""Read tools: account, playlists, likes, search, unfiled audit.

When storage is configured, reads accept cached=true: they answer from a
snapshot kept fresh automatically (baseline on first contact, lazy refresh
past a TTL — sync-then-serve), so they never error on a missing sync."""

from typing import Literal

from ..ytclient import LIKED_PLAYLIST, SYSTEM_PLAYLISTS, get_playlist, slim_playlist, slim_track


def register(mcp, deps) -> None:
    def _prime():
        """Before a cached read: guarantee a fresh-enough snapshot (baseline /
        lazy refresh). Done outside the read session (it may run a sync).
        Lazy import: sync.engine pulls SQLAlchemy, absent in the stdio build."""
        if deps.repo is None:
            raise RuntimeError("cached=true requires storage; this server has none")
        from ..sync.engine import FRESH_TTL_LIBRARY

        deps.ensure_fresh(FRESH_TTL_LIBRARY)

    @mcp.tool
    def whoami() -> dict:
        """Check the authenticated YouTube Music account (name, handle)."""
        return deps.get_yt().get_account_info()

    @mcp.tool
    def list_playlists(limit: int = 0, cached: bool = False) -> list[dict]:
        """List the playlists in the user's library. limit=0 returns all.
        cached=true reads the last synced snapshot (fast, owned playlists only)."""
        if cached:
            from sqlalchemy import select

            from ..db.models import Playlist

            _prime()
            with deps.repo.session() as s:
                rows = s.scalars(
                    select(Playlist)
                    .where(Playlist.user_id == deps.user_id(), Playlist.deleted_at.is_(None))
                    .limit(limit or None)
                ).all()
            return [
                {"playlistId": p.playlist_id, "title": p.title, "count": p.track_count}
                for p in rows
            ]
        playlists = deps.get_yt().get_library_playlists(limit=limit or None)
        return [slim_playlist(p) for p in playlists]

    @mcp.tool
    def playlist_tracks(playlist_id: str, limit: int = 0) -> dict:
        """Get the tracks of a playlist ('LM' = liked songs). limit=0 returns all."""
        pl = get_playlist(deps.get_yt(), playlist_id, limit or None)
        pl.pop("_raw_tracks")
        return pl

    @mcp.tool
    def liked_songs(limit: int = 0, cached: bool = False) -> dict:
        """Get the user's liked songs, most recently liked first. limit=0 returns all.
        cached=true reads the last synced snapshot (fast)."""
        if cached:
            from sqlalchemy import select

            from ..db.models import LikedSong

            _prime()
            with deps.repo.session() as s:
                last = deps.repo.last_ok_sync(s, deps.user_id())
                rows = s.scalars(
                    select(LikedSong)
                    .where(LikedSong.user_id == deps.user_id())
                    .order_by(LikedSong.rank)
                    .limit(limit or None)
                ).all()
                meta = deps.repo.tracks_meta(s, [r.video_id for r in rows])
            return {
                "playlistId": LIKED_PLAYLIST,
                "trackCount": len(rows),
                "syncedAt": last.finished_at.isoformat(),
                "tracks": [meta.get(r.video_id, {"videoId": r.video_id}) for r in rows],
            }
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
    def unfiled_liked_songs(include_followed: bool = False, cached: bool = False) -> dict:
        """Find liked songs that are not in any playlist of the library.

        Live mode is slow on large libraries (scans every playlist) — call once and
        reuse the result. cached=true answers instantly from the last synced
        snapshot (owned playlists only).
        """
        if cached:
            if include_followed:
                raise ValueError("cached snapshot only covers owned playlists")
            _prime()
            with deps.repo.session() as s:
                last = deps.repo.last_ok_sync(s, deps.user_id())
                vids = deps.repo.unfiled_video_ids(s, deps.user_id())
                meta = deps.repo.tracks_meta(s, vids)
                summary = deps.repo.summary(s, deps.user_id())
            return {
                "stats": {
                    "liked": summary["liked"],
                    "filed": summary["liked"] - len(vids),
                    "unfiled": len(vids),
                    "syncedAt": last.finished_at.isoformat(),
                },
                "tracks": [meta.get(v, {"videoId": v}) for v in vids],
            }
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
