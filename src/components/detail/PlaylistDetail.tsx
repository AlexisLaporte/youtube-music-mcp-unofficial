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
      {/* Header with cover */}
      <div className="bg-gradient-to-b from-space-cadet to-gray-50 p-8">
        <div className="max-w-2xl mx-auto flex flex-col md:flex-row items-center gap-6">
          <div className="relative group">
            {playlist.thumbnail ? (
              <img
                src={playlist.thumbnail}
                alt=""
                className="w-48 h-48 rounded-xl shadow-xl object-cover"
              />
            ) : (
              <div className="w-48 h-48 rounded-xl bg-gray-300 flex items-center justify-center">
                <MusicalNoteIcon className="w-20 h-20 text-gray-400" />
              </div>
            )}
            <button
              onClick={() => playShuffled(songs.map(s => s.videoId))}
              disabled={songs.length === 0}
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl disabled:cursor-not-allowed"
            >
              <div className="w-16 h-16 bg-red-pantone rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                <PlayIcon className="w-8 h-8 text-white ml-1" />
              </div>
            </button>
          </div>

          <div className="text-center md:text-left">
            <p className="text-sm text-gray-300 uppercase tracking-wide mb-1">Playlist</p>
            <h1 className="text-3xl font-bold text-white mb-2">{playlist.title}</h1>
            {playlist.description && (
              <p className="text-gray-300 text-sm mb-4 line-clamp-2">{playlist.description}</p>
            )}
            <p className="text-gray-400 text-sm">
              {songs.length} tracks • {artists.size} artists
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-2xl mx-auto p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{songs.length}</div>
            <div className="text-sm text-gray-500">Tracks</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{artists.size}</div>
            <div className="text-sm text-gray-500">Artists</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-2xl font-bold text-red-pantone">{likedCount}</div>
            <div className="text-sm text-gray-500">Liked</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-2xl font-bold text-gray-900 capitalize">{playlist.privacy}</div>
            <div className="text-sm text-gray-500">Privacy</div>
          </div>
        </div>

        {/* Top artists */}
        {artists.size > 0 && (
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Top artists</h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(artists).slice(0, 10).map(artist => (
                <span
                  key={artist}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm"
                >
                  {artist}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Analysis progress (only if not 100%) */}
        {analysisPercent < 100 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Audio analysis</span>
              <span className="text-sm font-medium text-gray-900">
                {analyzedCount}/{songs.length}
                {unavailableCount > 0 && (
                  <span className="text-gray-400 ml-1">({unavailableCount} unavailable)</span>
                )}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-space-cadet rounded-full transition-all"
                style={{ width: `${analysisPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Discover similar for playlist */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-md font-semibold text-gray-900 flex items-center gap-2">
              <SparklesIcon className="w-5 h-5 text-red-pantone" />
              Discover for this playlist
            </h3>
            {suggestions === null && !isLoadingSuggestions && (
              <button
                onClick={fetchPlaylistSuggestions}
                disabled={songs.length === 0}
                className="px-4 py-2 bg-space-cadet text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                Find tracks
              </button>
            )}
          </div>

          {isLoadingSuggestions && (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-space-cadet rounded-full animate-spin" />
              Analyzing playlist...
            </div>
          )}

          {suggestionsError && (
            <p className="text-red-500 text-sm">{suggestionsError}</p>
          )}

          {suggestions && suggestions.length > 0 && (
            <div className="space-y-2">
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
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  {s.thumbnail ? (
                    <img src={s.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center">
                      <MusicalNoteIcon className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.title}</p>
                    <p className="text-xs text-gray-500 truncate">{s.artist}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{s.score}x match</span>
                    <PlayIcon className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {suggestions && suggestions.length === 0 && (
            <p className="text-sm text-gray-500">No suggestions found for this playlist.</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => openModal('edit-playlist', { playlistId: playlist.id, playlistTitle: playlist.title })}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <PencilIcon className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => openModal('delete-playlist-confirm', { playlistId: playlist.id, playlistTitle: playlist.title })}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
