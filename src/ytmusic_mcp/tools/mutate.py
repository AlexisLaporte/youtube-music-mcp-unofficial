"""Write tools: create/edit/delete playlists, add/remove tracks, like/unlike."""

import json
import time
from typing import Literal

from ..ytclient import WRITE_THROTTLE_S, get_playlist, slim_track


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
        result = deps.get_yt().edit_playlist(
            playlist_id, title=title, description=description, privacyStatus=privacy
        )
        if result != "STATUS_SUCCEEDED":
            raise RuntimeError(f"edit failed: {json.dumps(result, ensure_ascii=False)}")
        return {"playlistId": playlist_id, "status": result}

    @mcp.tool
    def add_tracks(playlist_id: str, video_ids: list[str], allow_duplicates: bool = False) -> dict:
        """Add tracks to a playlist. Batch: pass all videoIds in one call."""
        result = deps.get_yt().add_playlist_items(
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
        yt = deps.get_yt()
        title = yt.get_playlist(playlist_id, limit=0).get("title")
        yt.delete_playlist(playlist_id)
        return {"deleted": playlist_id, "title": title}

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
        return _rate(video_ids, "LIKE")

    @mcp.tool
    def unlike(video_ids: list[str]) -> dict:
        """Remove the like from tracks. Destructive: confirm with the user first."""
        return _rate(video_ids, "INDIFFERENT")
