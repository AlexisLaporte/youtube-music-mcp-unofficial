"""History tools (registered only when storage is configured): sync,
recent likes since the previous sync, generic change feed."""

from datetime import datetime

from sqlalchemy import select

from ..db.models import LikedSong, Sync
from ..sync.engine import FRESH_TTL_RECENT, run_sync


def register(mcp, deps) -> None:
    repo = deps.repo

    @mcp.tool
    def sync(force: bool = False) -> dict:
        """Refresh the library snapshot from YouTube Music and record what changed
        since the last sync as history events. First sync is a silent baseline.

        Normally you don't need this — the snapshot is kept fresh automatically.
        Use it for an explicit 'show me the state right now'. Refuses to run twice
        within 5 minutes unless force=true."""
        return run_sync(repo, deps.get_yt(), deps.user_id(), force=force)

    @mcp.tool
    def recent_likes(since_sync_id: int | None = None, limit: int = 100) -> dict:
        """Liked songs that are NEW since the previous sync — the answer to
        "sort my latest likes". The snapshot is refreshed automatically first
        (short TTL), so this reflects what's freshly liked; no manual sync needed.

        Granularity is the sync cadence: YouTube does not expose like dates, so a
        track counts as "new" from the sync that first saw it."""
        user_id = deps.user_id()
        deps.ensure_fresh(FRESH_TTL_RECENT)  # baseline on 1st contact, fresh snapshot
        with repo.session() as s:
            latest = repo.last_ok_sync(s, user_id)
            if since_sync_id is not None:
                boundary_sync = s.get(Sync, since_sync_id)
                if boundary_sync is None or boundary_sync.user_id != user_id:
                    raise ValueError(f"unknown sync_id {since_sync_id} for this user")
                boundary = boundary_sync.finished_at
            else:
                prev = repo.previous_ok_sync(s, user_id)
                boundary = (prev or latest).finished_at

            rows = s.scalars(
                select(LikedSong)
                .where(LikedSong.user_id == user_id, LikedSong.liked_seen_at > boundary)
                .order_by(LikedSong.rank)
                .limit(limit)
            ).all()
            meta = repo.tracks_meta(s, [r.video_id for r in rows])
        return {
            "since": boundary.isoformat(),
            "until": latest.finished_at.isoformat(),
            "count": len(rows),
            "tracks": [
                meta.get(r.video_id, {"videoId": r.video_id})
                | {"likedSeenAt": r.liked_seen_at.isoformat()}
                for r in rows
            ],
        }

    @mcp.tool
    def mark_unfileable(video_ids: list[str], reason: str = "") -> dict:
        """Flag liked songs as "not fileable" (DJ set, jingle, ambience…): they
        disappear from unfiled_liked_songs and the dashboard without being
        unliked. Reversible with unmark_unfileable. Batch: pass all videoIds
        in one call."""
        from ..sync.diff import EventDraft

        user_id = deps.user_id()
        with repo.session() as s, s.begin():
            added = repo.add_filing_skips(s, user_id, video_ids, reason=reason or None)
            if added:
                repo.add_event(
                    s,
                    user_id,
                    EventDraft(
                        type="filing_skip",
                        video_ids=added,
                        payload={"reason": reason} if reason else None,
                    ),
                    source="tool",
                )
        return {"marked": added, "alreadyMarked": [v for v in video_ids if v not in added]}

    @mcp.tool
    def unmark_unfileable(video_ids: list[str]) -> dict:
        """Remove the "not fileable" flag: the tracks reappear in the unfiled list."""
        from ..sync.diff import EventDraft

        user_id = deps.user_id()
        with repo.session() as s, s.begin():
            removed = repo.remove_filing_skips(s, user_id, video_ids)
            if removed:
                repo.add_event(
                    s,
                    user_id,
                    EventDraft(type="filing_unskip", video_ids=video_ids),
                    source="tool",
                )
        return {"unmarked": removed}

    @mcp.tool
    def list_unfileable() -> dict:
        """List the tracks flagged "not fileable" (with metadata and reason)."""
        user_id = deps.user_id()
        with repo.session() as s:
            skips = repo.filing_skips(s, user_id)
            meta = repo.tracks_meta(s, [r.video_id for r in skips])
        return {
            "count": len(skips),
            "tracks": [
                meta.get(r.video_id, {"videoId": r.video_id})
                | {"reason": r.reason, "markedAt": r.created_at.isoformat()}
                for r in skips
            ],
        }

    @mcp.tool
    def library_changes(
        since: datetime | None = None,
        types: list[str] | None = None,
        limit: int = 50,
    ) -> dict:
        """History feed of library changes (likes, playlist edits…), newest first.

        types filter: like, unlike, playlist_create, playlist_edit,
        playlist_delete, tracks_add, tracks_remove."""
        user_id = deps.user_id()
        with repo.session() as s:
            events = repo.events(s, user_id, since=since, types=types, limit=limit)
        return {
            "count": len(events),
            "events": [
                {
                    "at": e.at.isoformat(),
                    "source": e.source,
                    "type": e.type,
                    "playlistId": e.playlist_id,
                    "videoIds": e.video_ids,
                    "payload": e.payload,
                }
                for e in events
            ],
        }
