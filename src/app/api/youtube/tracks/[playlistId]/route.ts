import { NextRequest, NextResponse } from 'next/server'
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

async function fetchPlaylistTracksFromYouTube(
  playlistId: string,
  accessToken: string
): Promise<YouTubeTrack[]> {
  const tracks: YouTubeTrack[] = []
  let pageToken = ''

  do {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const data = await fetchYouTube(`playlistItems?${params}`, accessToken)

    for (const item of data.items || []) {
      if (!item.snippet.resourceId?.videoId) continue

      // Skip deleted or private videos
      const title = item.snippet.title
      if (title === 'Deleted video' || title === 'Private video') continue

      const channelTitle = item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle || ''

      tracks.push({
        id: item.id,
        videoId: item.snippet.resourceId.videoId,
        title,
        artist: channelTitle.replace(/ - Topic$/, ''),
        duration: '',
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        addedAt: item.snippet.publishedAt,
      })
    }

    pageToken = data.nextPageToken || ''
  } while (pageToken)

  return tracks
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { playlistId } = await params

  try {
    // Check cache first
    const cached = cache.getPlaylistTracks<YouTubeTrack[]>(playlistId)

    if (cached.data && cached.fresh) {
      console.log(`[API] Returning cached tracks for playlist ${playlistId}`)
      return NextResponse.json({ data: resolveTrackIds(cached.data), fromCache: true })
    }

    // Fetch from YouTube
    console.log(`[API] Fetching tracks for playlist ${playlistId} from YouTube...`)
    const tracks = await fetchPlaylistTracksFromYouTube(playlistId, session.accessToken)

    // Store in cache
    cache.setPlaylistTracks(playlistId, session.userId, tracks)
    console.log(`[API] Cached ${tracks.length} tracks for playlist ${playlistId}`)

    return NextResponse.json({ data: resolveTrackIds(tracks), fromCache: false })
  } catch (error) {
    console.error(`[API] Tracks error for playlist ${playlistId}:`, error)

    // If YouTube fails but we have stale cache, return it
    const cached = cache.getPlaylistTracks<YouTubeTrack[]>(playlistId)
    if (cached.data) {
      console.log('[API] YouTube failed, returning stale cache')
      return NextResponse.json({ data: resolveTrackIds(cached.data), fromCache: true, stale: true })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tracks' },
      { status: 500 }
    )
  }
}
