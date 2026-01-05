import { create } from 'zustand'
import { YouTubePlaylist, YouTubeTrack, PlaylistAnalysis } from '@/types/youtube'
import { apiService } from '@/services/apiService'

// Helper: generate smart playlist suggestions based on artist/keyword matching
function generateSmartSuggestions(
  track: YouTubeTrack,
  playlists: YouTubePlaylist[],
  playlistTracksMap: Record<string, YouTubeTrack[]>,
  excludePlaylistIds: string[]
) {
  const suggestions: { playlist: YouTubePlaylist; score: number; reasons: string[] }[] = []

  playlists.forEach(playlist => {
    if (excludePlaylistIds.includes(playlist.id)) return

    const playlistTracks = playlistTracksMap[playlist.id] || []
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
      reasons.push(`Matching keywords`)
    }

    if (score > 0) {
      suggestions.push({ playlist, score, reasons })
    }
  })

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 3)
}

// Helper: calculate most common playlists from cross-references
function calculateMostCommonPlaylists(
  crossReferences: { foundInPlaylists: { playlist: YouTubePlaylist }[] }[],
  playlists: YouTubePlaylist[]
) {
  const playlistCounts = new Map<string, number>()

  crossReferences.forEach(ref => {
    ref.foundInPlaylists.forEach(fp => {
      playlistCounts.set(fp.playlist.id, (playlistCounts.get(fp.playlist.id) || 0) + 1)
    })
  })

  return Array.from(playlistCounts.entries())
    .map(([playlistId, songCount]) => ({
      playlist: playlists.find(p => p.id === playlistId)!,
      songCount
    }))
    .filter(item => item.playlist)
    .sort((a, b) => b.songCount - a.songCount)
    .slice(0, 10)
}

// Deduplication: prevent concurrent fetches for same resource
const pendingFetches = new Map<string, Promise<void>>()

interface CacheResult<T> {
  data: T | null
  fresh: boolean
}

async function fetchCache<T>(type: string, playlistId?: string): Promise<CacheResult<T>> {
  try {
    const params = new URLSearchParams({ type })
    if (playlistId) params.set('playlistId', playlistId)
    const res = await fetch(`/api/cache?${params}`)
    if (!res.ok) return { data: null, fresh: false }
    return res.json()
  } catch {
    return { data: null, fresh: false }
  }
}

async function saveCache(type: string, data: unknown, playlistId?: string): Promise<void> {
  try {
    await fetch('/api/cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data, playlistId })
    })
  } catch (e) {
    console.warn('Failed to save cache:', e)
  }
}

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
  isSyncing: boolean

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

