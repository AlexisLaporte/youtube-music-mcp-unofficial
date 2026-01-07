import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cache.db')

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!fs.existsSync(DB_PATH)) {
    return NextResponse.json({ error: 'Database not found' }, { status: 404 })
  }

  const db = new Database(DB_PATH)

  try {
    // Get playlists from JSON data
    const playlistsRow = db.prepare('SELECT data FROM playlists WHERE user_id = ?').get(session.userId) as { data: string } | undefined
    const playlists = playlistsRow ? JSON.parse(playlistsRow.data) : []
    const playlistsCount = Array.isArray(playlists) ? playlists.length : 0

    // Get liked songs from JSON data
    const likedRow = db.prepare('SELECT data FROM liked_songs WHERE user_id = ?').get(session.userId) as { data: string } | undefined
    const likedSongs = likedRow ? JSON.parse(likedRow.data) : []
    const likedSongsCount = Array.isArray(likedSongs) ? likedSongs.length : 0

    // Get all unique tracks from playlist_tracks
    const playlistTracksRows = db.prepare('SELECT playlist_id, data FROM playlist_tracks WHERE user_id = ?').all(session.userId) as { playlist_id: string; data: string }[]

    const allVideoIds = new Set<string>()
    let totalTracksInPlaylists = 0

    for (const row of playlistTracksRows) {
      try {
        const tracks = JSON.parse(row.data) as { videoId: string }[]
        totalTracksInPlaylists += tracks.length
        tracks.forEach(t => allVideoIds.add(t.videoId))
      } catch {
        // ignore parse errors
      }
    }

    // Add liked songs video IDs
    if (Array.isArray(likedSongs)) {
      likedSongs.forEach((s: { videoId: string }) => allVideoIds.add(s.videoId))
    }

    const uniqueTracksCount = allVideoIds.size

    // Get analysis count
    const analysisCount = (db.prepare('SELECT COUNT(*) as count FROM audio_analysis WHERE bpm IS NOT NULL').get() as { count: number }).count

    return NextResponse.json({
      playlistsCount,
      likedSongsCount,
      playlistTracksCount: playlistTracksRows.length,
      totalTracksInPlaylists,
      uniqueTracksCount,
      analysisCount
    })
  } finally {
    db.close()
  }
}
