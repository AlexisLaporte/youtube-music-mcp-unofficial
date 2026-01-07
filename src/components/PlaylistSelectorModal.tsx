'use client'

import React, { useState, useEffect } from 'react'
import { Search, Sparkles, Music } from 'lucide-react'

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
        className="bg-white dark:bg-slate-800 rounded-t-2xl md:rounded-2xl p-6 w-full md:w-96 md:max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add to Playlist</h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

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
                  const isAlreadyIn = foundInPlaylistIds.includes(playlist.id)

                  return (
                    <button
                      key={playlist.id}
                      onClick={() => {
                        if (!isAlreadyIn) {
                          onSelect(playlist.id)
                        }
                      }}
                      disabled={isAlreadyIn}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${
                        isAlreadyIn
                          ? 'text-gray-400 dark:text-slate-500 cursor-not-allowed bg-gray-50 dark:bg-slate-700/50'
                          : 'hover:bg-amber-50 dark:hover:bg-amber-900/30 bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                      }`}
                    >
                      {playlist.thumbnail ? (
                        <img
                          src={playlist.thumbnail}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
                          <Music className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate text-gray-900 dark:text-white">{playlist.title} {isAlreadyIn && '✓'}</span>
                          <span className="text-xs text-amber-600 dark:text-amber-500 font-medium ml-2 flex-shrink-0">
                            {Math.round(suggestion.score * 10)}%
                          </span>
                        </div>
                        {suggestion.reason && (
                          <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{suggestion.reason}</div>
                        )}
                      </div>
                    </button>
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
              const isAlreadyIn = foundInPlaylistIds.includes(playlist.id)

              return (
                <button
                  key={playlist.id}
                  onClick={() => {
                    if (!isAlreadyIn) {
                      onSelect(playlist.id)
                    }
                  }}
                  disabled={isAlreadyIn}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-3 ${
                    isAlreadyIn
                      ? 'text-gray-400 dark:text-slate-500 cursor-not-allowed'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-700 active:bg-gray-200 dark:active:bg-slate-600'
                  }`}
                >
                  {playlist.thumbnail ? (
                    <img
                      src={playlist.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
                      <Music className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                    </div>
                  )}
                  <span className="truncate font-medium text-gray-900 dark:text-white">{playlist.title}</span>
                  {isAlreadyIn && <span className="text-green-500 flex-shrink-0">✓</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
