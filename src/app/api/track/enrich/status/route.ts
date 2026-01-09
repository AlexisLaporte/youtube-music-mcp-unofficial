import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/db'

/**
 * Polling endpoint for track enrichment status.
 * Replacements are handled transparently by the cache layer -
 * this route doesn't need to know about them.
 */

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const videoId = request.nextUrl.searchParams.get('v')
  if (!videoId) {
    return NextResponse.json({ error: 'Missing video ID' }, { status: 400 })
  }

  // All cache methods automatically resolve to effective video ID
  const jobStatus = cache.getJobStatus(videoId)

  if (!jobStatus) {
    return NextResponse.json({
      videoId,
      status: 'not_found',
      step: null,
      error: null,
    })
  }

  if (jobStatus.status === 'complete') {
    const analysis = cache.getAudioAnalysis(videoId)
    return NextResponse.json({
      videoId,
      status: 'complete',
      step: null,
      error: null,
      result: analysis ? {
        bpm: analysis.bpm,
        key: analysis.key,
        scale: analysis.scale,
        energy: analysis.energy,
        danceability: analysis.danceability,
        lastfmTags: analysis.lastfmTags,
      } : null,
    })
  }

  return NextResponse.json({
    videoId,
    status: jobStatus.status,
    step: jobStatus.step,
    error: jobStatus.error,
  })
}
