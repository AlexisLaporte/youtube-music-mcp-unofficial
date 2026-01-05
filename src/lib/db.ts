import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cache.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
    runMigrations();
  }
  return db;
}

function runMigrations() {
  const database = db!;

  // Migration: Add algorithm_version column if missing
  try {
    const columns = database.prepare("PRAGMA table_info(audio_analysis)").all() as { name: string }[];
    const hasVersion = columns.some(col => col.name === 'algorithm_version');

    if (!hasVersion && columns.length > 0) {
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN algorithm_version INTEGER DEFAULT 1`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_analysis_version ON audio_analysis(algorithm_version)`);
      console.log('[DB] Migration: added algorithm_version column');
    }
  } catch (err) {
    // Column might already exist - that's fine
    console.log('[DB] Migration check:', err instanceof Error ? err.message : err);
  }
}

function initSchema() {
  const database = db!;

  database.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data JSON NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS liked_songs (
      user_id TEXT PRIMARY KEY,
      data JSON NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlist_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      data JSON NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_user ON playlist_tracks(user_id);

    CREATE TABLE IF NOT EXISTS audio_analysis (
      video_id TEXT PRIMARY KEY,
      title TEXT,
      artist TEXT,
      bpm INTEGER,
      key TEXT,
      scale TEXT,
      energy REAL,
      danceability REAL,
      lastfm_tags JSON,
      algorithm_version INTEGER DEFAULT 1,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_version ON audio_analysis(algorithm_version);
  `);
}

// TTL in milliseconds
const TTL = {
  playlists: 30 * 60 * 1000,      // 30 min
  liked_songs: 5 * 60 * 1000,     // 5 min
  playlist_tracks: 30 * 60 * 1000  // 30 min
};

export interface CacheResult<T> {
  data: T | null;
  fresh: boolean;
}

export interface AudioAnalysis {
  videoId: string;
  title: string | null;
  artist: string | null;
  bpm: number | null;
  key: string | null;
  scale: string | null;
  energy: number | null;
  danceability: number | null;
  lastfmTags: string[] | null;
  algorithmVersion?: number;
}

interface AudioAnalysisRow {
  video_id: string;
  title: string | null;
  artist: string | null;
  bpm: number | null;
  key: string | null;
  scale: string | null;
  energy: number | null;
  danceability: number | null;
  lastfm_tags: string | null;
  algorithm_version: number | null;
  updated_at: number;
}

export const cache = {
  getPlaylists<T>(userId: string): CacheResult<T> {
    const row = getDb().prepare(
      'SELECT data, updated_at FROM playlists WHERE user_id = ?'
    ).get(userId) as { data: string; updated_at: number } | undefined;

    if (!row) return { data: null, fresh: false };

    const age = Date.now() - row.updated_at;
    return {
      data: JSON.parse(row.data),
      fresh: age < TTL.playlists
    };
  },

  setPlaylists<T>(userId: string, data: T): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO playlists (id, user_id, data, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, userId, JSON.stringify(data), Date.now());
  },

  getLikedSongs<T>(userId: string): CacheResult<T> {
    const row = getDb().prepare(
      'SELECT data, updated_at FROM liked_songs WHERE user_id = ?'
    ).get(userId) as { data: string; updated_at: number } | undefined;

    if (!row) return { data: null, fresh: false };

    const age = Date.now() - row.updated_at;
    return {
      data: JSON.parse(row.data),
      fresh: age < TTL.liked_songs
    };
  },

  setLikedSongs<T>(userId: string, data: T): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO liked_songs (user_id, data, updated_at)
      VALUES (?, ?, ?)
    `).run(userId, JSON.stringify(data), Date.now());
  },

  getPlaylistTracks<T>(playlistId: string): CacheResult<T> {
    const row = getDb().prepare(
      'SELECT data, updated_at FROM playlist_tracks WHERE playlist_id = ?'
    ).get(playlistId) as { data: string; updated_at: number } | undefined;

    if (!row) return { data: null, fresh: false };

    const age = Date.now() - row.updated_at;
    return {
      data: JSON.parse(row.data),
      fresh: age < TTL.playlist_tracks
    };
  },

  setPlaylistTracks<T>(playlistId: string, userId: string, data: T): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO playlist_tracks (playlist_id, user_id, data, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(playlistId, userId, JSON.stringify(data), Date.now());
  },

  invalidateUser(userId: string): void {
    const database = getDb();
    database.prepare('DELETE FROM playlists WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM liked_songs WHERE user_id = ?').run(userId);
    database.prepare('DELETE FROM playlist_tracks WHERE user_id = ?').run(userId);
  },

  invalidatePlaylist(playlistId: string): void {
    getDb().prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(playlistId);
  },

  getAudioAnalysis(videoId: string): AudioAnalysis | null {
    const row = getDb().prepare(
      'SELECT * FROM audio_analysis WHERE video_id = ?'
    ).get(videoId) as AudioAnalysisRow | undefined;

    if (!row) return null;

    return {
      videoId: row.video_id,
      title: row.title,
      artist: row.artist,
      bpm: row.bpm,
      key: row.key,
      scale: row.scale,
      energy: row.energy,
      danceability: row.danceability,
      lastfmTags: row.lastfm_tags ? JSON.parse(row.lastfm_tags) : null,
      algorithmVersion: row.algorithm_version ?? 1
    };
  },

  setAudioAnalysis(analysis: AudioAnalysis): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO audio_analysis
      (video_id, title, artist, bpm, key, scale, energy, danceability, lastfm_tags, algorithm_version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      analysis.videoId,
      analysis.title,
      analysis.artist,
      analysis.bpm,
      analysis.key,
      analysis.scale,
      analysis.energy,
      analysis.danceability,
      analysis.lastfmTags ? JSON.stringify(analysis.lastfmTags) : null,
      analysis.algorithmVersion ?? 1,
      Date.now()
    );
  },

  // Get all video IDs that need analysis (no analysis or outdated version)
  getVideoIdsNeedingAnalysis(currentVersion: number): string[] {
    const database = getDb();

    // Get all video IDs from liked songs and playlists
    const likedRows = database.prepare('SELECT data FROM liked_songs').all() as { data: string }[];
    const trackRows = database.prepare('SELECT data FROM playlist_tracks').all() as { data: string }[];

    const allVideoIds = new Set<string>();

    // Extract video IDs from liked songs
    for (const row of likedRows) {
      try {
        const songs = JSON.parse(row.data) as { videoId: string }[];
        songs.forEach(s => allVideoIds.add(s.videoId));
      } catch { /* ignore */ }
    }

    // Extract video IDs from playlist tracks
    for (const row of trackRows) {
      try {
        const tracks = JSON.parse(row.data) as { videoId: string }[];
        tracks.forEach(t => allVideoIds.add(t.videoId));
      } catch { /* ignore */ }
    }

    // Filter out those already analyzed with current version
    const analyzed = database.prepare(
      'SELECT video_id FROM audio_analysis WHERE algorithm_version >= ? AND bpm IS NOT NULL'
    ).all(currentVersion) as { video_id: string }[];

    const analyzedSet = new Set(analyzed.map(r => r.video_id));

    return Array.from(allVideoIds).filter(id => !analyzedSet.has(id));
  },

  getAnalysisStats() {
    const database = getDb();

    // Get all video IDs from liked songs and playlists
    const likedRows = database.prepare('SELECT data FROM liked_songs').all() as { data: string }[];
    const trackRows = database.prepare('SELECT data FROM playlist_tracks').all() as { data: string }[];

    const allVideoIds = new Set<string>();

    for (const row of likedRows) {
      try {
        const songs = JSON.parse(row.data) as { videoId: string }[];
        songs.forEach(s => allVideoIds.add(s.videoId));
      } catch { /* ignore */ }
    }

    for (const row of trackRows) {
      try {
        const tracks = JSON.parse(row.data) as { videoId: string }[];
        tracks.forEach(t => allVideoIds.add(t.videoId));
      } catch { /* ignore */ }
    }

    const totalTracks = allVideoIds.size;

    // Get analysis counts
    const analyzedCount = database
      .prepare('SELECT COUNT(*) as count FROM audio_analysis WHERE bpm IS NOT NULL')
      .get() as { count: number };

    // Get version breakdown
    const versionBreakdown = database
      .prepare(
        'SELECT algorithm_version, COUNT(*) as count FROM audio_analysis WHERE bpm IS NOT NULL GROUP BY algorithm_version ORDER BY algorithm_version DESC'
      )
      .all() as { algorithm_version: number | null; count: number }[];

    // Get recent analyses
    const recentAnalyses = database
      .prepare(
        'SELECT video_id, title, artist, bpm, algorithm_version, updated_at FROM audio_analysis WHERE bpm IS NOT NULL ORDER BY updated_at DESC LIMIT 20'
      )
      .all() as { video_id: string; title: string | null; artist: string | null; bpm: number | null; algorithm_version: number | null; updated_at: number }[];

    // Get pending video IDs
    const analyzedIds = new Set(
      (database
        .prepare('SELECT video_id FROM audio_analysis WHERE bpm IS NOT NULL')
        .all() as { video_id: string }[]
      ).map(r => r.video_id)
    );

    const pendingIds = Array.from(allVideoIds).filter(id => !analyzedIds.has(id));

    return {
      totalTracks,
      analyzedCount: analyzedCount.count,
      pendingCount: pendingIds.length,
      versionBreakdown: versionBreakdown.map(v => ({
        version: v.algorithm_version ?? 1,
        count: v.count,
      })),
      recentAnalyses: recentAnalyses.map(r => ({
        videoId: r.video_id,
        title: r.title,
        artist: r.artist,
        bpm: r.bpm,
        version: r.algorithm_version ?? 1,
        updatedAt: r.updated_at,
      })),
      pendingIds: pendingIds.slice(0, 50),
    };
  }
};
