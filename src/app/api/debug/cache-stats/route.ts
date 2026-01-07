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
    const playlistsCount = (db.prepare('SELECT COUNT(*) as count FROM playlists WHERE user_id = ?').get(session.userId) as { count: number }).count
    const likedSongs = db.prepare('SELECT data FROM liked_songs WHERE user_id = ?').get(session.userId) as { data: string } | undefined
    const likedSongsCount = likedSongs ? JSON.parse(likedSongs.data).length : 0

    const playlistTracks = db.prepare('SELECT playlist_id, data FROM playlist_tracks WHERE user_id = ?').all(session.userId) as { playlist_id: string; data: string }[]
    const tracksCount = playlistTracks.reduce((sum, pt) => sum + JSON.parse(pt.data).length, 0)

    const analysisCount = (db.prepare('SELECT COUNT(*) as count FROM audio_analysis WHERE bpm IS NOT NULL').get() as { count: number }).count

    return NextResponse.json({
      playlistsCount,
      likedSongsCount,
      tracksCount,
      analysisCount
    })
  } finally {
    db.close()
  }
}
