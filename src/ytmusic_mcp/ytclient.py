"""YouTube Music access layer (ytmusicapi) shared by the MCP tools and the CLI."""

LIKED_PLAYLIST = "LM"
# System playlists excluded from audits (LM = likes, SE = saved episodes)
SYSTEM_PLAYLISTS = {"LM", "SE"}
WRITE_THROTTLE_S = 0.5


def build_yt(auth_json: str):
    """ytmusicapi client from a browser-auth JSON string (no disk access)."""
    from ytmusicapi import YTMusic

    return YTMusic(auth_json)


def slim_track(t: dict) -> dict:
    album = t.get("album")
    track = {
        "videoId": t.get("videoId"),
        "title": t.get("title"),
        "artists": [a["name"] for a in (t.get("artists") or []) if a.get("name")],
        "album": album.get("name") if isinstance(album, dict) else None,
        "duration": t.get("duration"),
    }
    if t.get("setVideoId"):
        track["setVideoId"] = t["setVideoId"]
    return track


def slim_playlist(p: dict) -> dict:
    return {
        "playlistId": p.get("playlistId"),
        "title": p.get("title"),
        "count": p.get("count"),
    }


def get_playlist(yt, playlist_id: str, limit: int | None) -> dict:
    pl = yt.get_playlist(playlist_id, limit=limit)
    return {
        "playlistId": playlist_id,
        "title": pl.get("title"),
        "owned": pl.get("owned"),
        "trackCount": pl.get("trackCount"),
        "tracks": [slim_track(t) for t in pl.get("tracks", [])],
        "_raw_tracks": pl.get("tracks", []),
    }
