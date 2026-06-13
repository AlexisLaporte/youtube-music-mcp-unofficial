"""LastFmClient: artist/title cleanup and response parsing, network mocked."""

import httpx
import pytest

from ytmusic_mcp.enrichment.lastfm import LastFmClient, clean_title, primary_artist


def test_primary_artist_strips_secondaries():
    assert primary_artist("Daft Punk feat. Pharrell") == "Daft Punk"
    assert primary_artist("Jay-Z & Kanye West") == "Jay-Z"
    assert primary_artist("A, B, C") == "A"
    assert primary_artist("Solo") == "Solo"


def test_clean_title_strips_production_noise():
    assert clean_title("Song (Official Video)") == "Song"
    assert clean_title("Song [Radio Remix]") == "Song"
    assert clean_title("Song (feat. X)") == "Song (feat. X)"  # only known noise words
    assert clean_title("Plain Song") == "Plain Song"


def _client(handler) -> LastFmClient:
    return LastFmClient(api_key="k", http=httpx.Client(transport=httpx.MockTransport(handler)))


def test_track_tags_from_track_info():
    def handler(request):
        assert request.url.params["method"] == "track.getInfo"
        return httpx.Response(
            200, json={"track": {"toptags": {"tag": [{"name": "rock"}, {"name": "80s"}]}}}
        )

    tags, source = _client(handler).track_tags("A", "T")
    assert tags == ["rock", "80s"]
    assert source == "track"


def test_track_tags_falls_back_to_artist():
    calls = []

    def handler(request):
        method = request.url.params["method"]
        calls.append(method)
        if method == "track.getInfo":
            return httpx.Response(200, json={"track": {"toptags": {"tag": []}}})
        return httpx.Response(200, json={"toptags": {"tag": [{"name": "indie"}]}})

    tags, source = _client(handler).track_tags("A", "T")
    assert tags == ["indie"]
    assert source == "artist"
    assert calls == ["track.getInfo", "artist.getTopTags"]


def test_track_tags_single_tag_object():
    """Last.fm degrades 'tag' to a bare object when there is only one."""

    def handler(request):
        return httpx.Response(200, json={"track": {"toptags": {"tag": {"name": "jazz"}}}})

    tags, source = _client(handler).track_tags("A", "T")
    assert tags == ["jazz"]


def test_similar_tracks_parsing():
    def handler(request):
        assert request.url.params["method"] == "track.getSimilar"
        return httpx.Response(
            200,
            json={
                "similartracks": {
                    "track": [
                        {"name": "S1", "artist": {"name": "AR1"}, "match": "0.9"},
                        {"name": "S2", "artist": {"name": "AR2"}, "match": "0.5"},
                    ]
                }
            },
        )

    out = _client(handler).similar_tracks("A", "T")
    assert out == [
        {"name": "S1", "artist": "AR1", "match": 0.9},
        {"name": "S2", "artist": "AR2", "match": 0.5},
    ]


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("LASTFM_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="LASTFM_API_KEY"):
        LastFmClient()
