#!/usr/bin/env python3
"""
Batch audio analysis script using Essentia.
Analyzes all tracks that haven't been analyzed yet or have an outdated version.

Usage:
    python scripts/analyze-batch.py [--force] [--limit N] [--video-id ID]

Options:
    --force      Re-analyze all tracks regardless of version
    --limit N    Only analyze N tracks
    --video-id   Analyze a specific video ID
"""

import os
import sys
import json
import sqlite3
import subprocess
import argparse
import time
from pathlib import Path

# Algorithm version - increment when changing analysis logic
ALGORITHM_VERSION = 1

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
DB_PATH = PROJECT_DIR / "data" / "cache.db"
AUDIO_CACHE_DIR = PROJECT_DIR / "data" / "audio-cache"

# Rate limiting
DOWNLOAD_DELAY = 2  # seconds between downloads


def get_db_connection():
    """Connect to SQLite database."""
    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        sys.exit(1)
    return sqlite3.connect(DB_PATH)


def get_all_video_ids(conn):
    """Extract all video IDs from liked songs and playlist tracks."""
    video_ids = set()
    cursor = conn.cursor()

    # From liked songs
    cursor.execute("SELECT data FROM liked_songs")
    for row in cursor.fetchall():
        try:
            songs = json.loads(row[0])
            for song in songs:
                if "videoId" in song:
                    video_ids.add(song["videoId"])
        except (json.JSONDecodeError, KeyError):
            pass

    # From playlist tracks
    cursor.execute("SELECT data FROM playlist_tracks")
    for row in cursor.fetchall():
        try:
            tracks = json.loads(row[0])
            for track in tracks:
                if "videoId" in track:
                    video_ids.add(track["videoId"])
        except (json.JSONDecodeError, KeyError):
            pass

    return video_ids


def get_analyzed_ids(conn, version):
    """Get video IDs already analyzed with current or newer version."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT video_id FROM audio_analysis WHERE algorithm_version >= ? AND bpm IS NOT NULL",
        (version,)
    )
    return {row[0] for row in cursor.fetchall()}


def get_video_metadata(conn, video_id):
    """Get title/artist from existing analysis or fetch via yt-dlp."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT title, artist FROM audio_analysis WHERE video_id = ?",
        (video_id,)
    )
    row = cursor.fetchone()
    if row and row[0]:
        return row[0], row[1]

    # Fetch from yt-dlp
    try:
        result = subprocess.run(
            ["yt-dlp", "--no-warnings", "--print", "%(title)s|||%(artist)s|||%(channel)s",
             f"https://www.youtube.com/watch?v={video_id}"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split("|||")
            raw_title = parts[0] if len(parts) > 0 else None
            artist = parts[1] if len(parts) > 1 and parts[1] != "NA" else None
            channel = parts[2] if len(parts) > 2 else None

            # Parse "Artist - Title" format
            title = raw_title
            if not artist:
                artist = channel
            if raw_title and " - " in raw_title:
                split = raw_title.split(" - ", 1)
                if len(split) == 2:
                    artist = split[0].strip()
                    title = split[1].strip()

            return title, artist
    except Exception as e:
        print(f"  Warning: Could not fetch metadata: {e}")

    return None, None


def validate_audio_file(path):
    """Check if audio file is valid using ffprobe."""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=10
        )
        return result.returncode == 0 and result.stdout.strip()
    except Exception:
        return False


def download_audio(video_id, retry=True):
    """Download audio using yt-dlp if not cached."""
    AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = AUDIO_CACHE_DIR / f"{video_id}.mp4"

    if output_path.exists():
        # Validate cached file
        if validate_audio_file(output_path):
            return output_path
        else:
            print(f"  Cached file corrupted, re-downloading...")
            output_path.unlink()

    try:
        subprocess.run(
            ["yt-dlp", "--no-warnings",
             "--extractor-args", "youtube:player_client=android",
             "-f", "18",
             "-o", str(output_path),
             f"https://www.youtube.com/watch?v={video_id}"],
            check=True, timeout=120, capture_output=True
        )
        # Validate downloaded file
        if validate_audio_file(output_path):
            return output_path
        else:
            print(f"  Downloaded file corrupted")
            output_path.unlink()
            return None
    except subprocess.CalledProcessError as e:
        print(f"  Error downloading: {e.stderr.decode() if e.stderr else e}")
        return None
    except subprocess.TimeoutExpired:
        print("  Error: Download timed out")
        # Clean up partial download
        if output_path.exists():
            output_path.unlink()
        return None


def analyze_audio(audio_path):
    """Analyze audio file using Essentia."""
    try:
        import essentia.standard as es
    except ImportError:
        print("Error: Essentia not installed. Run: pip install essentia")
        sys.exit(1)

    features = {
        "bpm": None,
        "key": None,
        "scale": None,
        "energy": None,
        "danceability": None
    }

    try:
        # Load audio
        loader = es.MonoLoader(filename=str(audio_path))
        audio = loader()

        # BPM
        try:
            rhythm_extractor = es.RhythmExtractor2013()
            bpm, *_ = rhythm_extractor(audio)
            features["bpm"] = round(bpm)
        except Exception as e:
            print(f"  Warning: BPM extraction failed: {e}")

        # Key
        try:
            key_extractor = es.KeyExtractor()
            key, scale, strength = key_extractor(audio)
            features["key"] = key
            features["scale"] = scale
        except Exception as e:
            print(f"  Warning: Key extraction failed: {e}")

        # Energy (RMS)
        try:
            rms = es.RMS()
            energy = rms(audio)
            features["energy"] = round(energy * 1000, 1)
        except Exception as e:
            print(f"  Warning: Energy extraction failed: {e}")

        # Danceability
        try:
            danceability = es.Danceability()
            dance_value, *_ = danceability(audio)
            features["danceability"] = round(dance_value * 100)
        except Exception as e:
            print(f"  Warning: Danceability extraction failed: {e}")

    except Exception as e:
        print(f"  Error analyzing audio: {e}")
        return None

    return features


def fetch_lastfm_tags(artist, title):
    """Fetch tags from Last.fm API."""
    if not artist or not title:
        return None

    import urllib.request
    import urllib.parse

    api_key = os.environ.get("LASTFM_API_KEY")
    if not api_key:
        return None

    try:
        params = urllib.parse.urlencode({
            "method": "track.getInfo",
            "api_key": api_key,
            "artist": artist,
            "track": title,
            "format": "json"
        })
        url = f"http://ws.audioscrobbler.com/2.0/?{params}"

        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            if "track" in data and "toptags" in data["track"]:
                tags = data["track"]["toptags"].get("tag", [])
                return [t["name"] for t in tags[:10]]
    except Exception as e:
        print(f"  Warning: Last.fm fetch failed: {e}")

    return None


def save_analysis(conn, video_id, title, artist, features, tags):
    """Save analysis results to database."""
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO audio_analysis
        (video_id, title, artist, bpm, key, scale, energy, danceability, lastfm_tags, algorithm_version, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        video_id,
        title,
        artist,
        features.get("bpm"),
        features.get("key"),
        features.get("scale"),
        features.get("energy"),
        features.get("danceability"),
        json.dumps(tags) if tags else None,
        ALGORITHM_VERSION,
        int(time.time() * 1000)
    ))
    conn.commit()


