"""Enrichment service: idempotent tagging + intra-library Jaccard similarity."""

from ytmusic_mcp.db.models import LikedSong, Track
from ytmusic_mcp.db.repo import Repo
from ytmusic_mcp.enrichment.service import (
    enrich_tracks,
    recommend_for_playlist,
    similar_in_library,
)

UID = "u1"


class FakeLastFm:
    """Returns canned tags per (artist, title); counts calls to assert idempotence."""

    def __init__(self, tags_by_title: dict[str, list[str]]):
        self.tags_by_title = tags_by_title
        self.calls = 0

    def track_tags(self, artist, title):
        self.calls += 1
        return self.tags_by_title.get(title, []), "track"


def make_repo(tracks: dict[str, tuple[str, str]]) -> Repo:
    """tracks: video_id -> (title, artist). All liked by UID."""
    repo = Repo("sqlite://")
    repo.create_all()
    with repo.session() as s, s.begin():
        for i, (vid, (title, artist)) in enumerate(tracks.items()):
            s.add(Track(video_id=vid, title=title, artists=[artist]))
            s.add(LikedSong(user_id=UID, video_id=vid, rank=i))
    return repo


def test_enrich_is_idempotent():
    repo = make_repo({"v1": ("Song1", "A"), "v2": ("Song2", "B")})
    lastfm = FakeLastFm({"Song1": ["rock"], "Song2": ["pop"]})

    stats = enrich_tracks(repo, lastfm, ["v1", "v2"])
    assert stats["enriched"] == 2
    assert lastfm.calls == 2

    # Second pass: everything already done → no Last.fm calls.
    stats = enrich_tracks(repo, lastfm, ["v1", "v2"])
    assert stats["alreadyDone"] == 2
    assert stats["enriched"] == 0
    assert lastfm.calls == 2


def test_enrich_skips_missing_metadata():
    repo = make_repo({"v1": ("Song1", "A")})
    with repo.session() as s, s.begin():
        s.add(Track(video_id="v2", title=None, artists=None))
        s.add(LikedSong(user_id=UID, video_id="v2", rank=1))
    lastfm = FakeLastFm({"Song1": ["rock"]})

    stats = enrich_tracks(repo, lastfm, ["v1", "v2"])
    assert stats["enriched"] == 1
    assert stats["skipped"] == 1


def test_similar_in_library_jaccard_and_artist_bonus():
    repo = make_repo(
        {
            "seed": ("Seed", "A"),
            "close": ("Close", "A"),  # shares tags + same artist
            "mid": ("Mid", "B"),  # shares some tags
            "far": ("Far", "C"),  # no overlap
        }
    )
    lastfm = FakeLastFm(
        {
            "Seed": ["rock", "80s", "guitar"],
            "Close": ["rock", "80s", "guitar"],
            "Mid": ["rock", "pop"],
            "Far": ["jazz", "blues"],
        }
    )
    enrich_tracks(repo, lastfm, ["seed", "close", "mid", "far"])

    result = similar_in_library(repo, UID, "seed", limit=10)
    assert result["enriched"] is True
    vids = [t["videoId"] for t in result["tracks"]]
    assert vids[0] == "close"  # identical tags + same-artist bonus → top
    assert "far" not in vids  # below 0.3 threshold
    assert "Same artist" in result["tracks"][0]["reasons"]


def test_similar_in_library_unenriched_seed():
    repo = make_repo({"seed": ("Seed", "A")})
    result = similar_in_library(repo, UID, "seed", limit=10)
    assert result["enriched"] is False
    assert result["tracks"] == []


def test_recommend_for_playlist_matches_profile():
    repo = make_repo(
        {
            "p1": ("P1", "A"),
            "p2": ("P2", "B"),
            "cand": ("Cand", "C"),  # matches playlist genre
            "other": ("Other", "D"),  # off-genre
        }
    )
    lastfm = FakeLastFm(
        {
            "P1": ["rock", "guitar"],
            "P2": ["rock", "guitar"],
            "Cand": ["rock", "guitar"],
            "Other": ["techno"],
        }
    )
    enrich_tracks(repo, lastfm, ["p1", "p2", "cand", "other"])

    result = recommend_for_playlist(repo, UID, "PL", ["p1", "p2"], limit=10)
    assert result["enriched"] is True
    vids = [t["videoId"] for t in result["tracks"]]
    assert "cand" in vids
    assert "other" not in vids
    assert "p1" not in vids  # already in the playlist
