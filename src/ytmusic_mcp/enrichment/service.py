"""Enrichment + recommendation logic. No MCP and no network beyond the injected
LastFmClient, so it is unit-testable against an in-memory repo.

Mirrors the previous Next.js product: track.getInfo tags + Jaccard tag
similarity (threshold 0.3, same-artist bonus). Coverage grows lazily — only
already-enriched tracks are candidates, so callers enrich the batch they work on.
"""

import time

ENRICH_PAUSE_S = 0.2  # rate-limit courtesy toward Last.fm
TAG_MATCH_THRESHOLD = 0.3
PLAYLIST_PROFILE_TAGS = 15


def _first_artist(artists) -> str | None:
    """Track.artists is a slim list of names (strings) but tolerate {name} dicts."""
    if not artists:
        return None
    a = artists[0]
    return a.get("name") if isinstance(a, dict) else a


def _tag_similarity(t1: list[str], t2: list[str]) -> float:
    if not t1 or not t2:
        return 0.3  # neutral when one side is unknown (matches the old product)
    s1 = {t.lower() for t in t1}
    s2 = {t.lower() for t in t2}
    union = len(s1 | s2)
    return len(s1 & s2) / union if union else 0.0


def _score(seed_tags, seed_artist, tags, artist) -> dict:
    score = round(_tag_similarity(seed_tags, tags), 2)
    reasons: list[str] = []
    lowered = {t.lower() for t in tags}
    common = [t for t in seed_tags if t.lower() in lowered][:3]
    if common:
        reasons.append(f"Similar style: {', '.join(common)}")
    if seed_artist and artist and seed_artist.lower() == artist.lower():
        reasons.insert(0, "Same artist")
    return {"score": score, "reasons": reasons}


def enrich_tracks(repo, lastfm, video_ids: list[str]) -> dict:
    """Resolve Last.fm tags for the not-yet-done subset of video_ids. Idempotent,
    bounded to the batch, sequential with a small pause (rate-limit friendly).
    Writes results to track_tags and returns counts."""
    with repo.session() as s:
        pending = repo.pending_tag_ids(s, video_ids)
        meta = repo.tracks_meta(s, pending)
    results, enriched, skipped, failed = [], 0, 0, 0
    for i, vid in enumerate(pending):
        m = meta.get(vid, {})
        artist, title = _first_artist(m.get("artists")), m.get("title")
        if not artist or not title:
            results.append(
                {"video_id": vid, "tags": [], "status": "skipped", "error": "missing artist/title"}
            )
            skipped += 1
            continue
        if i and ENRICH_PAUSE_S:
            time.sleep(ENRICH_PAUSE_S)
        try:
            tags, source = lastfm.track_tags(artist, title)
            results.append({"video_id": vid, "tags": tags, "status": "done", "source": source})
            enriched += 1
        except Exception as e:  # network/parse error — recorded, retried next call
            results.append({"video_id": vid, "tags": None, "status": "failed", "error": str(e)})
            failed += 1
    if results:
        with repo.session() as s, s.begin():
            repo.upsert_track_tags(s, results)
    return {
        "requested": len(video_ids),
        "alreadyDone": len(video_ids) - len(pending),
        "enriched": enriched,
        "skipped": skipped,
        "failed": failed,
    }


def similar_in_library(repo, user_id: str, video_id: str, limit: int = 20) -> dict:
    """Library tracks sharing genre tags with the seed (Jaccard, threshold 0.3,
    same-artist bonus). Returns enriched=False when the seed has no tags yet."""
    with repo.session() as s:
        pool = repo.user_enriched_tags(s, user_id)
        seed_tags = repo.track_tags(s, [video_id]).get(video_id, {}).get("tags") or []
        meta = repo.tracks_meta(s, list(set(pool) | {video_id}))
    if not seed_tags:
        return {"seed": video_id, "enriched": False, "tracks": []}
    seed_artist = _first_artist(meta.get(video_id, {}).get("artists"))
    scored = []
    for vid, tags in pool.items():
        if vid == video_id:
            continue
        r = _score(seed_tags, seed_artist, tags, _first_artist(meta.get(vid, {}).get("artists")))
        if r["score"] >= TAG_MATCH_THRESHOLD:
            scored.append((vid, r))
    scored.sort(key=lambda x: x[1]["score"], reverse=True)
    return {
        "seed": video_id,
        "enriched": True,
        "tracks": [
            meta.get(vid, {"videoId": vid}) | {"score": r["score"], "reasons": r["reasons"]}
            for vid, r in scored[:limit]
        ],
    }


def _tag_profile(tag_map: dict[str, dict], top: int = PLAYLIST_PROFILE_TAGS) -> list[str]:
    """Most frequent tags across a set of tracks — the playlist's genre profile."""
    from collections import Counter

    c: Counter = Counter()
    for v in tag_map.values():
        for t in v.get("tags") or []:
            c[t.lower()] += 1
    return [t for t, _ in c.most_common(top)]


def recommend_for_playlist(
    repo, user_id: str, playlist_id: str, playlist_video_ids: list[str], limit: int = 30
) -> dict:
    """Library tracks (not already in the playlist) that fit its genre profile."""
    pl_set = set(playlist_video_ids)
    with repo.session() as s:
        pl_tags = repo.track_tags(s, playlist_video_ids)
        pool = repo.user_enriched_tags(s, user_id)
        meta = repo.tracks_meta(s, list(set(pool) | pl_set))
    profile = _tag_profile(pl_tags)
    if not profile:
        return {"playlistId": playlist_id, "enriched": False, "tracks": []}
    scored = []
    for vid, tags in pool.items():
        if vid in pl_set:
            continue
        score = round(_tag_similarity(profile, tags), 2)
        if score >= TAG_MATCH_THRESHOLD:
            common = [t for t in profile if t in {x.lower() for x in tags}][:3]
            reason = f"Fits playlist genres: {', '.join(common)}" if common else None
            scored.append((vid, score, reason))
    scored.sort(key=lambda x: x[1], reverse=True)
    return {
        "playlistId": playlist_id,
        "enriched": True,
        "profile": profile,
        "tracks": [
            meta.get(vid, {"videoId": vid}) | {"score": score, "reason": reason}
            for vid, score, reason in scored[:limit]
        ],
    }
