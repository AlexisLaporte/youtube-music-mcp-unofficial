import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cache } from '@/lib/db'
import { YouTubePlaylist } from '@/types/youtube'

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

async function fetchPlaylistsFromYouTube(accessToken: string): Promise<YouTubePlaylist[]> {
  const playlists: YouTubePlaylist[] = []
  let pageToken = ''

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,status',
      mine: 'true',
      maxResults: '50',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const data = await fetchYouTube(`playlists?${params}`, accessToken)

    for (const item of data.items || []) {
      playlists.push({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description || '',
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        trackCount: item.contentDetails.itemCount || 0,
        privacy: item.status.privacyStatus,
        publishedAt: item.snippet.publishedAt,
      })
    }

    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return playlists
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check cache first
    const cached = cache.getPlaylists<YouTubePlaylist[]>(session.userId)

    if (cached.data && cached.fresh) {
      console.log('[API] Returning cached playlists')
      return NextResponse.json({ data: cached.data, fromCache: true })
    }

    // Fetch from YouTube
    console.log('[API] Fetching playlists from YouTube...')
    const playlists = await fetchPlaylistsFromYouTube(session.accessToken)

    // Store in cache
    cache.setPlaylists(session.userId, playlists)
    console.log(`[API] Cached ${playlists.length} playlists`)

    return NextResponse.json({ data: playlists, fromCache: false })
  } catch (error) {
    console.error('[API] Playlists error:', error)

    // If YouTube fails but we have stale cache, return it
    const cached = cache.getPlaylists<YouTubePlaylist[]>(session.userId)
    if (cached.data) {
      console.log('[API] YouTube failed, returning stale cache')
      return NextResponse.json({ data: cached.data, fromCache: true, stale: true })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch playlists' },
      { status: 500 }
    )
  }
}
