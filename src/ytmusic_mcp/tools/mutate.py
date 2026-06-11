"""Write tools: create/edit/delete playlists, add/remove tracks, like/unlike.

When storage is configured (deps.repo), every successful YT write also updates
the snapshot and appends a history event (source='tool') in one transaction.
A failed history write never hides a successful YT write: the result carries a
history_warning and the next sync reconciles (set-based diff ⇒ convergence,
no duplicate events)."""

import json
import time
from typing import Literal

from ..sync.diff import EventDraft
from ..ytclient import WRITE_THROTTLE_S, get_playlist, slim_track


def _record(deps, mutate_db) -> dict:
    if deps.repo is None:
        return {}
    try:
        with deps.repo.session() as s, s.begin():
            mutate_db(s, deps.repo, deps.user_id())
        return {}
    except Exception as e:  # YT write already succeeded — report, don't mask it
        return {
            "history_warning": (
                f"YT write succeeded but history update failed ({e}); "
                "the next sync will reconcile"
            )
        }


def register(mcp, deps) -> None:
    @mcp.tool
    def create_playlist(
        title: str,
        description: str = "",
        privacy: Literal["PRIVATE", "PUBLIC", "UNLISTED"] = "PRIVATE",
    ) -> dict:
        """Create a playlist and return its playlistId."""
        result = deps.get_yt().create_playlist(title, description, privacy_status=privacy)
        if not isinstance(result, str):
            raise RuntimeError(f"create failed: {json.dumps(result, ensure_ascii=False)}")

        def record(s, repo, user_id):
            from ..db.models import Playlist

            s.add(
                Playlist(
                    user_id=user_id,
                    playlist_id=result,
                    title=title,
                    description=description or None,
                    privacy=privacy,
                    owned=True,
                    track_count=0,
                )
            )
            repo.add_event(
                s,
                user_id,
                EventDraft(
                    type="playlist_create",
                    playlist_id=result,
                    payload={"title": title, "privacy": privacy},
                ),
                source="tool",
            )

        return {"playlistId": result, "title": title} | _record(deps, record)

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
        result = deps.get_yt().edit_playlist(
            playlist_id, title=title, description=description, privacyStatus=privacy
        )
        if result != "STATUS_SUCCEEDED":
            raise RuntimeError(f"edit failed: {json.dumps(result, ensure_ascii=False)}")

        changes = {
            k: v
            for k, v in {"title": title, "description": description, "privacy": privacy}.items()
            if v is not None
        }

        def record(s, repo, user_id):
            from ..db.models import Playlist

            row = s.get(Playlist, (user_id, playlist_id))
            if row:
                for k, v in changes.items():
                    setattr(row, k, v)
            repo.add_event(
                s,
                user_id,
                EventDraft(type="playlist_edit", playlist_id=playlist_id, payload=changes),
                source="tool",
            )

        return {"playlistId": playlist_id, "status": result} | _record(deps, record)

    @mcp.tool
    def add_tracks(playlist_id: str, video_ids: list[str], allow_duplicates: bool = False) -> dict:
        """Add tracks to a playlist. Batch: pass all videoIds in one call."""
        result = deps.get_yt().add_playlist_items(
            playlist_id, videoIds=video_ids, duplicates=allow_duplicates
        )
        status = result.get("status") if isinstance(result, dict) else result
        if status != "STATUS_SUCCEEDED":
            raise RuntimeError(f"add failed: {json.dumps(result, ensure_ascii=False)}")

        def record(s, repo, user_id):
            from ..db.models import PlaylistTrack

            for vid in video_ids:
                if s.get(PlaylistTrack, (user_id, playlist_id, vid)) is None:
                    s.add(PlaylistTrack(user_id=user_id, playlist_id=playlist_id, video_id=vid))
            repo.add_event(
                s,
                user_id,
                EventDraft(type="tracks_add", playlist_id=playlist_id, video_ids=video_ids),
                source="tool",
            )

        return {"playlistId": playlist_id, "added": video_ids, "status": status} | _record(
            deps, record
        )

    @mcp.tool
    def remove_tracks(playlist_id: str, video_ids: list[str]) -> dict:
        """Remove tracks from an owned playlist (every occurrence of each videoId).

        Destructive: confirm with the user first, listing the tracks.
        """
        yt = deps.get_yt()
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

        def record(s, repo, user_id):
            from sqlalchemy import delete

            from ..db.models import PlaylistTrack

            s.execute(
                delete(PlaylistTrack).where(
                    PlaylistTrack.user_id == user_id,
                    PlaylistTrack.playlist_id == playlist_id,
                    PlaylistTrack.video_id.in_(video_ids),
                )
            )
            repo.add_event(
                s,
                user_id,
                EventDraft(type="tracks_remove", playlist_id=playlist_id, video_ids=video_ids),
                source="tool",
            )

        return {
            "playlistId": playlist_id,
            "removed": [slim_track(t) for t in targets],
            "status": result,
        } | _record(deps, record)

    @mcp.tool
    def delete_playlist(playlist_id: str, confirm: bool = False) -> dict:
        """Delete a playlist. Destructive: requires confirm=true after explicit user approval."""
        if not confirm:
            raise ValueError("refused without confirm=true (ask the user first)")
        yt = deps.get_yt()
        title = yt.get_playlist(playlist_id, limit=0).get("title")
        yt.delete_playlist(playlist_id)

        def record(s, repo, user_id):
            from ..db.models import Playlist, utcnow

            row = s.get(Playlist, (user_id, playlist_id))
            if row:
                row.deleted_at = utcnow()
            repo.add_event(
                s,
                user_id,
                EventDraft(
                    type="playlist_delete", playlist_id=playlist_id, payload={"title": title}
                ),
                source="tool",
            )

        return {"deleted": playlist_id, "title": title} | _record(deps, record)

    def _rate(video_ids: list[str], rating: str) -> dict:
        yt = deps.get_yt()
        for i, vid in enumerate(video_ids):
            if i:
                time.sleep(WRITE_THROTTLE_S)
            yt.rate_song(vid, rating)
        return {"rating": rating, "videoIds": video_ids}

    @mcp.tool
    def like(video_ids: list[str]) -> dict:
        """Like tracks (adds them to liked songs)."""
        result = _rate(video_ids, "LIKE")

        def record(s, repo, user_id):
            from ..db.models import LikedSong

            for vid in video_ids:
                if s.get(LikedSong, (user_id, vid)) is None:
                    # rank=-1 sorts before the synced ranks; fixed at next sync
                    s.add(LikedSong(user_id=user_id, video_id=vid, rank=-1))
            repo.add_event(s, user_id, EventDraft(type="like", video_ids=video_ids), source="tool")

        return result | _record(deps, record)

    @mcp.tool
    def unlike(video_ids: list[str]) -> dict:
        """Remove the like from tracks. Destructive: confirm with the user first."""
        result = _rate(video_ids, "INDIFFERENT")

        def record(s, repo, user_id):
            from sqlalchemy import delete

            from ..db.models import LikedSong

            s.execute(
                delete(LikedSong).where(
                    LikedSong.user_id == user_id, LikedSong.video_id.in_(video_ids)
                )
            )
            repo.add_event(
                s, user_id, EventDraft(type="unlike", video_ids=video_ids), source="tool"
            )

        return result | _record(deps, record)
