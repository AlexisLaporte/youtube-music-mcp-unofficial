'use client'

import React, { useState, useEffect } from 'react'
import { Search, Sparkles, Music, Play, Pause, Check } from 'lucide-react'
import { useUIStore } from '@/stores/useUIStore'
import { useMusicStore } from '@/stores/useMusicStore'

interface PlaylistOption {
  id: string
  title: string
  thumbnail?: string
}

interface Suggestion {
  playlistId: string
  score: number
  matchedTags: string[]
  reason: string
}

interface PlaylistSelectorModalProps {
  videoId: string
  playlists: PlaylistOption[]
  foundInPlaylistIds: string[]
  onSelect: (playlistId: string) => void
  onClose: () => void
}

export const PlaylistSelectorModal: React.FC<PlaylistSelectorModalProps> = ({
  videoId,
  playlists,
  foundInPlaylistIds,
  onSelect,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [addedPlaylists, setAddedPlaylists] = useState<Set<string>>(new Set())

  // Player state
  const { playerVideoId, isPlayerPaused, playVideo, togglePlayPause, playVideoInQueue, playShuffled } = useUIStore()
  const song = useMusicStore(state => state.songs.get(videoId))
  const playlistSongsMap = useMusicStore(state => state.playlistSongs)
  const isPlayingCurrentTrack = playerVideoId === videoId && !isPlayerPaused
  const [playingPlaylistId, setPlayingPlaylistId] = useState<string | null>(null)

  const handleSelect = (playlistId: string) => {
    onSelect(playlistId)
    setJustAdded(playlistId)
    setAddedPlaylists(prev => new Set(prev).add(playlistId))
    // Clear animation after delay
    setTimeout(() => setJustAdded(null), 1500)
  }

  const handlePlayCurrentTrack = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPlayingPlaylistId(null)
    if (playerVideoId === videoId) {
      togglePlayPause()
    } else {
      playVideo(videoId)
    }
  }

  const handlePlayPlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation()
    const trackIds = playlistSongsMap.get(playlistId) || []
    if (trackIds.length === 0) return

    // Check if we're already playing this playlist
    const isCurrentlyPlayingThisPlaylist = playingPlaylistId === playlistId && trackIds.includes(playerVideoId || '')

    if (isCurrentlyPlayingThisPlaylist) {
      togglePlayPause()
    } else {
      setPlayingPlaylistId(playlistId)
      // Play shuffled to get a good mix
      playShuffled(trackIds)
    }
  }

  // Track which playlist is playing
  useEffect(() => {
    if (playingPlaylistId && playerVideoId) {
      const trackIds = playlistSongsMap.get(playingPlaylistId) || []
      if (!trackIds.includes(playerVideoId)) {
        setPlayingPlaylistId(null)
      }
    }
  }, [playerVideoId, playingPlaylistId, playlistSongsMap])

  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true)
      try {
        // First check if we have an analysis
        const analysisRes = await fetch(`/api/analysis?v=${videoId}`)
        const analysisData = await analysisRes.json()

        // If no cached analysis with BPM, trigger one
        if (!analysisData.cached || !analysisData.bpm) {
          console.log('🔬 No analysis for', videoId, '- triggering analysis...')
          setIsAnalyzing(true)

          // Start analysis for this single video
          const startRes = await fetch('/api/analysis/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoIds: [videoId] })
          })

          if (startRes.ok) {
            // Poll for completion (max 60s)
            for (let i = 0; i < 30; i++) {
              await new Promise(r => setTimeout(r, 2000))
              const statusRes = await fetch('/api/analysis/batch')
              const status = await statusRes.json()
              if (!status.running) break
            }
          }
          setIsAnalyzing(false)
        }

        // Now fetch suggestions
        const res = await fetch(`/api/playlist-suggestions?v=${videoId}`)
        if (res.ok) {
          const data = await res.json()
          setSuggestions(data.suggestions || [])
        }
      } catch (e) {
        console.warn('Failed to fetch suggestions:', e)
      } finally {
        setIsLoadingSuggestions(false)
      }
    }

    fetchSuggestions()
  }, [videoId])

  const filteredPlaylists = playlists.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end md:items-center md:justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-2xl p-6 w-full md:w-[600px] lg:w-[700px] md:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add to Playlist</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Track preview with play button */}
        {song && (
          <div className="flex items-center gap-3 p-3 mb-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
            <button
              onClick={handlePlayCurrentTrack}
              className="relative w-12 h-12 flex-shrink-0 group"
            >
              {song.thumbnail ? (
                <img src={song.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-600 dark:to-slate-500" />
              )}
              <div className={`absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 transition-opacity ${isPlayingCurrentTrack ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {isPlayingCurrentTrack ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 text-white ml-0.5" />
                )}
              </div>
              {isPlayingCurrentTrack && (
                <div className="absolute -top-1 -right-1 w-3 h-3">
                  <span className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
                  <span className="absolute inset-0 bg-red-500 rounded-full" />
                </div>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-0.5">Track to organize</div>
              <div className="font-medium text-gray-900 dark:text-white truncate text-sm">{song.title}</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{song.artist}</div>
            </div>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search playlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {/* Suggestions Section */}
          {!searchQuery && suggestions.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Suggested</span>
              </div>
              <div className="space-y-1">
                {suggestions.map(suggestion => {
                  const playlist = playlists.find(p => p.id === suggestion.playlistId)
                  if (!playlist) return null
                  const isAlreadyIn = foundInPlaylistIds.includes(playlist.id) || addedPlaylists.has(playlist.id)
                  const wasJustAdded = justAdded === playlist.id
                  const trackIds = playlistSongsMap.get(playlist.id) || []
                  const isPlayingThis = playingPlaylistId === playlist.id && !isPlayerPaused

                  return (
                    <div
                      key={playlist.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        wasJustAdded
                          ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 scale-[1.02]'
                          : isAlreadyIn
                          ? 'bg-gray-50 dark:bg-slate-700/50'
                          : 'bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                      }`}
                    >
                      {/* Thumbnail */}
                      {playlist.thumbnail ? (
                        <img src={playlist.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
                          <Music className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                        </div>
                      )}

                      {/* Playlist info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-gray-900 dark:text-white">{playlist.title}</div>
                        {suggestion.reason && !wasJustAdded && (
                          <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
                            {suggestion.reason} • {Math.round(suggestion.score * 10)}% match
                          </div>
                        )}
                        {wasJustAdded && (
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">Added to playlist!</div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Play/Preview button */}
                        {trackIds.length > 0 && (
                          <button
                            onClick={(e) => handlePlayPlaylist(e, playlist.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isPlayingThis
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-500'
                            }`}
                            title="Preview this playlist"
                          >
                            {isPlayingThis ? (
                              <>
                                <Pause className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Playing</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Preview</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Add button */}
                        {wasJustAdded ? (
                          <div className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium">
                            <Check className="w-3.5 h-3.5" />
                            <span>Added</span>
                          </div>
                        ) : isAlreadyIn ? (
                          <div className="flex items-center gap-1 px-3 py-1.5 text-gray-400 dark:text-slate-500 text-xs">
                            <Check className="w-3.5 h-3.5" />
                            <span>Already in</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSelect(playlist.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="border-b border-gray-200 dark:border-slate-700 my-3" />
              <div className="text-xs text-gray-500 dark:text-slate-400 px-1 mb-2">All playlists</div>
            </div>
          )}

          {isLoadingSuggestions && !searchQuery && (
            <div className="flex items-center gap-2 mb-4 px-1 text-sm text-gray-500 dark:text-slate-400">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 dark:border-slate-600 border-t-amber-500 rounded-full" />
              {isAnalyzing ? 'Analyzing audio...' : 'Loading suggestions...'}
            </div>
          )}

          {playlists.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
              No playlists loaded. Click Refresh.
            </p>
          ) : filteredPlaylists.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
              No playlists match your search.
            </p>
          ) : (
            filteredPlaylists.map(playlist => {
              const isAlreadyIn = foundInPlaylistIds.includes(playlist.id) || addedPlaylists.has(playlist.id)
              const wasJustAdded = justAdded === playlist.id
              const trackIds = playlistSongsMap.get(playlist.id) || []
              const isPlayingThis = playingPlaylistId === playlist.id && !isPlayerPaused

              return (
                <div
                  key={playlist.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    wasJustAdded
                      ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 scale-[1.02]'
                      : isAlreadyIn
                      ? 'bg-gray-50 dark:bg-slate-700/50'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {/* Thumbnail */}
                  {playlist.thumbnail ? (
                    <img src={playlist.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
                      <Music className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    </div>
                  )}

                  {/* Playlist info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-gray-900 dark:text-white">{playlist.title}</div>
                    {wasJustAdded && (
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-0.5">Added to playlist!</div>
                    )}
                    {!wasJustAdded && trackIds.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{trackIds.length} tracks</div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Play/Preview button */}
                    {trackIds.length > 0 && (
                      <button
                        onClick={(e) => handlePlayPlaylist(e, playlist.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isPlayingThis
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-500'
                        }`}
                        title="Preview this playlist"
                      >
                        {isPlayingThis ? (
                          <>
                            <Pause className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Playing</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Preview</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* Add button */}
                    {wasJustAdded ? (
                      <div className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium">
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </div>
                    ) : isAlreadyIn ? (
                      <div className="flex items-center gap-1 px-3 py-1.5 text-gray-400 dark:text-slate-500 text-xs">
                        <Check className="w-3.5 h-3.5" />
                        <span>Already in</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelect(playlist.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-pantone hover:bg-crimson text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
