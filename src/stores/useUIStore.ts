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

interface UIState {
  // Modals
  activeModal: ModalType
  modalData: ModalData

  // Mini Player
  playerVideoId: string | null
  isPlayerVisible: boolean

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

  // Actions - Modals
  openModal: (type: ModalType, data?: ModalData) => void
  closeModal: () => void
  updateModalData: (data: Partial<ModalData>) => void

  // Actions - Player
  playVideo: (videoId: string) => void
  closePlayer: () => void

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
}

export const useUIStore = create<UIState>((set) => ({
  // Initial state
  activeModal: null,
  modalData: {},
  playerVideoId: null,
  isPlayerVisible: false,
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

  // Player actions
  playVideo: (videoId) => {
    console.log('▶️ Playing video:', videoId)
    set({ playerVideoId: videoId, isPlayerVisible: true })
  },

  closePlayer: () => {
    console.log('⏹️ Closing player')
    set({ playerVideoId: null, isPlayerVisible: false })
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
  }
}))