export const usePlaylistsStore = create<PlaylistsState>((set, get) => ({
  // Initial state
  playlists: [],
  likedSongs: [],
  playlistTracks: {},
  analysis: null,
  isLoadingPlaylists: false,
  isLoadingLikedSongs: false,
  isLoadingAnalysis: false,
  isSyncing: false,
  cacheTimestamp: null,
  selectedTracks: new Set(),
  selectedPlaylists: new Set(),

  // Fetch playlists
  fetchPlaylists: async (forceRefresh = false) => {
    const state = get()

    // Already have data in memory
    if (!forceRefresh && state.playlists.length > 0) {
      console.log('📦 Using in-memory playlists')
      return
    }

    set({ isLoadingPlaylists: true })

    // Check server cache first
    if (!forceRefresh) {
      const cached = await fetchCache<YouTubePlaylist[]>('playlists')
      if (cached.data && cached.fresh) {
        console.log('📦 Using server-cached playlists')
        set({ playlists: cached.data, isLoadingPlaylists: false, cacheTimestamp: Date.now() })
        return
      }
      // If we have stale data, show it immediately and sync in background
      if (cached.data) {
        console.log('📦 Using stale cache, syncing in background...')
        set({ playlists: cached.data, isLoadingPlaylists: false, isSyncing: true })
      }
    }

    console.log('🔄 Fetching playlists from YouTube...')
    try {
      const playlists = await apiService.getPlaylists()
      set({ playlists, isLoadingPlaylists: false, isSyncing: false, cacheTimestamp: Date.now() })
      await saveCache('playlists', playlists)
      console.log(`✅ Fetched ${playlists.length} playlists`)
    } catch (error) {
      console.error('❌ Error fetching playlists:', error)
      set({ isLoadingPlaylists: false, isSyncing: false })
      throw error
    }
  },

  // Fetch liked songs
  fetchLikedSongs: async (forceRefresh = false) => {
    const state = get()

    // Already have data in memory
    if (!forceRefresh && state.likedSongs.length > 0) {
      console.log('📦 Using in-memory liked songs')
      return
    }

    set({ isLoadingLikedSongs: true })

    // Check server cache first
    if (!forceRefresh) {
      const cached = await fetchCache<YouTubeTrack[]>('liked')
      if (cached.data && cached.fresh) {
        console.log('📦 Using server-cached liked songs')
        set({ likedSongs: cached.data, isLoadingLikedSongs: false, cacheTimestamp: Date.now() })
        return
      }
      if (cached.data) {
        console.log('📦 Using stale liked songs cache, syncing in background...')
        set({ likedSongs: cached.data, isLoadingLikedSongs: false, isSyncing: true })
      }
    }

    console.log('🔄 Fetching liked songs from YouTube...')
    try {
      const likedSongs = await apiService.getLikedSongs()
      set({ likedSongs, isLoadingLikedSongs: false, isSyncing: false, cacheTimestamp: Date.now() })
      await saveCache('liked', likedSongs)
      console.log(`✅ Fetched ${likedSongs.length} liked songs`)
    } catch (error) {
      console.error('❌ Error fetching liked songs:', error)
      set({ isLoadingLikedSongs: false, isSyncing: false })
      throw error
    }
  },

  // Fetch tracks for a specific playlist
  fetchPlaylistTracks: async (playlistId: string, forceRefresh = false) => {
    const state = get()

    // Already have data in memory
    if (!forceRefresh && state.playlistTracks[playlistId]) {
      console.log(`📦 Using in-memory tracks for playlist ${playlistId}`)
      return
    }

    // Check server cache first
    if (!forceRefresh) {
      const cached = await fetchCache<YouTubeTrack[]>('tracks', playlistId)
      if (cached.data && cached.fresh) {
        console.log(`📦 Using server-cached tracks for playlist ${playlistId}`)
        set({ playlistTracks: { ...state.playlistTracks, [playlistId]: cached.data } })
        return
      }
      if (cached.data) {
        console.log(`📦 Using stale tracks cache for ${playlistId}, syncing in background...`)
        set({ playlistTracks: { ...state.playlistTracks, [playlistId]: cached.data }, isSyncing: true })
      }
    }

    console.log(`🔄 Fetching tracks for playlist ${playlistId} from YouTube...`)
    try {
      const tracks = await apiService.getPlaylistTracks(playlistId)
      set({ playlistTracks: { ...get().playlistTracks, [playlistId]: tracks }, isSyncing: false })
      await saveCache('tracks', tracks, playlistId)
      console.log(`✅ Fetched ${tracks.length} tracks`)
    } catch (error) {
      console.error('❌ Error fetching playlist tracks:', error)
      set({ isSyncing: false })
      throw error
    }
  },

  // Fetch full analysis - uses cached playlists/liked songs when available
  fetchAnalysis: async (forceRefresh = false) => {
    const state = get()

    // Use in-memory analysis if still fresh (5 min)
    if (!forceRefresh && state.analysis && state.cacheTimestamp) {
      const cacheAge = Date.now() - state.cacheTimestamp
      if (cacheAge < 5 * 60 * 1000) {
        console.log('📦 Using cached analysis')
        return
      }
    }

    set({ isLoadingAnalysis: true })
    console.log('🔄 Running full analysis...')

    try {
      // Use store's cached fetch methods instead of direct API call
      await get().fetchPlaylists(forceRefresh)
      await get().fetchLikedSongs(forceRefresh)

      const { playlists, likedSongs } = get()

      // Fetch tracks for each playlist (uses cache)
      for (const playlist of playlists) {
        await get().fetchPlaylistTracks(playlist.id, forceRefresh)
      }

      const { playlistTracks } = get()

      // Compute analysis from cached data
      const crossReferences = likedSongs.map(track => {
        const foundInPlaylists: { playlist: typeof playlists[0]; position: number }[] = []

        playlists.forEach(playlist => {
          const tracks = playlistTracks[playlist.id] || []
          const position = tracks.findIndex(pt => pt.videoId === track.videoId)
          if (position !== -1) {
            foundInPlaylists.push({ playlist, position: position + 1 })
          }
        })

        // Generate smart suggestions
        const suggestedPlaylists = generateSmartSuggestions(
          track,
          playlists,
          playlistTracks,
          foundInPlaylists.map(fp => fp.playlist.id)
        )

        return { track, foundInPlaylists, suggestedPlaylists }
      })

      const statistics = {
        totalLikedSongs: likedSongs.length,
        songsFoundInPlaylists: crossReferences.filter(ref => ref.foundInPlaylists.length > 0).length,
        songsNotFoundInPlaylists: crossReferences.filter(ref => ref.foundInPlaylists.length === 0).length,
        mostCommonPlaylists: calculateMostCommonPlaylists(crossReferences, playlists)
      }

      set({
        analysis: { likedSongs, crossReferences, statistics },
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
    // Also invalidate server cache
    fetch('/api/cache', { method: 'DELETE' }).catch(() => {})
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
    // Also clear server cache
    fetch('/api/cache', { method: 'DELETE' }).catch(() => {})
  }
}))
