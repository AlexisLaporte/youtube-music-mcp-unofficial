/**
 * Music recommendation engine based on Last.fm tags.
 *
 * Similarity scoring:
 * - Tags: 100% weight (Jaccard similarity)
 * - Same artist bonus: bumped to top of reasons
 */
import { tracks, recommendations, playlistTracks } from '@/lib/pg'
import type { DbTrack } from '@/lib/pg'

function tagSimilarity(tags1: string[], tags2: string[]): number {
  if (!tags1.length || !tags2.length) return 0.3

  const set1 = new Set(tags1.map(t => t.toLowerCase()))
  const set2 = new Set(tags2.map(t => t.toLowerCase()))

  const intersection = [...set1].filter(t => set2.has(t)).length
  const union = new Set([...set1, ...set2]).size

  return union > 0 ? intersection / union : 0
}

interface ScoredTrack {
  track: DbTrack
  score: number
  reasons: string[]
}

// Calculate similarity between two tracks based on Last.fm tags
export function calculateSimilarity(source: DbTrack, target: DbTrack): ScoredTrack {
  const reasons: string[] = []

  // Tags similarity (100%)
  const tagScore = tagSimilarity(source.lastfm_tags || [], target.lastfm_tags || [])

  if (tagScore >= 0.3) {
    const commonTags = (source.lastfm_tags || [])
      .filter(t => (target.lastfm_tags || []).map(x => x.toLowerCase()).includes(t.toLowerCase()))
      .slice(0, 3)
    if (commonTags.length > 0) {
      reasons.push(`Similar style: ${commonTags.join(', ')}`)
    }
  }

  // Same artist bonus
  if (source.artist && target.artist &&
      source.artist.toLowerCase() === target.artist.toLowerCase()) {
    reasons.unshift(`Same artist`)
  }

  return {
    track: target,
    score: Math.round(tagScore * 100) / 100,
    reasons,
  }
}

// Get recommendations for a single track
export async function getRecommendationsForTrack(
  videoId: string,
  limit = 20
): Promise<ScoredTrack[]> {
  // Check cache first
  const cached = await recommendations.getForTrack(videoId, limit)
  if (cached.length > 0) {
    return cached.map(c => ({
      track: c,
      score: c.score,
      reasons: c.reasons,
    }))
  }

  // Get source track
  const source = await tracks.getById(videoId)
  if (!source || source.enrichment_status !== 'done') {
    return []
  }

  // Get all enriched tracks
  const allTracks = await tracks.getEnriched(2000)

  // Calculate similarity scores
  const scored = allTracks
    .filter(t => t.video_id !== videoId)
    .map(t => calculateSimilarity(source, t))
    .filter(s => s.score >= 0.3) // Minimum threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  // Cache results
  if (scored.length > 0) {
    await recommendations.upsertBatch(
      scored.map(s => ({
        sourceId: videoId,
        targetId: s.track.video_id,
        score: s.score,
        reasons: s.reasons,
      }))
    )
  }

  return scored
}

// Get recommendations for a playlist (aggregate of all tracks)
export async function getRecommendationsForPlaylist(
  playlistId: string,
  limit = 30
): Promise<ScoredTrack[]> {
  // Get playlist tracks
  const playlistTracksData = await playlistTracks.getByPlaylist(playlistId)
  if (playlistTracksData.length === 0) return []

  // Get enriched tracks from playlist
  const enrichedPlaylistTracks = playlistTracksData.filter(
    t => t.enrichment_status === 'done' && t.lastfm_tags && t.lastfm_tags.length > 0
  )

  if (enrichedPlaylistTracks.length === 0) return []

  // Aggregate tags
  const tagCounts = new Map<string, number>()
  for (const t of enrichedPlaylistTracks) {
    for (const tag of t.lastfm_tags || []) {
      tagCounts.set(tag.toLowerCase(), (tagCounts.get(tag.toLowerCase()) || 0) + 1)
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag)

  // Create a "virtual" source track representing the playlist
  const playlistProfile: DbTrack = {
    video_id: `playlist:${playlistId}`,
    title: 'Playlist Profile',
    artist: null,
    thumbnail: null,
    duration_seconds: null,
    content_type: 'music',
    is_available: true,
    replacement_id: null,
    is_topic_channel: false,
    bpm: null,
    key: null,
    scale: null,
    energy: null,
    danceability: null,
    lastfm_tags: topTags,
    yt_genres: [],
    yt_tags: [],
    enrichment_status: 'done',
    enrichment_error: null,
    enriched_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  }

  // Get all enriched tracks
  const allTracks = await tracks.getEnriched(2000)

  // Exclude tracks already in the playlist
  const playlistVideoIds = new Set(playlistTracksData.map(t => t.video_id))

  // Calculate similarity scores
  const scored = allTracks
    .filter(t => !playlistVideoIds.has(t.video_id))
    .map(t => calculateSimilarity(playlistProfile, t))
    .filter(s => s.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return scored
}

// Batch compute recommendations for all enriched tracks (background job)
export async function computeAllRecommendations(): Promise<number> {
  const enrichedTracks = await tracks.getEnriched(2000)
  console.log(`[Reco] Computing recommendations for ${enrichedTracks.length} tracks`)

  let count = 0
  for (const source of enrichedTracks) {
    // Clear old recommendations
    await recommendations.deleteForSource(source.video_id)

    // Calculate new ones
    const scored = enrichedTracks
      .filter(t => t.video_id !== source.video_id)
      .map(t => calculateSimilarity(source, t))
      .filter(s => s.score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50) // Store top 50 per track

    if (scored.length > 0) {
      await recommendations.upsertBatch(
        scored.map(s => ({
          sourceId: source.video_id,
          targetId: s.track.video_id,
          score: s.score,
          reasons: s.reasons,
        }))
      )
      count += scored.length
    }
  }

  console.log(`[Reco] Stored ${count} recommendations`)
  return count
}
