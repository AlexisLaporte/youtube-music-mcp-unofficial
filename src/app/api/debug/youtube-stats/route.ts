import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

async function fetchYouTube(endpoint: string, accessToken: string) {
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch playlists
    const playlistsData = await fetchYouTube(
      'playlists?part=snippet,contentDetails&mine=true&maxResults=50',
      session.accessToken
    )

    const playlists = (playlistsData.items || []).map((item: {
      id: string
      snippet: { title: string }
      contentDetails: { itemCount: number }
    }) => ({
      id: item.id,
      title: item.snippet.title,
      trackCount: item.contentDetails.itemCount || 0,
    }))

    // Fetch liked songs count (just first page to get total)
    const likedData = await fetchYouTube(
      'videos?part=id&myRating=like&maxResults=50',
      session.accessToken
    )

    // Get total count by pagination info if available
    let likedSongsCount = (likedData.items || []).length
    let pageToken = likedData.nextPageToken

    // Fetch all pages to get accurate count
    while (pageToken) {
      const nextPage = await fetchYouTube(
        `videos?part=id&myRating=like&maxResults=50&pageToken=${pageToken}`,
        session.accessToken
      )
      likedSongsCount += (nextPage.items || []).length
      pageToken = nextPage.nextPageToken
    }

    return NextResponse.json({
      playlistsCount: playlists.length,
      likedSongsCount,
      playlists,
    })
  } catch (error) {
    console.error('YouTube stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch YouTube data' },
      { status: 500 }
    )
  }
}
