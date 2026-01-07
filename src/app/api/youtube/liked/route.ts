import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cache, resolveTrackIds } from '@/lib/db'
import { YouTubeTrack } from '@/types/youtube'

async function fetchYouTube(endpoint: string, accessToken: string) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('YouTube authentication expired')
    }
    throw new Error(`YouTube API error: ${response.status}`)
  }

  return response.json()
}

function parseDuration(duration: string): string {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''

  const hours = match[1] ? parseInt(match[1]) : 0
  const minutes = match[2] ? parseInt(match[2]) : 0
  const seconds = match[3] ? parseInt(match[3]) : 0

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

async function fetchLikedSongsFromYouTube(accessToken: string): Promise<YouTubeTrack[]> {
  const tracks: YouTubeTrack[] = []
  let pageToken = ''

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      myRating: 'like',
      maxResults: '50',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const data = await fetchYouTube(`videos?${params}`, accessToken)

    for (const item of data.items || []) {
      // Filter: Music category (10) or Topic channels (YouTube Music auto-generated)
      const isMusic = item.snippet.categoryId === '10'
      const isTopicChannel = item.snippet.channelTitle?.endsWith(' - Topic')

      if (!isMusic && !isTopicChannel) continue

      tracks.push({
        id: item.id,
        videoId: item.id,
        title: item.snippet.title,
        artist: item.snippet.channelTitle?.replace(/ - Topic$/, '') || item.snippet.channelTitle,
        duration: parseDuration(item.contentDetails.duration),
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        addedAt: item.snippet.publishedAt,
      })
    }

    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return tracks
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check cache first
    const cached = cache.getLikedSongs<YouTubeTrack[]>(session.userId)

    if (cached.data && cached.fresh) {
      console.log('[API] Returning cached liked songs')
      return NextResponse.json({ data: resolveTrackIds(cached.data), fromCache: true })
    }

    // Fetch from YouTube
    console.log('[API] Fetching liked songs from YouTube...')
    const tracks = await fetchLikedSongsFromYouTube(session.accessToken)

    // Store in cache
    cache.setLikedSongs(session.userId, tracks)
    console.log(`[API] Cached ${tracks.length} liked songs`)

    return NextResponse.json({ data: resolveTrackIds(tracks), fromCache: false })
  } catch (error) {
    console.error('[API] Liked songs error:', error)

    // If YouTube fails but we have stale cache, return it
    const cached = cache.getLikedSongs<YouTubeTrack[]>(session.userId)
    if (cached.data) {
      console.log('[API] YouTube failed, returning stale cache')
      return NextResponse.json({ data: resolveTrackIds(cached.data), fromCache: true, stale: true })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch liked songs' },
      { status: 500 }
    )
  }
}
