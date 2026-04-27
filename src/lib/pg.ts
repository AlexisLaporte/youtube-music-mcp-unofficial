/**
 * PostgreSQL client for ytmusic database on tuls.me.
 *
 * Handles:
 * - Connection pooling
 * - Users, playlists, tracks CRUD
 * - Sync state management
 * - Recommendations queries
 */
import { Pool, PoolClient } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('[PG] Unexpected pool error:', err)
})

// Types
export interface DbUser {
  id: string
  email: string
  name: string | null
  profile_picture: string | null
  status: 'pending' | 'approved' | 'blocked'
  google_refresh_token: string | null
  token_expires_at: Date | null
  sync_enabled: boolean
  last_sync_at: Date | null
  next_sync_at: Date | null
  sync_error: string | null
  created_at: Date
}

export interface DbPlaylist {
  id: string
  user_id: string
  title: string
  description: string | null
  thumbnail: string | null
  track_count: number
  is_liked_playlist: boolean
  yt_etag: string | null
  last_sync_at: Date | null
  created_at: Date
}

export interface DbTrack {
  video_id: string
  title: string | null
  artist: string | null
  thumbnail: string | null
  duration_seconds: number | null
  content_type: 'music' | 'video' | 'unknown'
  is_available: boolean
  replacement_id: string | null
  is_topic_channel: boolean
  bpm: number | null
  key: string | null
  scale: string | null
  energy: number | null
  danceability: number | null
  lastfm_tags: string[]
  yt_genres: string[]
  yt_tags: string[]
  enrichment_status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  enrichment_error: string | null
  enriched_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface DbRecommendation {
  source_id: string
  target_id: string
  score: number
  reasons: string[]
  created_at: Date
}

// Helper to run queries
async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    return result.rows as T[]
  } finally {
    client.release()
  }
}

async function queryOne<T>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] || null
}

