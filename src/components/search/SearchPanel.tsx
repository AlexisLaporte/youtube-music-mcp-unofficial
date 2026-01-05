'use client'

import { useState, useCallback, useEffect } from 'react'
import { MagnifyingGlassIcon, MusicalNoteIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { PlayIcon, PauseIcon, PlusIcon, HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline'
import { apiService, SearchResult } from '@/services/youtubeService'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'

export function SearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const { playerVideoId, playVideo, closePlayer, openModal, exitSearchMode } = useUIStore()
  const { getSong, toggleLike } = useMusicStore()

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

  // Escape key to exit search mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !query) {
        exitSearchMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [query, exitSearchMode])

  const getSongFromLibrary = (videoId: string) => getSong(videoId)

  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={exitSearchMode}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Close search"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search YouTube Music..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-red-pantone" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched && !isSearching && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <MagnifyingGlassIcon className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg">Search for songs on YouTube</p>
            <p className="text-sm text-gray-400 mt-1">Results will show if they&apos;re already in your library</p>
          </div>
        )}

        {hasSearched && results.length === 0 && !isSearching && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <MusicalNoteIcon className="h-16 w-16 mb-4 text-gray-300" />
            <p className="text-lg">No results found</p>
            <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="p-4 space-y-2">
            {results.map((result) => {
              const songInLibrary = getSongFromLibrary(result.videoId)
              const isLiked = songInLibrary?.isLiked ?? false
              const isPlaying = playerVideoId === result.videoId

              return (
                <div
                  key={result.videoId}
                  className={`bg-white border rounded-xl p-3 transition-all hover:shadow-sm ${
                    isLiked ? 'border-red-200 bg-red-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div className="relative flex-shrink-0 w-12 h-12">
                      {result.thumbnail ? (
                        <img
                          src={result.thumbnail}
                          alt=""
                          className="w-full h-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                          <MusicalNoteIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                      {isLiked && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-pantone rounded-full flex items-center justify-center">
                          <HeartSolidIcon className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate text-sm">{result.title}</h4>
                      <p className="text-xs text-gray-600 truncate">{result.artist}</p>
                      {songInLibrary && songInLibrary.playlistIds.length > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          In {songInLibrary.playlistIds.length} playlist{songInLibrary.playlistIds.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => isPlaying ? closePlayer() : playVideo(result.videoId)}
                        className="w-9 h-9 rounded-full bg-red-pantone hover:bg-crimson flex items-center justify-center transition-all"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? (
                          <PauseIcon className="h-4 w-4 text-white" />
                        ) : (
                          <PlayIcon className="h-4 w-4 text-white ml-0.5" />
                        )}
                      </button>
                      <button
                        onClick={() => toggleLike(result.videoId)}
                        className={`p-2 rounded-lg transition-colors ${
                          isLiked
                            ? 'text-red-pantone hover:bg-red-50'
                            : 'text-gray-400 hover:text-red-pantone hover:bg-gray-100'
                        }`}
                        title={isLiked ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {isLiked ? (
                          <HeartSolidIcon className="h-5 w-5" />
                        ) : (
                          <HeartOutlineIcon className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => openModal('playlist-selector', { videoId: result.videoId })}
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Add to playlist"
                      >
                        <PlusIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
