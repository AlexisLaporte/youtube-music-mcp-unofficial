import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'cache.db')

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const db = new Database(DB_PATH, { readonly: true })

    // Get all enriched video IDs
    const enriched = db.prepare(
      'SELECT video_id FROM audio_analysis WHERE yt_enriched_at IS NOT NULL'
    ).all() as { video_id: string }[]

    // Get all analyzed video IDs (with BPM)
    const analyzed = db.prepare(
      'SELECT video_id FROM audio_analysis WHERE bpm IS NOT NULL'
    ).all() as { video_id: string }[]

    // Get unavailable video IDs (duration = -1)
    const unavailable = db.prepare(
      'SELECT video_id FROM audio_analysis WHERE duration_seconds = -1'
    ).all() as { video_id: string }[]

    db.close()

    return NextResponse.json({
      enrichedIds: enriched.map(r => r.video_id),
      analyzedIds: analyzed.map(r => r.video_id),
      unavailableIds: unavailable.map(r => r.video_id),
    })
  } catch (error) {
    console.error('[Progress] Error:', error)
    return NextResponse.json({ enrichedIds: [], analyzedIds: [] })
  }
}
