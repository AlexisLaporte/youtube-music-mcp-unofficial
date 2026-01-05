import { NextRequest, NextResponse } from 'next/server'
import { cache } from '@/lib/db'
import { getSession } from '@/lib/auth'

interface PlaylistScore {
  playlistId: string
  score: number
  matchedTags: string[]
  reason: string
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const videoId = request.nextUrl.searchParams.get('v')
  if (!videoId) {
    return NextResponse.json({ error: 'Missing video ID' }, { status: 400 })
  }

  // Get the target song's analysis
  const songAnalysis = cache.getAudioAnalysis(videoId)
  if (!songAnalysis) {
    return NextResponse.json({ suggestions: [], reason: 'no_analysis' })
  }

  const songTags = songAnalysis.lastfmTags || []
  const songBpm = songAnalysis.bpm
  const songEnergy = songAnalysis.energy
  const songDanceability = songAnalysis.danceability

  // Get all playlists for this user
  const playlistsCache = cache.getPlaylists<Array<{ id: string; title: string }>>(session.userId)
  if (!playlistsCache.data) {
    return NextResponse.json({ suggestions: [], reason: 'no_playlists' })
  }

  const playlists = playlistsCache.data
  const scores: PlaylistScore[] = []

  for (const playlist of playlists) {
    // Get tracks for this playlist
    const tracksCache = cache.getPlaylistTracks<Array<{ videoId: string }>>(playlist.id)
    if (!tracksCache.data || tracksCache.data.length === 0) continue

    let tagScore = 0
    let audioScore = 0
    let matchCount = 0
    const matchedTags = new Set<string>()

    for (const track of tracksCache.data) {
      const trackAnalysis = cache.getAudioAnalysis(track.videoId)
      if (!trackAnalysis) continue

      matchCount++

      // Tag similarity
      const trackTags = trackAnalysis.lastfmTags || []
      for (const tag of songTags) {
        if (trackTags.some(t => t.toLowerCase() === tag.toLowerCase())) {
          tagScore += 1
          matchedTags.add(tag)
        }
      }

      // Audio similarity (BPM within 10, energy/danceability within 20%)
      if (songBpm && trackAnalysis.bpm) {
        const bpmDiff = Math.abs(songBpm - trackAnalysis.bpm)
        if (bpmDiff <= 10) audioScore += 2
        else if (bpmDiff <= 20) audioScore += 1
      }

      if (songEnergy !== null && trackAnalysis.energy !== null) {
        const energyDiff = Math.abs(songEnergy - trackAnalysis.energy)
        if (energyDiff <= 10) audioScore += 1
        else if (energyDiff <= 20) audioScore += 0.5
      }

      if (songDanceability !== null && trackAnalysis.danceability !== null) {
        const danceDiff = Math.abs(songDanceability - trackAnalysis.danceability)
        if (danceDiff <= 10) audioScore += 1
        else if (danceDiff <= 20) audioScore += 0.5
      }
    }

    if (matchCount === 0) continue

    // Normalize scores
    const normalizedTagScore = tagScore / Math.max(matchCount, 1)
    const normalizedAudioScore = audioScore / Math.max(matchCount, 1)
    const totalScore = normalizedTagScore * 2 + normalizedAudioScore // Tags weighted more

    if (totalScore > 0) {
      let reason = ''
      if (matchedTags.size > 0) {
        reason = `Genres: ${Array.from(matchedTags).slice(0, 3).join(', ')}`
      } else if (audioScore > 0) {
        reason = 'Profil audio similaire'
      }

      scores.push({
        playlistId: playlist.id,
        score: totalScore,
        matchedTags: Array.from(matchedTags),
        reason,
      })
    }
  }

  // Sort by score and return top 5
  scores.sort((a, b) => b.score - a.score)
  const suggestions = scores.slice(0, 5)

  return NextResponse.json({ suggestions })
}
