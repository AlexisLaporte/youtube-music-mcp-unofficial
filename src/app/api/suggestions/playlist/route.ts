/**
 * Playlist-level suggestions API.
 *
 * Algorithm:
 * 1. Take top N tracks from the playlist
 * 2. Fetch suggestions for each (YouTube Mix + Last.fm)
 * 3. Aggregate: count how many playlist tracks suggested the same song
 * 4. Rank by occurrence count (score)
 *
 * Higher score = better fit for the playlist's overall vibe.
 * Excludes tracks already in the playlist.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { cache, SuggestedTrack } from '@/lib/db'

const LASTFM_API_KEY = process.env.LASTFM_API_KEY
const MAX_TRACKS_TO_ANALYZE = 10
const MAX_SUGGESTIONS_PER_TRACK = 5

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

async function fetchYouTubeMix(videoId: string, accessToken: string): Promise<SuggestedTrack[]> {
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      playlistId: `RD${videoId}`,
      maxResults: String(MAX_SUGGESTIONS_PER_TRACK),
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

    if (!response.ok) return []

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
  } catch {
    return []
  }
}

async function searchYouTubeForTrack(artist: string, title: string, accessToken: string): Promise<{ videoId: string; thumbnail?: string } | null> {
  try {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoCategoryId: '10',
      q: `${artist} ${title}`,
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

  const primaryArtist = artist.split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bx\b/i)[0].trim()
  const cleanedTrack = cleanTrackTitle(track)

  try {
    const url = new URL('https://ws.audioscrobbler.com/2.0/')
    url.searchParams.set('method', 'track.getSimilar')
    url.searchParams.set('api_key', LASTFM_API_KEY)
    url.searchParams.set('artist', primaryArtist)
    url.searchParams.set('track', cleanedTrack)
    url.searchParams.set('autocorrect', '1')
    url.searchParams.set('limit', String(MAX_SUGGESTIONS_PER_TRACK))
    url.searchParams.set('format', 'json')

    const response = await fetch(url.toString())
    const data = await response.json()

    const similarTracks = data.similartracks?.track || []

    const results: SuggestedTrack[] = []
    for (const t of similarTracks.slice(0, 3)) {
      const ytResult = await searchYouTubeForTrack(t.artist.name, t.name, accessToken)
      if (ytResult?.videoId) {
        results.push({
          videoId: ytResult.videoId,
          title: t.name,
          artist: t.artist.name,
          thumbnail: ytResult.thumbnail,
        })
      }
    }

    return results
  } catch {
    return []
  }
}

interface TrackInput {
  videoId: string
  title: string
  artist: string
}

interface RankedSuggestion extends SuggestedTrack {
  score: number
  sources: string[]
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { tracks, playlistVideoIds } = body as {
    tracks: TrackInput[]
    playlistVideoIds: string[]
  }

  if (!tracks || !Array.isArray(tracks)) {
    return NextResponse.json({ error: 'tracks array required' }, { status: 400 })
  }

  const playlistSet = new Set(playlistVideoIds || [])
  const suggestionCounts = new Map<string, RankedSuggestion>()

  // Analyze top N tracks
  const tracksToAnalyze = tracks.slice(0, MAX_TRACKS_TO_ANALYZE)

  for (const track of tracksToAnalyze) {
    // Check cache first
    const cached = cache.getSuggestions(track.videoId)
    let suggestions: SuggestedTrack[] = []

    if (cached.data && cached.fresh) {
      suggestions = [...cached.data.youtubeMix, ...cached.data.lastfmSimilar]
    } else {
      // Fetch fresh
      const [ytMix, lastfm] = await Promise.all([
        fetchYouTubeMix(track.videoId, session.accessToken),
        fetchLastfmSimilar(track.artist, track.title, session.accessToken)
      ])
      suggestions = [...ytMix, ...lastfm]

      // Cache for future use
      cache.setSuggestions({
        videoId: track.videoId,
        title: track.title,
        artist: track.artist,
        youtubeMix: ytMix,
        lastfmSimilar: lastfm,
        updatedAt: Date.now()
      })
    }

    // Aggregate suggestions
    for (const suggestion of suggestions) {
      if (!suggestion.videoId || playlistSet.has(suggestion.videoId)) continue

      const existing = suggestionCounts.get(suggestion.videoId)
      if (existing) {
        existing.score++
        if (!existing.sources.includes(track.title)) {
          existing.sources.push(track.title)
        }
      } else {
        suggestionCounts.set(suggestion.videoId, {
          ...suggestion,
          score: 1,
          sources: [track.title]
        })
      }
    }
  }

  // Sort by score and return top results
  const rankedSuggestions = Array.from(suggestionCounts.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)

  return NextResponse.json({
    suggestions: rankedSuggestions,
    analyzedTracks: tracksToAnalyze.length,
    totalSuggestions: suggestionCounts.size
  })
}
