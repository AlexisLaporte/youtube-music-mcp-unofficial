"""Last.fm-powered tools, registered only with storage + LASTFM_API_KEY:
genre tags (for clustering), intra-library similarity, external discovery and
playlist completion. Enrichment is triggered here, never inside sync."""

from typing import Literal

from sqlalchemy import select

from ..db.models import LikedSong, PlaylistTrack
from ..enrichment.service import (
    _first_artist,
    enrich_tracks,
    similar_in_library,
)
from ..enrichment.service import recommend_for_playlist as _recommend_for_playlist
from ..ytclient import slim_track


def register(mcp, deps) -> None:
    repo = deps.repo

    @mcp.tool
    def track_tags(video_ids: list[str]) -> dict:
        """Genre/mood tags (Last.fm) for tracks — enriches any not-yet-resolved
        ones first (bounded to this batch), then returns them. Use this to cluster
        liked songs by genre BEFORE filing them. Batch: pass all videoIds at once."""
        stats = enrich_tracks(repo, deps.get_lastfm(), video_ids)
        with repo.session() as s:
            tags = repo.track_tags(s, video_ids)
        return {"stats": stats, "tags": tags}

    @mcp.tool
    def similar_tracks(
        video_id: str,
        source: Literal["library", "discover"] = "library",
        limit: int = 20,
    ) -> dict:
        """Tracks similar to a seed.

        source="library": songs already in YOUR library sharing genre tags
          (re-grouping). Enrich the library first (track_tags / recommend_for_playlist)
          — only enriched tracks are candidates.
        source="discover": NEW tracks from Last.fm not yet in your library, resolved
          to YouTube Music videoIds. PROPOSE only — never like/add without explicit
          user approval."""
        lastfm = deps.get_lastfm()
        if source == "library":
            enrich_tracks(repo, lastfm, [video_id])  # ensure the seed itself has tags
            return similar_in_library(repo, deps.user_id(), video_id, limit)
        return _discover(deps, lastfm, video_id, limit)

    @mcp.tool
    def recommend_for_playlist(playlist_id: str, limit: int = 30) -> dict:
        """Suggest liked songs that fit a playlist's genre profile but aren't in it
        yet. Tag-enriches the playlist's own tracks first (bounded), then matches
        against your other library tracks. Propose, get approval, then add_tracks."""
        user_id = deps.user_id()
        with repo.session() as s:
            pl_vids = list(
                s.scalars(
                    select(PlaylistTrack.video_id).where(
                        PlaylistTrack.user_id == user_id,
                        PlaylistTrack.playlist_id == playlist_id,
                    )
                ).all()
            )
        if not pl_vids:
            raise ValueError(
                f"playlist {playlist_id} has no tracks in the snapshot (sync first?)"
            )
        enrich_tracks(repo, deps.get_lastfm(), pl_vids)
        return _recommend_for_playlist(repo, user_id, playlist_id, pl_vids, limit)


def _discover(deps, lastfm, video_id: str, limit: int) -> dict:
    repo = deps.repo
    with repo.session() as s:
        seed = repo.tracks_meta(s, [video_id]).get(video_id)
    if not seed or not seed.get("title"):
        raise ValueError(f"unknown seed track {video_id} (not in snapshot)")
    artist = _first_artist(seed.get("artists")) or ""
    candidates = lastfm.similar_tracks(artist, seed["title"], limit=limit)

    with repo.session() as s:
        liked = set(
            s.scalars(
                select(LikedSong.video_id).where(LikedSong.user_id == deps.user_id())
            ).all()
        )
    yt = deps.get_yt()
    out = []
    for c in candidates:
        hits = yt.search(f"{c['artist']} {c['name']}", filter="songs", limit=1)
        if not hits:
            continue
        vid = hits[0].get("videoId")
        if not vid or vid in liked:
            continue
        out.append(
            slim_track(hits[0])
            | {"match": c["match"], "reason": f"Last.fm similar (match {c['match']:.2f})"}
        )
    return {"seed": video_id, "count": len(out), "tracks": out}
