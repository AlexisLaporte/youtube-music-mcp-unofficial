import { NextResponse } from 'next/server'
import { tracks } from '@/lib/pg'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params

  const track = await tracks.getById(videoId)
  if (!track) {
    return NextResponse.json({ lastfmTags: [] })
  }

  return NextResponse.json({
    lastfmTags: track.lastfm_tags || [],
  })
}
