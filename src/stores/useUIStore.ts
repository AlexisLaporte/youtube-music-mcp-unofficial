import { create } from 'zustand'

type ModalType =
  | 'playlist-selector'
  | 'create-playlist'
  | 'edit-playlist'
  | 'delete-playlist-confirm'
  | 'split-playlist'
  | null

interface ModalData {
  trackId?: string
  playlistId?: string
  playlistTitle?: string
  videoId?: string
  selectedTracks?: string[]
  onConfirm?: () => void
  [key: string]: unknown
}

type SortBy = 'date' | 'artist' | 'title' | 'playlistCount'
type SortOrder = 'asc' | 'desc'
type MobileTab = 'playlists' | 'songs' | 'detail'
type PlaybackMode = 'normal' | 'shuffle' | 'loop-one' | 'loop-all'

interface UIState {
  // Navigation (3-column layout)
  selectedPlaylistId: string | 'liked' | null  // Col 1 selection
  selectedSongId: string | null                 // Col 2 selection (for detail view)
  isNowPlayingMode: boolean                     // Player bar expanded view
  mobileTab: MobileTab                          // Mobile bottom tabs
  isSearchMode: boolean                         // YouTube search mode active

  // Modals
  activeModal: ModalType
  modalData: ModalData

  // Player
  playerVideoId: string | null
  isPlayerVisible: boolean
  isPlayerPaused: boolean
  playbackMode: PlaybackMode
  playbackQueue: string[]  // Array of videoIds
  playbackQueueIndex: number

  // View modes
  view: 'list' | 'grid'
  filterMode: 'all' | 'not-in-playlists'
  searchQuery: string

  // Sorting
  sortBy: SortBy
  sortOrder: SortOrder

  // Advanced filters
  filterArtist: string | null
  filterPlaylists: string[]

  // Mobile
  isMobileSearchVisible: boolean
  isMobileMenuOpen: boolean

  // Batch operations mode
  isBatchMode: boolean
  selectedPlaylists: Set<string>
  selectedTracks: Set<string>

  // Actions - Modals
  openModal: (type: ModalType, data?: ModalData) => void
  closeModal: () => void
  updateModalData: (data: Partial<ModalData>) => void

  // Actions - Navigation
  selectPlaylist: (playlistId: string | 'liked' | null) => void
  selectSong: (songId: string | null) => void
  toggleNowPlayingMode: () => void
  setMobileTab: (tab: MobileTab) => void
  enterSearchMode: () => void
  exitSearchMode: () => void

  // Actions - Player
  playVideo: (videoId: string) => void
  playVideoInQueue: (videoId: string, queue: string[]) => void
  pausePlayer: () => void
  resumePlayer: () => void
  togglePlayPause: () => void
  closePlayer: () => void
  setPlaybackMode: (mode: PlaybackMode) => void
  cyclePlaybackMode: () => void
  playNext: () => void
  playPrevious: () => void

  // Actions - View
  setView: (view: 'list' | 'grid') => void
  setFilterMode: (mode: 'all' | 'not-in-playlists') => void
  setSearchQuery: (query: string) => void

  // Actions - Sorting
  setSortBy: (sortBy: SortBy) => void
  setSortOrder: (order: SortOrder) => void
  toggleSortOrder: () => void

  // Actions - Advanced filters
  setFilterArtist: (artist: string | null) => void
  setFilterPlaylists: (playlistIds: string[]) => void
  clearFilters: () => void

  // Actions - Mobile
  toggleMobileSearch: () => void
  toggleMobileMenu: () => void
  closeMobileMenu: () => void

  // Actions - Batch mode
  toggleBatchMode: () => void
  exitBatchMode: () => void

  // Actions - Batch selection
  togglePlaylistSelection: (playlistId: string) => void
  clearPlaylistSelection: () => void
  toggleTrackSelection: (trackId: string) => void
  clearTrackSelection: () => void
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state - Navigation
  selectedPlaylistId: 'liked',  // Default to liked songs
  selectedSongId: null,
  isNowPlayingMode: false,
  mobileTab: 'playlists',
  isSearchMode: false,

