import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { videoId } = await params

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
      new URLSearchParams({
        part: 'snippet,contentDetails',
        id: videoId,
      }),
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ error: 'YouTube authentication expired' }, { status: 401 })
      }
      return NextResponse.json({ error: 'YouTube API error' }, { status: response.status })
    }

    const data = await response.json()
    const video = data.items?.[0]

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 })
    }

    return NextResponse.json({
      videoId: video.id,
      title: video.snippet.title,
      artist: video.snippet.channelTitle?.replace(/ - Topic$/, '') || video.snippet.channelTitle,
      thumbnail: video.snippet.thumbnails?.maxres?.url
        || video.snippet.thumbnails?.high?.url
        || video.snippet.thumbnails?.medium?.url,
      duration: parseDuration(video.contentDetails.duration),
    })
  } catch (error) {
    console.error('[API] Video info error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch video info' },
      { status: 500 }
    )
  }
}
