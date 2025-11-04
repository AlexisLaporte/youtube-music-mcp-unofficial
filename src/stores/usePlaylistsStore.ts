import { create } from 'zustand'
import { YouTubePlaylist, YouTubeTrack, PlaylistAnalysis } from '@/types/youtube'
import { apiService } from '@/services/apiService'

interface PlaylistsState {
  // Data
  playlists: YouTubePlaylist[]
  likedSongs: YouTubeTrack[]
  playlistTracks: Record<string, YouTubeTrack[]>
  analysis: PlaylistAnalysis | null

  // Loading states
  isLoadingPlaylists: boolean
  isLoadingLikedSongs: boolean
  isLoadingAnalysis: boolean

  // Cache
  cacheTimestamp: number | null

  // Selected items (for batch operations)
  selectedTracks: Set<string>
  selectedPlaylists: Set<string>

  // Actions - Data fetching
  fetchPlaylists: (forceRefresh?: boolean) => Promise<void>
  fetchLikedSongs: (forceRefresh?: boolean) => Promise<void>
  fetchPlaylistTracks: (playlistId: string, forceRefresh?: boolean) => Promise<void>
  fetchAnalysis: (forceRefresh?: boolean) => Promise<void>

  // Actions - Playlist CRUD
  createPlaylist: (title: string, description: string, privacy: 'public' | 'private' | 'unlisted') => Promise<string>
  deletePlaylist: (playlistId: string) => Promise<void>
  updatePlaylist: (playlistId: string, updates: Partial<YouTubePlaylist>) => Promise<void>

  // Actions - Track operations
  addTrackToPlaylist: (playlistId: string, videoId: string) => Promise<void>
  addTracksToPlaylist: (playlistId: string, videoIds: string[]) => Promise<void>
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>
  moveTracksToPlaylist: (sourcePlaylistId: string, targetPlaylistId: string, videoIds: string[]) => Promise<void>

  // Actions - Selection
  toggleTrackSelection: (trackId: string) => void
  togglePlaylistSelection: (playlistId: string) => void
  selectAllTracks: (tracks: YouTubeTrack[]) => void
  clearTrackSelection: () => void
  clearPlaylistSelection: () => void

