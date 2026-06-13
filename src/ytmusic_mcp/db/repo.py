"""Storage access — all SQL lives here, tools and engine talk to Repo only."""

from datetime import datetime

from sqlalchemy import create_engine, delete, func, select, text
from sqlalchemy.orm import Session, sessionmaker

from ..sync.diff import EventDraft, LibraryState, PlaylistState
from ..ytclient import SYSTEM_PLAYLISTS
from .models import (
    Base,
    Event,
    FilingSkip,
    LikedSong,
    Playlist,
    PlaylistTrack,
    Sync,
    Track,
    TrackTags,
    utcnow,
)


class NoSyncError(RuntimeError):
    def __init__(self):
        super().__init__("no successful sync yet for this user — run the `sync` tool first")


# On Postgres everything lives in a dedicated schema: on Supabase, tables in
# `public` are exposed by PostgREST to the anon key — `ytm` is not. The DSN
# `options=search_path` route is unreliable through poolers, so the schema is
# mapped at the SQLAlchemy level (SQLite ignores it).
DB_SCHEMA = "ytm"


class Repo:
    def __init__(self, database_url: str):
        engine = create_engine(database_url, pool_pre_ping=True)
        if engine.dialect.name == "postgresql":
            engine = engine.execution_options(schema_translate_map={None: DB_SCHEMA})
        self.engine = engine
        self._session = sessionmaker(self.engine, expire_on_commit=False)

    def create_all(self) -> None:
        if self.engine.dialect.name == "postgresql":
            with self.engine.connect() as conn:
                conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {DB_SCHEMA}"))
                conn.commit()
        Base.metadata.create_all(self.engine)

    def session(self) -> Session:
        return self._session()

    # -- sync bookkeeping ----------------------------------------------------

    def lock_user(self, s: Session, user_id: str) -> None:
        """One sync at a time per user (no-op outside Postgres)."""
        if s.bind.dialect.name == "postgresql":
            s.execute(text("SELECT pg_advisory_xact_lock(hashtext(:uid))"), {"uid": user_id})

    def last_ok_sync(self, s: Session, user_id: str) -> Sync | None:
        return s.scalars(
            select(Sync)
            .where(Sync.user_id == user_id, Sync.status == "ok")
            .order_by(Sync.id.desc())
            .limit(1)
        ).first()

    def previous_ok_sync(self, s: Session, user_id: str) -> Sync | None:
        return s.scalars(
            select(Sync)
            .where(Sync.user_id == user_id, Sync.status == "ok")
            .order_by(Sync.id.desc())
            .offset(1)
            .limit(1)
        ).first()

    # -- state ----------------------------------------------------------------

    def library_state(self, s: Session, user_id: str) -> LibraryState:
        liked = tuple(
            s.scalars(
                select(LikedSong.video_id)
                .where(LikedSong.user_id == user_id)
                .order_by(LikedSong.rank)
            ).all()
        )
        playlists: dict[str, PlaylistState] = {}
        rows = s.scalars(
            select(Playlist).where(Playlist.user_id == user_id, Playlist.deleted_at.is_(None))
        ).all()
        track_rows = s.execute(
            select(PlaylistTrack.playlist_id, PlaylistTrack.video_id).where(
                PlaylistTrack.user_id == user_id
            )
        ).all()
        by_playlist: dict[str, set[str]] = {}
        for pid, vid in track_rows:
            by_playlist.setdefault(pid, set()).add(vid)
        for p in rows:
            playlists[p.playlist_id] = PlaylistState(
                title=p.title,
                description=p.description,
                privacy=p.privacy,
                owned=p.owned,
                tracks=frozenset(by_playlist.get(p.playlist_id, set())),
            )
        return LibraryState(liked=liked, playlists=playlists)

    def replace_library(
        self, s: Session, user_id: str, live: LibraryState, liked_seen_at: datetime
    ) -> None:
        """Overwrite the snapshot with the live state (sync), keeping
        first_seen_at / liked_seen_at of rows that already existed."""
        existing_likes = {
            r.video_id: r for r in s.scalars(select(LikedSong).where(LikedSong.user_id == user_id))
        }
        s.execute(delete(LikedSong).where(LikedSong.user_id == user_id))
        for rank, vid in enumerate(live.liked):
            seen = existing_likes[vid].liked_seen_at if vid in existing_likes else liked_seen_at
            s.add(LikedSong(user_id=user_id, video_id=vid, rank=rank, liked_seen_at=seen))

        existing_pt = {
            (r.playlist_id, r.video_id): r.first_seen_at
            for r in s.scalars(select(PlaylistTrack).where(PlaylistTrack.user_id == user_id))
        }
        s.execute(delete(PlaylistTrack).where(PlaylistTrack.user_id == user_id))
        s.execute(delete(Playlist).where(Playlist.user_id == user_id))
        for pid, pl in live.playlists.items():
            s.add(
                Playlist(
                    user_id=user_id,
                    playlist_id=pid,
                    title=pl.title,
                    description=pl.description,
                    privacy=pl.privacy,
                    owned=pl.owned,
                    track_count=len(pl.tracks),
                )
            )
            for vid in pl.tracks:
                s.add(
                    PlaylistTrack(
                        user_id=user_id,
                        playlist_id=pid,
                        video_id=vid,
                        first_seen_at=existing_pt.get((pid, vid), liked_seen_at),
                    )
                )

    def upsert_tracks(self, s: Session, tracks: list[dict]) -> None:
        """Best-effort metadata cache from slim tracks."""
        for t in tracks:
            vid = t.get("videoId")
            if not vid:
                continue
            row = s.get(Track, vid) or Track(video_id=vid)
            row.title = t.get("title") or row.title
            row.artists = t.get("artists") or row.artists
            row.album = t.get("album") or row.album
            row.duration = t.get("duration") or row.duration
            row.updated_at = utcnow()
            s.add(row)

    # -- events ----------------------------------------------------------------

    def add_event(
        self, s: Session, user_id: str, draft: EventDraft, source: str, sync_id: int | None = None
    ) -> None:
        s.add(
            Event(
                user_id=user_id,
                source=source,
                type=draft.type,
                playlist_id=draft.playlist_id,
                video_ids=draft.video_ids,
                payload=draft.payload,
                sync_id=sync_id,
            )
        )

    def events(
        self,
        s: Session,
        user_id: str,
        since: datetime | None = None,
        types: list[str] | None = None,
        limit: int = 200,
    ) -> list[Event]:
        q = select(Event).where(Event.user_id == user_id)
        if since is not None:
            q = q.where(Event.at > since)
        if types:
            q = q.where(Event.type.in_(types))
        return list(s.scalars(q.order_by(Event.id.desc()).limit(limit)).all())

    # -- queries ----------------------------------------------------------------

    def tracks_meta(self, s: Session, video_ids: list[str]) -> dict[str, dict]:
        rows = s.scalars(select(Track).where(Track.video_id.in_(video_ids))).all()
        return {
            t.video_id: {
                "videoId": t.video_id,
                "title": t.title,
                "artists": t.artists,
                "album": t.album,
                "duration": t.duration,
            }
            for t in rows
        }

    # -- Last.fm tag enrichment ------------------------------------------------

    def upsert_track_tags(self, s: Session, results: list[dict]) -> None:
        """Cache Last.fm enrichment results (shared, no user_id). Each result:
        {video_id, tags, status, source, error}."""
        for r in results:
            vid = r["video_id"]
            row = s.get(TrackTags, vid) or TrackTags(video_id=vid)
            row.tags = r.get("tags")
            row.status = r.get("status", "done")
            row.source = r.get("source")
            row.error = r.get("error")
            row.updated_at = utcnow()
            s.add(row)

    def track_tags(self, s: Session, video_ids: list[str]) -> dict[str, dict]:
        rows = s.scalars(select(TrackTags).where(TrackTags.video_id.in_(video_ids))).all()
        return {
            t.video_id: {"tags": t.tags or [], "status": t.status, "source": t.source}
            for t in rows
        }

    def pending_tag_ids(self, s: Session, video_ids: list[str]) -> list[str]:
        """Subset of video_ids not yet enriched (status != 'done') — drives the
        idempotent, bounded enrichment loop. Failures/skips are retried."""
        done = set(
            s.scalars(
                select(TrackTags.video_id).where(
                    TrackTags.video_id.in_(video_ids), TrackTags.status == "done"
                )
            ).all()
        )
        return [v for v in video_ids if v not in done]

    def user_enriched_tags(self, s: Session, user_id: str) -> dict[str, list[str]]:
        """Tags of the user's library tracks (liked ∪ in owned playlists) that are
        enriched — the candidate pool for intra-library similarity."""
        user_vids = (
            select(LikedSong.video_id)
            .where(LikedSong.user_id == user_id)
            .union(select(PlaylistTrack.video_id).where(PlaylistTrack.user_id == user_id))
        )
        rows = s.execute(
            select(TrackTags.video_id, TrackTags.tags).where(
                TrackTags.status == "done",
                TrackTags.tags.is_not(None),
                TrackTags.video_id.in_(user_vids),
            )
        ).all()
        return {vid: tags for vid, tags in rows if tags}

    def playlists(self, s: Session, user_id: str) -> list[Playlist]:
        """Owned, non-system playlists, biggest first."""
        return list(
            s.scalars(
                select(Playlist)
                .where(
                    Playlist.user_id == user_id,
                    Playlist.deleted_at.is_(None),
                    Playlist.owned.is_(True),
                    Playlist.playlist_id.notin_(SYSTEM_PLAYLISTS),
                )
                .order_by(Playlist.track_count.desc())
            ).all()
        )

    def unfiled_video_ids(
        self, s: Session, user_id: str, include_skipped: bool = False
    ) -> list[str]:
        filed = (
            select(PlaylistTrack.video_id)
            .join(
                Playlist,
                (Playlist.user_id == PlaylistTrack.user_id)
                & (Playlist.playlist_id == PlaylistTrack.playlist_id),
            )
            .where(
                PlaylistTrack.user_id == user_id,
                Playlist.deleted_at.is_(None),
                Playlist.owned.is_(True),
                Playlist.playlist_id.notin_(SYSTEM_PLAYLISTS),
            )
        )
        q = select(LikedSong.video_id).where(
            LikedSong.user_id == user_id, LikedSong.video_id.notin_(filed)
        )
        if not include_skipped:
            skipped = select(FilingSkip.video_id).where(FilingSkip.user_id == user_id)
            q = q.where(LikedSong.video_id.notin_(skipped))
        return list(s.scalars(q.order_by(LikedSong.rank)).all())

    # -- filing skips ("not fileable" flags) -----------------------------------

    def add_filing_skips(
        self, s: Session, user_id: str, video_ids: list[str], reason: str | None = None
    ) -> list[str]:
        """Flag tracks as not fileable. Returns the ids actually added (idempotent)."""
        added = []
        for vid in video_ids:
            if s.get(FilingSkip, (user_id, vid)) is None:
                s.add(FilingSkip(user_id=user_id, video_id=vid, reason=reason))
                added.append(vid)
        return added

    def remove_filing_skips(self, s: Session, user_id: str, video_ids: list[str]) -> int:
        result = s.execute(
            delete(FilingSkip).where(
                FilingSkip.user_id == user_id, FilingSkip.video_id.in_(video_ids)
            )
        )
        return result.rowcount

    def filing_skips(self, s: Session, user_id: str) -> list[FilingSkip]:
        return list(
            s.scalars(
                select(FilingSkip)
                .where(FilingSkip.user_id == user_id)
                .order_by(FilingSkip.created_at.desc())
            ).all()
        )

    def summary(self, s: Session, user_id: str) -> dict:
        liked = s.scalar(
            select(func.count()).select_from(LikedSong).where(LikedSong.user_id == user_id)
        )
        playlists = s.scalar(
            select(func.count())
            .select_from(Playlist)
            .where(Playlist.user_id == user_id, Playlist.deleted_at.is_(None))
        )
        unfiled = self.unfiled_video_ids(s, user_id)
        unfiled_all = self.unfiled_video_ids(s, user_id, include_skipped=True)
        last = self.last_ok_sync(s, user_id)
        return {
            "liked": liked,
            "playlists": playlists,
            "unfiled": len(unfiled),
            "skipped": len(unfiled_all) - len(unfiled),
            "last_sync_at": last.finished_at.isoformat() if last and last.finished_at else None,
        }
