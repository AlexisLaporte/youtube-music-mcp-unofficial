"""Library snapshot + append-only history. Portable SQLite (local) / Postgres (hosted).

`user_id` is a plain string: the JWT sub on hosted deployments, "local" on stdio.
`tracks` is a shared metadata cache (no per-user data, no FK — best-effort cache).
"""

from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Integer, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """SQLite returns naive datetimes even for timezone=True columns — they are UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


class Base(DeclarativeBase):
    pass


class Track(Base):
    __tablename__ = "tracks"

    video_id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str | None] = mapped_column(Text)
    artists: Mapped[list | None] = mapped_column(JSON)
    album: Mapped[str | None] = mapped_column(Text)
    duration: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TrackTags(Base):
    """Last.fm genre/mood tags per track — a shared cache like `tracks` (no
    per-user data: a track's tags are global). Enrichment is lazy and bounded;
    `status` lets us skip already-resolved tracks and retry failures."""

    __tablename__ = "track_tags"

    video_id: Mapped[str] = mapped_column(Text, primary_key=True)
    tags: Mapped[list | None] = mapped_column(JSON)  # ["rock", "2000s", …]
    status: Mapped[str] = mapped_column(Text, default="pending")  # pending|done|skipped|failed
    source: Mapped[str | None] = mapped_column(Text)  # "track" | "artist" (where tags came from)
    error: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Playlist(Base):
    __tablename__ = "playlists"

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    playlist_id: Mapped[str] = mapped_column(Text, primary_key=True)
    title: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    privacy: Mapped[str | None] = mapped_column(Text)
    owned: Mapped[bool] = mapped_column(Boolean, default=True)
    track_count: Mapped[int | None] = mapped_column(Integer)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    playlist_id: Mapped[str] = mapped_column(Text, primary_key=True)
    video_id: Mapped[str] = mapped_column(Text, primary_key=True)
    position: Mapped[int | None] = mapped_column(Integer)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LikedSong(Base):
    __tablename__ = "liked_songs"

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    video_id: Mapped[str] = mapped_column(Text, primary_key=True)
    rank: Mapped[int | None] = mapped_column(Integer)  # 0 = most recently liked
    liked_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class FilingSkip(Base):
    """Liked songs flagged "not fileable" (DJ sets, jingles, ambience…): excluded
    from the unfiled audit so they stop resurfacing. Lives outside liked_songs on
    purpose — survives sync rewrites and unlike/re-like cycles."""

    __tablename__ = "filing_skips"

    user_id: Mapped[str] = mapped_column(Text, primary_key=True)
    video_id: Mapped[str] = mapped_column(Text, primary_key=True)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Event(Base):
    """Append-only journal — the source of truth for "what changed since X"."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    user_id: Mapped[str] = mapped_column(Text, index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    source: Mapped[str] = mapped_column(Text)
    # 'tool' (MCP mutation) | 'sync' (detected diff) | 'site' (dashboard action)
    type: Mapped[str] = mapped_column(Text)
    # like | unlike | playlist_create | playlist_edit | playlist_delete | tracks_add | tracks_remove
    playlist_id: Mapped[str | None] = mapped_column(Text)
    video_ids: Mapped[list | None] = mapped_column(JSON)  # one batch = one event
    payload: Mapped[dict | None] = mapped_column(JSON)
    sync_id: Mapped[int | None] = mapped_column(BigInteger().with_variant(Integer, "sqlite"))


class Sync(Base):
    __tablename__ = "syncs"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    user_id: Mapped[str] = mapped_column(Text, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text, default="running")  # running | ok | error
    is_baseline: Mapped[bool] = mapped_column(Boolean, default=False)
    stats: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None] = mapped_column(Text)
