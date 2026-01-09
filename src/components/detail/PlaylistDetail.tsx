'use client'

import { useMemo, useState, useEffect } from 'react'
import { Playlist, Song } from '@/types/youtube'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { MusicalNoteIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline'
import { PlayIcon, SparklesIcon } from '@heroicons/react/24/solid'
import type { FeatureMeta } from '@/types/docs'

/**
 * Playlist detail view with stats, management, and discovery.
 *
 * Playlist suggestions aggregate recommendations from multiple tracks,
 * ranking by how many playlist tracks suggested the same song.
 * Higher score = better fit for the playlist's overall vibe.
 */
export const featureMeta: FeatureMeta = {
  id: 'playlist-discover',
  name: 'Playlist Discovery',
  description: 'Find tracks that match your playlist\'s vibe.',
  faq: [
    { q: 'How does playlist discovery work?', a: 'Analyzes your top tracks and aggregates their suggestions. Songs recommended by multiple tracks rank higher.' },
    { q: 'What does "3x match" mean?', a: '3 tracks in your playlist suggested this song independently.' },
  ]
}

interface PlaylistDetailProps {
  playlist: Playlist
}

interface PlaylistSuggestion {
  videoId: string
  title: string
  artist: string
  thumbnail?: string
  score: number
  sources: string[]
}

export function PlaylistDetail({ playlist }: PlaylistDetailProps) {
  const songsMap = useMusicStore(state => state.songs)
  const playlistSongsMap = useMusicStore(state => state.playlistSongs)
  const { openModal, playShuffled, playVideoInQueue } = useUIStore()
  const [analyzedIds, setAnalyzedIds] = useState<Set<string>>(new Set())
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set())

  // Playlist suggestions state
  const [suggestions, setSuggestions] = useState<PlaylistSuggestion[] | null>(null)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)

  const songs = useMemo(() => {
    const videoIds = playlistSongsMap.get(playlist.id) || []
    return videoIds
      .map(id => songsMap.get(id))
      .filter((s): s is Song => s !== undefined)
  }, [playlist.id, songsMap, playlistSongsMap])

  // Calculate stats
  const artists = new Set(songs.map(s => s.artist))
  const likedCount = songs.filter(s => s.isLiked).length

  // Fetch analysis progress
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const res = await fetch('/api/analysis/progress')
        if (res.ok) {
          const data = await res.json()
          setAnalyzedIds(new Set(data.analyzedIds || []))
          setUnavailableIds(new Set(data.unavailableIds || []))
        }
      } catch {
        // Ignore
      }
    }
    fetchProgress()
  }, [])

  // Calculate analysis progress for this playlist
  const videoIds = useMemo(() => songs.map(s => s.videoId), [songs])
  const analyzedCount = useMemo(
    () => videoIds.filter(id => analyzedIds.has(id)).length,
    [videoIds, analyzedIds]
  )
  const unavailableCount = useMemo(
    () => videoIds.filter(id => unavailableIds.has(id)).length,
    [videoIds, unavailableIds]
  )
  // Consider unavailable videos as "done" since we can't analyze them
  const effectiveAnalyzed = analyzedCount + unavailableCount
  const analysisPercent = songs.length > 0 ? Math.round((effectiveAnalyzed / songs.length) * 100) : 100

  const fetchPlaylistSuggestions = async () => {
    setIsLoadingSuggestions(true)
    setSuggestionsError(null)
    try {
      const tracks = songs.map(s => ({
        videoId: s.videoId,
        title: s.title,
        artist: s.artist
      }))

      const res = await fetch('/api/suggestions/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracks,
          playlistVideoIds: songs.map(s => s.videoId)
        })
      })

      if (!res.ok) throw new Error('Failed to fetch suggestions')

      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch (e) {
      setSuggestionsError(e instanceof Error ? e.message : 'Failed to load suggestions')
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 lg:p-8">
        {/* 2-column layout on large screens */}
        <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
          {/* Left column: Cover, info, stats, actions */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Cover image */}
              <div className="relative group mx-auto lg:mx-0 w-fit">
                {playlist.thumbnail ? (
                  <img
                    src={playlist.thumbnail}
                    alt=""
                    className="w-56 h-56 lg:w-72 lg:h-72 rounded-2xl shadow-xl object-cover"
                  />
                ) : (
                  <div className="w-56 h-56 lg:w-72 lg:h-72 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center shadow-xl">
                    <MusicalNoteIcon className="w-20 h-20 text-gray-400 dark:text-slate-400" />
                  </div>
                )}
                <button
                  onClick={() => playShuffled(songs.map(s => s.videoId))}
                  disabled={songs.length === 0}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl disabled:cursor-not-allowed"
                >
                  <div className="w-16 h-16 bg-red-pantone rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                    <PlayIcon className="w-8 h-8 text-white ml-1" />
                  </div>
                </button>
              </div>

              {/* Title & description */}
              <div className="text-center lg:text-left">
                <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Playlist</p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{playlist.title}</h1>
                {playlist.description && (
                  <p className="text-gray-500 dark:text-slate-400 text-sm mb-3 line-clamp-3">{playlist.description}</p>
                )}
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  {songs.length} tracks • {artists.size} artists
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{songs.length}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Tracks</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                  <div className="text-2xl font-bold text-red-pantone">{likedCount}</div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Liked</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => openModal('edit-playlist', { playlistId: playlist.id, playlistTitle: playlist.title })}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <PencilIcon className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => openModal('delete-playlist-confirm', { playlistId: playlist.id, playlistTitle: playlist.title })}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Right column: Top artists, Analysis, Discover */}
          <div className="flex-1 space-y-8">
            {/* Top artists */}
            {artists.size > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Artists</h2>
                <div className="flex flex-wrap gap-2">
                  {Array.from(artists).slice(0, 12).map(artist => (
                    <span
                      key={artist}
                      className="px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-full text-sm border border-gray-200 dark:border-slate-700"
                    >
                      {artist}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Analysis progress (only if not 100%) */}
            {analysisPercent < 100 && (
              <section className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Audio Analysis</span>
                  <span className="text-sm text-gray-500 dark:text-slate-400">
                    {analyzedCount}/{songs.length}
                    {unavailableCount > 0 && (
                      <span className="ml-1">({unavailableCount} unavailable)</span>
                    )}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-space-cadet to-red-pantone rounded-full transition-all"
                    style={{ width: `${analysisPercent}%` }}
                  />
                </div>
              </section>
            )}

            {/* Discover similar for playlist */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-red-pantone" />
                  Discover for this playlist
                </h2>
                {suggestions === null && !isLoadingSuggestions && (
                  <button
                    onClick={fetchPlaylistSuggestions}
                    disabled={songs.length === 0}
                    className="px-4 py-2 bg-space-cadet text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 text-sm"
                  >
                    Find tracks
                  </button>
                )}
              </div>

              {isLoadingSuggestions && (
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 py-4">
                  <div className="w-4 h-4 border-2 border-gray-300 dark:border-slate-600 border-t-space-cadet rounded-full animate-spin" />
                  Analyzing playlist...
                </div>
              )}

              {suggestionsError && (
                <p className="text-red-500 text-sm py-2">{suggestionsError}</p>
              )}

              {suggestions && suggestions.length > 0 && (
                <div className="grid gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.videoId}
                      onClick={() => {
                        const queue = suggestions.map(sg => sg.videoId)
                        const externalTracks = suggestions.map(sg => ({
                          videoId: sg.videoId,
                          title: sg.title,
                          artist: sg.artist,
                          thumbnail: sg.thumbnail
                        }))
                        playVideoInQueue(s.videoId, queue, externalTracks)
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-colors text-left group"
                    >
                      {s.thumbnail ? (
                        <img src={s.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                          <MusicalNoteIcon className="w-5 h-5 text-gray-400 dark:text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{s.title}</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400 truncate">{s.artist}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-400 dark:text-slate-500 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded-full">{s.score}x</span>
                        <PlayIcon className="w-5 h-5 text-gray-400 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {suggestions && suggestions.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-slate-400 py-4">No suggestions found for this playlist.</p>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
