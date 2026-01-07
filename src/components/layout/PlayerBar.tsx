'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { XMarkIcon, ChevronUpIcon, PlayIcon, PauseIcon, HeartIcon as HeartSolidIcon, PlusIcon, BackwardIcon, ForwardIcon } from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutlineIcon, QueueListIcon, XMarkIcon as XMarkOutlineIcon, ArrowPathRoundedSquareIcon } from '@heroicons/react/24/outline'
import { Shuffle, Repeat1 } from 'lucide-react'
import type { FeatureMeta } from '@/types/docs'

/**
 * Persistent player bar with YouTube IFrame API integration.
 *
 * Supports queue management, shuffle, and repeat modes.
 * External tracks (from suggestions) are handled via externalTracks map
 * since they're not in the user's library.
 */
export const featureMeta: FeatureMeta = {
  id: 'player',
  name: 'Music Player',
  description: 'Play tracks with queue, shuffle, and repeat.',
  faq: [
    { q: 'Why does a track show no title?', a: 'Suggested tracks from discovery may briefly show no info while loading.' },
    { q: 'How does shuffle work?', a: 'Randomizes the queue when activated. Click again to restore original order.' },
  ]
}

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
    onError: (event: { data: number }) => void
  }
}

interface YouTubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getDuration: () => number
  getPlayerState: () => number
  loadVideoById: (videoId: string) => void
  destroy: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const router = useRouter()
  const {
    playerVideoId, closePlayer, toggleNowPlayingMode, isNowPlayingMode,
    isPlayerPaused, pausePlayer, resumePlayer, openModal,
    playbackMode, cyclePlaybackMode, playNext, playPrevious,
    playbackQueue, selectedPlaylistId, externalTracks
  } = useUIStore()
  const songsMap = useMusicStore(state => state.songs)
  const playlistsMap = useMusicStore(state => state.playlists)
  const toggleLike = useMusicStore(state => state.toggleLike)
  const removeSongFromPlaylist = useMusicStore(state => state.removeSongFromPlaylist)

  const playerRef = useRef<YouTubePlayer | null>(null)
  const playerReadyRef = useRef(false)  // Track if player is actually ready
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isApiReady, setIsApiReady] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)
  const seekUntilRef = useRef<number>(0)  // Ignore YouTube until this timestamp
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

  // Create player when API is ready and we have a video to play
  useEffect(() => {
    if (!isApiReady || !playerVideoId || !containerRef.current) return

    // Reset state for new track
    setCurrentTime(0)
    setDuration(0)
    seekUntilRef.current = 0

    // If player exists and is ready, just load the new video
    if (playerRef.current && playerReadyRef.current) {
      playerRef.current.loadVideoById(playerVideoId)
      return
    }

    // Need to create a new player
    playerReadyRef.current = false

    // Create container div for the player
    const playerDiv = document.createElement('div')
    playerDiv.id = 'yt-player-' + Date.now()
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(playerDiv)

    const videoIdToLoad = playerVideoId // Capture for closure

    playerRef.current = new window.YT.Player(playerDiv.id, {
      height: '0',
      width: '0',
      videoId: videoIdToLoad,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event) => {
          playerReadyRef.current = true
          setDuration(event.target.getDuration())
          useUIStore.getState().resumePlayer()
        },
        onStateChange: (event) => {
          if (!playerReadyRef.current) return
          const store = useUIStore.getState()

          const playing = event.data === window.YT.PlayerState.PLAYING
          if (playing) {
            store.resumePlayer()
            if (playerRef.current && typeof playerRef.current.getDuration === 'function') {
              setDuration(playerRef.current.getDuration())
              const time = playerRef.current.getCurrentTime()
              if (time < 1) {
                setCurrentTime(0)
              }
            }
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            store.pausePlayer()
          } else if (event.data === window.YT.PlayerState.ENDED) {
            // Handle loop-one mode by seeking to beginning
            if (store.playbackMode === 'loop-one' && playerRef.current && typeof playerRef.current.seekTo === 'function') {
              setCurrentTime(0)
              playerRef.current.seekTo(0, true)
              playerRef.current.playVideo()
            } else {
              // Call playNext - will trigger this effect again with new videoId
              store.playNext()
            }
          }
        },
        onError: (event) => {
          // YouTube error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=embed not allowed
          // Pre-validation during enrichment should handle most unavailable videos
          // This is just a fallback for edge cases
          console.warn(`⚠️ YouTube player error ${event.data} for video ${videoIdToLoad}, skipping...`)
          useUIStore.getState().playNext()
        }
      }
    })

    return () => {
      playerReadyRef.current = false
    }
  }, [isApiReady, playerVideoId])

  // Sync with store pause state
  useEffect(() => {
    if (!playerReadyRef.current || !playerRef.current) return
    if (isPlayerPaused) {
      playerRef.current.pauseVideo()
    } else {
      playerRef.current.playVideo()
    }
  }, [isPlayerPaused])

  // Update progress - using setInterval for reliable React state updates
  useEffect(() => {
    if (!playerVideoId) return

    const intervalId = setInterval(() => {
      if (playerReadyRef.current && playerRef.current && Date.now() > seekUntilRef.current) {
        try {
          setCurrentTime(playerRef.current.getCurrentTime())
        } catch {
          // Player might not be ready
        }
      }
    }, 100)  // 10 updates per second - smooth enough for progress bar

    return () => clearInterval(intervalId)
  }, [playerVideoId])

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return
    if (isPlaying) {
      pausePlayer()
    } else {
      resumePlayer()
    }
  }, [isPlaying, pausePlayer, resumePlayer])

  const handleSeek = useCallback((delta: number) => {
    if (!playerReadyRef.current || !playerRef.current || !duration) return
    const newTime = Math.max(0, Math.min(duration, currentTime + delta))
    seekUntilRef.current = Date.now() + 500
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
    if (!playerReadyRef.current || !progressRef.current || !playerRef.current || !duration) return

    const rect = progressRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = clickX / rect.width
    const seekTime = percent * duration

    seekUntilRef.current = Date.now() + 500
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
    if (isDragging && playerReadyRef.current && playerRef.current) {
      seekUntilRef.current = Date.now() + 500
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
  const externalTrack = externalTracks.get(playerVideoId)
  const trackInfo = song || externalTrack
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0
  const isLiked = song?.isLiked ?? false
  const songPlaylists = song?.playlistIds
    .map(id => playlistsMap.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined) ?? []

  return (
    <div className="relative">
      {/* Gradient border top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-pantone/30 to-transparent" />

      {/* Main player bar with glassmorphism */}
      <div className="bg-white/80 dark:bg-slate-900/90 backdrop-blur-xl border-t border-gray-200/50 dark:border-slate-700/50 shadow-[0_-4px_30px_rgba(0,0,0,0.08)]">
        {/* Hidden YouTube player container */}
        <div ref={containerRef} className="hidden" />

        {/* Player bar content */}
        <div className="flex items-center gap-4 px-5 py-3">
          {/* Thumbnail (clickable to expand) */}
          <button
            onClick={toggleNowPlayingMode}
            className="relative flex-shrink-0 group"
          >
            {trackInfo?.thumbnail ? (
              <img
                src={trackInfo.thumbnail}
                alt=""
                className="w-14 h-14 rounded-xl object-cover shadow-lg ring-1 ring-black/5 transition-transform duration-200 group-hover:scale-105"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 shadow-lg" />
            )}
            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center backdrop-blur-sm">
              <ChevronUpIcon
                className={`w-6 h-6 text-white transition-transform duration-300 ${isNowPlayingMode ? 'rotate-180' : ''}`}
              />
            </div>
            {/* Playing indicator dot */}
            {isPlaying && (
              <div className="absolute -top-1 -right-1 w-3 h-3">
                <span className="absolute inset-0 bg-red-pantone rounded-full animate-ping opacity-75" />
                <span className="absolute inset-0 bg-red-pantone rounded-full" />
              </div>
            )}
          </button>

          {/* Playback controls */}
          <div className="flex items-center gap-1">
            {/* Playback mode button */}
            <button
              onClick={cyclePlaybackMode}
              className={`p-2 rounded-full transition-all duration-200 ${
                playbackMode !== 'normal'
                  ? 'text-red-pantone bg-red-50 dark:bg-red-900/30'
                  : 'text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
              title={
                playbackMode === 'normal' ? 'Normal playback' :
                playbackMode === 'loop-all' ? 'Loop all' :
                playbackMode === 'loop-one' ? 'Loop one' :
                'Shuffle'
              }
            >
              {playbackMode === 'shuffle' ? (
                <Shuffle className="w-4 h-4" />
              ) : playbackMode === 'loop-one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <ArrowPathRoundedSquareIcon className={`w-4 h-4 ${playbackMode === 'loop-all' ? '' : 'opacity-50'}`} />
              )}
            </button>

            {/* Previous button */}
            <button
              onClick={playPrevious}
              disabled={playbackQueue.length === 0}
              className="p-2 rounded-full text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              title="Previous"
            >
              <BackwardIcon className="w-5 h-5" />
            </button>

            {/* Play/Pause button */}
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-br from-red-pantone to-crimson text-white hover:shadow-lg hover:shadow-red-pantone/25 hover:scale-105 active:scale-95 transition-all duration-200 flex-shrink-0"
            >
              {isPlaying ? (
                <PauseIcon className="w-5 h-5" />
              ) : (
                <PlayIcon className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* Next button */}
            <button
              onClick={playNext}
              disabled={playbackQueue.length === 0}
              className="p-2 rounded-full text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              title="Next"
            >
              <ForwardIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Center section: Song info + Progress */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {/* Song info - clickable to navigate to song detail */}
            <button
              onClick={() => {
                if (playerVideoId) {
                  const playlistPath = selectedPlaylistId ? `/playlist/${selectedPlaylistId}` : ''
                  router.push(`${playlistPath}/song/${playerVideoId}`)
                }
              }}
              className="flex items-center gap-2 mb-1.5 text-left hover:opacity-80 transition-opacity"
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                  {trackInfo?.title || 'Now playing...'}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400 truncate">
                  {trackInfo?.artist || 'YouTube'}
                </div>
              </div>
            </button>

            {/* Progress bar (clickable) - larger hit area */}
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium tabular-nums w-9 text-right">
                {formatTime(currentTime)}
              </span>
              <div
                ref={progressRef}
                className="flex-1 h-5 flex items-center cursor-pointer group"
                onClick={handleProgressClick}
                onMouseDown={() => setIsDragging(true)}
                onMouseMove={handleProgressDrag}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
              >
                <div className="w-full h-1 bg-gray-200/80 dark:bg-slate-700 rounded-full relative group-hover:h-1.5 transition-all duration-150">
                  {/* Progress fill with gradient */}
                  <div
                    className="h-full bg-gradient-to-r from-red-pantone to-crimson rounded-full relative transition-all duration-75"
                    style={{ width: `${progress}%` }}
                  >
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-red-pantone to-crimson rounded-full blur-sm opacity-50" />
                    {/* Scrubber handle */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md border-2 border-red-pantone opacity-0 group-hover:opacity-100 scale-0 group-hover:scale-100 transition-all duration-150 -mr-1.5" />
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium tabular-nums w-9">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Like button */}
            <button
              onClick={() => toggleLike(playerVideoId)}
              className={`p-2.5 rounded-full transition-all duration-200 ${
                isLiked
                  ? 'text-red-pantone hover:bg-red-50 dark:hover:bg-red-900/30'
                  : 'text-gray-400 dark:text-slate-400 hover:text-red-pantone hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
              title={isLiked ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isLiked ? (
                <HeartSolidIcon className="w-5 h-5" />
              ) : (
                <HeartOutlineIcon className="w-5 h-5" />
              )}
            </button>

            {/* Playlist menu button */}
            <div className="relative flex-shrink-0" data-playlist-menu>
              <button
                onClick={() => setShowPlaylistMenu(!showPlaylistMenu)}
                className={`p-2.5 rounded-full transition-all duration-200 ${
                  showPlaylistMenu
                    ? 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200'
                    : 'text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
                title="Manage playlists"
              >
                <QueueListIcon className="w-5 h-5" />
                {songPlaylists.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-br from-red-pantone to-crimson text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {songPlaylists.length}
                  </span>
                )}
              </button>

              {/* Playlist dropdown */}
              {showPlaylistMenu && (
                <div className="absolute bottom-full right-0 mb-3 w-72 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-slate-700/50 overflow-hidden z-50">
                  <div className="p-2 border-b border-gray-100 dark:border-slate-700">
                    <button
                      onClick={() => {
                        openModal('playlist-selector', { videoId: playerVideoId })
                        setShowPlaylistMenu(false)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center">
                        <PlusIcon className="w-4 h-4 text-white" />
                      </div>
                      Add to playlist
                    </button>
                  </div>
                  {songPlaylists.length > 0 && (
                    <div className="p-2 max-h-56 overflow-y-auto">
                      <div className="text-[11px] font-medium text-gray-400 dark:text-slate-500 uppercase tracking-wider px-4 py-2">In playlists</div>
                      {songPlaylists.map(playlist => (
                        <div
                          key={playlist.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl group transition-colors"
                        >
                          {playlist.thumbnail ? (
                            <img src={playlist.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600" />
                          )}
                          <span className="flex-1 text-sm font-medium text-gray-700 dark:text-slate-200 truncate">{playlist.title}</span>
                          <button
                            onClick={() => {
                              removeSongFromPlaylist(playerVideoId, playlist.id)
                            }}
                            className="p-1.5 rounded-lg text-gray-300 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
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
              className="p-2.5 rounded-full text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200 flex-shrink-0"
              title="Close player"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
