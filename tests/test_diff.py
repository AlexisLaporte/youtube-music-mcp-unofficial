"""Pure diff unit tests."""

from ytmusic_mcp.sync.diff import EventDraft, LibraryState, PlaylistState, diff_library


def pl(tracks, title="P", description=None, privacy=None, owned=True):
    return PlaylistState(
        title=title, description=description, privacy=privacy, owned=owned,
        tracks=frozenset(tracks),
    )


def by_type(events: list[EventDraft]) -> dict[str, EventDraft]:
    out = {}
    for e in events:
        assert e.type not in out, f"duplicate event type in fixture: {e.type}"
        out[e.type] = e
    return out


def test_no_change_is_empty():
    state = LibraryState(liked=("a", "b"), playlists={"P1": pl({"a"})})
    assert diff_library(state, state) == []


def test_likes_set_based():
    db = LibraryState(liked=("a", "b", "c"))
    live = LibraryState(liked=("x", "a", "c"))  # b unliked, x liked (newest first)
    ev = by_type(diff_library(db, live))
    assert ev["like"].video_ids == ["x"]
    assert ev["unlike"].video_ids == ["b"]


def test_playlist_lifecycle():
    db = LibraryState(liked=(), playlists={"OLD": pl({"a"}, title="Old")})
    live = LibraryState(liked=(), playlists={"NEW": pl({"a", "b"}, title="New")})
    ev = by_type(diff_library(db, live))
    assert ev["playlist_create"].playlist_id == "NEW"
    assert ev["playlist_create"].video_ids == ["a", "b"]
    assert ev["playlist_delete"].playlist_id == "OLD"
    assert ev["playlist_delete"].payload == {"title": "Old"}


def test_playlist_edit_and_tracks():
    db = LibraryState(liked=(), playlists={"P": pl({"a", "b"}, title="Avant")})
    live = LibraryState(liked=(), playlists={"P": pl({"b", "c"}, title="Après")})
    ev = by_type(diff_library(db, live))
    assert ev["playlist_edit"].payload == {"title": {"before": "Avant", "after": "Après"}}
    assert ev["tracks_add"].video_ids == ["c"]
    assert ev["tracks_remove"].video_ids == ["a"]
