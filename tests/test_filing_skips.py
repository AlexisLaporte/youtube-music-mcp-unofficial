"""Filing skips ("not fileable" flags): exclusion from the unfiled audit."""

from ytmusic_mcp.db.models import LikedSong, Playlist, PlaylistTrack
from ytmusic_mcp.db.repo import Repo

UID = "u1"


def make_repo() -> Repo:
    repo = Repo("sqlite://")
    repo.create_all()
    with repo.session() as s, s.begin():
        for i, vid in enumerate(["v1", "v2", "v3"]):
            s.add(LikedSong(user_id=UID, video_id=vid, rank=i))
        s.add(Playlist(user_id=UID, playlist_id="p1", title="P1", owned=True, track_count=1))
        s.add(PlaylistTrack(user_id=UID, playlist_id="p1", video_id="v3"))
    return repo


def test_skip_excludes_from_unfiled():
    repo = make_repo()
    with repo.session() as s, s.begin():
        added = repo.add_filing_skips(s, UID, ["v2"], reason="DJ set")
    assert added == ["v2"]
    with repo.session() as s:
        assert repo.unfiled_video_ids(s, UID) == ["v1"]
        assert repo.unfiled_video_ids(s, UID, include_skipped=True) == ["v1", "v2"]
        summary = repo.summary(s, UID)
    assert summary["unfiled"] == 1
    assert summary["skipped"] == 1


def test_skip_is_idempotent_and_reversible():
    repo = make_repo()
    with repo.session() as s, s.begin():
        repo.add_filing_skips(s, UID, ["v1", "v2"])
        added_again = repo.add_filing_skips(s, UID, ["v2"])
    assert added_again == []
    with repo.session() as s, s.begin():
        removed = repo.remove_filing_skips(s, UID, ["v1", "v2", "vX"])
    assert removed == 2
    with repo.session() as s:
        assert repo.unfiled_video_ids(s, UID) == ["v1", "v2"]
        assert repo.summary(s, UID)["skipped"] == 0


def test_skip_survives_sync_rewrite():
    """replace_library wipes liked_songs — the flag must survive."""
    from datetime import datetime, timezone

    from ytmusic_mcp.sync.diff import LibraryState

    repo = make_repo()
    with repo.session() as s, s.begin():
        repo.add_filing_skips(s, UID, ["v2"])
    with repo.session() as s, s.begin():
        repo.replace_library(
            s,
            UID,
            LibraryState(liked=("v1", "v2", "v3"), playlists={}),
            datetime.now(timezone.utc),
        )
    with repo.session() as s:
        assert "v2" not in repo.unfiled_video_ids(s, UID)


def test_skipped_filter_is_per_user():
    repo = make_repo()
    with repo.session() as s, s.begin():
        s.add(LikedSong(user_id="u2", video_id="v2", rank=0))
        repo.add_filing_skips(s, UID, ["v2"])
    with repo.session() as s:
        assert repo.unfiled_video_ids(s, "u2") == ["v2"]
