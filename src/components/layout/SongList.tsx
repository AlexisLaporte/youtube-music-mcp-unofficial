'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { PlayIcon, PauseIcon } from '@heroicons/react/24/solid'
import { Song } from '@/types/youtube'

export function SongList() {
  const router = useRouter()
  const { selectedPlaylistId, selectedSongId, playerVideoId, playVideo, togglePlayPause, isPlayerPaused, setMobileTab } = useUIStore()
  const songsMap = useMusicStore(state => state.songs)
  const playlistsMap = useMusicStore(state => state.playlists)
  const playlistSongsMap = useMusicStore(state => state.playlistSongs)

  const songs: Song[] = useMemo(() => {
    if (selectedPlaylistId === 'liked') {
      return Array.from(songsMap.values()).filter(s => s.isLiked)
    }
    if (selectedPlaylistId) {
      const videoIds = playlistSongsMap.get(selectedPlaylistId) || []
      return videoIds
        .map(id => songsMap.get(id))
        .filter((s): s is Song => s !== undefined)
    }
    return []
  }, [selectedPlaylistId, songsMap, playlistSongsMap])

  const playlist = useMemo(() =>
    selectedPlaylistId && selectedPlaylistId !== 'liked'
      ? playlistsMap.get(selectedPlaylistId)
      : null,
    [selectedPlaylistId, playlistsMap]
  )

  const title = selectedPlaylistId === 'liked'
    ? 'Liked Songs'
    : playlist?.title || 'Select a playlist'

  const handleSongClick = (song: Song) => {
    // Navigate via URL - use playlist context if available
    if (selectedPlaylistId && selectedPlaylistId !== 'liked') {
      router.push(`/playlist/${selectedPlaylistId}/song/${song.videoId}`)
    } else {
      router.push(`/song/${song.videoId}`)
    }
    setMobileTab('detail')
  }

  const handlePlay = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation()
    if (playerVideoId === videoId) {
      // Toggle play/pause for currently playing track
      togglePlayPause()
    } else {
      // Play new track
      playVideo(videoId)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
        <p className="text-sm text-gray-500">{songs.length} tracks</p>
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto">
        {songs.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            {selectedPlaylistId ? 'No tracks' : 'Select a playlist'}
          </div>
        ) : (
          songs.map(song => {
            const isSelected = selectedSongId === song.videoId
            const isPlaying = playerVideoId === song.videoId

            return (
              <button
                key={song.videoId}
                onClick={() => handleSongClick(song)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors group ${
                  isSelected
                    ? 'bg-red-50 border-l-4 border-red-pantone'
                    : 'hover:bg-gray-50 border-l-4 border-transparent'
                }`}
              >
                {/* Thumbnail with play overlay */}
                <div className="relative w-12 h-12 flex-shrink-0">
                  {song.thumbnail ? (
                    <img
                      src={song.thumbnail}
                      alt=""
                      className="w-full h-full rounded object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded bg-gray-200" />
                  )}

                  {/* Play/Pause overlay */}
                  <div
                    onClick={(e) => handlePlay(e, song.videoId)}
                    className={`absolute inset-0 flex items-center justify-center rounded bg-black/40 transition-opacity ${
                      isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isPlaying && !isPlayerPaused ? (
                      <PauseIcon className="w-6 h-6 text-white" />
                    ) : (
                      <PlayIcon className="w-6 h-6 text-white" />
                    )}
                  </div>

                  {/* Playing indicator */}
                  {isPlaying && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-pantone rounded-full animate-pulse" />
                  )}
                </div>

                {/* Song info */}
                <div className="min-w-0 flex-1">
                  <div className={`font-medium truncate ${isPlaying ? 'text-red-pantone' : 'text-gray-900'}`}>
                    {song.title}
                  </div>
                  <div className="text-sm text-gray-500 truncate">{song.artist}</div>
                </div>

                {/* Duration */}
                {song.duration && (
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {song.duration}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
