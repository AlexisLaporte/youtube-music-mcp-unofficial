import { createClient } from '@/lib/supabase'
import { AuthStatus, YouTubePlaylist } from '@/types/youtube'

class ApiService {
  private supabase = createClient()

  async checkAuthStatus(): Promise<AuthStatus> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession()
      
      if (error) {
        console.error('Auth error:', error)
        return { isConnected: false, error: error.message }
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
          prompt: 'consent',
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
}

export const apiService = new ApiService()