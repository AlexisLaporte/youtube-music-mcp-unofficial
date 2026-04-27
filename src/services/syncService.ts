/**
 * Server-side sync service for YouTube Music data.
 *
 * Handles:
 * - Fetching playlists and tracks from YouTube API
 * - Reconciliation with PostgreSQL database
 * - Content type classification (music vs video)
 * - Scheduling periodic syncs
 */
import { users, playlists, tracks, playlistTracks, syncJobs } from '@/lib/pg'
import type { DbUser, DbTrack } from '@/lib/pg'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

// Refresh OAuth token using refresh_token
async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      console.error('[Sync] Token refresh failed:', await response.text())
      return null
    }

    const data = await response.json()
    return data.access_token
  } catch (err) {
    console.error('[Sync] Token refresh error:', err)
    return null
  }
}

// YouTube API helper
async function youtubeApi<T>(
  accessToken: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T | null> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    console.error(`[Sync] YouTube API error ${endpoint}:`, response.status)
    return null
  }

  return response.json()
}

interface YouTubePlaylistItem {
  id: string
  snippet: {
    title: string
    description: string
    thumbnails?: { medium?: { url: string } }
  }
  contentDetails: {
    itemCount: number
  }
}

interface YouTubePlaylistResponse {
  items: YouTubePlaylistItem[]
  nextPageToken?: string
}

interface YouTubePlaylistItemsResponse {
  items: Array<{
    snippet: {
      title: string
      videoOwnerChannelTitle?: string
      thumbnails?: { medium?: { url: string } }
      resourceId: { videoId: string }
    }
    contentDetails: {
      videoId: string
    }
  }>
  nextPageToken?: string
}

interface YouTubeVideoDetails {
  items: Array<{
    id: string
    contentDetails: { duration: string }
    snippet: { categoryId: string; tags?: string[] }
  }>
}

// Parse ISO 8601 duration to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 3600 + minutes * 60 + seconds
}

// Classify content type based on signals
function classifyContentType(track: {
  durationSeconds?: number
  isTopicChannel?: boolean
  categoryId?: string
  tags?: string[]
}): DbTrack['content_type'] {
  // Topic channels are official YouTube Music releases
  if (track.isTopicChannel) return 'music'

  // Category 10 = Music
  if (track.categoryId === '10') return 'music'

  // Duration heuristics
  if (track.durationSeconds) {
    if (track.durationSeconds < 30) return 'video' // Too short
    if (track.durationSeconds > 900) return 'video' // > 15 min, probably not music
  }

  // Tag-based exclusions
  const excludeTags = ['podcast', 'interview', 'live stream', 'vlog', 'tutorial']
  if (track.tags?.some(t => excludeTags.some(ex => t.toLowerCase().includes(ex)))) {
    return 'video'
  }

  return 'unknown'
}

// Fetch all playlists for a user
async function fetchPlaylists(accessToken: string): Promise<YouTubePlaylistItem[]> {
  const allPlaylists: YouTubePlaylistItem[] = []
  let pageToken: string | undefined

  do {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
    }
    if (pageToken) params.pageToken = pageToken

    const response = await youtubeApi<YouTubePlaylistResponse>(
      accessToken,
      'playlists',
      params
    )

    if (!response) break
    allPlaylists.push(...response.items)
    pageToken = response.nextPageToken
  } while (pageToken)

  return allPlaylists
}

// Fetch all tracks in a playlist
async function fetchPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<Array<{ videoId: string; title: string; artist: string; thumbnail?: string; position: number }>> {
  const allTracks: Array<{
    videoId: string
    title: string
    artist: string
    thumbnail?: string
    position: number
  }> = []
  let pageToken: string | undefined
  let position = 0

  do {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50',
    }
    if (pageToken) params.pageToken = pageToken

    const response = await youtubeApi<YouTubePlaylistItemsResponse>(
      accessToken,
      'playlistItems',
      params
    )

    if (!response) break

    for (const item of response.items) {
      const videoId = item.contentDetails.videoId || item.snippet.resourceId?.videoId
      if (!videoId) continue

      allTracks.push({
        videoId,
        title: item.snippet.title,
        artist: item.snippet.videoOwnerChannelTitle?.replace(' - Topic', '') || '',
        thumbnail: item.snippet.thumbnails?.medium?.url,
        position: position++,
      })
    }

    pageToken = response.nextPageToken
  } while (pageToken)

  return allTracks
}

// Fetch video details for classification
async function fetchVideoDetails(
  accessToken: string,
  videoIds: string[]
): Promise<Map<string, { duration: number; categoryId: string; tags: string[] }>> {
  const result = new Map<string, { duration: number; categoryId: string; tags: string[] }>()

  // Process in batches of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50)
    const response = await youtubeApi<YouTubeVideoDetails>(accessToken, 'videos', {
      part: 'contentDetails,snippet',
      id: batch.join(','),
    })

    if (response) {
      for (const item of response.items) {
        result.set(item.id, {
          duration: parseDuration(item.contentDetails.duration),
          categoryId: item.snippet.categoryId,
          tags: item.snippet.tags || [],
        })
      }
    }
  }

  return result
}

