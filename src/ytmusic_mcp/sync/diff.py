"""Pure diff between the stored library state and the live one.

No I/O: unit-testable on fixtures. Set-based (likes can disappear, playlists
can be deleted) — never a prefix comparison.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class PlaylistState:
    title: str | None
    description: str | None
    privacy: str | None
    owned: bool
    tracks: frozenset[str]


@dataclass(frozen=True)
class LibraryState:
    liked: tuple[str, ...]  # video_ids, most recently liked first
    playlists: dict[str, PlaylistState] = field(default_factory=dict)


@dataclass
class EventDraft:
    type: str
    playlist_id: str | None = None
    video_ids: list[str] | None = None
    payload: dict | None = None


def diff_library(db: LibraryState, live: LibraryState) -> list[EventDraft]:
    events: list[EventDraft] = []

    new_likes = [v for v in live.liked if v not in set(db.liked)]
    gone_likes = [v for v in db.liked if v not in set(live.liked)]
    if new_likes:
        events.append(EventDraft(type="like", video_ids=new_likes))
    if gone_likes:
        events.append(EventDraft(type="unlike", video_ids=gone_likes))

    for pid, pl in live.playlists.items():
        old = db.playlists.get(pid)
        if old is None:
            events.append(
                EventDraft(
                    type="playlist_create",
                    playlist_id=pid,
                    video_ids=sorted(pl.tracks),
                    payload={"title": pl.title, "privacy": pl.privacy},
                )
            )
            continue
        changed = {
            k: {"before": getattr(old, k), "after": getattr(pl, k)}
            for k in ("title", "description", "privacy")
            if getattr(old, k) != getattr(pl, k)
        }
        if changed:
            events.append(EventDraft(type="playlist_edit", playlist_id=pid, payload=changed))
        added = sorted(pl.tracks - old.tracks)
        removed = sorted(old.tracks - pl.tracks)
        if added:
            events.append(EventDraft(type="tracks_add", playlist_id=pid, video_ids=added))
        if removed:
            events.append(EventDraft(type="tracks_remove", playlist_id=pid, video_ids=removed))

    for pid, old in db.playlists.items():
        if pid not in live.playlists:
            events.append(
                EventDraft(type="playlist_delete", playlist_id=pid, payload={"title": old.title})
            )

    return events
