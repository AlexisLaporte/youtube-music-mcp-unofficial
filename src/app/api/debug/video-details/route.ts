import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const ids = searchParams.get('ids') // comma-separated video IDs

  if (!ids) {
    return NextResponse.json({ error: 'ids parameter required' }, { status: 400 })
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics,topicDetails',
      id: ids,
    })

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        { error: `YouTube API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Extract useful fields for each video
    const videos = (data.items || []).map((item: any) => ({
      videoId: item.id,
      title: item.snippet?.title,
      channelTitle: item.snippet?.channelTitle,
      categoryId: item.snippet?.categoryId,
      tags: item.snippet?.tags?.slice(0, 10), // first 10 tags
      duration: item.contentDetails?.duration,
      viewCount: item.statistics?.viewCount,
      likeCount: item.statistics?.likeCount,
      topicCategories: item.topicDetails?.topicCategories?.map((url: string) =>
        url.split('/wiki/').pop()?.replace(/_/g, ' ')
      ),
      // Raw data for inspection
      _raw: {
        snippet: {
          categoryId: item.snippet?.categoryId,
          tags: item.snippet?.tags,
          defaultLanguage: item.snippet?.defaultLanguage,
          defaultAudioLanguage: item.snippet?.defaultAudioLanguage,
        },
        contentDetails: item.contentDetails,
        topicDetails: item.topicDetails,
      }
    }))

    return NextResponse.json({ videos })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