// Main sync function for a user
export async function syncUser(user: DbUser): Promise<{
  success: boolean
  playlistsSynced: number
  tracksAdded: number
  tracksRemoved: number
  error?: string
}> {
  console.log(`[Sync] Starting sync for user ${user.email}`)

  // Check for refresh token
  if (!user.google_refresh_token) {
    return { success: false, playlistsSynced: 0, tracksAdded: 0, tracksRemoved: 0, error: 'No refresh token' }
  }

  // Get fresh access token
  const accessToken = await refreshAccessToken(user.google_refresh_token)
  if (!accessToken) {
    await users.updateSyncState(user.id, { syncError: 'Token refresh failed' })
    return { success: false, playlistsSynced: 0, tracksAdded: 0, tracksRemoved: 0, error: 'Token refresh failed' }
  }

  // Create sync job
  const jobId = await syncJobs.create({ userId: user.id, jobType: 'full' })
  await syncJobs.start(jobId)

  let playlistsSynced = 0
  let totalTracksAdded = 0
  let totalTracksRemoved = 0

  try {
    // Fetch playlists from YouTube
    const ytPlaylists = await fetchPlaylists(accessToken)
    console.log(`[Sync] Found ${ytPlaylists.length} playlists for ${user.email}`)

    const currentPlaylistIds: string[] = []

    for (const ytPlaylist of ytPlaylists) {
      currentPlaylistIds.push(ytPlaylist.id)

      // Upsert playlist
      await playlists.upsert({
        id: ytPlaylist.id,
        userId: user.id,
        title: ytPlaylist.snippet.title,
        description: ytPlaylist.snippet.description,
        thumbnail: ytPlaylist.snippet.thumbnails?.medium?.url,
        trackCount: ytPlaylist.contentDetails.itemCount,
      })

      // Fetch tracks for this playlist
      const playlistTracks_data = await fetchPlaylistTracks(accessToken, ytPlaylist.id)
      console.log(`[Sync] Playlist "${ytPlaylist.snippet.title}": ${playlistTracks_data.length} tracks`)

      // Get video details for new tracks
      const existingTracks = await tracks.getByIds(playlistTracks_data.map(t => t.videoId))
      const existingIds = new Set(existingTracks.map(t => t.video_id))
      const newVideoIds = playlistTracks_data
        .filter(t => !existingIds.has(t.videoId))
        .map(t => t.videoId)

      // Fetch details for new tracks
      let videoDetails = new Map<string, { duration: number; categoryId: string; tags: string[] }>()
      if (newVideoIds.length > 0) {
        videoDetails = await fetchVideoDetails(accessToken, newVideoIds)
      }

      // Upsert tracks
      const tracksToUpsert = playlistTracks_data.map(t => {
        const details = videoDetails.get(t.videoId)
        const isTopicChannel = t.artist.endsWith(' - Topic') || t.artist === ''
        return {
          videoId: t.videoId,
          title: t.title,
          artist: t.artist.replace(' - Topic', ''),
          thumbnail: t.thumbnail,
          durationSeconds: details?.duration,
          isTopicChannel,
        }
      })

      await tracks.upsertBatch(tracksToUpsert)

      // Classify new tracks
      for (const t of tracksToUpsert) {
        if (!existingIds.has(t.videoId)) {
          const details = videoDetails.get(t.videoId)
          const contentType = classifyContentType({
            durationSeconds: t.durationSeconds,
            isTopicChannel: t.isTopicChannel,
            categoryId: details?.categoryId,
            tags: details?.tags,
          })
          if (contentType !== 'unknown') {
            await tracks.setContentType(t.videoId, contentType)
          }
        }
      }

      // Sync playlist-track relationships
      const { added, removed } = await playlistTracks.syncPlaylistTracks(
        ytPlaylist.id,
        playlistTracks_data.map(t => ({ videoId: t.videoId, position: t.position })),
        jobId
      )

      totalTracksAdded += added
      totalTracksRemoved += removed
      playlistsSynced++

      await playlists.updateSyncState(ytPlaylist.id, null)
    }

    // Delete playlists that no longer exist
    const stalePlaylistIds = await playlists.getStalePlaylistIds(user.id, currentPlaylistIds)
    for (const id of stalePlaylistIds) {
      await playlists.delete(id)
    }

    // Update user sync state
    const nextSync = new Date(Date.now() + 6 * 60 * 60 * 1000) // +6 hours
    await users.updateSyncState(user.id, {
      lastSyncAt: new Date(),
      nextSyncAt: nextSync,
      syncError: null,
    })

    await syncJobs.complete(jobId, {
      playlists: playlistsSynced,
      added: totalTracksAdded,
      removed: totalTracksRemoved,
    })

    console.log(`[Sync] Completed for ${user.email}: ${playlistsSynced} playlists, +${totalTracksAdded}/-${totalTracksRemoved} tracks`)

    return {
      success: true,
      playlistsSynced,
      tracksAdded: totalTracksAdded,
      tracksRemoved: totalTracksRemoved,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[Sync] Error for ${user.email}:`, error)

    await syncJobs.fail(jobId, error)
    await users.updateSyncState(user.id, { syncError: error })

    return {
      success: false,
      playlistsSynced,
      tracksAdded: totalTracksAdded,
      tracksRemoved: totalTracksRemoved,
      error,
    }
  }
}

// Sync all users that are due
export async function syncAllDueUsers(): Promise<void> {
  const usersToSync = await users.getUsersToSync()
  console.log(`[Sync] Found ${usersToSync.length} users to sync`)

  for (const user of usersToSync) {
    await syncUser(user)
    // Small delay between users to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}