  // Initial state - Modals & Player
  activeModal: null,
  modalData: {},
  playerVideoId: null,
  isPlayerVisible: false,
  isPlayerPaused: false,
  playbackMode: 'normal',
  playbackQueue: [],
  playbackQueueIndex: -1,
  view: 'list',
  filterMode: 'all',
  searchQuery: '',
  sortBy: 'date',
  sortOrder: 'desc',
  filterArtist: null,
  filterPlaylists: [],
  isMobileSearchVisible: false,
  isMobileMenuOpen: false,
  isBatchMode: false,
  selectedPlaylists: new Set(),
  selectedTracks: new Set(),

  // Modal actions
  openModal: (type, data = {}) => {
    console.log('🪟 Opening modal:', type, data)
    set({ activeModal: type, modalData: data })
  },

  closeModal: () => {
    console.log('🪟 Closing modal')
    set({ activeModal: null, modalData: {} })
  },

  updateModalData: (data) => {
    set(state => ({
      modalData: { ...state.modalData, ...data }
    }))
  },

  // Navigation actions
  selectPlaylist: (playlistId) => {
    set({
      selectedPlaylistId: playlistId,
      selectedSongId: null,
      isNowPlayingMode: false,
      isSearchMode: false  // Exit search mode when selecting a playlist
    })
  },

  selectSong: (songId) => {
    set({ selectedSongId: songId, isNowPlayingMode: false })
  },

  toggleNowPlayingMode: () => {
    set(state => ({ isNowPlayingMode: !state.isNowPlayingMode }))
  },

  setMobileTab: (tab) => {
    set({ mobileTab: tab })
  },

  enterSearchMode: () => {
    set({ isSearchMode: true, selectedSongId: null, isNowPlayingMode: false })
  },

  exitSearchMode: () => {
    set({ isSearchMode: false })
  },

  // Player actions
  playVideo: (videoId) => {
    console.log('▶️ Playing video:', videoId)
    set(state => {
      // If already in a queue, find the index
      const queueIndex = state.playbackQueue.indexOf(videoId)
      return {
        playerVideoId: videoId,
        isPlayerVisible: true,
        isPlayerPaused: false,
        playbackQueueIndex: queueIndex >= 0 ? queueIndex : state.playbackQueueIndex
      }
    })
  },

  playVideoInQueue: (videoId, queue) => {
    console.log('▶️ Playing video in queue:', videoId, `(${queue.length} tracks)`)
    const queueIndex = queue.indexOf(videoId)
    set({
      playerVideoId: videoId,
      isPlayerVisible: true,
      isPlayerPaused: false,
      playbackQueue: queue,
      playbackQueueIndex: queueIndex >= 0 ? queueIndex : 0
    })
  },

  pausePlayer: () => {
    set(state => state.isPlayerPaused ? {} : { isPlayerPaused: true })
  },

  resumePlayer: () => {
    set(state => state.isPlayerPaused ? { isPlayerPaused: false } : {})
  },

  togglePlayPause: () => {
    set(state => ({ isPlayerPaused: !state.isPlayerPaused }))
  },

  closePlayer: () => {
    console.log('⏹️ Closing player')
    set({ playerVideoId: null, isPlayerVisible: false, isPlayerPaused: false, playbackQueue: [], playbackQueueIndex: -1 })
  },

  setPlaybackMode: (mode) => {
    console.log('🔀 Setting playback mode:', mode)
    set({ playbackMode: mode })
  },

  cyclePlaybackMode: () => {
    set(state => {
      const modes: PlaybackMode[] = ['normal', 'loop-all', 'loop-one', 'shuffle']
      const currentIndex = modes.indexOf(state.playbackMode)
      const nextMode = modes[(currentIndex + 1) % modes.length]
      console.log('🔀 Cycling playback mode:', state.playbackMode, '→', nextMode)
      return { playbackMode: nextMode }
    })
  },

