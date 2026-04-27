'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, MusicalNoteIcon } from '@heroicons/react/24/outline'
import { PlayIcon, PauseIcon, PlusIcon, HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { HeartIcon as HeartOutlineIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { apiService, SearchResult } from '@/services/youtubeService'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'

interface SearchPanelWithURLProps {
  initialQuery: string
}

export function SearchPanelWithURL({ initialQuery }: SearchPanelWithURLProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const { playerVideoId, playVideo, closePlayer, openModal } = useUIStore()
  const { getSong, toggleLike } = useMusicStore()

  // Search function
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

  // Debounce input and update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      // Update URL
      if (query.trim()) {
        const url = new URL(window.location.href)
        url.searchParams.set('q', query.trim())
        window.history.replaceState({}, '', url.toString())
      } else {
        const url = new URL(window.location.href)
        url.searchParams.delete('q')
        window.history.replaceState({}, '', url.toString())
      }
      search(query)
    }, 400)
    return () => clearTimeout(timer)
  }, [query, search])

  // Initial search if query provided
  useEffect(() => {
    if (initialQuery) {
      search(initialQuery)
    }
  }, [])

  const getSongFromLibrary = (videoId: string) => getSong(videoId)

  // Sort results: library first, then official music, then others
  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const songA = getSong(a.videoId)
      const songB = getSong(b.videoId)
      // Score: in playlist = 10, liked = 5, official music = 2
      const scoreA = (songA?.playlistIds.length ? 10 : 0) + (songA?.isLiked ? 5 : 0) + (a.isOfficialMusic ? 2 : 0)
      const scoreB = (songB?.playlistIds.length ? 10 : 0) + (songB?.isLiked ? 5 : 0) + (b.isOfficialMusic ? 2 : 0)
      return scoreB - scoreA
    })
  }, [results, getSong])

  const navigateToSong = (videoId: string) => {
    router.push(`/song/${videoId}`)
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Search Header */}
      <div className="p-6 border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Search</h1>
        <div className="relative max-w-xl">
          <MagnifyingGlassIcon className="absolute left-4 top-3 h-5 w-5 text-gray-400 dark:text-slate-400" />
          <input
            type="text"
            placeholder="Search YouTube Music..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full pl-11 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:ring-2 focus:ring-red-500 focus:border-transparent text-lg"
          />
          {isSearching && (
            <div className="absolute right-4 top-3">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-slate-600 border-t-red-pantone" />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-6">
        {!hasSearched && !isSearching && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-slate-400">
            <MagnifyingGlassIcon className="h-16 w-16 mb-4 text-gray-300 dark:text-slate-600" />
            <p className="text-lg">Search for songs on YouTube</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Results will show if they&apos;re already in your library</p>
          </div>
        )}

        {hasSearched && results.length === 0 && !isSearching && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-slate-400">
            <MusicalNoteIcon className="h-16 w-16 mb-4 text-gray-300 dark:text-slate-600" />
            <p className="text-lg">No results found</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Try a different search term</p>
          </div>
        )}

        {sortedResults.length > 0 && (
          <div className="max-w-4xl space-y-2">
            {sortedResults.map((result) => {
              const songInLibrary = getSongFromLibrary(result.videoId)
              const isLiked = songInLibrary?.isLiked ?? false
              const isPlaying = playerVideoId === result.videoId
              const inPlaylistCount = songInLibrary?.playlistIds.length || 0

              return (
                <div
                  key={result.videoId}
                  className={`bg-white dark:bg-slate-800 border rounded-xl p-4 transition-all hover:shadow-md group ${
                    inPlaylistCount > 0
                      ? 'border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10'
                      : isLiked
                        ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10'
                        : result.isOfficialMusic
                          ? 'border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10'
                          : 'border-gray-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Thumbnail */}
                    <div className="relative flex-shrink-0 w-16 h-16">
                      {result.thumbnail ? (
                        <img
                          src={result.thumbnail}
                          alt=""
                          className="w-full h-full rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                          <MusicalNoteIcon className="h-6 w-6 text-gray-400 dark:text-slate-400" />
                        </div>
                      )}
                      {inPlaylistCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                          {inPlaylistCount}
                        </div>
                      )}
                      {isLiked && inPlaylistCount === 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-pantone rounded-full flex items-center justify-center">
                          <HeartSolidIcon className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info - clickable to navigate */}
                    <button
                      onClick={() => navigateToSong(result.videoId)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <h4 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-red-pantone transition-colors">{result.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-slate-400 truncate">{result.artist}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {inPlaylistCount > 0 && (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            In {inPlaylistCount} playlist{inPlaylistCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {isLiked && inPlaylistCount === 0 && (
                          <span className="text-xs text-red-500 dark:text-red-400">Liked</span>
                        )}
                        {result.isOfficialMusic && (
                          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Official</span>
                        )}
                      </div>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => isPlaying ? closePlayer() : playVideo(result.videoId, { videoId: result.videoId, title: result.title, artist: result.artist, thumbnail: result.thumbnail })}
                        className="w-10 h-10 rounded-full bg-red-pantone hover:bg-crimson flex items-center justify-center transition-all"
                        title={isPlaying ? 'Pause' : 'Play'}
                      >
                        {isPlaying ? (
                          <PauseIcon className="h-5 w-5 text-white" />
                        ) : (
                          <PlayIcon className="h-5 w-5 text-white ml-0.5" />
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
                      <button
                        onClick={() => navigateToSong(result.videoId)}
                        className="p-2 rounded-lg text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors opacity-0 group-hover:opacity-100"
                        title="View details"
                      >
                        <ArrowRightIcon className="h-5 w-5" />
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
