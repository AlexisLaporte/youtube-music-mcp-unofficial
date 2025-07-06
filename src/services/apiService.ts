import { createClient } from '@/lib/supabase'
import { AuthStatus, YouTubePlaylist, YouTubeTrack, PlaylistAnalysis } from '@/types/youtube'

class ApiService {
  private supabase = createClient()

  // Getter public pour accéder au client Supabase
  get supabaseClient() {
    return this.supabase
  }

  async checkAuthStatus(): Promise<AuthStatus> {
    try {
      // D'abord essayer de récupérer la session courante
      let { data: { session }, error } = await this.supabase.auth.getSession()
      
      if (error) {
        console.error('Auth error:', error)
        return { isConnected: false, error: error.message }
      }

      // Si pas de session, essayer de rafraîchir
      if (!session || !session.user) {
        console.log('No session found, attempting to refresh...')
        const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession()
        
        if (refreshError) {
          console.log('No refresh session available:', refreshError.message)
          return { isConnected: false }
        }
        
        session = refreshData.session
      }

      if (!session || !session.user) {
        return { isConnected: false }
      }

      const user = session.user
      const providerToken = user.user_metadata?.provider_token

      if (!providerToken) {
        return { 
          isConnected: false, 
          error: 'YouTube connection required' 
        }
      }

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
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
        scopes: 'openid email profile https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube'
      }
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  async disconnect(): Promise<boolean> {
    try {
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
      
      if (!session || !session.user) {
        throw new Error('Not authenticated')
      }

      const providerToken = session.user.user_metadata?.provider_token
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
      
      if (!session || !session.user) {
        throw new Error('Not authenticated')
      }

      const providerToken = session.user.user_metadata?.provider_token
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

  async deletePlaylist(playlistId: string): Promise<boolean> {
    try {
      const { data: { session } } = await this.supabase.auth.getSession()
      
      if (!session || !session.user) {
        throw new Error('Not authenticated')
      }

      const providerToken = session.user.user_metadata?.provider_token
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
      
      if (!session || !session.user) {
        throw new Error('Not authenticated')
      }

      const providerToken = session.user.user_metadata?.provider_token
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
      
      if (!session || !session.user) {
        throw new Error('Not authenticated')
      }

      const providerToken = session.user.user_metadata?.provider_token
      if (!providerToken) {
        throw new Error('YouTube token not available')
      }

      // YouTube API v3 endpoint pour les vidéos likées
      const response = await fetch(
        'https://www.googleapis.com/youtube/v3/videos?' +
        'part=snippet,contentDetails&' +
        'myRating=like&' +
        'maxResults=50',
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
        const video = item as Record<string, unknown>
        const snippet = video.snippet as Record<string, unknown>
        const contentDetails = video.contentDetails as Record<string, unknown>
        const thumbnails = snippet.thumbnails as Record<string, unknown>
        
        return {
          id: video.id,
          title: snippet.title || 'Titre inconnu',
          artist: snippet.channelTitle || 'Artiste inconnu',
          duration: contentDetails.duration || '0:00',
          thumbnail: (thumbnails?.medium as Record<string, unknown>)?.url || (thumbnails?.default as Record<string, unknown>)?.url || '',
          videoId: video.id as string,
          addedAt: snippet.publishedAt,
        }
      }) || []

      return tracks
    } catch (error) {
      console.error('Error fetching liked songs:', error)
      throw error
    }
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

        return {
          track: likedTrack,
          foundInPlaylists
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