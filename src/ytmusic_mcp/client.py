"""YouTube Music access layer (ytmusicapi) shared by the MCP server and the CLI.

Auth lives in a local browser-headers file created by `ytmusic-manager setup`.
It never leaves the machine.
"""

import os
from pathlib import Path

LIKED_PLAYLIST = "LM"
# System playlists excluded from audits (LM = likes, SE = saved episodes)
SYSTEM_PLAYLISTS = {"LM", "SE"}
WRITE_THROTTLE_S = 0.5


def auth_path() -> Path:
    override = os.environ.get("YTMUSIC_AUTH_FILE")
    if override:
        return Path(override)
    config_home = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return config_home / "ytmusic" / "browser.json"


class AuthMissingError(RuntimeError):
    def __init__(self):
        super().__init__(
            f"No YouTube Music auth at {auth_path()}. "
            "Run `ytmusic-manager setup` in a terminal (paste the request headers "
            "of a POST youtubei/v1 request from music.youtube.com devtools)."
        )


def get_client():
    from ytmusicapi import YTMusic

    path = auth_path()
    if not path.exists():
        raise AuthMissingError()
    return YTMusic(str(path))


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
