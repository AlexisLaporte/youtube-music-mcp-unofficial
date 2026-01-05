'use client'

import React, { useState, useEffect } from 'react'
import { Search, Sparkles } from 'lucide-react'

interface PlaylistOption {
  id: string
  title: string
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

  useEffect(() => {
    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true)
      try {
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
        className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:w-96 md:max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Add to Playlist</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search playlists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {/* Suggestions Section */}
          {!searchQuery && suggestions.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">Suggested</span>
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
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                        isAlreadyIn
                          ? 'text-gray-400 cursor-not-allowed bg-gray-50'
                          : 'hover:bg-amber-50 bg-amber-50/50 border border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{playlist.title} {isAlreadyIn && '✓'}</span>
                        <span className="text-xs text-amber-600 font-medium">
                          {Math.round(suggestion.score * 10)}%
                        </span>
                      </div>
                      {suggestion.reason && (
                        <div className="text-xs text-gray-500 mt-0.5">{suggestion.reason}</div>
                      )}
                    </button>
                  )
                })}
              </div>
              <div className="border-b border-gray-200 my-3" />
              <div className="text-xs text-gray-500 px-1 mb-2">All playlists</div>
            </div>
          )}

          {isLoadingSuggestions && !searchQuery && (
            <div className="flex items-center gap-2 mb-4 px-1 text-sm text-gray-500">
              <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-amber-500 rounded-full" />
              Loading suggestions...
            </div>
          )}

          {playlists.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No playlists loaded. Click Refresh.
            </p>
          ) : filteredPlaylists.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
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
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                    isAlreadyIn
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  {playlist.title} {isAlreadyIn && '✓'}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
