'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { MagnifyingGlassIcon, MusicalNoteIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { PlayIcon, PauseIcon, PlusIcon, HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutlineIcon } from '@heroicons/react/24/outline'
import { apiService, SearchResult } from '@/services/youtubeService'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { AnalysisBadge } from '@/components/AnalysisBadge'

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

  // Sort results: tracks in playlists first, then liked, then others
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const songA = getSong(a.videoId)
      const songB = getSong(b.videoId)

      // Score based on: playlists count + liked bonus
      const scoreA = (songA?.playlistIds.length || 0) + (songA?.isLiked ? 0.5 : 0)
      const scoreB = (songB?.playlistIds.length || 0) + (songB?.isLiked ? 0.5 : 0)

      return scoreB - scoreA
    })
  }, [results, getSong])

  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={exitSearchMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="Close search"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" />
          </button>
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-slate-400" />
            <input
              type="text"
              placeholder="Search YouTube Music..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-slate-600 border-t-red-pantone" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched && !isSearching && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-slate-400 p-8">
            <MagnifyingGlassIcon className="h-16 w-16 mb-4 text-gray-300 dark:text-slate-600" />
            <p className="text-lg">Search for songs on YouTube</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Results will show if they&apos;re already in your library</p>
          </div>
        )}

        {hasSearched && results.length === 0 && !isSearching && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-slate-400 p-8">
            <MusicalNoteIcon className="h-16 w-16 mb-4 text-gray-300 dark:text-slate-600" />
            <p className="text-lg">No results found</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Try a different search term</p>
          </div>
        )}

        {sortedResults.length > 0 && (
          <div className="p-4 space-y-2">
            {sortedResults.map((result) => {
              const songInLibrary = getSongFromLibrary(result.videoId)
              const isLiked = songInLibrary?.isLiked ?? false
              const isPlaying = playerVideoId === result.videoId

              const inPlaylistCount = songInLibrary?.playlistIds.length || 0

              return (
                <div
                  key={result.videoId}
                  className={`bg-white dark:bg-slate-800 border rounded-xl p-3 transition-all hover:shadow-sm ${
                    inPlaylistCount > 0
                      ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10'
                      : isLiked
                        ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10'
                        : 'border-gray-200 dark:border-slate-700'
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
                        <div className="w-full h-full bg-gray-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                          <MusicalNoteIcon className="h-5 w-5 text-gray-400 dark:text-slate-400" />
                        </div>
                      )}
                      {inPlaylistCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                          {inPlaylistCount}
                        </div>
                      )}
                      {isLiked && inPlaylistCount === 0 && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-pantone rounded-full flex items-center justify-center">
                          <HeartSolidIcon className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate text-sm">{result.title}</h4>
                      <p className="text-xs text-gray-600 dark:text-slate-400 truncate">{result.artist}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {inPlaylistCount > 0 && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            In {inPlaylistCount} playlist{inPlaylistCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {isLiked && inPlaylistCount === 0 && (
                          <span className="text-xs text-red-500 dark:text-red-400">Liked</span>
                        )}
                        <AnalysisBadge videoId={result.videoId} />
                      </div>
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
                            ? 'text-red-pantone hover:bg-red-50 dark:hover:bg-red-900/30'
                            : 'text-gray-400 dark:text-slate-400 hover:text-red-pantone hover:bg-gray-100 dark:hover:bg-slate-700'
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
                        className="p-2 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
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
