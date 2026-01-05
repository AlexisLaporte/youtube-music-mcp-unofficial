'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { XMarkIcon, ChevronUpIcon, PlayIcon, PauseIcon, HeartIcon as HeartSolidIcon, PlusIcon } from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutlineIcon, QueueListIcon, XMarkIcon as XMarkOutlineIcon } from '@heroicons/react/24/outline'

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, options: YouTubePlayerOptions) => YouTubePlayer
      PlayerState: {
        PLAYING: number
        PAUSED: number
        ENDED: number
        BUFFERING: number
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YouTubePlayerOptions {
  height: string
  width: string
  videoId: string
  playerVars: {
    autoplay: number
    controls: number
    modestbranding: number
    rel: number
  }
  events: {
    onReady: (event: { target: YouTubePlayer }) => void
    onStateChange: (event: { data: number }) => void
  }
}

interface YouTubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  destroy: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const { playerVideoId, closePlayer, toggleNowPlayingMode, isNowPlayingMode, isPlayerPaused, pausePlayer, resumePlayer, openModal } = useUIStore()
  const songsMap = useMusicStore(state => state.songs)
  const playlistsMap = useMusicStore(state => state.playlists)
  const toggleLike = useMusicStore(state => state.toggleLike)
  const removeSongFromPlaylist = useMusicStore(state => state.removeSongFromPlaylist)

  const playerRef = useRef<YouTubePlayer | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isApiReady, setIsApiReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)
  const animationRef = useRef<number | null>(null)
  const isPlaying = !isPlayerPaused

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT) {
      setIsApiReady(true)
      return
    }

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)

    window.onYouTubeIframeAPIReady = () => {
      setIsApiReady(true)
    }

    return () => {
      window.onYouTubeIframeAPIReady = () => {}
    }
  }, [])

  // Create/update player when video changes
  useEffect(() => {
    if (!isApiReady || !playerVideoId || !containerRef.current) return

    // Reset progress for new track
    setCurrentTime(0)
    setDuration(0)

    // Destroy existing player
    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }

    // Create container div for the player
    const playerDiv = document.createElement('div')
    playerDiv.id = 'yt-player-' + Date.now()
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(playerDiv)

    playerRef.current = new window.YT.Player(playerDiv.id, {
      height: '0',
      width: '0',
      videoId: playerVideoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event) => {
          setDuration(event.target.getDuration())
          resumePlayer()
        },
        onStateChange: (event) => {
          const playing = event.data === window.YT.PlayerState.PLAYING
          if (playing) {
            resumePlayer()
            setDuration(playerRef.current?.getDuration() || 0)
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            pausePlayer()
          }
        }
      }
    })

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isApiReady, playerVideoId, resumePlayer, pausePlayer])

  // Sync with store pause state
  useEffect(() => {
    if (!playerRef.current) return
    try {
      if (isPlayerPaused) {
        playerRef.current.pauseVideo()
      } else {
        playerRef.current.playVideo()
      }
    } catch {
      // Player might not be ready
    }
  }, [isPlayerPaused])

  // Update progress
  useEffect(() => {
    const updateProgress = () => {
      if (playerRef.current && !isDragging) {
        try {
          const time = playerRef.current.getCurrentTime()
          setCurrentTime(time)
        } catch {
          // Player might not be ready
        }
      }
      animationRef.current = requestAnimationFrame(updateProgress)
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateProgress)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isPlaying, isDragging])

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return
    if (isPlaying) {
      pausePlayer()
    } else {
      resumePlayer()
    }
  }, [isPlaying, pausePlayer, resumePlayer])

  const handleSeek = useCallback((delta: number) => {
    if (!playerRef.current || !duration) return
    const newTime = Math.max(0, Math.min(duration, currentTime + delta))
    playerRef.current.seekTo(newTime, true)
    setCurrentTime(newTime)
  }, [currentTime, duration])

  // Keyboard shortcuts (space = play/pause, arrows = seek)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          handlePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handleSeek(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          handleSeek(10)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlePlayPause, handleSeek])

  // Close playlist menu when clicking outside
  useEffect(() => {
    if (!showPlaylistMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-playlist-menu]')) {
        setShowPlaylistMenu(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showPlaylistMenu])

  // Close playlist menu when video changes
  useEffect(() => {
    setShowPlaylistMenu(false)
  }, [playerVideoId])

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !playerRef.current || !duration) return

    const rect = progressRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = clickX / rect.width
    const seekTime = percent * duration

    playerRef.current.seekTo(seekTime, true)
    setCurrentTime(seekTime)
  }, [duration])

  const handleProgressDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !progressRef.current || !duration) return

    const rect = progressRef.current.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const percent = clickX / rect.width
    const seekTime = percent * duration

    setCurrentTime(seekTime)
  }, [isDragging, duration])

  const handleDragEnd = useCallback(() => {
    if (isDragging && playerRef.current) {
      playerRef.current.seekTo(currentTime, true)
    }
    setIsDragging(false)
  }, [isDragging, currentTime])

  const handleClose = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.destroy()
      playerRef.current = null
    }
    closePlayer()
  }, [closePlayer])

  if (!playerVideoId) return null

  const song = songsMap.get(playerVideoId)
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isLiked = song?.isLiked ?? false
  const songPlaylists = song?.playlistIds
    .map(id => playlistsMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined) ?? []

  return (
    <div className="border-t border-gray-200 bg-white shadow-lg">
      {/* Hidden YouTube player container */}
      <div ref={containerRef} className="hidden" />

      {/* Player bar content */}
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Thumbnail (clickable to expand) */}
        <button
          onClick={toggleNowPlayingMode}
          className="relative flex-shrink-0 group"
        >
          {song?.thumbnail ? (
            <img
              src={song.thumbnail}
              alt=""
              className="w-14 h-14 rounded-lg object-cover shadow-md"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-gray-200" />
          )}
          <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ChevronUpIcon
              className={`w-6 h-6 text-white transition-transform ${isNowPlayingMode ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        {/* Play/Pause button */}
        <button
          onClick={handlePlayPause}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-red-pantone text-white hover:bg-crimson hover:scale-105 transition-all flex-shrink-0 shadow-md"
        >
          {isPlaying ? (
            <PauseIcon className="w-6 h-6" />
          ) : (
            <PlayIcon className="w-6 h-6 ml-0.5" />
          )}
        </button>

        {/* Center section: Song info + Progress */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* Song info */}
          <div className="flex items-center gap-2 mb-1">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 truncate">
                {song?.title || 'Now playing...'}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {song?.artist || 'YouTube'}
              </div>
            </div>
          </div>

          {/* Progress bar (clickable) - larger hit area */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono w-10 text-right">
              {formatTime(currentTime)}
            </span>
            <div
              ref={progressRef}
              className="flex-1 h-6 flex items-center cursor-pointer group"
              onClick={handleProgressClick}
              onMouseDown={() => setIsDragging(true)}
              onMouseMove={handleProgressDrag}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
            >
              <div className="w-full h-1.5 bg-gray-200 rounded-full relative group-hover:h-2 transition-all">
                <div
                  className="h-full bg-red-pantone rounded-full relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-red-pantone rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md -mr-2" />
                </div>
              </div>
            </div>
            <span className="text-xs text-gray-500 font-mono w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Like button */}
        <button
          onClick={() => toggleLike(playerVideoId)}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          title={isLiked ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isLiked ? (
            <HeartSolidIcon className="w-6 h-6 text-red-pantone" />
          ) : (
            <HeartOutlineIcon className="w-6 h-6 text-gray-400 hover:text-red-pantone transition-colors" />
          )}
        </button>

        {/* Playlist menu button */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
            className={`p-2 rounded-full transition-colors ${
              showPlaylistMenu ? 'bg-gray-100' : 'hover:bg-gray-100'
            }`}
            title="Manage playlists"
          >
            <QueueListIcon className="w-5 h-5 text-gray-500" />
            {songPlaylists.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-pantone text-white text-xs rounded-full flex items-center justify-center">
                {songPlaylists.length}
              </span>
            )}
          </button>

          {/* Playlist dropdown */}
          {showPlaylistMenu && (
            <div data-playlist-menu className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50">
              <div className="p-2 border-b border-gray-100">
                <button
                  onClick={() => {
                    openModal('playlist-selector', { videoId: playerVideoId })
                    setShowPlaylistMenu(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add to playlist
                </button>
              </div>
              {songPlaylists.length > 0 && (
                <div className="p-2 max-h-48 overflow-y-auto">
                  <div className="text-xs text-gray-500 px-3 py-1 mb-1">In playlists</div>
                  {songPlaylists.map(playlist => (
                    <div
                      key={playlist.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg group"
                    >
                      {playlist.thumbnail ? (
                        <img src={playlist.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-gray-200" />
                      )}
                      <span className="flex-1 text-sm text-gray-700 truncate">{playlist.title}</span>
                      <button
                        onClick={() => {
                          removeSongFromPlaylist(playerVideoId, playlist.id)
                        }}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                        title={`Remove from ${playlist.title}`}
                      >
                        <XMarkOutlineIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          title="Close player"
        >
          <XMarkIcon className="w-5 h-5 text-gray-500" />
        </button>
      </div>
    </div>
  )
}
