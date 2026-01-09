import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/db'

/**
 * Unified track enrichment endpoint.
 * For each video ID, does EVERYTHING:
 * 1. Check if replacement exists (uses cache.getEffectiveVideoId)
 * 2. If no replacement, check availability and find one if needed
 * 3. Run audio analysis on effective video (Python/Essentia)
 *
 * The cache layer handles all resolution transparently - callers
 * don't need to know about replacements.
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

// Spawn Python audio analysis as detached process
function spawnAudioAnalysis(videoId: string): void {
  const scriptPath = path.join(process.cwd(), 'scripts', 'analyze-batch.py')
  const pythonPath = path.join(process.cwd(), 'scripts', 'venv', 'bin', 'python')

  const proc = spawn(pythonPath, [scriptPath, '--video-id', videoId], {
    cwd: process.cwd(),
    env: { ...process.env },
    detached: true,
    stdio: 'ignore',
  })

  proc.unref()
  console.log(`[Enrich] Spawned analysis for ${videoId}`)
}

// Check if video needs a replacement (Topic channels or unavailable)
async function checkNeedsReplacement(
  accessToken: string,
  videoId: string
): Promise<{ needsReplacement: boolean; metadata?: { duration: number; genres: string[]; tags: string[] } }> {
  const params = new URLSearchParams({
    part: 'contentDetails,snippet,topicDetails,status',
    id: videoId,
  })

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    return { needsReplacement: true }
  }

  const data = await response.json()
  const items = data.items || []
  const item = items[0]

  if (!item) {
    return { needsReplacement: true }
  }

  const isPlayable = item.status?.uploadStatus === 'processed' &&
    (item.status?.privacyStatus === 'public' || item.status?.privacyStatus === 'unlisted')

  if (!isPlayable) {
    return { needsReplacement: true }
  }

  // Topic channels often have broken videos that appear "processed"
  const oembed = await getOEmbedData(videoId)
  const isTopicChannel = oembed?.author_name?.endsWith(' - Topic')

  if (isTopicChannel && oembed) {
    const channelId = extractChannelId(oembed.author_url)
    if (channelId) {
      const results = await searchChannelForTitle(accessToken, channelId, oembed.title)
      for (const result of results) {
        if (result.id.videoId !== videoId) {
          const available = await isVideoAvailable(accessToken, result.id.videoId)
          if (available) {
            console.log(`[Enrich] Topic channel: ${videoId} has alternative ${result.id.videoId}`)
            return { needsReplacement: true }
          }
        }
      }
    }
  }

  return {
    needsReplacement: false,
    metadata: {
      duration: parseDuration(item.contentDetails?.duration || 'PT0S'),
      genres: (item.topicDetails?.topicCategories || []).map(parseGenre),
      tags: (item.snippet?.tags || []).slice(0, 20),
    }
  }
}

// Enrich a single track
async function enrichTrack(
  accessToken: string,
  videoId: string
): Promise<{ status: 'accepted' | 'unavailable' | 'error'; videoId: string }> {

  // Get effective video ID (automatically resolves known replacements)
  const effectiveId = cache.getEffectiveVideoId(videoId)
  const hasExistingReplacement = effectiveId !== videoId

  if (hasExistingReplacement) {
    console.log(`[Enrich] ${videoId} → using known replacement ${effectiveId}`)
  }

  // Set job status (automatically stored on effective ID)
  cache.setJobStatus(videoId, 'in_progress', 'yt-metadata')

  // If no existing replacement, check if we need to find one
  if (!hasExistingReplacement) {
    const check = await checkNeedsReplacement(accessToken, videoId)

    if (check.needsReplacement) {
      console.log(`[Enrich] ${videoId} needs replacement`)
      const replacement = await findReplacement(accessToken, videoId)

      if (replacement) {
        // Store the replacement mapping
        cache.setVideoReplacement(videoId, replacement, 'unavailable')
        console.log(`[Enrich] ${videoId} → replaced with ${replacement}`)

        // Fetch and store metadata for replacement
        const replCheck = await checkNeedsReplacement(accessToken, replacement)
        if (replCheck.metadata) {
          cache.setYouTubeMetadata({
            videoId: replacement,
            durationSeconds: replCheck.metadata.duration,
            genres: replCheck.metadata.genres,
            tags: replCheck.metadata.tags,
          })
        }
      } else {
        // No replacement found
        cache.markPermanentlyUnavailable(videoId)
        cache.setJobStatus(videoId, 'error', null, 'Video unavailable, no replacement found')
        return { status: 'unavailable', videoId }
      }
    } else if (check.metadata) {
      // Video is fine, store its metadata
      cache.setYouTubeMetadata({
        videoId,
        durationSeconds: check.metadata.duration,
        genres: check.metadata.genres,
        tags: check.metadata.tags,
      })
    }
  }

  // Spawn audio analysis (uses effective ID via cache resolution)
  const finalEffectiveId = cache.getEffectiveVideoId(videoId)
  cache.setJobStatus(videoId, 'in_progress', 'downloading')
  spawnAudioAnalysis(finalEffectiveId)

  return { status: 'accepted', videoId }
}

// POST - start enrichment (async, returns immediately)
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

  const results: Array<{ status: string; videoId: string }> = []

  for (const videoId of videoIds) {
    const result = await enrichTrack(session.accessToken, videoId)
    results.push(result)
  }

  // Return 202 Accepted - analysis is running in background
  return NextResponse.json({
    accepted: true,
    videoIds: results.map(r => r.videoId),
    results,
  }, { status: 202 })
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