  playNext: () => {
    set(state => {
      const { playbackQueue, playbackQueueIndex, playbackMode } = state

      if (playbackQueue.length === 0) {
        console.log('⏭️ No queue, stopping')
        return {}
      }

      // Loop one: replay current
      if (playbackMode === 'loop-one') {
        console.log('🔁 Loop one: replaying current')
        return { isPlayerPaused: false }
      }

      let nextIndex: number

      if (playbackMode === 'shuffle') {
        // Random next (excluding current)
        const availableIndices = playbackQueue
          .map((_, i) => i)
          .filter(i => i !== playbackQueueIndex)
        if (availableIndices.length === 0) {
          nextIndex = playbackQueueIndex
        } else {
          nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
        }
        console.log('🔀 Shuffle: playing random track', nextIndex)
      } else {
        // Normal or loop-all: go to next
        nextIndex = playbackQueueIndex + 1

        if (nextIndex >= playbackQueue.length) {
          if (playbackMode === 'loop-all') {
            nextIndex = 0
            console.log('🔁 Loop all: restarting from beginning')
          } else {
            console.log('⏹️ End of queue')
            return { isPlayerPaused: true }
          }
        }
      }

      const nextVideoId = playbackQueue[nextIndex]
      console.log('⏭️ Playing next:', nextVideoId)
      return {
        playerVideoId: nextVideoId,
        playbackQueueIndex: nextIndex,
        isPlayerPaused: false
      }
    })
  },

  playPrevious: () => {
    set(state => {
      const { playbackQueue, playbackQueueIndex, playbackMode } = state

      if (playbackQueue.length === 0) {
        return {}
      }

      let prevIndex: number

      if (playbackMode === 'shuffle') {
        // Random (same logic as next for shuffle)
        const availableIndices = playbackQueue
          .map((_, i) => i)
          .filter(i => i !== playbackQueueIndex)
        if (availableIndices.length === 0) {
          prevIndex = playbackQueueIndex
        } else {
          prevIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
        }
      } else {
        prevIndex = playbackQueueIndex - 1
        if (prevIndex < 0) {
          prevIndex = playbackMode === 'loop-all' ? playbackQueue.length - 1 : 0
        }
      }

      const prevVideoId = playbackQueue[prevIndex]
      console.log('⏮️ Playing previous:', prevVideoId)
      return {
        playerVideoId: prevVideoId,
        playbackQueueIndex: prevIndex,
        isPlayerPaused: false
      }
    })
  },

  // View actions
  setView: (view) => {
    console.log('👁️ Setting view:', view)
    set({ view })
  },

  setFilterMode: (mode) => {
    console.log('🔍 Setting filter mode:', mode)
    set({ filterMode: mode })
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  // Sorting actions
  setSortBy: (sortBy) => {
    set({ sortBy })
  },

  setSortOrder: (order) => {
    set({ sortOrder: order })
  },

  toggleSortOrder: () => {
    set(state => ({ sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc' }))
  },

  // Advanced filter actions
  setFilterArtist: (artist) => {
    set({ filterArtist: artist })
  },

  setFilterPlaylists: (playlistIds) => {
    set({ filterPlaylists: playlistIds })
  },

  clearFilters: () => {
    set({
      searchQuery: '',
      filterMode: 'all',
      filterArtist: null,
      filterPlaylists: [],
      sortBy: 'date',
      sortOrder: 'desc'
    })
  },

  // Mobile actions
  toggleMobileSearch: () => {
    set(state => ({ isMobileSearchVisible: !state.isMobileSearchVisible }))
  },

  toggleMobileMenu: () => {
    set(state => ({ isMobileMenuOpen: !state.isMobileMenuOpen }))
  },

  closeMobileMenu: () => {
    set({ isMobileMenuOpen: false })
  },

  // Batch mode actions
  toggleBatchMode: () => {
    set(state => {
      const newMode = !state.isBatchMode
      console.log('📦 Batch mode:', newMode ? 'ON' : 'OFF')
      return { isBatchMode: newMode }
    })
  },

  exitBatchMode: () => {
    console.log('📦 Exiting batch mode')
    set({ isBatchMode: false })
  },

  // Batch selection actions
  togglePlaylistSelection: (playlistId) => {
    set(state => {
      const newSet = new Set(state.selectedPlaylists)
      if (newSet.has(playlistId)) {
        newSet.delete(playlistId)
      } else {
        newSet.add(playlistId)
      }
      return { selectedPlaylists: newSet }
    })
  },

  clearPlaylistSelection: () => {
    set({ selectedPlaylists: new Set() })
  },

  toggleTrackSelection: (trackId) => {
    set(state => {
      const newSet = new Set(state.selectedTracks)
      if (newSet.has(trackId)) {
        newSet.delete(trackId)
      } else {
        newSet.add(trackId)
      }
      return { selectedTracks: newSet }
    })
  },

  clearTrackSelection: () => {
    set({ selectedTracks: new Set() })
  }
}))
