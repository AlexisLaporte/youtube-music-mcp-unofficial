"""Last.fm API client: genre/mood tags and similar tracks.

A single application API key (LASTFM_API_KEY) — Last.fm read methods need no
per-user auth. The artist/title cleanup and response parsing are pure functions
so they can be unit-tested without the network.
"""

import os
import re

import httpx

API_ROOT = "https://ws.audioscrobbler.com/2.0/"
MAX_TAGS = 10

# Drop secondary artists ("A feat. B", "A & B", "A x B", "A, B") — keep the primary.
_ARTIST_SPLIT = re.compile(r"[,&]|\bfeat\.?\b|\bft\.?\b|\bx\b", re.IGNORECASE)
# Drop parenthetical/bracketed production noise ("(Official Video)", "[Remix]"…).
_TITLE_NOISE = re.compile(
    r"\s*[\(\[][^)\]]*(?:remix|video|official|audio|lyric)[^)\]]*[\)\]]", re.IGNORECASE
)


def primary_artist(artist: str) -> str:
    return _ARTIST_SPLIT.split(artist)[0].strip()


def clean_title(title: str) -> str:
    return _TITLE_NOISE.sub("", title).strip()


def _tag_names(toptags) -> list[str]:
    """Extract tag names from a Last.fm toptags block (which degrades to a bare
    object when there is a single tag)."""
    if not isinstance(toptags, dict):
        return []
    tags = toptags.get("tag") or []
    if isinstance(tags, dict):
        tags = [tags]
    return [t["name"] for t in tags if isinstance(t, dict) and t.get("name")]


class LastFmClient:
    def __init__(self, api_key: str | None = None, http: httpx.Client | None = None):
        self.api_key = api_key or os.environ.get("LASTFM_API_KEY")
        if not self.api_key:
            raise RuntimeError("LASTFM_API_KEY required for Last.fm enrichment")
        self._http = http or httpx.Client(timeout=10.0)

    def _get(self, method: str, **params) -> dict:
        params |= {
            "method": method,
            "api_key": self.api_key,
            "format": "json",
            "autocorrect": "1",
        }
        r = self._http.get(API_ROOT, params=params)
        r.raise_for_status()
        return r.json()

    def track_tags(self, artist: str, title: str) -> tuple[list[str], str | None]:
        """Top genre/mood tags for a track, falling back to the artist's top tags.
        Returns (tags, source) where source is 'track' | 'artist' | None."""
        art, ttl = primary_artist(artist), clean_title(title)
        data = self._get("track.getInfo", artist=art, track=ttl)
        tags = _tag_names((data.get("track") or {}).get("toptags"))
        if tags:
            return tags[:MAX_TAGS], "track"
        data = self._get("artist.getTopTags", artist=art)
        tags = _tag_names(data.get("toptags"))
        return (tags[:MAX_TAGS], "artist") if tags else ([], None)

    def similar_tracks(self, artist: str, title: str, limit: int = 20) -> list[dict]:
        """External tracks similar to a seed (track.getSimilar). Each entry:
        {name, artist, match} where match is Last.fm's 0..1 similarity."""
        art, ttl = primary_artist(artist), clean_title(title)
        data = self._get("track.getSimilar", artist=art, track=ttl, limit=limit)
        out = []
        for t in (data.get("similartracks") or {}).get("track", []) or []:
            name = t.get("name")
            t_artist = (t.get("artist") or {}).get("name")
            if name and t_artist:
                out.append(
                    {"name": name, "artist": t_artist, "match": float(t.get("match") or 0)}
                )
        return out
