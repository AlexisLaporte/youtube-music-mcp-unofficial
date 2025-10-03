import { createClient } from '@/lib/supabase'
import { AuthStatus, YouTubePlaylist, YouTubeTrack, PlaylistAnalysis } from '@/types/youtube'

class ApiService {
  private supabase = createClient()
  private readonly PROVIDER_TOKEN_KEY = 'youtube_provider_token'
  private readonly PROVIDER_REFRESH_TOKEN_KEY = 'youtube_provider_refresh_token'

  // Getter public pour accéder au client Supabase
  get supabaseClient() {
    return this.supabase
  }

  // Store provider tokens in localStorage
  storeProviderTokens(providerToken: string, providerRefreshToken?: string) {
    console.log('💾 Storing provider tokens', {
      hasToken: !!providerToken,
      hasRefreshToken: !!providerRefreshToken,
      tokenLength: providerToken?.length
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.PROVIDER_TOKEN_KEY, providerToken)
      if (providerRefreshToken) {
        localStorage.setItem(this.PROVIDER_REFRESH_TOKEN_KEY, providerRefreshToken)
      }
    }
  }

  // Get provider token from localStorage
  getProviderToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.PROVIDER_TOKEN_KEY)
    }
    return null
  }

  // Clear provider tokens
  clearProviderTokens() {
    console.log('🗑️ Clearing provider tokens');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.PROVIDER_TOKEN_KEY)
      localStorage.removeItem(this.PROVIDER_REFRESH_TOKEN_KEY)
    }
  }

  async checkAuthStatus(): Promise<AuthStatus> {
    console.log('🔍 ApiService.checkAuthStatus called');
    try {
      // Check provider token first
      const providerToken = this.getProviderToken()

      // Check if we have a session first
      const { data: { session } } = await this.supabase.auth.getSession()

      if (!session) {
        console.log('❌ No session found');
        return { isConnected: false }
      }

      // Now we can safely get the user
      const { data: { user }, error: userError } = await this.supabase.auth.getUser()

      console.log('🔑 Auth check:', {
        hasUser: !!user,
        hasProviderToken: !!providerToken,
        userEmail: user?.email,
        error: userError?.message,
      });

      if (userError) {
        console.error('❌ Auth error:', userError)
        return { isConnected: false, error: userError.message }
      }

      if (!user) {
        console.log('❌ No user found');
        return { isConnected: false }
      }

      console.log('👤 User session details:', {
        userId: user.id,
        email: user.email,
        hasProviderToken: !!providerToken,
        providerTokenLength: providerToken?.length,
        providerTokenSource: 'localStorage',
        userMetadata: user.user_metadata,
        appMetadata: user.app_metadata,
        lastSignIn: user.last_sign_in_at,
        createdAt: user.created_at
      });

      if (!providerToken) {
        console.log('❌ No provider token found in localStorage - YouTube connection required');
        return {
          isConnected: false,
          error: 'YouTube connection required'
        }
      }

      console.log('✅ Auth status successful:', {
        userName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        userEmail: user.email,
        hasProfilePicture: !!user.user_metadata?.avatar_url
      });

      return {
        isConnected: true,
        user: {
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          profilePicture: user.user_metadata?.avatar_url
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error)
      return { 
        isConnected: false, 
        error: error instanceof Error ? error.message : 'Failed to check authentication status' 
      }
    }
  }

  async signInWithGoogle(): Promise<void> {
    console.log('🔐 signInWithGoogle called');

    // Force sign out first to clear any cached state
    await this.supabase.auth.signOut();
    console.log('🧹 Cleared previous session');

    console.log('🚀 Initiating Google OAuth...', {
      currentOrigin: window.location.origin,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    });
    
    // Use environment variable if set, otherwise use current origin
    // This allows overriding redirect URL for development
    const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || `${window.location.origin}/`;

    console.log('🚀 OAuth redirect configuration:', {
      redirectTo,
      currentOrigin: window.location.origin,
      isLocalhost: window.location.origin.includes('localhost'),
      envSiteUrl: process.env.NEXT_PUBLIC_SITE_URL
    });

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          include_granted_scopes: 'true',
          prompt: 'consent' // Force consent to get refresh token
        },
        scopes: 'openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube'
      }
    })

    if (data?.url) {
      console.log('📎 OAuth URL generated:', data.url);
    }

    if (error) {
      throw new Error(error.message)
    }
  }

  async disconnect(): Promise<boolean> {
    try {
      this.clearProviderTokens()
      const { error } = await this.supabase.auth.signOut()
      return !error
    } catch (error) {
      console.error('Error disconnecting:', error)
      return false
    }
  }

  async getPlaylists(): Promise<YouTubePlaylist[]> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const providerToken = this.getProviderToken()
      if (!providerToken) {
        throw new Error('YouTube token not available')
      }

      const response = await fetch(
        "https://www.googleapis.com/youtube/v3/playlists?" +
        "part=snippet,contentDetails,status&" +
        "mine=true&" +
        "maxResults=50",
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('YouTube API error:', response.status, errorText)

        // If token expired, clear it and throw a specific error
        if (response.status === 401) {
          this.clearProviderTokens()
          throw new Error('YouTube authentication expired. Please reconnect.')
        }

        throw new Error(`YouTube API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      const playlists = data.items?.map((item: unknown) => {
        const playlist = item as Record<string, unknown>
        const snippet = playlist.snippet as Record<string, unknown>
        const contentDetails = playlist.contentDetails as Record<string, unknown>
        const status = playlist.status as Record<string, unknown>
        const thumbnails = snippet.thumbnails as Record<string, unknown>
        
        return {
          id: playlist.id,
          title: snippet.title,
          description: snippet.description || "",
          thumbnail: (thumbnails?.medium as Record<string, unknown>)?.url || (thumbnails?.default as Record<string, unknown>)?.url || "",
          trackCount: contentDetails.itemCount || 0,
          privacy: status?.privacyStatus || "private",
          publishedAt: snippet.publishedAt,
        }
      }) || []

      return playlists
    } catch (error) {
      console.error('Error fetching playlists:', error)
      throw error
    }
  }

  async createPlaylist(title: string, description?: string, privacy: 'public' | 'private' | 'unlisted' = 'private'): Promise<string> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const providerToken = this.getProviderToken()
      if (!providerToken) {
        throw new Error('YouTube token not available')
      }

      const response = await fetch("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            title,
            description: description || "",
          },
          status: {
            privacyStatus: privacy,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('YouTube API create playlist error:', response.status, errorText)
        throw new Error(`YouTube API error: ${response.statusText}`)
      }

      const data = await response.json()
      return data.id
    } catch (error) {
      console.error('Error creating playlist:', error)
      throw error
    }
  }

  async addVideoToPlaylist(playlistId: string, videoId: string): Promise<boolean> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const providerToken = this.getProviderToken()
      if (!providerToken) {
        throw new Error('YouTube token not available')
      }

      const response = await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${providerToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: {
              kind: "youtube#video",
              videoId
            }
          }
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('YouTube API add video error:', response.status, errorText)

        // If token expired, clear it and throw a specific error
        if (response.status === 401) {
          this.clearProviderTokens()
          throw new Error('YouTube authentication expired. Please reconnect.')
        }

        throw new Error(`YouTube API error: ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error('Error adding video to playlist:', error)
      throw error
    }
  }

  async deletePlaylist(playlistId: string): Promise<boolean> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const providerToken = this.getProviderToken()
      if (!providerToken) {
        throw new Error('YouTube token not available')
      }

      const response = await fetch(`https://www.googleapis.com/youtube/v3/playlists?id=${playlistId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('YouTube API delete playlist error:', response.status, errorText)
        throw new Error(`YouTube API error: ${response.statusText}`)
      }

      return true
    } catch (error) {
      console.error('Error deleting playlist:', error)
      return false
    }
  }

  async getPlaylistTracks(playlistId: string): Promise<YouTubeTrack[]> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const providerToken = this.getProviderToken()
      if (!providerToken) {
        throw new Error('YouTube token not available')
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?` +
        `part=snippet,contentDetails&` +
        `playlistId=${playlistId}&` +
        `maxResults=50`,
        {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error('YouTube API error:', response.status, errorText)
        throw new Error(`YouTube API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      const tracks = data.items?.map((item: unknown) => {
        const playlistItem = item as Record<string, unknown>
        const snippet = playlistItem.snippet as Record<string, unknown>
        const contentDetails = playlistItem.contentDetails as Record<string, unknown>
        const resourceId = snippet.resourceId as Record<string, unknown>
        const thumbnails = snippet.thumbnails as Record<string, unknown>
        
        return {
          id: playlistItem.id,
          title: snippet.title || 'Titre inconnu',
          artist: snippet.videoOwnerChannelTitle || 'Artiste inconnu',
          duration: contentDetails.duration || '0:00',
          thumbnail: (thumbnails?.medium as Record<string, unknown>)?.url || (thumbnails?.default as Record<string, unknown>)?.url || '',
          videoId: resourceId.videoId,
          addedAt: snippet.publishedAt,
        }
      }) || []

      return tracks
    } catch (error) {
      console.error('Error fetching playlist tracks:', error)
      throw error
    }
  }

  async getLikedSongs(): Promise<YouTubeTrack[]> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: { user } } = await this.supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const providerToken = this.getProviderToken()
      if (!providerToken) {
        throw new Error('YouTube token not available')
      }

      // Fetch all liked songs with pagination
      let allTracks: YouTubeTrack[] = []
      let pageToken: string | undefined = undefined

      do {
        const url: string = 'https://www.googleapis.com/youtube/v3/videos?' +
          'part=snippet,contentDetails&' +
          'myRating=like&' +
          'maxResults=50' +
          (pageToken ? `&pageToken=${pageToken}` : '')

        const response: Response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('YouTube API error:', response.status, errorText)
          throw new Error(`YouTube API error: ${response.statusText}`)
        }

        const data = await response.json() as {
          items?: unknown[],
          nextPageToken?: string
        }

        const tracks = data.items?.map((item: unknown) => {
          const video = item as Record<string, unknown>
          const snippet = video.snippet as Record<string, unknown>
          const contentDetails = video.contentDetails as Record<string, unknown>
          const thumbnails = snippet.thumbnails as Record<string, unknown>

          return {
            id: video.id as string,
            title: (snippet.title || 'Titre inconnu') as string,
            artist: (snippet.channelTitle || 'Artiste inconnu') as string,
            duration: (contentDetails.duration || '0:00') as string,
            thumbnail: ((thumbnails?.medium as Record<string, unknown>)?.url || (thumbnails?.default as Record<string, unknown>)?.url || '') as string,
            videoId: video.id as string,
            addedAt: snippet.publishedAt as string,
            categoryId: snippet.categoryId as string,
          }
        }).filter((track) => {
          // Filter music only: categoryId 10 = Music
          return track?.categoryId === '10'
        }) || []

        allTracks = allTracks.concat(tracks)
        pageToken = data.nextPageToken
      } while (pageToken)

      return allTracks
    } catch (error) {
      console.error('Error fetching liked songs:', error)
      throw error
    }
  }

  // Analyze playlist content to build profiles
  private analyzePlaylistProfile(tracks: YouTubeTrack[]) {
    // Count artists
    const artistCounts = new Map<string, number>()
    tracks.forEach(track => {
      const artist = track.artist.toLowerCase()
      artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1)
    })

    // Extract keywords from titles (excluding common words)
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'feat', 'ft', 'featuring', 'official', 'video', 'audio', 'music', 'lyrics', 'lyric'])
    const keywordCounts = new Map<string, number>()

    tracks.forEach(track => {
      const words = track.title.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !commonWords.has(w))

      words.forEach(word => {
        keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1)
      })
    })

    return {
      artistCounts,
      keywordCounts,
      totalTracks: tracks.length
    }
  }

  // Suggest best playlists for a track
  private suggestPlaylistsForTrack(
    track: YouTubeTrack,
    playlistProfiles: Map<string, ReturnType<typeof this.analyzePlaylistProfile>>,
    playlists: YouTubePlaylist[]
  ): Array<{ playlist: YouTubePlaylist; score: number; reasons: string[] }> {
    const suggestions: Array<{ playlist: YouTubePlaylist; score: number; reasons: string[] }> = []

    const trackArtist = track.artist.toLowerCase()
    const trackWords = track.title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)

    playlists.forEach(playlist => {
      const profile = playlistProfiles.get(playlist.id)
      if (!profile) return

      let score = 0
      const reasons: string[] = []

      // Score by artist presence
      const artistCount = profile.artistCounts.get(trackArtist) || 0
      if (artistCount > 0) {
        const artistScore = Math.min(50, artistCount * 10)
        score += artistScore
        reasons.push(`${artistCount} morceau${artistCount > 1 ? 'x' : ''} de ${track.artist}`)
      }

      // Score by keyword overlap
      let keywordMatches = 0
      trackWords.forEach(word => {
        if (profile.keywordCounts.has(word)) {
          keywordMatches++
          score += 5
        }
      })
      if (keywordMatches > 0) {
        reasons.push(`${keywordMatches} mot${keywordMatches > 1 ? 's' : ''}-clé${keywordMatches > 1 ? 's' : ''} en commun`)
      }

      if (score > 0) {
        suggestions.push({ playlist, score, reasons })
      }
    })

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 3)
  }

  async analyzeLikedSongsInPlaylists(): Promise<PlaylistAnalysis> {
    try {
      // Récupérer les morceaux likés et toutes les playlists
      const [likedSongs, playlists] = await Promise.all([
        this.getLikedSongs(),
        this.getPlaylists()
      ])

      // Récupérer les morceaux de toutes les playlists
      const playlistsWithTracks = await Promise.all(
        playlists.map(async (playlist) => {
          const tracks = await this.getPlaylistTracks(playlist.id)
          return { playlist, tracks }
        })
      )

      // Build playlist profiles
      const playlistProfiles = new Map<string, ReturnType<typeof this.analyzePlaylistProfile>>()
      playlistsWithTracks.forEach(({ playlist, tracks }) => {
        playlistProfiles.set(playlist.id, this.analyzePlaylistProfile(tracks))
      })

      // Analyser les cross-références
      const crossReferences = likedSongs.map((likedTrack) => {
        const foundInPlaylists: { playlist: YouTubePlaylist; position: number }[] = []

        playlistsWithTracks.forEach(({ playlist, tracks }) => {
          tracks.forEach((track, index) => {
            if (track.videoId === likedTrack.videoId) {
              foundInPlaylists.push({ playlist, position: index + 1 })
            }
          })
        })

        // Get playlist suggestions if not already in playlists
        const suggestedPlaylists = foundInPlaylists.length === 0
          ? this.suggestPlaylistsForTrack(likedTrack, playlistProfiles, playlists)
          : []

        return {
          track: likedTrack,
          foundInPlaylists,
          suggestedPlaylists
        }
      })

      // Calculer les statistiques
      const songsFoundInPlaylists = crossReferences.filter(cr => cr.foundInPlaylists.length > 0).length
      const songsNotFoundInPlaylists = likedSongs.length - songsFoundInPlaylists

      // Compter les playlists les plus communes
      const playlistCounts = new Map<string, { playlist: YouTubePlaylist; count: number }>()
      
      crossReferences.forEach(({ foundInPlaylists }) => {
        foundInPlaylists.forEach(({ playlist }) => {
          const existing = playlistCounts.get(playlist.id)
          if (existing) {
            existing.count++
          } else {
            playlistCounts.set(playlist.id, { playlist, count: 1 })
          }
        })
      })

      const mostCommonPlaylists = Array.from(playlistCounts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(({ playlist, count }) => ({ playlist, songCount: count }))

      return {
        likedSongs,
        crossReferences,
        statistics: {
          totalLikedSongs: likedSongs.length,
          songsFoundInPlaylists,
          songsNotFoundInPlaylists,
          mostCommonPlaylists
        }
      }
    } catch (error) {
      console.error('Error analyzing liked songs:', error)
      throw error
    }
  }
}

export const apiService = new ApiService()