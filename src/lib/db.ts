/**
 * SQLite cache layer for YouTube API responses and audio analysis.
 *
 * Why SQLite over Redis/memory:
 * - Persists across restarts (important for analysis results that take hours)
 * - Single-file, no external service needed
 * - WAL mode for concurrent reads during background processing
 *
 * TTL strategy:
 * - Playlists/tracks: 1 hour (user expects fresh data on sync)
 * - Suggestions: 7 days (stable, expensive to fetch)
 * - Audio analysis: no TTL (immutable once computed)
 */
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

  const columns = database.prepare("PRAGMA table_info(audio_analysis)").all() as { name: string }[];
  const columnNames = new Set(columns.map(c => c.name));

  // Migration: Add algorithm_version column if missing
  if (!columnNames.has('algorithm_version') && columns.length > 0) {
    try {
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN algorithm_version INTEGER DEFAULT 1`);
      database.exec(`CREATE INDEX IF NOT EXISTS idx_analysis_version ON audio_analysis(algorithm_version)`);
      console.log('[DB] Migration: added algorithm_version column');
    } catch (err) {
      console.log('[DB] Migration algorithm_version:', err instanceof Error ? err.message : err);
    }
  }

  // Migration: Add YouTube metadata columns
  if (!columnNames.has('duration_seconds') && columns.length > 0) {
    try {
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN duration_seconds INTEGER`);
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN yt_genres JSON`);
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN yt_tags JSON`);
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN yt_enriched_at INTEGER`);
      console.log('[DB] Migration: added YouTube metadata columns');
    } catch (err) {
      console.log('[DB] Migration yt_metadata:', err instanceof Error ? err.message : err);
    }
  }

  // Migration: Add replacement tracking columns
  if (!columnNames.has('replacement_id') && columns.length > 0) {
    try {
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN replacement_id TEXT`);
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN permanently_unavailable INTEGER DEFAULT 0`);
      console.log('[DB] Migration: added replacement tracking columns');
    } catch (err) {
      console.log('[DB] Migration replacement:', err instanceof Error ? err.message : err);
    }
  }

  // Migration: Add job status columns for async enrichment
  if (!columnNames.has('job_status') && columns.length > 0) {
    try {
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN job_status TEXT`);
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN job_step TEXT`);
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN job_error TEXT`);
      database.exec(`ALTER TABLE audio_analysis ADD COLUMN job_started_at INTEGER`);
      console.log('[DB] Migration: added job status columns');
    } catch (err) {
      console.log('[DB] Migration job_status:', err instanceof Error ? err.message : err);
    }
  }

  // Migration: Move replacements to dedicated table
  if (columnNames.has('replacement_id')) {
    try {
      // Check if we have data to migrate
      const count = database.prepare(
        'SELECT COUNT(*) as cnt FROM audio_analysis WHERE replacement_id IS NOT NULL'
      ).get() as { cnt: number };

      if (count.cnt > 0) {
        database.exec(`
          INSERT OR IGNORE INTO video_replacements (original_id, effective_id, reason)
          SELECT video_id, replacement_id, 'unavailable'
          FROM audio_analysis
          WHERE replacement_id IS NOT NULL
        `);
        console.log(`[DB] Migration: moved ${count.cnt} replacements to video_replacements table`);
      }
    } catch (err) {
      console.log('[DB] Migration move_replacements:', err instanceof Error ? err.message : err);
    }
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

    CREATE TABLE IF NOT EXISTS track_suggestions (
      video_id TEXT PRIMARY KEY,
      title TEXT,
      artist TEXT,
      youtube_mix JSON,
      lastfm_similar JSON,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      profile_picture TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

    CREATE TABLE IF NOT EXISTS video_replacements (
      original_id TEXT PRIMARY KEY,
      effective_id TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );
  `);
}

/**
 * Core resolution function: maps original videoId to effective videoId.
 * If the video has been replaced (unavailable), returns the replacement.
 * Otherwise returns the original videoId.
 *
 * This is THE ONLY place where replacement logic should be checked.
 */
function getEffectiveVideoId(videoId: string): string {
  const database = getDb();
  const row = database.prepare(
    'SELECT effective_id FROM video_replacements WHERE original_id = ?'
  ).get(videoId) as { effective_id: string } | undefined;
  return row?.effective_id || videoId;
}

// TTL in milliseconds
const TTL = {
  playlists: 30 * 60 * 1000,      // 30 min
  liked_songs: 5 * 60 * 1000,     // 5 min
  playlist_tracks: 30 * 60 * 1000, // 30 min
  suggestions: 7 * 24 * 60 * 60 * 1000  // 7 days
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
  // YouTube metadata
  durationSeconds?: number | null;
  ytGenres?: string[] | null;
  ytTags?: string[] | null;
  ytEnrichedAt?: number | null;
}

export interface YouTubeMetadata {
  videoId: string;
  durationSeconds: number;
  genres: string[];
  tags: string[];
}

export interface SuggestedTrack {
  videoId: string;
  title: string;
  artist: string;
  thumbnail?: string;
}

export interface TrackSuggestions {
  videoId: string;
  title: string | null;
  artist: string | null;
  youtubeMix: SuggestedTrack[];
  lastfmSimilar: SuggestedTrack[];
  updatedAt: number;
}

export interface UserRecord {
  id: string;
  email: string;
  name?: string;
  profilePicture?: string;
  status: 'pending' | 'approved' | 'blocked';
  createdAt: number;
}

export type JobStatus = 'pending' | 'in_progress' | 'complete' | 'error';
export type JobStep = 'yt-metadata' | 'downloading' | 'analyzing' | 'lastfm' | null;

export interface JobState {
  status: JobStatus;
  step: JobStep;
  error: string | null;
  startedAt: number | null;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  profile_picture: string | null;
  status: string;
  created_at: number;
}

function rowToUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name || undefined,
    profilePicture: row.profile_picture || undefined,
    status: row.status as 'pending' | 'approved' | 'blocked',
    createdAt: row.created_at
  };
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
  duration_seconds: number | null;
  yt_genres: string | null;
  yt_tags: string | null;
  yt_enriched_at: number | null;
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
    // Resolve to effective video ID (handles replacements transparently)
    const effectiveId = getEffectiveVideoId(videoId);

    const row = getDb().prepare(
      'SELECT * FROM audio_analysis WHERE video_id = ?'
    ).get(effectiveId) as AudioAnalysisRow | undefined;

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
  },

  // YouTube metadata enrichment
  setYouTubeMetadata(metadata: YouTubeMetadata): void {
    const database = getDb();
    const now = Date.now();

    // Check if row exists
    const existing = database.prepare('SELECT video_id FROM audio_analysis WHERE video_id = ?').get(metadata.videoId);

    if (existing) {
      database.prepare(`
        UPDATE audio_analysis
        SET duration_seconds = ?, yt_genres = ?, yt_tags = ?, yt_enriched_at = ?
        WHERE video_id = ?
      `).run(
        metadata.durationSeconds,
        JSON.stringify(metadata.genres),
        JSON.stringify(metadata.tags),
        now,
        metadata.videoId
      );
    } else {
      database.prepare(`
        INSERT INTO audio_analysis (video_id, duration_seconds, yt_genres, yt_tags, yt_enriched_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        metadata.videoId,
        metadata.durationSeconds,
        JSON.stringify(metadata.genres),
        JSON.stringify(metadata.tags),
        now,
        now
      );
    }
  },

  getVideoIdsNeedingEnrichment(): string[] {
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

    // Get already enriched video IDs
    const enriched = database.prepare(
      'SELECT video_id FROM audio_analysis WHERE yt_enriched_at IS NOT NULL'
    ).all() as { video_id: string }[];

    const enrichedSet = new Set(enriched.map(r => r.video_id));

    return Array.from(allVideoIds).filter(id => !enrichedSet.has(id));
  },

  getEnrichmentStats() {
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

    // Get enrichment count
    const enrichedCount = (database
      .prepare('SELECT COUNT(*) as count FROM audio_analysis WHERE yt_enriched_at IS NOT NULL')
      .get() as { count: number }).count;

    // Get recently enriched
    const recentEnriched = database
      .prepare(`
        SELECT video_id, title, artist, duration_seconds, yt_genres, yt_enriched_at
        FROM audio_analysis
        WHERE yt_enriched_at IS NOT NULL
        ORDER BY yt_enriched_at DESC
        LIMIT 10
      `)
      .all() as { video_id: string; title: string | null; artist: string | null; duration_seconds: number | null; yt_genres: string | null; yt_enriched_at: number }[];

    return {
      totalTracks,
      enrichedCount,
      pendingCount: totalTracks - enrichedCount,
      recentEnriched: recentEnriched.map(r => ({
        videoId: r.video_id,
        title: r.title,
        artist: r.artist,
        durationSeconds: r.duration_seconds,
        genres: r.yt_genres ? JSON.parse(r.yt_genres) : [],
        enrichedAt: r.yt_enriched_at,
      })),
    };
  },

  // Get unavailable video IDs (duration = -1, not yet resolved)
  getUnavailableVideoIds(): string[] {
    const database = getDb();
    const rows = database.prepare(
      'SELECT video_id FROM audio_analysis WHERE duration_seconds = -1 AND replacement_id IS NULL AND permanently_unavailable = 0'
    ).all() as { video_id: string }[];
    return rows.map(r => r.video_id);
  },

  // Get effective video ID (resolves replacement if any)
  getEffectiveVideoId(videoId: string): string {
    return getEffectiveVideoId(videoId);
  },

  // Set replacement for an unavailable video (stored in video_replacements table)
  setVideoReplacement(originalId: string, effectiveId: string, reason = 'unavailable'): void {
    const database = getDb();
    database.prepare(`
      INSERT OR REPLACE INTO video_replacements (original_id, effective_id, reason, created_at)
      VALUES (?, ?, ?, ?)
    `).run(originalId, effectiveId, reason, Date.now());
  },

  // Check if video has a replacement
  hasReplacement(videoId: string): boolean {
    const database = getDb();
    const row = database.prepare(
      'SELECT 1 FROM video_replacements WHERE original_id = ?'
    ).get(videoId);
    return !!row;
  },

  // Mark video as permanently unavailable (no replacement found)
  markPermanentlyUnavailable(videoId: string): void {
    const database = getDb();
    // Store as self-replacement with reason 'no_replacement' to indicate it's unavailable
    database.prepare(`
      INSERT OR REPLACE INTO video_replacements (original_id, effective_id, reason, created_at)
      VALUES (?, ?, 'no_replacement', ?)
    `).run(videoId, videoId, Date.now());
  },

  // Check if video is permanently unavailable
  isPermanentlyUnavailable(videoId: string): boolean {
    const database = getDb();
    const row = database.prepare(
      "SELECT 1 FROM video_replacements WHERE original_id = ? AND reason = 'no_replacement'"
    ).get(videoId);
    return !!row;
  },

  // Get all replacement mappings (original → effective) - used by resolveTrackIds
  getReplacementMap(): Map<string, string> {
    const database = getDb();
    const rows = database.prepare(
      "SELECT original_id, effective_id FROM video_replacements WHERE reason != 'no_replacement'"
    ).all() as { original_id: string; effective_id: string }[];
    return new Map(rows.map(r => [r.original_id, r.effective_id]));
  },

  // Get all permanently unavailable video IDs
  getPermanentlyUnavailableIds(): Set<string> {
    const database = getDb();
    const rows = database.prepare(
      "SELECT original_id FROM video_replacements WHERE reason = 'no_replacement'"
    ).all() as { original_id: string }[];
    return new Set(rows.map(r => r.original_id));
  },

  // Track suggestions cache
  getSuggestions(videoId: string): CacheResult<TrackSuggestions> {
    const row = getDb().prepare(
      'SELECT * FROM track_suggestions WHERE video_id = ?'
    ).get(videoId) as {
      video_id: string;
      title: string | null;
      artist: string | null;
      youtube_mix: string | null;
      lastfm_similar: string | null;
      updated_at: number;
    } | undefined;

    if (!row) return { data: null, fresh: false };

    const age = Date.now() - row.updated_at;
    return {
      data: {
        videoId: row.video_id,
        title: row.title,
        artist: row.artist,
        youtubeMix: row.youtube_mix ? JSON.parse(row.youtube_mix) : [],
        lastfmSimilar: row.lastfm_similar ? JSON.parse(row.lastfm_similar) : [],
        updatedAt: row.updated_at
      },
      fresh: age < TTL.suggestions
    };
  },

  setSuggestions(suggestions: TrackSuggestions): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO track_suggestions
      (video_id, title, artist, youtube_mix, lastfm_similar, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      suggestions.videoId,
      suggestions.title,
      suggestions.artist,
      JSON.stringify(suggestions.youtubeMix),
      JSON.stringify(suggestions.lastfmSimilar),
      Date.now()
    );
  },

  // User management
  getUser(userId: string): UserRecord | null {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
    return row ? rowToUser(row) : null;
  },

  getUserByEmail(email: string): UserRecord | null {
    const row = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
    return row ? rowToUser(row) : null;
  },

  upsertUser(user: { id: string; email: string; name?: string; profilePicture?: string }): UserRecord {
    const existing = this.getUser(user.id);
    if (existing) {
      // Update name/picture, keep status
      getDb().prepare(`
        UPDATE users SET name = ?, profile_picture = ? WHERE id = ?
      `).run(user.name || null, user.profilePicture || null, user.id);
      return { ...existing, name: user.name, profilePicture: user.profilePicture };
    } else {
      // Insert new user with pending status
      getDb().prepare(`
        INSERT INTO users (id, email, name, profile_picture, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', ?)
      `).run(user.id, user.email, user.name || null, user.profilePicture || null, Date.now());
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePicture: user.profilePicture,
        status: 'pending',
        createdAt: Date.now()
      };
    }
  },

  setUserStatus(userId: string, status: 'pending' | 'approved' | 'blocked'): void {
    getDb().prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId);
  },

  getAllUsers(): UserRecord[] {
    const rows = getDb().prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[];
    return rows.map(rowToUser);
  },

  // Job status tracking for async enrichment
  // All methods use effective video ID transparently
  setJobStatus(videoId: string, status: JobStatus, step: JobStep = null, error: string | null = null): void {
    const database = getDb();
    const effectiveId = getEffectiveVideoId(videoId);
    const now = Date.now();

    // Check if row exists
    const existing = database.prepare('SELECT video_id FROM audio_analysis WHERE video_id = ?').get(effectiveId);

    if (existing) {
      database.prepare(`
        UPDATE audio_analysis
        SET job_status = ?, job_step = ?, job_error = ?, job_started_at = COALESCE(job_started_at, ?)
        WHERE video_id = ?
      `).run(status, step, error, status === 'pending' ? now : null, effectiveId);
    } else {
      database.prepare(`
        INSERT INTO audio_analysis (video_id, job_status, job_step, job_error, job_started_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(effectiveId, status, step, error, status === 'pending' ? now : null, now);
    }
  },

  getJobStatus(videoId: string): JobState | null {
    const effectiveId = getEffectiveVideoId(videoId);

    const row = getDb().prepare(`
      SELECT job_status, job_step, job_error, job_started_at
      FROM audio_analysis WHERE video_id = ?
    `).get(effectiveId) as { job_status: string | null; job_step: string | null; job_error: string | null; job_started_at: number | null } | undefined;

    if (!row || !row.job_status) return null;

    return {
      status: row.job_status as JobStatus,
      step: row.job_step as JobStep,
      error: row.job_error,
      startedAt: row.job_started_at
    };
  },

  clearJobStatus(videoId: string): void {
    const effectiveId = getEffectiveVideoId(videoId);
    getDb().prepare(`
      UPDATE audio_analysis
      SET job_status = NULL, job_step = NULL, job_error = NULL, job_started_at = NULL
      WHERE video_id = ?
    `).run(effectiveId);
  }
};

/**
 * Transform tracks: apply replacements and filter unavailable.
 * Call this before returning track data to the frontend.
 */
export function resolveTrackIds<T extends { videoId: string }>(tracks: T[]): T[] {
  const replacements = cache.getReplacementMap();
  const unavailable = cache.getPermanentlyUnavailableIds();

  return tracks
    .filter(t => !unavailable.has(t.videoId))
    .map(t => {
      const replacement = replacements.get(t.videoId);
      if (replacement) {
        return { ...t, videoId: replacement };
      }
      return t;
    });
}