// Transaction helper
async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Users
export const users = {
  async getById(id: string): Promise<DbUser | null> {
    return queryOne<DbUser>('SELECT * FROM users WHERE id = $1', [id])
  },

  async getByEmail(email: string): Promise<DbUser | null> {
    return queryOne<DbUser>('SELECT * FROM users WHERE email = $1', [email])
  },

  async upsert(user: {
    id: string
    email: string
    name?: string
    profilePicture?: string
    refreshToken?: string
  }): Promise<DbUser> {
    const sql = `
      INSERT INTO users (id, email, name, profile_picture, google_refresh_token, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = COALESCE($3, users.name),
        profile_picture = COALESCE($4, users.profile_picture),
        google_refresh_token = COALESCE($5, users.google_refresh_token)
      RETURNING *
    `
    const rows = await query<DbUser>(sql, [
      user.id,
      user.email,
      user.name || null,
      user.profilePicture || null,
      user.refreshToken || null,
    ])
    return rows[0]
  },

  async setStatus(id: string, status: DbUser['status']): Promise<void> {
    await query('UPDATE users SET status = $2 WHERE id = $1', [id, status])
  },

  async updateSyncState(id: string, update: {
    lastSyncAt?: Date
    nextSyncAt?: Date
    syncError?: string | null
  }): Promise<void> {
    const sets: string[] = []
    const params: unknown[] = [id]
    let i = 2

    if (update.lastSyncAt !== undefined) {
      sets.push(`last_sync_at = $${i++}`)
      params.push(update.lastSyncAt)
    }
    if (update.nextSyncAt !== undefined) {
      sets.push(`next_sync_at = $${i++}`)
      params.push(update.nextSyncAt)
    }
    if (update.syncError !== undefined) {
      sets.push(`sync_error = $${i++}`)
      params.push(update.syncError)
    }

    if (sets.length > 0) {
      await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1`, params)
    }
  },

  async getUsersToSync(): Promise<DbUser[]> {
    return query<DbUser>(`
      SELECT * FROM users
      WHERE sync_enabled = true
        AND status = 'approved'
        AND (next_sync_at IS NULL OR next_sync_at < NOW())
      ORDER BY last_sync_at ASC NULLS FIRST
      LIMIT 10
    `)
  },

  async getAll(): Promise<DbUser[]> {
    return query<DbUser>('SELECT * FROM users ORDER BY created_at DESC')
  },
}

// Playlists
export const playlists = {
  async getByUser(userId: string): Promise<DbPlaylist[]> {
    return query<DbPlaylist>(
      'SELECT * FROM yt_playlists WHERE user_id = $1 ORDER BY is_liked_playlist DESC, title',
      [userId]
    )
  },

  async upsert(playlist: {
    id: string
    userId: string
    title: string
    description?: string
    thumbnail?: string
    trackCount?: number
    isLikedPlaylist?: boolean
    ytEtag?: string
  }): Promise<DbPlaylist> {
    const sql = `
      INSERT INTO yt_playlists (id, user_id, title, description, thumbnail, track_count, is_liked_playlist, yt_etag, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = $3,
        description = $4,
        thumbnail = COALESCE($5, yt_playlists.thumbnail),
        track_count = COALESCE($6, yt_playlists.track_count),
        yt_etag = $8
      RETURNING *
    `
    const rows = await query<DbPlaylist>(sql, [
      playlist.id,
      playlist.userId,
      playlist.title,
      playlist.description || null,
      playlist.thumbnail || null,
      playlist.trackCount || 0,
      playlist.isLikedPlaylist || false,
      playlist.ytEtag || null,
    ])
    return rows[0]
  },

  async updateSyncState(id: string, etag: string | null): Promise<void> {
    await query(
      'UPDATE yt_playlists SET last_sync_at = NOW(), yt_etag = $2 WHERE id = $1',
      [id, etag]
    )
  },

  async delete(id: string): Promise<void> {
    await query('DELETE FROM yt_playlists WHERE id = $1', [id])
  },

  async getStalePlaylistIds(userId: string, currentIds: string[]): Promise<string[]> {
    if (currentIds.length === 0) {
      const rows = await query<{ id: string }>(
        'SELECT id FROM yt_playlists WHERE user_id = $1',
        [userId]
      )
      return rows.map(r => r.id)
    }
    const rows = await query<{ id: string }>(
      `SELECT id FROM yt_playlists WHERE user_id = $1 AND id != ALL($2)`,
      [userId, currentIds]
    )
    return rows.map(r => r.id)
  },
}

// Tracks
export const tracks = {
  async getById(videoId: string): Promise<DbTrack | null> {
    return queryOne<DbTrack>('SELECT * FROM tracks WHERE video_id = $1', [videoId])
  },

  async getByIds(videoIds: string[]): Promise<DbTrack[]> {
    if (videoIds.length === 0) return []
    return query<DbTrack>('SELECT * FROM tracks WHERE video_id = ANY($1)', [videoIds])
  },

  async upsert(track: {
    videoId: string
    title?: string
    artist?: string
    thumbnail?: string
    durationSeconds?: number
    isTopicChannel?: boolean
  }): Promise<DbTrack> {
    const sql = `
      INSERT INTO tracks (video_id, title, artist, thumbnail, duration_seconds, is_topic_channel, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (video_id) DO UPDATE SET
        title = COALESCE($2, tracks.title),
        artist = COALESCE($3, tracks.artist),
        thumbnail = COALESCE($4, tracks.thumbnail),
        duration_seconds = COALESCE($5, tracks.duration_seconds),
        is_topic_channel = COALESCE($6, tracks.is_topic_channel),
        updated_at = NOW()
      RETURNING *
    `
    const rows = await query<DbTrack>(sql, [
      track.videoId,
      track.title || null,
      track.artist || null,
      track.thumbnail || null,
      track.durationSeconds || null,
      track.isTopicChannel || false,
    ])
    return rows[0]
  },

  async upsertBatch(trackList: Array<{
    videoId: string
    title?: string
    artist?: string
    thumbnail?: string
    durationSeconds?: number
    isTopicChannel?: boolean
  }>): Promise<number> {
    if (trackList.length === 0) return 0

    return withTransaction(async (client) => {
      let count = 0
      for (const track of trackList) {
        await client.query(`
          INSERT INTO tracks (video_id, title, artist, thumbnail, duration_seconds, is_topic_channel, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          ON CONFLICT (video_id) DO UPDATE SET
            title = COALESCE($2, tracks.title),
            artist = COALESCE($3, tracks.artist),
            thumbnail = COALESCE($4, tracks.thumbnail),
            duration_seconds = COALESCE($5, tracks.duration_seconds),
            is_topic_channel = COALESCE($6, tracks.is_topic_channel),
            updated_at = NOW()
        `, [
          track.videoId,
          track.title || null,
          track.artist || null,
          track.thumbnail || null,
          track.durationSeconds || null,
          track.isTopicChannel || false,
        ])
        count++
      }
      return count
    })
  },

  async setContentType(videoId: string, contentType: DbTrack['content_type']): Promise<void> {
    await query(
      'UPDATE tracks SET content_type = $2, updated_at = NOW() WHERE video_id = $1',
      [videoId, contentType]
    )
  },

  async setEnrichmentResult(videoId: string, result: {
    bpm?: number
    key?: string
    scale?: string
    energy?: number
    danceability?: number
    lastfmTags?: string[]
    status: 'done' | 'failed' | 'skipped'
    error?: string
  }): Promise<void> {
    await query(`
      UPDATE tracks SET
        bpm = COALESCE($2, bpm),
        key = COALESCE($3, key),
        scale = COALESCE($4, scale),
        energy = COALESCE($5, energy),
        danceability = COALESCE($6, danceability),
        lastfm_tags = COALESCE($7, lastfm_tags),
        enrichment_status = $8,
        enrichment_error = $9,
        enriched_at = NOW(),
        updated_at = NOW()
      WHERE video_id = $1
    `, [
      videoId,
      result.bpm || null,
      result.key || null,
      result.scale || null,
      result.energy || null,
      result.danceability || null,
      result.lastfmTags ? JSON.stringify(result.lastfmTags) : null,
      result.status,
      result.error || null,
    ])
  },

  async getForEnrichment(limit = 50): Promise<DbTrack[]> {
    return query<DbTrack>(`
      SELECT * FROM tracks
      WHERE enrichment_status = 'pending'
        AND content_type != 'video'
        AND is_available = true
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit])
  },

  async getEnriched(limit = 1000): Promise<DbTrack[]> {
    return query<DbTrack>(`
      SELECT * FROM tracks
      WHERE enrichment_status = 'done'
        AND bpm IS NOT NULL
      LIMIT $1
    `, [limit])
  },
}

// Playlist tracks (join table)
export const playlistTracks = {
  async getByPlaylist(playlistId: string): Promise<(DbTrack & { position: number })[]> {
    return query<DbTrack & { position: number }>(`
      SELECT t.*, pt.position
      FROM tracks t
      JOIN playlist_tracks pt ON pt.video_id = t.video_id
      WHERE pt.playlist_id = $1
        AND pt.removed_at IS NULL
        AND t.content_type IN ('music', 'unknown')
      ORDER BY pt.position
    `, [playlistId])
  },

  async syncPlaylistTracks(
    playlistId: string,
    tracks: Array<{ videoId: string; position: number }>,
    syncId: string
  ): Promise<{ added: number; removed: number }> {
    return withTransaction(async (client) => {
      // Upsert all tracks with current sync_id
      for (const track of tracks) {
        await client.query(`
          INSERT INTO playlist_tracks (playlist_id, video_id, position, sync_id, added_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (playlist_id, video_id) DO UPDATE SET
            position = $3,
            sync_id = $4,
            removed_at = NULL
        `, [playlistId, track.videoId, track.position, syncId])
      }

      // Soft-delete tracks not in this sync
      const deleteResult = await client.query(`
        UPDATE playlist_tracks
        SET removed_at = NOW()
        WHERE playlist_id = $1
          AND sync_id != $2
          AND removed_at IS NULL
        RETURNING video_id
      `, [playlistId, syncId])

      return {
        added: tracks.length,
        removed: deleteResult.rowCount || 0,
      }
    })
  },
}

// Recommendations
export const recommendations = {
  async getForTrack(videoId: string, limit = 20): Promise<(DbTrack & { score: number; reasons: string[] })[]> {
    return query<DbTrack & { score: number; reasons: string[] }>(`
      SELECT t.*, r.score, r.reasons
      FROM recommendations_cache r
      JOIN tracks t ON t.video_id = r.target_id
      WHERE r.source_id = $1
        AND t.content_type = 'music'
        AND t.is_available = true
      ORDER BY r.score DESC
      LIMIT $2
    `, [videoId, limit])
  },

  async upsertBatch(recs: Array<{
    sourceId: string
    targetId: string
    score: number
    reasons: string[]
  }>): Promise<number> {
    if (recs.length === 0) return 0

    return withTransaction(async (client) => {
      for (const rec of recs) {
        await client.query(`
          INSERT INTO recommendations_cache (source_id, target_id, score, reasons, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (source_id, target_id) DO UPDATE SET
            score = $3,
            reasons = $4,
            created_at = NOW()
        `, [rec.sourceId, rec.targetId, rec.score, JSON.stringify(rec.reasons)])
      }
      return recs.length
    })
  },

  async deleteForSource(sourceId: string): Promise<void> {
    await query('DELETE FROM recommendations_cache WHERE source_id = $1', [sourceId])
  },
}

// Sync jobs
export const syncJobs = {
  async create(job: {
    userId: string
    jobType: 'full' | 'playlist' | 'enrichment'
    targetId?: string
  }): Promise<string> {
    const rows = await query<{ id: string }>(`
      INSERT INTO sync_jobs (user_id, job_type, target_id, status, created_at)
      VALUES ($1, $2, $3, 'pending', NOW())
      RETURNING id
    `, [job.userId, job.jobType, job.targetId || null])
    return rows[0].id
  },

  async start(id: string): Promise<void> {
    await query(
      "UPDATE sync_jobs SET status = 'running', started_at = NOW() WHERE id = $1",
      [id]
    )
  },

  async complete(id: string, stats: Record<string, number>): Promise<void> {
    await query(
      "UPDATE sync_jobs SET status = 'completed', completed_at = NOW(), stats = $2 WHERE id = $1",
      [id, JSON.stringify(stats)]
    )
  },

  async fail(id: string, error: string): Promise<void> {
    await query(
      "UPDATE sync_jobs SET status = 'failed', completed_at = NOW(), error = $2 WHERE id = $1",
      [id, error]
    )
  },
}

// Health check
export async function checkConnection(): Promise<boolean> {
  try {
    await query('SELECT 1')
    return true
  } catch {
    return false
  }
}

export { pool, withTransaction }
