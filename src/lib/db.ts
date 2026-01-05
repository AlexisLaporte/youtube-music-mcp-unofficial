import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cache.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
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
      updated_at INTEGER NOT NULL
    );
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
      lastfmTags: row.lastfm_tags ? JSON.parse(row.lastfm_tags) : null
    };
  },

  setAudioAnalysis(analysis: AudioAnalysis): void {
    getDb().prepare(`
      INSERT OR REPLACE INTO audio_analysis
      (video_id, title, artist, bpm, key, scale, energy, danceability, lastfm_tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      Date.now()
    );
  }
};
