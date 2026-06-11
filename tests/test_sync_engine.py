"""Sync engine on sqlite with a fake YT client: baseline, diff events,
recent-likes boundary, convergence after tool write-through."""

import pytest
from sqlalchemy import select

from ytmusic_mcp.db.models import Event, LikedSong
from ytmusic_mcp.db.repo import Repo
from ytmusic_mcp.sync.diff import EventDraft
from ytmusic_mcp.sync.engine import SyncTooSoonError, run_sync

from .fake_yt import FakeYT

USER = "u1"


@pytest.fixture
def repo(tmp_path):
    r = Repo(f"sqlite:///{tmp_path}/lib.db")
    r.create_all()
    return r


@pytest.fixture
def yt():
    f = FakeYT()
    f.add_like("v1")
    f.add_like("v2")  # liked order: v2 (newest), v1
    f.set_playlist("P1", "Rock", ["v1"])
    return f


def events_of(repo, types=None):
    with repo.session() as s:
        q = select(Event).where(Event.user_id == USER).order_by(Event.id)
        rows = s.scalars(q).all()
    return [e for e in rows if types is None or e.type in types]


def test_duplicate_liked_video_ids(repo, yt):
    """YT's LM playlist can list the same videoId twice — must not crash the sync."""
    yt.liked.append(dict(yt.liked[0]))  # duplicate of the newest like at the tail
    stats = run_sync(repo, yt, USER)
    assert stats["liked"] == 2  # deduplicated


def test_baseline_imports_without_events(repo, yt):
    stats = run_sync(repo, yt, USER)
    assert stats["baseline"] is True
    assert stats["liked"] == 2 and stats["playlists"] == 1
    assert events_of(repo) == []
    with repo.session() as s:
        assert repo.unfiled_video_ids(s, USER) == ["v2"]  # v1 filed in P1


def test_second_sync_emits_diff_events(repo, yt):
    run_sync(repo, yt, USER)
    yt.add_like("v3")
    yt.remove_like("v1")
    yt.set_playlist("P1", "Rock classique", ["v1", "v3"])
    yt.set_playlist("P2", "Nouveau", ["v2"])

    stats = run_sync(repo, yt, USER, force=True)
    assert stats["baseline"] is False
    types = {e.type for e in events_of(repo)}
    assert types == {"like", "unlike", "playlist_edit", "tracks_add", "playlist_create"}
    like = events_of(repo, ["like"])[0]
    assert like.video_ids == ["v3"] and like.source == "sync"


def test_sync_rate_limited(repo, yt):
    run_sync(repo, yt, USER)
    with pytest.raises(SyncTooSoonError):
        run_sync(repo, yt, USER)
    run_sync(repo, yt, USER, force=True)


def test_recent_likes_boundary(repo, yt):
    """liked_seen_at > previous-sync boundary ⇒ only the likes the latest sync saw."""
    run_sync(repo, yt, USER)  # baseline: v1, v2
    yt.add_like("v9")
    run_sync(repo, yt, USER, force=True)

    with repo.session() as s:
        prev = repo.previous_ok_sync(s, USER)
        fresh = s.scalars(
            select(LikedSong).where(
                LikedSong.user_id == USER, LikedSong.liked_seen_at > prev.finished_at
            )
        ).all()
    assert [r.video_id for r in fresh] == ["v9"]


def test_tool_write_through_converges(repo, yt):
    """A mutation recorded by write-through is NOT re-detected by the next sync."""
    run_sync(repo, yt, USER)

    # simulate the tool: YT applied + write-through (snapshot + event source=tool)
    yt.add_like("v5")
    with repo.session() as s, s.begin():
        s.add(LikedSong(user_id=USER, video_id="v5", rank=-1))
        repo.add_event(s, USER, EventDraft(type="like", video_ids=["v5"]), source="tool")

    run_sync(repo, yt, USER, force=True)
    likes = events_of(repo, ["like"])
    assert len(likes) == 1 and likes[0].source == "tool"  # no duplicate 'sync' event


def test_ensure_fresh_baseline_then_skip(repo, yt):
    from datetime import timedelta
    from ytmusic_mcp.sync.engine import ensure_fresh

    # 1st contact: no snapshot → baseline runs
    stats = ensure_fresh(repo, yt, USER, timedelta(hours=12))
    assert stats and stats["baseline"] is True
    with repo.session() as s:
        assert repo.last_ok_sync(s, USER) is not None

    # fresh enough → no sync
    assert ensure_fresh(repo, yt, USER, timedelta(hours=12)) is None


def test_ensure_fresh_refreshes_when_stale(repo, yt):
    from datetime import timedelta
    from sqlalchemy import update
    from ytmusic_mcp.sync.engine import ensure_fresh
    from ytmusic_mcp.db.models import Sync, utcnow

    ensure_fresh(repo, yt, USER, timedelta(hours=12))  # baseline
    # age the sync artificially (20 min ago) and shorten TTL to 10 min
    with repo.session() as s, s.begin():
        s.execute(update(Sync).values(finished_at=utcnow() - timedelta(minutes=20)))
    yt.add_like("vNEW")
    stats = ensure_fresh(repo, yt, USER, timedelta(minutes=10))
    assert stats is not None and stats["baseline"] is False
    ev = events_of(repo, ["like"])
    assert ev and ev[-1].video_ids == ["vNEW"]
