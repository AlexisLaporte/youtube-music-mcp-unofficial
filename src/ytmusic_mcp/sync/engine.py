"""Sync orchestration: fetch the live library, diff against the snapshot,
record events, overwrite the snapshot — all in one transaction.

The first successful sync is a silent baseline (import without events,
otherwise a 3000-song library would emit 3000 'like' events).
"""

import time
from datetime import timedelta

from ..db.models import Sync, as_utc, utcnow
from ..db.repo import Repo
from ..sync.diff import LibraryState, PlaylistState, diff_library
from ..ytclient import LIKED_PLAYLIST, SYSTEM_PLAYLISTS, get_playlist

MIN_SYNC_INTERVAL = timedelta(minutes=5)
PLAYLIST_FETCH_PAUSE_S = 0.3


class SyncTooSoonError(RuntimeError):
    def __init__(self, last_at):
        super().__init__(
            f"last successful sync at {last_at.isoformat()} — "
            "less than 5 minutes ago; pass force=true to sync anyway"
        )


def fetch_live(yt) -> tuple[LibraryState, list[dict]]:
    """Live library state + slim track metadata for the cache."""
    tracks_meta: list[dict] = []

    liked_pl = get_playlist(yt, LIKED_PLAYLIST, None)
    seen: set[str] = set()
    liked = tuple(
        v
        for t in liked_pl["tracks"]
        if (v := t.get("videoId")) and not (v in seen or seen.add(v))
    )  # YT's liked list can contain duplicate videoIds — keep the newest occurrence
    tracks_meta.extend(liked_pl["tracks"])

    playlists: dict[str, PlaylistState] = {}
    for p in yt.get_library_playlists(limit=None):
        pid = p.get("playlistId")
        if not pid or pid in SYSTEM_PLAYLISTS:
            continue
        time.sleep(PLAYLIST_FETCH_PAUSE_S)
        pl = get_playlist(yt, pid, None)
        if not pl.get("owned"):
            continue
        tracks_meta.extend(pl["tracks"])
        playlists[pid] = PlaylistState(
            title=pl.get("title"),
            description=None,  # get_playlist slim does not carry description
            privacy=None,
            owned=True,
            tracks=frozenset(t["videoId"] for t in pl["tracks"] if t.get("videoId")),
        )
    return LibraryState(liked=liked, playlists=playlists), tracks_meta


def run_sync(repo: Repo, yt, user_id: str, force: bool = False) -> dict:
    with repo.session() as s, s.begin():
        repo.lock_user(s, user_id)
        last = repo.last_ok_sync(s, user_id)
        if last and last.finished_at and not force:
            if utcnow() - as_utc(last.finished_at) < MIN_SYNC_INTERVAL:
                raise SyncTooSoonError(as_utc(last.finished_at))
        sync = Sync(user_id=user_id, is_baseline=last is None)
        s.add(sync)
        s.flush()
        sync_id, is_baseline = sync.id, sync.is_baseline

    try:
        live, tracks_meta = fetch_live(yt)
    except Exception as e:
        with repo.session() as s, s.begin():
            row = s.get(Sync, sync_id)
            row.status, row.error, row.finished_at = "error", str(e), utcnow()
        raise

    with repo.session() as s, s.begin():
        repo.lock_user(s, user_id)
        db_state = repo.library_state(s, user_id)
        events = [] if is_baseline else diff_library(db_state, live)
        now = utcnow()
        repo.upsert_tracks(s, tracks_meta)
        repo.replace_library(s, user_id, live, liked_seen_at=now)
        for draft in events:
            repo.add_event(s, user_id, draft, source="sync", sync_id=sync_id)
        stats = {
            "liked": len(live.liked),
            "playlists": len(live.playlists),
            "events": len(events),
            "baseline": is_baseline,
        }
        row = s.get(Sync, sync_id)
        row.status, row.stats, row.finished_at = "ok", stats, now

    return {"sync_id": sync_id} | stats
