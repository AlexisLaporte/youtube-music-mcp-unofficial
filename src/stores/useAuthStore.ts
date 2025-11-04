import { create } from 'zustand'

interface UserInfo {
  name: string
  email: string
  profilePicture?: string
}

interface AuthState {
  // State
  user: UserInfo | null
  providerToken: string | null
  isConnected: boolean
  isLoading: boolean
  error: string | null

  // Actions
  setProviderToken: (token: string | null) => void
  setUser: (user: UserInfo | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Auth operations
  initialize: () => Promise<void>
  checkAuthStatus: () => Promise<void>
  signIn: () => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  providerToken: null,
  isConnected: false,
  isLoading: true,
  error: null,

  // Setters
  setProviderToken: (token) => {
    if (token) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('youtube_provider_token', token)
      }
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('youtube_provider_token')
      }
    }
    set({ providerToken: token })
  },
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  // Initialize auth state
  initialize: async () => {
    console.log('🚀 Auth store initializing...')
    set({ isLoading: true })

    // Transfer tokens from cookies to localStorage
    if (typeof window !== 'undefined') {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`
        const parts = value.split(`; ${name}=`)
        if (parts.length === 2) return parts.pop()?.split(';').shift()
      }

      const accessToken = getCookie('youtube_access_token')
      const refreshToken = getCookie('youtube_refresh_token')

      if (accessToken) {
        console.log('🍪 Found YouTube tokens in cookies, storing them...')
        get().setProviderToken(accessToken)

        if (refreshToken) {
          localStorage.setItem('youtube_provider_refresh_token', refreshToken)
        }

        // Clear cookies after storing
        document.cookie = 'youtube_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
        document.cookie = 'youtube_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      }
    }

    // Check auth status
    await get().checkAuthStatus()
  },

  // Check current auth status
  checkAuthStatus: async () => {
    console.log('🔍 Checking auth status...')
    set({ isLoading: true, error: null })

    try {
      const response = await fetch('/api/auth/me')

      if (!response.ok) {
        set({
          isConnected: false,
          user: null,
          providerToken: null,
          error: null,
          isLoading: false
        })
        return
      }

      const data = await response.json()

      if (data.user) {
        // Get provider token from localStorage
        const providerToken = typeof window !== 'undefined'
          ? localStorage.getItem('youtube_provider_token')
          : null

        set({
          isConnected: true,
          user: data.user,
          providerToken,
          error: null,
          isLoading: false
        })
      } else {
        set({
          isConnected: false,
          user: null,
          providerToken: null,
          error: null,
          isLoading: false
        })
      }
    } catch (error) {
      console.error('❌ Error checking auth status:', error)
      set({
        isConnected: false,
        user: null,
        providerToken: null,
        error: error instanceof Error ? error.message : 'Failed to check authentication',
        isLoading: false
      })
    }
  },

  // Sign in with Google
  signIn: () => {
    console.log('🔐 Initiating sign in...')
    window.location.href = '/api/auth/google'
  },

  // Sign out
  signOut: async () => {
    console.log('🚪 Signing out...')
    try {
      await fetch('/api/auth/logout', { method: 'POST' })

      // Clear local state
      if (typeof window !== 'undefined') {
        localStorage.removeItem('youtube_provider_token')
        localStorage.removeItem('youtube_provider_refresh_token')
      }

      set({
        user: null,
        providerToken: null,
        isConnected: false,
        error: null
      })

      console.log('✅ Sign out successful')
    } catch (error) {
      console.error('❌ Error signing out:', error)
      set({ error: (error as Error).message })
      throw error
    }
  }
}))