def main():
    parser = argparse.ArgumentParser(description="Batch audio analysis")
    parser.add_argument("--force", action="store_true", help="Re-analyze all tracks")
    parser.add_argument("--limit", type=int, help="Limit number of tracks to analyze")
    parser.add_argument("--video-id", action="append", dest="video_ids", help="Analyze specific video ID (can be repeated)")
    args = parser.parse_args()

    conn = get_db_connection()

    if args.video_ids:
        video_ids = set(args.video_ids)
    else:
        all_ids = get_all_video_ids(conn)
        if args.force:
            video_ids = all_ids
        else:
            analyzed = get_analyzed_ids(conn, ALGORITHM_VERSION)
            video_ids = all_ids - analyzed

    if args.limit:
        video_ids = set(list(video_ids)[:args.limit])

    total = len(video_ids)
    print(f"Found {total} tracks to analyze (version {ALGORITHM_VERSION})")

    if total == 0:
        print("Nothing to analyze!")
        return

    for i, video_id in enumerate(video_ids, 1):
        print(f"\n[{i}/{total}] Analyzing {video_id}...")

        # Get metadata
        title, artist = get_video_metadata(conn, video_id)
        print(f"  Title: {title}")
        print(f"  Artist: {artist}")

        # Download audio
        audio_path = download_audio(video_id)
        if not audio_path:
            print("  Skipping (download failed)")
            continue

        # Analyze
        features = analyze_audio(audio_path)
        if not features:
            print("  Skipping (analysis failed)")
            continue

        print(f"  BPM: {features.get('bpm')}")
        print(f"  Key: {features.get('key')} {features.get('scale')}")
        print(f"  Energy: {features.get('energy')}")
        print(f"  Danceability: {features.get('danceability')}")

        # Fetch Last.fm tags
        tags = fetch_lastfm_tags(artist, title)
        if tags:
            print(f"  Tags: {', '.join(tags[:5])}")

        # Save
        save_analysis(conn, video_id, title, artist, features, tags)
        print("  Saved!")

        # Rate limit
        if i < total:
            time.sleep(DOWNLOAD_DELAY)

    conn.close()
    print(f"\nDone! Analyzed {total} tracks.")


if __name__ == "__main__":
    main()
