/**
 * Track suggestions API - combines YouTube Mix and Last.fm similar tracks.
 *
 * YouTube Mix: Undocumented but stable. Playlist ID = "RD" + videoId.
 * Returns ~25 related tracks based on YouTube's algorithm.
 *
 * Last.fm: Uses track.getSimilar API. Returns artist/title pairs,
 * then we search YouTube to get playable videoIds.
 *
 * Results are cached 7 days (suggestions don't change often).
 * Use ?refresh=true to bypass cache.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cache, SuggestedTrack } from '@/lib/db'

const LASTFM_API_KEY = process.env.LASTFM_API_KEY

async function fetchYouTubeMix(videoId: string, accessToken: string): Promise<SuggestedTrack[]> {
  // YouTube Mix playlist ID = "RD" + videoId (undocumented but stable)
  const mixPlaylistId = `RD${videoId}`

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId: mixPlaylistId,
      maxResults: '25',
    })

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.log(`YouTube Mix fetch failed: ${response.status}`)
      return []
    }

    const data = await response.json()

    return (data.items || [])
      .filter((item: { snippet: { resourceId?: { videoId: string }; title: string } }) => {
        const vid = item.snippet.resourceId?.videoId
        return vid && vid !== videoId && item.snippet.title !== 'Deleted video' && item.snippet.title !== 'Private video'
      })
      .map((item: {
        snippet: {
          resourceId: { videoId: string }
          title: string
          videoOwnerChannelTitle?: string
          thumbnails?: { medium?: { url: string }; default?: { url: string } }
        }
      }) => ({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        artist: (item.snippet.videoOwnerChannelTitle || '').replace(/ - Topic$/, ''),
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      }))
  } catch (error) {
    console.error('YouTube Mix error:', error)
    return []
  }
}

function cleanTrackTitle(title: string): string {
  return title
    .replace(/\s*\(Official\s*(Video|Audio|Music Video|Lyric Video|Visualizer)?\)/gi, '')
    .replace(/\s*\[Official\s*(Video|Audio|Music Video|Lyric Video|Visualizer)?\]/gi, '')
    .replace(/\s*\(Lyrics?\)/gi, '')
    .replace(/\s*\[Lyrics?\]/gi, '')
    .replace(/\s*\(HD\)/gi, '')
    .replace(/\s*\(HQ\)/gi, '')
    .replace(/\s*-\s*Topic$/i, '')
    .trim()
}

async function searchYouTubeForTrack(artist: string, title: string, accessToken: string): Promise<{ videoId: string; thumbnail?: string } | null> {
  try {
    const query = `${artist} ${title}`
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoCategoryId: '10',
      q: query,
      maxResults: '1',
    })

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const item = data.items?.[0]
    if (!item) return null

    return {
      videoId: item.id.videoId,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    }
  } catch {
    return null
  }
}

async function fetchLastfmSimilar(artist: string, track: string, accessToken: string): Promise<SuggestedTrack[]> {
  if (!LASTFM_API_KEY) return []

  // Clean artist and track names
  const primaryArtist = artist
    .split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bx\b/i)[0]
    .trim()
  const cleanedTrack = cleanTrackTitle(track)

  try {
    const url = new URL('https://ws.audioscrobbler.com/2.0/')
    url.searchParams.set('method', 'track.getSimilar')
    url.searchParams.set('api_key', LASTFM_API_KEY)
    url.searchParams.set('artist', primaryArtist)
    url.searchParams.set('track', cleanedTrack)
    url.searchParams.set('autocorrect', '1')
    url.searchParams.set('limit', '10')
    url.searchParams.set('format', 'json')

    const response = await fetch(url.toString())
    const data = await response.json()

    const similarTracks = data.similartracks?.track || []

    // Search YouTube for each track (limit to 5 to avoid quota issues)
    const results: SuggestedTrack[] = []
    for (const t of similarTracks.slice(0, 5)) {
      const ytResult = await searchYouTubeForTrack(t.artist.name, t.name, accessToken)
      results.push({
        videoId: ytResult?.videoId || '',
        title: t.name,
        artist: t.artist.name,
        thumbnail: ytResult?.thumbnail || t.image?.find((i: { size: string }) => i.size === 'medium')?.['#text'] || undefined,
      })
    }

    return results.filter(r => r.videoId) // Only return tracks with valid videoIds
  } catch (error) {
    console.error('Last.fm similar error:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const videoId = searchParams.get('videoId')
  const title = searchParams.get('title')
  const artist = searchParams.get('artist')
  const forceRefresh = searchParams.get('refresh') === 'true'

  if (!videoId) {
    return NextResponse.json({ error: 'videoId required' }, { status: 400 })
  }

  // Check cache
  const cached = cache.getSuggestions(videoId)
  if (cached.data && cached.fresh && !forceRefresh) {
    return NextResponse.json({ ...cached.data, cached: true })
  }

  // Fetch fresh data
  const [youtubeMix, lastfmSimilar] = await Promise.all([
    fetchYouTubeMix(videoId, session.accessToken),
    title && artist ? fetchLastfmSimilar(artist, title, session.accessToken) : Promise.resolve([])
  ])

  const suggestions = {
    videoId,
    title: title || null,
    artist: artist || null,
    youtubeMix,
    lastfmSimilar,
    updatedAt: Date.now()
  }

  // Cache results
  cache.setSuggestions(suggestions)

  // If we have stale data, return it merged with fresh (for background refresh pattern)
  return NextResponse.json({ ...suggestions, cached: false })
}
