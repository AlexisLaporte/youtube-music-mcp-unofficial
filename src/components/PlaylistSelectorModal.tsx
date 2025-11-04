'use client'

import React, { useState } from 'react'
import { Search } from 'lucide-react'
import { YouTubePlaylist, YouTubeTrack } from '@/types/youtube'

interface PlaylistSelectorModalProps {
  videoId: string
  currentTrack?: YouTubeTrack
  playlists: YouTubePlaylist[]
  foundInPlaylistIds: string[]
  onSelect: (playlistId: string) => void
  onClose: () => void
}

export const PlaylistSelectorModal: React.FC<PlaylistSelectorModalProps> = ({
  playlists,
  foundInPlaylistIds,
  onSelect,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('')

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
