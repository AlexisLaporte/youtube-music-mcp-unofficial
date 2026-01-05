'use client'

import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { PlaylistDetail } from '@/components/detail/PlaylistDetail'
import { SongDetail } from '@/components/detail/SongDetail'
import { SearchPanel } from '@/components/search'
import { MusicalNoteIcon } from '@heroicons/react/24/outline'

export function DetailPanel() {
  const { selectedPlaylistId, selectedSongId, isNowPlayingMode, playerVideoId, isSearchMode } = useUIStore()
  const songsMap = useMusicStore(state => state.songs)
  const playlistsMap = useMusicStore(state => state.playlists)

  // Search mode: show search panel
  if (isSearchMode) {
    return <SearchPanel />
  }

  // Now Playing mode: show currently playing song
  if (isNowPlayingMode && playerVideoId) {
    const song = songsMap.get(playerVideoId)
    if (song) {
      return <SongDetail song={song} isNowPlaying />
    }
  }

  // Song selected: show song detail
  if (selectedSongId) {
    const song = songsMap.get(selectedSongId)
    if (song) {
      // Show "now playing" style if this song is currently playing
      const isPlaying = playerVideoId === selectedSongId
      return <SongDetail song={song} isNowPlaying={isPlaying} />
    }
  }

  // Playlist selected (no song): show playlist detail
  if (selectedPlaylistId && selectedPlaylistId !== 'liked') {
    const playlist = playlistsMap.get(selectedPlaylistId)
    if (playlist) {
      return <PlaylistDetail playlist={playlist} />
    }
  }

  // Liked Songs selected (no song): show liked songs stats
  if (selectedPlaylistId === 'liked') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center mb-6">
          <MusicalNoteIcon className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Liked Songs</h2>
        <p className="text-gray-500 dark:text-slate-400 max-w-md">
          Select a track to view its details and audio analysis.
        </p>
      </div>
    )
  }

  // Nothing selected
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center mb-6">
        <MusicalNoteIcon className="w-10 h-10 text-gray-400 dark:text-slate-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Welcome</h2>
      <p className="text-gray-500 dark:text-slate-400 max-w-md">
        Select a playlist to get started.
      </p>
    </div>
  )
}