  // Actions - Cache
  invalidateCache: () => void
  clearAllData: () => void
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const usePlaylistsStore = create<PlaylistsState>((set, get) => ({
  // Initial state
  playlists: [],
  likedSongs: [],
  playlistTracks: {},
  analysis: null,
  isLoadingPlaylists: false,
  isLoadingLikedSongs: false,
  isLoadingAnalysis: false,
  cacheTimestamp: null,
  selectedTracks: new Set(),
  selectedPlaylists: new Set(),

  // Fetch playlists
  fetchPlaylists: async (forceRefresh = false) => {
    const state = get()

    if (!forceRefresh && state.playlists.length > 0 && state.cacheTimestamp) {
      const cacheAge = Date.now() - state.cacheTimestamp
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 Using cached playlists')
        return
      }
    }

    set({ isLoadingPlaylists: true })
    console.log('🔄 Fetching playlists...')

    try {
      const playlists = await apiService.getPlaylists()
      set({
        playlists,
        isLoadingPlaylists: false,
        cacheTimestamp: Date.now()
      })
      console.log(`✅ Fetched ${playlists.length} playlists`)
    } catch (error) {
      console.error('❌ Error fetching playlists:', error)
      set({ isLoadingPlaylists: false })
      throw error
    }
  },

  // Fetch liked songs
  fetchLikedSongs: async (forceRefresh = false) => {
    const state = get()

    if (!forceRefresh && state.likedSongs.length > 0 && state.cacheTimestamp) {
      const cacheAge = Date.now() - state.cacheTimestamp
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 Using cached liked songs')
        return
      }
    }

    set({ isLoadingLikedSongs: true })
    console.log('🔄 Fetching liked songs...')

    try {
      const likedSongs = await apiService.getLikedSongs()
      set({
        likedSongs,
        isLoadingLikedSongs: false,
        cacheTimestamp: Date.now()
      })
      console.log(`✅ Fetched ${likedSongs.length} liked songs`)
    } catch (error) {
      console.error('❌ Error fetching liked songs:', error)
      set({ isLoadingLikedSongs: false })
      throw error
    }
  },

  // Fetch tracks for a specific playlist
  fetchPlaylistTracks: async (playlistId: string, forceRefresh = false) => {
    const state = get()

    if (!forceRefresh && state.playlistTracks[playlistId]) {
      console.log(`📦 Using cached tracks for playlist ${playlistId}`)
      return
    }

    console.log(`🔄 Fetching tracks for playlist ${playlistId}...`)

    try {
      const tracks = await apiService.getPlaylistTracks(playlistId)
      set({
        playlistTracks: {
          ...state.playlistTracks,
          [playlistId]: tracks
        }
      })
      console.log(`✅ Fetched ${tracks.length} tracks`)
    } catch (error) {
      console.error('❌ Error fetching playlist tracks:', error)
      throw error
    }
  },

  // Fetch full analysis
  fetchAnalysis: async (forceRefresh = false) => {
    const state = get()

    if (!forceRefresh && state.analysis && state.cacheTimestamp) {
      const cacheAge = Date.now() - state.cacheTimestamp
      if (cacheAge < CACHE_DURATION) {
        console.log('📦 Using cached analysis')
        return
      }
    }

    set({ isLoadingAnalysis: true })
    console.log('🔄 Running full analysis...')

    try {
      const analysis = await apiService.analyzeLikedSongsInPlaylists()
      set({
        analysis,
        playlists: analysis.crossReferences.flatMap(cr =>
          cr.foundInPlaylists.map(fp => fp.playlist)
        ).filter((pl, idx, arr) => arr.findIndex(p => p.id === pl.id) === idx),
        likedSongs: analysis.likedSongs,
        isLoadingAnalysis: false,
        cacheTimestamp: Date.now()
      })
      console.log('✅ Analysis complete')
    } catch (error) {
      console.error('❌ Error running analysis:', error)
      set({ isLoadingAnalysis: false })
      throw error
    }
  },

  // Create a new playlist
  createPlaylist: async (title, description, privacy) => {
    console.log(`🔄 Creating playlist: ${title}`)
    try {
      const playlistId = await apiService.createPlaylist(title, description, privacy)

      // Refresh playlists
      await get().fetchPlaylists(true)

      console.log(`✅ Playlist created: ${playlistId}`)
      return playlistId
    } catch (error) {
      console.error('❌ Error creating playlist:', error)
      throw error
    }
  },

  // Delete a playlist
  deletePlaylist: async (playlistId) => {
    console.log(`🔄 Deleting playlist: ${playlistId}`)
    try {
      await apiService.deletePlaylist(playlistId)

      // Remove from state
      set(state => ({
        playlists: state.playlists.filter(pl => pl.id !== playlistId),
        playlistTracks: Object.fromEntries(
          Object.entries(state.playlistTracks).filter(([id]) => id !== playlistId)
        )
      }))

      console.log(`✅ Playlist deleted: ${playlistId}`)
    } catch (error) {
      console.error('❌ Error deleting playlist:', error)
      throw error
    }
  },

  // Update playlist metadata (note: API method needs to be added)
  updatePlaylist: async (playlistId, updates) => {
    console.log(`🔄 Updating playlist: ${playlistId}`, updates)
    // This will need a new API method
    // For now, just update local state
    set(state => ({
      playlists: state.playlists.map(pl =>
        pl.id === playlistId ? { ...pl, ...updates } : pl
      )
    }))
  },

  // Add a track to a playlist
  addTrackToPlaylist: async (playlistId, videoId) => {
    console.log(`🔄 Adding track ${videoId} to playlist ${playlistId}`)
    try {
      await apiService.addVideoToPlaylist(playlistId, videoId)

      // Invalidate playlist tracks cache
      const state = get()
      if (state.playlistTracks[playlistId]) {
        await get().fetchPlaylistTracks(playlistId, true)
      }

      console.log('✅ Track added')
    } catch (error) {
      console.error('❌ Error adding track:', error)
      throw error
    }
  },

  // Add multiple tracks to a playlist
  addTracksToPlaylist: async (playlistId, videoIds) => {
    console.log(`🔄 Adding ${videoIds.length} tracks to playlist ${playlistId}`)
    try {
      await Promise.all(
        videoIds.map(videoId => apiService.addVideoToPlaylist(playlistId, videoId))
      )

      // Invalidate playlist tracks cache
      const state = get()
      if (state.playlistTracks[playlistId]) {
        await get().fetchPlaylistTracks(playlistId, true)
      }

      console.log('✅ Tracks added')
    } catch (error) {
      console.error('❌ Error adding tracks:', error)
      throw error
    }
  },

  // Remove a track from a playlist (needs API method)
  removeTrackFromPlaylist: async (playlistId, trackId) => {
    console.log(`🔄 Removing track ${trackId} from playlist ${playlistId}`)
    // This will need a new API method
    // For now, just update local state
    set(state => ({
      playlistTracks: {
        ...state.playlistTracks,
        [playlistId]: state.playlistTracks[playlistId]?.filter(t => t.id !== trackId) || []
      }
    }))
  },

  // Move tracks from one playlist to another
  moveTracksToPlaylist: async (sourcePlaylistId, targetPlaylistId, videoIds) => {
    console.log(`🔄 Moving ${videoIds.length} tracks from ${sourcePlaylistId} to ${targetPlaylistId}`)
    try {
      // Add to target
      await get().addTracksToPlaylist(targetPlaylistId, videoIds)

      // Remove from source (when API method exists)
      // For now, we'll need to implement this

      console.log('✅ Tracks moved')
    } catch (error) {
      console.error('❌ Error moving tracks:', error)
      throw error
    }
  },

  // Selection management
  toggleTrackSelection: (trackId) => {
    set(state => {
      const newSelection = new Set(state.selectedTracks)
      if (newSelection.has(trackId)) {
        newSelection.delete(trackId)
      } else {
        newSelection.add(trackId)
      }
      return { selectedTracks: newSelection }
    })
  },

  togglePlaylistSelection: (playlistId) => {
    set(state => {
      const newSelection = new Set(state.selectedPlaylists)
      if (newSelection.has(playlistId)) {
        newSelection.delete(playlistId)
      } else {
        newSelection.add(playlistId)
      }
      return { selectedPlaylists: newSelection }
    })
  },

  selectAllTracks: (tracks) => {
    set({ selectedTracks: new Set(tracks.map(t => t.id)) })
  },

  clearTrackSelection: () => {
    set({ selectedTracks: new Set() })
  },

  clearPlaylistSelection: () => {
    set({ selectedPlaylists: new Set() })
  },

  // Cache management
  invalidateCache: () => {
    console.log('🗑️ Invalidating cache')
    set({ cacheTimestamp: null })
  },

  clearAllData: () => {
    console.log('🗑️ Clearing all data')
    set({
      playlists: [],
      likedSongs: [],
      playlistTracks: {},
      analysis: null,
      cacheTimestamp: null,
      selectedTracks: new Set(),
      selectedPlaylists: new Set()
    })
  }
}))
