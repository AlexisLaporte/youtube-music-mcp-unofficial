import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/db'

/**
 * Unified track enrichment endpoint.
 * For each video ID, does EVERYTHING:
 * 1. Fetch YT metadata (duration, genres, tags)
 * 2. If unavailable, search for replacement
 * 3. Run audio analysis (Python/Essentia)
 */

interface OEmbedResponse {
  title: string
  author_name: string
  author_url: string
}

interface YouTubeSearchItem {
  id: { videoId: string }
  snippet: { title: string }
}

function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

function parseGenre(url: string): string {
  const match = url.match(/\/wiki\/(.+)$/)
  if (!match) return url
  return decodeURIComponent(match[1]).replace(/_/g, ' ')
}

function extractChannelId(authorUrl: string): string | null {
  const match = authorUrl.match(/\/channel\/([^/]+)$/)
  return match ? match[1] : null
}

async function getOEmbedData(videoId: string): Promise<OEmbedResponse | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    )
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function searchChannelForTitle(
  accessToken: string,
  channelId: string,
  title: string
): Promise<YouTubeSearchItem[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    q: title,
    type: 'video',
    maxResults: '5',
  })

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) return []
  const data = await res.json()
  return data.items || []
}

async function isVideoAvailable(accessToken: string, videoId: string): Promise<boolean> {
  const params = new URLSearchParams({ part: 'status', id: videoId })
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )
  if (!res.ok) return false
  const data = await res.json()
  return data.items && data.items.length > 0
}

async function findReplacement(
  accessToken: string,
  videoId: string
): Promise<string | null> {
  const oembed = await getOEmbedData(videoId)
  if (!oembed) return null

  const channelId = extractChannelId(oembed.author_url)
  if (!channelId) return null

  const results = await searchChannelForTitle(accessToken, channelId, oembed.title)

  for (const item of results) {
    if (item.id.videoId === videoId) continue
    const available = await isVideoAvailable(accessToken, item.id.videoId)
    if (available) return item.id.videoId
  }

  return null
}

// Run Python audio analysis for a single video
function runAudioAnalysis(videoId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'analyze-batch.py')
    const pythonPath = path.join(process.cwd(), 'scripts', 'venv', 'bin', 'python')

    const proc = spawn(pythonPath, [scriptPath, '--video-id', videoId], {
      cwd: process.cwd(),
      env: { ...process.env },
    })

    proc.stdout?.on('data', (data: Buffer) => {
      console.log(`[Analysis ${videoId}]`, data.toString().trim())
    })

    proc.stderr?.on('data', (data: Buffer) => {
      console.error(`[Analysis ${videoId} Error]`, data.toString().trim())
    })

    proc.on('close', (code) => {
      resolve(code === 0)
    })

    proc.on('error', () => {
      resolve(false)
    })
  })
}

// Enrich a single track: YT metadata + replacement + audio analysis
async function enrichTrack(
  accessToken: string,
  videoId: string
): Promise<{ status: 'enriched' | 'replaced' | 'unavailable' | 'error'; videoId: string; replacementId?: string }> {

  // Step 1: Get YT metadata
  const params = new URLSearchParams({
    part: 'contentDetails,snippet,topicDetails',
    id: videoId,
  })

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    return { status: 'error', videoId }
  }

  const data = await response.json()
  const items = data.items || []

  let effectiveVideoId = videoId

  if (items.length === 0) {
    // Video unavailable - try to find replacement
    cache.setYouTubeMetadata({
      videoId,
      durationSeconds: -1,
      genres: [],
      tags: [],
    })

    const replacement = await findReplacement(accessToken, videoId)

    if (replacement) {
      cache.setReplacement(videoId, replacement)
      effectiveVideoId = replacement
      console.log(`[Enrich] Replaced ${videoId} with ${replacement}`)

      // Get metadata for replacement
      const replParams = new URLSearchParams({
        part: 'contentDetails,snippet,topicDetails',
        id: replacement,
      })
      const replResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?${replParams}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (replResponse.ok) {
        const replData = await replResponse.json()
        if (replData.items?.length > 0) {
          const item = replData.items[0]
          cache.setYouTubeMetadata({
            videoId: replacement,
            durationSeconds: parseDuration(item.contentDetails?.duration || 'PT0S'),
            genres: (item.topicDetails?.topicCategories || []).map(parseGenre),
            tags: (item.snippet?.tags || []).slice(0, 20),
          })
        }
      }
    } else {
      cache.markPermanentlyUnavailable(videoId)
      return { status: 'unavailable', videoId }
    }
  } else {
    // Video available - store metadata
    const item = items[0]
    cache.setYouTubeMetadata({
      videoId,
      durationSeconds: parseDuration(item.contentDetails?.duration || 'PT0S'),
      genres: (item.topicDetails?.topicCategories || []).map(parseGenre),
      tags: (item.snippet?.tags || []).slice(0, 20),
    })
  }

  // Step 2: Run audio analysis on effective video ID
  await runAudioAnalysis(effectiveVideoId)

  if (effectiveVideoId !== videoId) {
    return { status: 'replaced', videoId, replacementId: effectiveVideoId }
  }

  return { status: 'enriched', videoId }
}

// POST - enrich tracks one by one
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const videoIds: string[] = body.videoIds || []

  if (videoIds.length === 0) {
    return NextResponse.json({ error: 'No videoIds provided' }, { status: 400 })
  }

  // Process one at a time
  const results: Array<{ status: string; videoId: string; replacementId?: string }> = []

  for (const videoId of videoIds) {
    const result = await enrichTrack(session.accessToken, videoId)
    results.push(result)
  }

  return NextResponse.json({
    results,
    enriched: results.filter(r => r.status === 'enriched').length,
    replaced: results.filter(r => r.status === 'replaced').length,
    unavailable: results.filter(r => r.status === 'unavailable').length,
    errors: results.filter(r => r.status === 'error').length,
  })
}

// GET - get enrichment stats
export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats = cache.getEnrichmentStats()
  const analysisStats = cache.getAnalysisStats()

  return NextResponse.json({
    ...stats,
    analyzedCount: analysisStats.analyzedCount,
    pendingAnalysis: analysisStats.pendingCount,
  })
}
