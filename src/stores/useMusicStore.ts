import { create } from 'zustand'
import { persist, PersistStorage } from 'zustand/middleware'
import { Song, Playlist } from '@/types/youtube'
import { apiService } from '@/services/apiService'

const SYNC_TTL = 60 * 60 * 1000 // 1 hour

// Serialized state format for localStorage
interface PersistedState {
  songs: [string, Song][]
  playlists: [string, Playlist][]
  playlistSongs: [string, string[]][]
  lastSyncAt: number | null
}

// Custom storage to handle Map serialization
const musicStorage: PersistStorage<Pick<MusicState, 'songs' | 'playlists' | 'playlistSongs' | 'lastSyncAt'>> = {
  getItem: (name) => {
    const str = localStorage.getItem(name)
    if (!str) return null
    try {
      const parsed = JSON.parse(str) as { state: PersistedState; version?: number }
      return {
        ...parsed,
        state: {
          songs: new Map(parsed.state.songs || []),
          playlists: new Map(parsed.state.playlists || []),
          playlistSongs: new Map(parsed.state.playlistSongs || []),
          lastSyncAt: parsed.state.lastSyncAt,
        },
      }
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    const toStore = {
      ...value,
      state: {
        songs: Array.from(value.state.songs.entries()),
        playlists: Array.from(value.state.playlists.entries()),
        playlistSongs: Array.from(value.state.playlistSongs.entries()),
        lastSyncAt: value.state.lastSyncAt,
      },
    }
    localStorage.setItem(name, JSON.stringify(toStore))
  },
  removeItem: (name) => localStorage.removeItem(name),
}

interface MusicState {
  // Entities
  songs: Map<string, Song>
  playlists: Map<string, Playlist>

  // Relations (ordered)
  playlistSongs: Map<string, string[]> // playlistId → [videoId, ...]

  // Sync metadata
  lastSyncAt: number | null
  isSyncing: boolean
  syncError: string | null

  // Getters
  getSong: (videoId: string) => Song | undefined
  getPlaylist: (playlistId: string) => Playlist | undefined
  getPlaylistsForSong: (videoId: string) => Playlist[]
  getSongsForPlaylist: (playlistId: string) => Song[]
  getLikedSongs: () => Song[]
  getAllSongs: () => Song[]
  getAllPlaylists: () => Playlist[]

  // Sync actions
  fullSync: () => Promise<void>
  smartSync: () => Promise<void>

  // Optimistic actions
  addSongToPlaylist: (videoId: string, playlistId: string) => Promise<void>
  removeSongFromPlaylist: (videoId: string, playlistId: string) => Promise<void>
  createPlaylist: (title: string, description: string, privacy: 'public' | 'private' | 'unlisted') => Promise<string>
  deletePlaylist: (playlistId: string) => Promise<void>
  toggleLike: (videoId: string) => Promise<void>

  // Utility
  clearAll: () => void
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
  // Initial state
  songs: new Map(),
  playlists: new Map(),
  playlistSongs: new Map(),
  lastSyncAt: null,
  isSyncing: false,
  syncError: null,

  // ============ Getters ============

  getSong: (videoId) => get().songs.get(videoId),

  getPlaylist: (playlistId) => get().playlists.get(playlistId),

  getPlaylistsForSong: (videoId) => {
    const song = get().songs.get(videoId)
    if (!song) return []
    return song.playlistIds
      .map(id => get().playlists.get(id))
      .filter((p): p is Playlist => p !== undefined)
  },

  getSongsForPlaylist: (playlistId) => {
    const videoIds = get().playlistSongs.get(playlistId) || []
    return videoIds
      .map(id => get().songs.get(id))
      .filter((s): s is Song => s !== undefined)
  },

  getLikedSongs: () => {
    return Array.from(get().songs.values()).filter(s => s.isLiked)
  },

  getAllSongs: () => Array.from(get().songs.values()),

  getAllPlaylists: () => Array.from(get().playlists.values()),

  // ============ Sync Actions ============

  fullSync: async () => {
    set({ isSyncing: true, syncError: null })
    console.log('🔄 Starting full sync...')

    try {
      // 1. Fetch playlists
      const rawPlaylists = await apiService.getPlaylists()
      const playlists = new Map<string, Playlist>()
      for (const p of rawPlaylists) {
        playlists.set(p.id, {
          id: p.id,
          title: p.title,
          description: p.description,
          thumbnail: p.thumbnail,
          privacy: p.privacy,
          publishedAt: p.publishedAt,
        })
      }

      // 2. Fetch liked songs
      const rawLikedSongs = await apiService.getLikedSongs()
      const songs = new Map<string, Song>()

      for (const track of rawLikedSongs) {
        songs.set(track.videoId, {
          videoId: track.videoId,
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          thumbnail: track.thumbnail,
          isLiked: true,
          playlistIds: [],
          addedAt: track.addedAt,
        })
      }

      // 3. Fetch tracks for each playlist and build relations
      const playlistSongs = new Map<string, string[]>()

      for (const playlist of rawPlaylists) {
        const tracks = await apiService.getPlaylistTracks(playlist.id)
        const videoIds: string[] = []

        for (const track of tracks) {
          videoIds.push(track.videoId)

          // Add or update song
          const existing = songs.get(track.videoId)
          if (existing) {
            // Avoid duplicates (same song can appear twice in a playlist)
            if (!existing.playlistIds.includes(playlist.id)) {
              existing.playlistIds.push(playlist.id)
            }
          } else {
            songs.set(track.videoId, {
              videoId: track.videoId,
              title: track.title,
              artist: track.artist,
              duration: track.duration,
              thumbnail: track.thumbnail,
              isLiked: false,
              playlistIds: [playlist.id],
              addedAt: track.addedAt,
            })
          }
        }

        playlistSongs.set(playlist.id, videoIds)
      }

      set({
        songs,
        playlists,
        playlistSongs,
        lastSyncAt: Date.now(),
        isSyncing: false,
      })

      console.log(`✅ Sync complete: ${songs.size} songs, ${playlists.size} playlists`)
    } catch (error) {
      console.error('❌ Sync failed:', error)
      set({
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Sync failed',
      })
      throw error
    }
  },

  smartSync: async () => {
    const { lastSyncAt } = get()
    const now = Date.now()

    if (lastSyncAt && now - lastSyncAt < SYNC_TTL) {
      console.log('📦 Data is fresh, skipping sync')
      return
    }

    await get().fullSync()
  },

  // ============ Optimistic Actions ============

  addSongToPlaylist: async (videoId, playlistId) => {
    const { songs, playlistSongs } = get()
    const song = songs.get(videoId)

    if (!song) {
      console.error(`❌ Cannot add song ${videoId} to playlist: song not found in store`)
      return
    }

    if (song.playlistIds.includes(playlistId)) {
      console.log(`ℹ️ Song ${videoId} already in playlist ${playlistId}`)
      return
    }

    // 1. Optimistic update with proper immutability
    const updatedSong = {
      ...song,
      playlistIds: [...song.playlistIds, playlistId]
    }
    const newSongs = new Map(songs)
    newSongs.set(videoId, updatedSong)

    const currentPlaylistSongs = playlistSongs.get(playlistId) || []
    const newPlaylistSongs = new Map(playlistSongs)
    if (!currentPlaylistSongs.includes(videoId)) {
      newPlaylistSongs.set(playlistId, [...currentPlaylistSongs, videoId])
    }

    set({ songs: newSongs, playlistSongs: newPlaylistSongs })
    console.log(`✅ Added ${videoId} to playlist ${playlistId} (optimistic)`)

    // 2. API call in background
    apiService.addVideoToPlaylist(playlistId, videoId).catch(err => {
      console.error('❌ API sync failed for addSongToPlaylist:', err)
      // Rollback on failure
      const rollbackSongs = new Map(get().songs)
      rollbackSongs.set(videoId, song)
      const rollbackPlaylistSongs = new Map(get().playlistSongs)
      rollbackPlaylistSongs.set(playlistId, currentPlaylistSongs)
      set({ songs: rollbackSongs, playlistSongs: rollbackPlaylistSongs })
    })
  },

  removeSongFromPlaylist: async (videoId, playlistId) => {
    const { songs, playlistSongs } = get()
    const song = songs.get(videoId)

    // 1. Optimistic update
    if (song) {
      const newPlaylistIds = song.playlistIds.filter(id => id !== playlistId)
      const newSongs = new Map(songs)
      newSongs.set(videoId, { ...song, playlistIds: newPlaylistIds })

      const currentPlaylistSongs = playlistSongs.get(playlistId) || []
      const newPlaylistSongsMap = new Map(playlistSongs)
      newPlaylistSongsMap.set(playlistId, currentPlaylistSongs.filter(id => id !== videoId))

      set({ songs: newSongs, playlistSongs: newPlaylistSongsMap })
      console.log(`✅ Removed ${videoId} from playlist ${playlistId} (optimistic)`)
    }

    // 2. API call in background
    apiService.removeVideoFromPlaylist(playlistId, videoId).catch(err => {
      console.error('❌ API sync failed for removeSongFromPlaylist:', err)
      // Rollback on failure
      if (song) {
        const rollbackSongs = new Map(get().songs)
        rollbackSongs.set(videoId, { ...song })
        const rollbackPlaylistSongs = new Map(get().playlistSongs)
        rollbackPlaylistSongs.set(playlistId, [...(get().playlistSongs.get(playlistId) || []), videoId])
        set({ songs: rollbackSongs, playlistSongs: rollbackPlaylistSongs })
      }
    })
  },

  createPlaylist: async (title, description, privacy) => {
    // 1. Create with temp ID
    const tempId = `temp_${Date.now()}`
    const newPlaylist: Playlist = {
      id: tempId,
      title,
      description,
      privacy,
    }

    const { playlists, playlistSongs } = get()
    const newPlaylists = new Map(playlists)
    newPlaylists.set(tempId, newPlaylist)
    const newPlaylistSongs = new Map(playlistSongs)
    newPlaylistSongs.set(tempId, [])

    set({ playlists: newPlaylists, playlistSongs: newPlaylistSongs })
    console.log(`✅ Created playlist ${title} (temp ID: ${tempId})`)

    // 2. API call and replace temp ID
    try {
      const realId = await apiService.createPlaylist(title, description, privacy)

      // Replace temp ID with real ID
      const updatedPlaylists = new Map(get().playlists)
      const playlist = updatedPlaylists.get(tempId)
      if (playlist) {
        updatedPlaylists.delete(tempId)
        updatedPlaylists.set(realId, { ...playlist, id: realId })
      }

      const updatedPlaylistSongs = new Map(get().playlistSongs)
      const songs = updatedPlaylistSongs.get(tempId)
      if (songs !== undefined) {
        updatedPlaylistSongs.delete(tempId)
        updatedPlaylistSongs.set(realId, songs)
      }

      set({ playlists: updatedPlaylists, playlistSongs: updatedPlaylistSongs })
      console.log(`✅ Playlist ID updated: ${tempId} → ${realId}`)

      return realId
    } catch (err) {
      // Rollback
      const rollbackPlaylists = new Map(get().playlists)
      rollbackPlaylists.delete(tempId)
      const rollbackPlaylistSongs = new Map(get().playlistSongs)
      rollbackPlaylistSongs.delete(tempId)
      set({ playlists: rollbackPlaylists, playlistSongs: rollbackPlaylistSongs })
      throw err
    }
  },

  deletePlaylist: async (playlistId) => {
    const { playlists, playlistSongs, songs } = get()

    // 1. Optimistic update
    const newPlaylists = new Map(playlists)
    newPlaylists.delete(playlistId)

    const newPlaylistSongs = new Map(playlistSongs)
    newPlaylistSongs.delete(playlistId)

    // Remove playlist from all songs
    const newSongs = new Map(songs)
    for (const [videoId, song] of newSongs) {
      if (song.playlistIds.includes(playlistId)) {
        newSongs.set(videoId, {
          ...song,
          playlistIds: song.playlistIds.filter(id => id !== playlistId),
        })
      }
    }

    set({ playlists: newPlaylists, playlistSongs: newPlaylistSongs, songs: newSongs })
    console.log(`✅ Deleted playlist ${playlistId} (optimistic)`)

    // 2. API call in background
    apiService.deletePlaylist(playlistId).catch(err => {
      console.error('❌ API sync failed for deletePlaylist:', err)
    })
  },

  toggleLike: async (videoId) => {
    const { songs } = get()
    const song = songs.get(videoId)
    if (!song) return

    const newIsLiked = !song.isLiked

    // 1. Optimistic update
    const newSongs = new Map(songs)
    newSongs.set(videoId, { ...song, isLiked: newIsLiked })
    set({ songs: newSongs })
    console.log(`${newIsLiked ? '❤️' : '💔'} ${newIsLiked ? 'Liked' : 'Unliked'} ${videoId} (optimistic)`)

    // 2. API call in background
    apiService.rateVideo(videoId, newIsLiked ? 'like' : 'none').catch(err => {
      console.error('❌ API sync failed for toggleLike:', err)
      // Rollback on failure
      const rollbackSongs = new Map(get().songs)
      rollbackSongs.set(videoId, { ...song })
      set({ songs: rollbackSongs })
    })
  },

  // ============ Utility ============

  clearAll: () => {
    set({
      songs: new Map(),
      playlists: new Map(),
      playlistSongs: new Map(),
      lastSyncAt: null,
      syncError: null,
    })
  },
    }),
    {
      name: 'music-store',
      storage: musicStorage,
      partialize: (state) => ({
        songs: state.songs,
        playlists: state.playlists,
        playlistSongs: state.playlistSongs,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
)
