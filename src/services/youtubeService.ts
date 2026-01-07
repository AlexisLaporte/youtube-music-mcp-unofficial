import { YouTubePlaylist, YouTubeTrack, PlaylistAnalysis } from '@/types/youtube'

export interface SearchResult extends YouTubeTrack {
  channelTitle: string
  publishedAt: string
}

class YouTubeService {
  private readonly PROVIDER_TOKEN_KEY = 'youtube_provider_token'

  // Get provider token from localStorage
  getProviderToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.PROVIDER_TOKEN_KEY)
    }
    return null
  }

  private async fetchYouTube(endpoint: string, options: RequestInit = {}) {
    const token = this.getProviderToken()
    if (!token) {
      throw new Error('No YouTube access token available')
    }

    const response = await fetch(`https://www.googleapis.com/youtube/v3/${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('YouTube authentication expired. Please sign in again.')
      }
      throw new Error(`YouTube API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getPlaylists(): Promise<YouTubePlaylist[]> {
    console.log('📋 Fetching playlists...')
    const playlists: YouTubePlaylist[] = []
    let pageToken = ''

    do {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails,status',
        mine: 'true',
        maxResults: '50',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const data = await this.fetchYouTube(`playlists?${params}`)

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

    console.log(`✅ Fetched ${playlists.length} playlists`)
    return playlists
  }

  async searchVideos(query: string, maxResults = 20): Promise<SearchResult[]> {
    console.log(`🔍 Searching for: ${query}`)

    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      videoCategoryId: '10', // Music category
      q: query,
      maxResults: String(maxResults),
    })

    const data = await this.fetchYouTube(`search?${params}`)

    const results: SearchResult[] = (data.items || []).map((item: {
      id: { videoId: string }
      snippet: {
        title: string
        channelTitle: string
        thumbnails?: { medium?: { url: string }, default?: { url: string } }
        publishedAt: string
      }
    }) => ({
      id: item.id.videoId,
      videoId: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle.replace(' - Topic', ''),
      channelTitle: item.snippet.channelTitle,
      duration: '', // Not available in search results
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      publishedAt: item.snippet.publishedAt,
    }))

    console.log(`✅ Found ${results.length} results`)
    return results
  }

  async getLikedSongs(musicOnly = true): Promise<YouTubeTrack[]> {
    console.log('❤️ Fetching liked songs...')
    const tracks: YouTubeTrack[] = []
    let pageToken = ''

    do {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        myRating: 'like',
        maxResults: '50',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const data = await this.fetchYouTube(`videos?${params}`)

      for (const item of data.items || []) {
        // Filter: Music category (10) or Topic channels (YouTube Music auto-generated)
        const isMusic = item.snippet.categoryId === '10'
        const isTopicChannel = item.snippet.channelTitle?.endsWith(' - Topic')

        if (musicOnly && !isMusic && !isTopicChannel) continue

        tracks.push({
          id: item.id,
          videoId: item.id,
          title: item.snippet.title,
          artist: item.snippet.channelTitle?.replace(/ - Topic$/, '') || item.snippet.channelTitle,
          duration: this.parseDuration(item.contentDetails.duration),
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        })
      }

      pageToken = data.nextPageToken || ''
    } while (pageToken)

    console.log(`✅ Fetched ${tracks.length} liked songs (music only: ${musicOnly})`)
    return tracks
  }

  async rateVideo(videoId: string, rating: 'like' | 'dislike' | 'none'): Promise<void> {
    const token = this.getProviderToken()
    if (!token) {
      throw new Error('No YouTube access token available')
    }

    const params = new URLSearchParams({ id: videoId, rating })
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos/rate?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to rate video: ${response.statusText}`)
    }
  }

  async removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void> {
    // First, find the playlistItemId for this video
    const params = new URLSearchParams({
      part: 'id,snippet',
      playlistId,
      videoId,
      maxResults: '1',
    })

    const data = await this.fetchYouTube(`playlistItems?${params}`)

    if (!data.items || data.items.length === 0) {
      throw new Error(`Video ${videoId} not found in playlist ${playlistId}`)
    }

    const playlistItemId = data.items[0].id

    // Delete the playlist item
    const token = this.getProviderToken()
    if (!token) {
      throw new Error('No YouTube access token available')
    }

    const deleteParams = new URLSearchParams({ id: playlistItemId })
    const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${deleteParams}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to remove video from playlist: ${response.statusText}`)
    }

    console.log(`✅ Removed video ${videoId} from playlist ${playlistId}`)
  }

  async getPlaylistTracks(playlistId: string): Promise<YouTubeTrack[]> {
    console.log(`🎵 Fetching tracks for playlist ${playlistId}...`)
    const tracks: YouTubeTrack[] = []
    let pageToken = ''

    do {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: '50',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const data = await this.fetchYouTube(`playlistItems?${params}`)

      for (const item of data.items || []) {
        if (!item.snippet.resourceId?.videoId) continue

        // Skip deleted or private videos
        const title = item.snippet.title
        if (title === 'Deleted video' || title === 'Private video') continue

        tracks.push({
          id: item.id,
          videoId: item.snippet.resourceId.videoId,
          title,
          artist: item.snippet.videoOwnerChannelTitle || item.snippet.channelTitle,
          duration: '',
          thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          addedAt: item.snippet.publishedAt,
        })
      }

      pageToken = data.nextPageToken || ''
    } while (pageToken)

    console.log(`✅ Fetched ${tracks.length} tracks`)
    return tracks
  }

  async addVideoToPlaylist(playlistId: string, videoId: string): Promise<boolean> {
    console.log(`➕ Adding video ${videoId} to playlist ${playlistId}...`)

    try {
      await this.fetchYouTube('playlistItems?part=snippet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId,
            },
          },
        }),
      })

      console.log('✅ Video added successfully')
      return true
    } catch (error) {
      console.error('❌ Error adding video:', error)
      return false
    }
  }

  async createPlaylist(
    title: string,
    description: string,
    privacy: 'public' | 'private' | 'unlisted'
  ): Promise<string> {
    console.log(`🆕 Creating playlist: ${title}...`)

    const data = await this.fetchYouTube('playlists?part=snippet,status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
        },
        status: {
          privacyStatus: privacy,
        },
      }),
    })

    console.log(`✅ Playlist created: ${data.id}`)
    return data.id
  }

  async deletePlaylist(playlistId: string): Promise<boolean> {
    console.log(`🗑️ Deleting playlist ${playlistId}...`)

    try {
      await this.fetchYouTube(`playlists?id=${playlistId}`, {
        method: 'DELETE',
      })

      console.log('✅ Playlist deleted successfully')
      return true
    } catch (error) {
      console.error('❌ Error deleting playlist:', error)
      return false
    }
  }

  async updatePlaylist(
    playlistId: string,
    title: string,
    description?: string
  ): Promise<boolean> {
    console.log(`✏️ Updating playlist ${playlistId}...`)

    try {
      await this.fetchYouTube('playlists?part=snippet', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: playlistId,
          snippet: {
            title,
            description: description || '',
          },
        }),
      })

      console.log('✅ Playlist updated successfully')
      return true
    } catch (error) {
      console.error('❌ Error updating playlist:', error)
      return false
    }
  }

  async analyzeLikedSongsInPlaylists(): Promise<PlaylistAnalysis> {
    console.log('🔍 Starting liked songs analysis...')

    const [likedSongs, playlists] = await Promise.all([
      this.getLikedSongs(),
      this.getPlaylists(),
    ])

    const playlistTracksMap = new Map<string, YouTubeTrack[]>()
    for (const playlist of playlists) {
      const tracks = await this.getPlaylistTracks(playlist.id)
      playlistTracksMap.set(playlist.id, tracks)
    }

    const crossReferences = likedSongs.map(track => {
      const foundInPlaylists: { playlist: YouTubePlaylist; position: number }[] = []

      playlists.forEach(playlist => {
        const playlistTracks = playlistTracksMap.get(playlist.id) || []
        const position = playlistTracks.findIndex(pt => pt.videoId === track.videoId)

        if (position !== -1) {
          foundInPlaylists.push({ playlist, position: position + 1 })
        }
      })

      // Generate smart suggestions
      const suggestedPlaylists = this.generateSmartSuggestions(
        track,
        playlists,
        playlistTracksMap,
        foundInPlaylists.map(fp => fp.playlist.id)
      )

      return {
        track,
        foundInPlaylists,
        suggestedPlaylists,
      }
    })

    const statistics = {
      totalLikedSongs: likedSongs.length,
      songsFoundInPlaylists: crossReferences.filter(ref => ref.foundInPlaylists.length > 0).length,
      songsNotFoundInPlaylists: crossReferences.filter(ref => ref.foundInPlaylists.length === 0).length,
      mostCommonPlaylists: this.calculateMostCommonPlaylists(crossReferences, playlists),
    }

    console.log('✅ Analysis complete:', statistics)
    return { likedSongs, crossReferences, statistics }
  }

  private generateSmartSuggestions(
    track: YouTubeTrack,
    playlists: YouTubePlaylist[],
    playlistTracksMap: Map<string, YouTubeTrack[]>,
    excludePlaylistIds: string[]
  ) {
    const suggestions: { playlist: YouTubePlaylist; score: number; reasons: string[] }[] = []

    playlists.forEach(playlist => {
      if (excludePlaylistIds.includes(playlist.id)) return

      const playlistTracks = playlistTracksMap.get(playlist.id) || []
      let score = 0
      const reasons: string[] = []

      // Check artist frequency
      const artistMatches = playlistTracks.filter(pt =>
        pt.artist.toLowerCase().includes(track.artist.toLowerCase()) ||
        track.artist.toLowerCase().includes(pt.artist.toLowerCase())
      ).length

      if (artistMatches > 0) {
        score += artistMatches * 2
        reasons.push(`${artistMatches} songs by ${track.artist}`)
      }

      // Check keyword matches in playlist title/description
      const keywords = track.title.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      const playlistText = `${playlist.title} ${playlist.description}`.toLowerCase()
      const keywordMatches = keywords.filter(kw => playlistText.includes(kw)).length

      if (keywordMatches > 0) {
        score += keywordMatches
        reasons.push(`Matching keywords in playlist`)
      }

      if (score > 0) {
        suggestions.push({ playlist, score, reasons })
      }
    })

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 3)
  }

  private calculateMostCommonPlaylists(
    crossReferences: Array<{
      track: YouTubeTrack
      foundInPlaylists: { playlist: YouTubePlaylist; position: number }[]
      suggestedPlaylists: { playlist: YouTubePlaylist; score: number; reasons: string[] }[]
    }>,
    playlists: YouTubePlaylist[]
  ) {
    const playlistCounts = new Map<string, number>()

    crossReferences.forEach(ref => {
      ref.foundInPlaylists.forEach((fp) => {
        playlistCounts.set(fp.playlist.id, (playlistCounts.get(fp.playlist.id) || 0) + 1)
      })
    })

    return Array.from(playlistCounts.entries())
      .map(([playlistId, songCount]) => ({
        playlist: playlists.find(p => p.id === playlistId)!,
        songCount,
      }))
      .filter(item => item.playlist)
      .sort((a, b) => b.songCount - a.songCount)
      .slice(0, 10)
  }

  private parseDuration(duration: string): string {
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
}

export const youtubeService = new YouTubeService()
// For backwards compatibility
export const apiService = youtubeService
