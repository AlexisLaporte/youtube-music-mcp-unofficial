'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Search, Music, Play, Pause, Plus, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { apiService, SearchResult } from '@/services/youtubeService'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { useUIStore } from '@/stores/useUIStore'
import { PlaylistBadges } from './PlaylistBadges'
import { PlaylistSelectorModal } from './PlaylistSelectorModal'

export const SearchView: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null)

  const { playerVideoId, playVideo, closePlayer } = useUIStore()
  const { playlists, likedSongs, addTrackToPlaylist, getPlaylistsForVideo } = usePlaylistsStore()

  // Debounced search
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setHasSearched(false)
      return
    }

    setIsSearching(true)
    try {
      const searchResults = await apiService.searchVideos(searchQuery)
      setResults(searchResults)
      setHasSearched(true)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounce input
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query)
    }, 400)
    return () => clearTimeout(timer)
  }, [query, search])

  const isInLibrary = (videoId: string) => {
    return likedSongs.some(track => track.videoId === videoId)
  }

  const handleAddToPlaylist = async (videoId: string, playlistId?: string) => {
    if (playlistId) {
      try {
        await addTrackToPlaylist(playlistId, videoId)
      } catch (error) {
        console.error('Error adding to playlist:', error)
      }
    } else {
      setAddingToPlaylist(videoId)
    }
  }

  const handleModalSelect = async (playlistId: string) => {
    if (addingToPlaylist) {
      try {
        await addTrackToPlaylist(playlistId, addingToPlaylist)
        setAddingToPlaylist(null)
      } catch (error) {
        console.error('Error adding to playlist:', error)
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search YouTube Music..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-12 pr-4 py-3 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          {isSearching && (
            <Loader2 className="absolute right-4 top-3.5 h-5 w-5 text-gray-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {!hasSearched && !isSearching && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Search className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg">Search for songs on YouTube</p>
            <p className="text-sm text-gray-400 mt-1">Results will show if they&apos;re already in your library</p>
          </div>
        )}

        {hasSearched && results.length === 0 && !isSearching && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Music className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg">No results found</p>
            <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2 max-w-3xl mx-auto">
            {results.map((result) => {
              const inLibrary = isInLibrary(result.videoId)
              const playlistIds = getPlaylistsForVideo(result.videoId)
              const isPlaying = playerVideoId === result.videoId

              return (
                <div
                  key={result.videoId}
                  className={`bg-white border rounded-xl p-3 transition-all hover:shadow-sm ${
                    inLibrary ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="relative flex-shrink-0 w-14 h-14">
                      {result.thumbnail ? (
                        <Image
                          src={result.thumbnail}
                          alt={result.title}
                          width={56}
                          height={56}
                          className="rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                          <Music className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      {inLibrary && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-xs">*</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{result.title}</h4>
                      <p className="text-sm text-gray-600 truncate">{result.artist}</p>
                      {playlistIds.length > 0 ? (
                        <div className="mt-1">
                          <PlaylistBadges videoId={result.videoId} maxVisible={2} showEmpty={false} />
                        </div>
                      ) : inLibrary ? (
                        <span className="text-xs text-green-600">In your liked songs</span>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => isPlaying ? closePlayer() : playVideo(result.videoId)}
                        className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4 text-white" />
                        ) : (
                          <Play className="h-4 w-4 text-white ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleAddToPlaylist(result.videoId)}
                        className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        title="Add to playlist"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Playlist Selector Modal */}
      {addingToPlaylist && (
        <PlaylistSelectorModal
          videoId={addingToPlaylist}
          playlists={playlists}
          foundInPlaylistIds={getPlaylistsForVideo(addingToPlaylist)}
          onSelect={handleModalSelect}
          onClose={() => setAddingToPlaylist(null)}
        />
      )}
    </div>
  )
}
