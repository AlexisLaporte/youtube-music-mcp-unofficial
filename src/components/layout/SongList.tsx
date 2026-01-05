'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { PlayIcon, PauseIcon, HeartIcon } from '@heroicons/react/24/solid'
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

  // Count orphan tracks (not in any playlist)
  const orphanCount = useMemo(() =>
    songs.filter(s => s.playlistIds.length === 0).length,
    [songs]
  )

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
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 truncate">{title}</h2>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-sm text-gray-400">{songs.length} tracks</p>
          {orphanCount > 0 && selectedPlaylistId === 'liked' && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              {orphanCount} to organize
            </span>
          )}
        </div>
      </div>

      {/* Song list */}
      <div className="flex-1 overflow-y-auto">
        {songs.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 text-sm">
              {selectedPlaylistId ? 'No tracks in this playlist' : 'Select a playlist to see tracks'}
            </div>
          </div>
        ) : (
          <div className="p-2">
            {songs.map((song, index) => {
              const isSelected = selectedSongId === song.videoId
              const isPlaying = playerVideoId === song.videoId

              return (
                <button
                  key={song.videoId}
                  onClick={() => handleSongClick(song)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-3 rounded-xl transition-all duration-150 group ${
                    isSelected
                      ? 'bg-red-pantone/5 ring-1 ring-red-pantone/20'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Track number or thumbnail */}
                  <div className="relative w-11 h-11 flex-shrink-0">
                    {song.thumbnail ? (
                      <img
                        src={song.thumbnail}
                        alt=""
                        className="w-full h-full rounded-lg object-cover shadow-sm"
                      />
                    ) : (
                      <div className="w-full h-full rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-400 font-medium">{index + 1}</span>
                      </div>
                    )}

                    {/* Play/Pause overlay */}
                    <div
                      onClick={(e) => handlePlay(e, song.videoId)}
                      className={`absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm transition-all duration-200 ${
                        isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isPlaying && !isPlayerPaused ? (
                        <PauseIcon className="w-5 h-5 text-white" />
                      ) : (
                        <PlayIcon className="w-5 h-5 text-white ml-0.5" />
                      )}
                    </div>

                    {/* Playing indicator */}
                    {isPlaying && (
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5">
                        <span className="absolute inset-0 bg-red-pantone rounded-full animate-ping opacity-75" />
                        <span className="absolute inset-0 bg-red-pantone rounded-full" />
                      </div>
                    )}
                  </div>

                  {/* Song info */}
                  <div className="min-w-0 flex-1">
                    <div className={`font-medium truncate text-sm ${isPlaying ? 'text-red-pantone' : 'text-gray-900'}`}>
                      {song.title}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{song.artist}</div>
                  </div>

                  {/* Liked indicator */}
                  {song.isLiked && (
                    <HeartIcon
                      className="w-4 h-4 text-red-pantone flex-shrink-0"
                      title="In Liked Songs"
                    />
                  )}

                  {/* Not in any playlist indicator */}
                  {song.playlistIds.length === 0 && (
                    <div
                      className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"
                      title="Not in any playlist"
                    />
                  )}

                  {/* Duration */}
                  {song.duration && (
                    <div className="text-xs text-gray-400 flex-shrink-0 font-medium tabular-nums">
                      {song.duration}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
