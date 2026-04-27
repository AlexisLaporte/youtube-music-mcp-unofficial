/**
 * Track enrichment service.
 *
 * Fetches metadata from Last.fm (tags, genres) for tracks in the database.
 * Runs as a background job via the scheduler.
 */
import { tracks } from '@/lib/pg'

const LASTFM_API_KEY = process.env.LASTFM_API_KEY
const BATCH_SIZE = 20
const DELAY_BETWEEN_TRACKS = 200 // ms, to respect rate limits

interface LastFmTrackInfo {
  tags: string[]
  listeners?: number
  playcount?: number
}

/**
 * Fetch track info from Last.fm API
 */
async function fetchLastFmInfo(artist: string, title: string): Promise<LastFmTrackInfo | null> {
  if (!LASTFM_API_KEY) {
    console.warn('[Enrich] LASTFM_API_KEY not configured')
    return null
  }

  // Clean artist name (remove feat, &, etc.)
  const primaryArtist = artist
    .split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bx\b/i)[0]
    .trim()

  // Clean title (remove remix info, video tags, etc.)
  const cleanTitle = title
    .replace(/\s*\([^)]*(?:remix|video|official|audio|lyric)[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*(?:remix|video|official|audio|lyric)[^\]]*\]/gi, '')
    .trim()

  try {
    // Try track.getInfo first
    const trackUrl = new URL('https://ws.audioscrobbler.com/2.0/')
    trackUrl.searchParams.set('method', 'track.getInfo')
    trackUrl.searchParams.set('api_key', LASTFM_API_KEY)
    trackUrl.searchParams.set('artist', primaryArtist)
    trackUrl.searchParams.set('track', cleanTitle)
    trackUrl.searchParams.set('autocorrect', '1')
    trackUrl.searchParams.set('format', 'json')

    const trackResponse = await fetch(trackUrl.toString())
    const trackData = await trackResponse.json()
    const trackInfo = trackData.track

    let tags = trackInfo?.toptags?.tag?.map((t: { name: string }) => t.name) || []

    // Fallback to artist tags if track has no tags
    if (tags.length === 0) {
      const artistUrl = new URL('https://ws.audioscrobbler.com/2.0/')
      artistUrl.searchParams.set('method', 'artist.getTopTags')
      artistUrl.searchParams.set('api_key', LASTFM_API_KEY)
      artistUrl.searchParams.set('artist', primaryArtist)
      artistUrl.searchParams.set('autocorrect', '1')
      artistUrl.searchParams.set('format', 'json')

      const artistResponse = await fetch(artistUrl.toString())
      const artistData = await artistResponse.json()
      tags = artistData?.toptags?.tag?.slice(0, 10).map((t: { name: string }) => t.name) || []
    }

    return {
      tags: tags.slice(0, 10), // Keep top 10 tags
      listeners: trackInfo?.listeners ? parseInt(trackInfo.listeners) : undefined,
      playcount: trackInfo?.playcount ? parseInt(trackInfo.playcount) : undefined,
    }
  } catch (error) {
    console.error('[Enrich] Last.fm API error:', error)
    return null
  }
}

/**
 * Enrich a single track with Last.fm data
 */
async function enrichTrack(track: { video_id: string; title: string | null; artist: string | null }): Promise<boolean> {
  if (!track.artist || !track.title) {
    await tracks.setEnrichmentResult(track.video_id, {
      status: 'skipped',
      error: 'Missing artist or title',
    })
    return false
  }

  try {
    const info = await fetchLastFmInfo(track.artist, track.title)

    if (!info || info.tags.length === 0) {
      await tracks.setEnrichmentResult(track.video_id, {
        status: 'done',
        lastfmTags: [],
      })
      return true
    }

    await tracks.setEnrichmentResult(track.video_id, {
      status: 'done',
      lastfmTags: info.tags,
    })

    return true
  } catch (error) {
    await tracks.setEnrichmentResult(track.video_id, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return false
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Enrich all pending tracks in batches
 */
export async function enrichPendingTracks(): Promise<{
  processed: number
  successful: number
  failed: number
}> {
  console.log('[Enrich] Starting enrichment job...')

  const pendingTracks = await tracks.getForEnrichment(BATCH_SIZE)
  console.log(`[Enrich] Found ${pendingTracks.length} tracks to enrich`)

  let successful = 0
  let failed = 0

  for (const track of pendingTracks) {
    const success = await enrichTrack(track)
    if (success) {
      successful++
    } else {
      failed++
    }

    // Rate limiting
    await sleep(DELAY_BETWEEN_TRACKS)
  }

  console.log(`[Enrich] Completed: ${successful} successful, ${failed} failed`)

  return {
    processed: pendingTracks.length,
    successful,
    failed,
  }
}
