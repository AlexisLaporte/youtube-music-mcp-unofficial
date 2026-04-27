import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import {
  getRecommendationsForTrack,
  getRecommendationsForPlaylist,
} from '@/services/recommendationService'

/**
 * GET /api/recommendations
 *
 * Query params:
 * - v: video ID (get recommendations for a track)
 * - playlist: playlist ID (get recommendations for a playlist)
 * - limit: max results (default 20)
 */
export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const videoId = searchParams.get('v')
  const playlistId = searchParams.get('playlist')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  if (!videoId && !playlistId) {
    return NextResponse.json(
      { error: 'Missing v or playlist parameter' },
      { status: 400 }
    )
  }

  try {
    if (videoId) {
      const recommendations = await getRecommendationsForTrack(videoId, limit)
      return NextResponse.json({
        type: 'track',
        sourceId: videoId,
        recommendations: recommendations.map(r => ({
          videoId: r.track.video_id,
          title: r.track.title,
          artist: r.track.artist,
          thumbnail: r.track.thumbnail,
          bpm: r.track.bpm,
          key: r.track.key,
          scale: r.track.scale,
          score: r.score,
          reasons: r.reasons,
        })),
      })
    }

    if (playlistId) {
      const recommendations = await getRecommendationsForPlaylist(playlistId, limit)
      return NextResponse.json({
        type: 'playlist',
        sourceId: playlistId,
        recommendations: recommendations.map(r => ({
          videoId: r.track.video_id,
          title: r.track.title,
          artist: r.track.artist,
          thumbnail: r.track.thumbnail,
          bpm: r.track.bpm,
          key: r.track.key,
          scale: r.track.scale,
          score: r.score,
          reasons: r.reasons,
        })),
      })
    }
  } catch (err) {
    console.error('[API] Recommendations error:', err)
    return NextResponse.json(
      { error: 'Failed to get recommendations' },
      { status: 500 }
    )
  }
}
