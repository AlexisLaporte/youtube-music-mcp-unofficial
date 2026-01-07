'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Song } from '@/types/youtube'
import type { FeatureMeta } from '@/types/docs'

/**
 * Track detail view with playback, metadata, and discovery.
 *
 * Discovery uses two sources:
 * - YouTube Mix: playlist ID = "RD" + videoId (undocumented but stable API)
 * - Last.fm similar tracks: requires YouTube search to get playable videoIds
 *
 * Suggestions are cached 7 days in SQLite to reduce API calls.
 */
export const featureMeta: FeatureMeta = {
  id: 'discover-similar',
  name: 'Discover Similar',
  description: 'Find new music based on any track in your library.',
  faq: [
    { q: 'How does discovery work?', a: 'Combines YouTube Mix recommendations and Last.fm similar tracks.' },
    { q: 'Why are some suggestions not playable?', a: 'Last.fm tracks without a matching YouTube video are filtered out.' },
    { q: 'How often are suggestions refreshed?', a: 'Cached for 7 days. Click Refresh to force update.' },
  ]
}
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { PlayIcon, PlusIcon, HeartIcon as HeartSolidIcon, SparklesIcon } from '@heroicons/react/24/solid'
import { MusicalNoteIcon, ArrowTopRightOnSquareIcon, ArrowPathIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { AnalysisModal } from '@/components/AnalysisModal'
import type { AnalysisResult } from '@/hooks/useEssentia'

interface SongDetailProps {
  song: Song
  isNowPlaying?: boolean
}

function buildLastFmUrl(artist: string, track: string): string {
  // Remove feat./ft. parts but keep duo names like "Amadou & Mariam"
  const cleanArtist = artist.replace(/\s*\(.*\)$/, '').replace(/\s+(feat\.?|ft\.?).*$/i, '').trim()
  return `https://www.last.fm/music/${encodeURIComponent(cleanArtist)}/_/${encodeURIComponent(track)}`
}

interface AnalysisData {
  bpm?: number
  key?: string
  scale?: string
  energy?: number
  danceability?: number
  lastfmTags?: string[]
  lastfmListeners?: string
  lastfmPlaycount?: string
  title?: string
  artist?: string
}

export function SongDetail({ song, isNowPlaying }: SongDetailProps) {
  const router = useRouter()
  const playlistsMap = useMusicStore(state => state.playlists)
  const songsMap = useMusicStore(state => state.songs)
  const toggleLike = useMusicStore(state => state.toggleLike)
  const removeSongFromPlaylist = useMusicStore(state => state.removeSongFromPlaylist)
  const { playVideoInQueue, openModal, selectedPlaylistId } = useUIStore()
  const playlistSongsMap = useMusicStore(state => state.playlistSongs)
  const getLikedSongs = useMusicStore(state => state.getLikedSongs)

  // Build queue based on current context
  const handlePlay = useCallback(() => {
    let queue: string[] = []
    if (selectedPlaylistId === 'liked') {
      queue = getLikedSongs().map(s => s.videoId)
    } else if (selectedPlaylistId) {
      queue = playlistSongsMap.get(selectedPlaylistId) || []
    }
    // If no context, just play the single song
    if (queue.length === 0) {
      queue = [song.videoId]
    }
    playVideoInQueue(song.videoId, queue)
  }, [selectedPlaylistId, getLikedSongs, playlistSongsMap, song.videoId, playVideoInQueue])

  // Get live song data from store (for isLiked and playlistIds updates)
  const liveSong = songsMap.get(song.videoId) ?? song
  const isLiked = liveSong.isLiked

  const playlists = useMemo(() =>
    liveSong.playlistIds
      .map(id => playlistsMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined),
    [liveSong.playlistIds, playlistsMap]
  )
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)
  const [showAnalysisModal, setShowAnalysisModal] = useState<boolean | 'refresh'>(false)

  // Suggestions state
  const [suggestions, setSuggestions] = useState<{
    youtubeMix: { videoId: string; title: string; artist: string; thumbnail?: string }[]
    lastfmSimilar: { videoId: string; title: string; artist: string; thumbnail?: string }[]
  } | null>(null)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)

  const openAnalysisModal = (refresh = false) => {
    setShowAnalysisModal(refresh ? 'refresh' : true)
  }

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysis({
      bpm: result.bpm ?? undefined,
      key: result.key ?? undefined,
      scale: result.scale ?? undefined,
      energy: result.energy ?? undefined,
      danceability: result.danceability ?? undefined,
      lastfmTags: result.lastfmTags ?? undefined,
      lastfmListeners: result.lastfmListeners ?? undefined,
      lastfmPlaycount: result.lastfmPlaycount ?? undefined,
      title: result.title ?? undefined,
      artist: result.artist ?? undefined,
    })
    setShowAnalysisModal(false)
  }

  const fetchSuggestions = async (forceRefresh = false) => {
    setIsLoadingSuggestions(true)
    setSuggestionsError(null)
    try {
      const params = new URLSearchParams({
        videoId: song.videoId,
        title: song.title,
        artist: song.artist
      })
      if (forceRefresh) params.set('refresh', 'true')
      const res = await fetch(`/api/suggestions?${params}`)
      if (!res.ok) throw new Error('Failed to fetch suggestions')
      const data = await res.json()
      setSuggestions({
        youtubeMix: data.youtubeMix || [],
        lastfmSimilar: data.lastfmSimilar || []
      })
    } catch (e) {
      setSuggestionsError(e instanceof Error ? e.message : 'Failed to load suggestions')
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  // Fetch analysis and suggestions on mount
  useEffect(() => {
    fetchSuggestions()
  }, [song.videoId])

  useEffect(() => {
    const fetchAnalysis = async () => {
      setIsLoadingAnalysis(true)
      try {
        const res = await fetch(`/api/analysis?v=${song.videoId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.cached) {
            setAnalysis(data)
          }
        }
      } catch (e) {
        console.warn('Failed to fetch analysis:', e)
      } finally {
        setIsLoadingAnalysis(false)
      }
    }

    fetchAnalysis()
  }, [song.videoId])

  return (
    <div className="h-full overflow-y-auto">
      {/* Header with cover */}
      <div className={`relative p-8 transition-all duration-500 ${isNowPlaying ? 'bg-gradient-to-b from-red-pantone/15 via-red-pantone/5 to-transparent' : 'bg-gradient-to-b from-gray-100/80 dark:from-slate-800/80 to-transparent'}`}>
        {/* Animated background glow when playing */}
        {isNowPlaying && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-red-pantone/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -top-1/4 -right-1/4 w-3/4 h-3/4 bg-crimson/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
        )}

        <div className="relative max-w-2xl mx-auto flex flex-col items-center text-center">
          {/* Album art with consistent size */}
          <div className="relative group mb-6">
            {song.thumbnail ? (
              <img
                src={song.thumbnail}
                alt=""
                className="w-56 h-56 rounded-2xl shadow-2xl object-cover ring-1 ring-black/5"
              />
            ) : (
              <div className="w-56 h-56 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center shadow-xl">
                <MusicalNoteIcon className="w-20 h-20 text-gray-400 dark:text-slate-400" />
              </div>
            )}
            {/* Play overlay on hover (only when not playing) */}
            {!isNowPlaying && (
              <button
                onClick={handlePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300"
              >
                <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/90 shadow-lg transform group-hover:scale-110 transition-transform">
                  <PlayIcon className="w-8 h-8 text-red-pantone ml-1" />
                </div>
              </button>
            )}
            {/* Playing indicator */}
            {isNowPlaying && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 bg-red-pantone text-white text-xs font-medium rounded-full shadow-lg">
                <span className="flex gap-0.5">
                  <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                Now Playing
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{song.title}</h1>
          <p className="text-lg text-gray-500 dark:text-slate-400">{song.artist}</p>
        </div>
      </div>

      {/* Status indicators */}
      {(playlists.length === 0 || isLiked) && (
        <div className="mx-4 -mt-2 mb-4 space-y-2 max-w-2xl mx-auto">
          {/* Liked indicator */}
          {isLiked && (
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center flex-shrink-0">
                <HeartSolidIcon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-red-700 dark:text-red-400">In your Liked Songs</span>
              </div>
              <button
                onClick={() => toggleLike(song.videoId)}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          )}

          {/* Warning: not in any playlist */}
          {playlists.length === 0 && (
            <button
              onClick={() => openModal('playlist-selector', { videoId: song.videoId })}
              className="w-full flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 dark:group-hover:bg-amber-800/50 transition-colors">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-amber-800 dark:text-amber-400">Not in any playlist</div>
                <div className="text-sm text-amber-600 dark:text-amber-500">Click to add this track to a playlist</div>
              </div>
              <PlusIcon className="w-5 h-5 text-amber-500 group-hover:text-amber-700 transition-colors" />
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Audio Analysis */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Audio Analysis</h2>

          {isLoadingAnalysis ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 dark:border-slate-600 border-t-red-pantone" />
            </div>
          ) : analysis ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {analysis.bpm && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{analysis.bpm}</div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">BPM</div>
                  </div>
                )}
                {analysis.key && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {analysis.key} {analysis.scale}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Key</div>
                  </div>
                )}
                {analysis.energy !== undefined && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{analysis.energy}%</div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Energy</div>
                  </div>
                )}
                {analysis.danceability !== undefined && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{analysis.danceability}%</div>
                    <div className="text-sm text-gray-500 dark:text-slate-400">Danceability</div>
                  </div>
                )}
              </div>
              <button
                onClick={() => openAnalysisModal(true)}
                className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Re-analyze
              </button>
            </>
          ) : (
            <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 dark:text-slate-400 mb-4">No analysis available</p>
              <button
                onClick={() => openAnalysisModal(false)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-space-cadet text-white rounded-lg hover:bg-space-cadet/90 transition-colors"
              >
                Analyze this track
              </button>
            </div>
          )}
        </section>

        {/* Last.fm Tags */}
        {analysis?.lastfmTags && analysis.lastfmTags.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Tags</h2>
              <a
                href={buildLastFmUrl(song.artist, song.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-red-600 transition-colors"
              >
                Last.fm
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.lastfmTags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
            {(analysis.lastfmListeners || analysis.lastfmPlaycount) && (
              <div className="flex gap-6 mt-4 text-sm text-gray-500 dark:text-slate-400">
                {analysis.lastfmListeners && (
                  <span>{Number(analysis.lastfmListeners).toLocaleString()} listeners</span>
                )}
                {analysis.lastfmPlaycount && (
                  <span>{Number(analysis.lastfmPlaycount).toLocaleString()} plays</span>
                )}
              </div>
            )}
          </section>
        )}

        {/* Discover similar */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Discover Similar</h2>
            {suggestions && (
              <button
                onClick={() => fetchSuggestions(true)}
                className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              >
                Refresh
              </button>
            )}
          </div>

          {!suggestions && !isLoadingSuggestions && (
            <button
              onClick={() => fetchSuggestions()}
              className="w-full flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-700 rounded-xl hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30 transition-colors group"
            >
              <SparklesIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span className="font-medium text-purple-700 dark:text-purple-300">Find similar tracks</span>
            </button>
          )}

          {isLoadingSuggestions && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-300 dark:border-purple-600 border-t-purple-600 dark:border-t-purple-300" />
            </div>
          )}

          {suggestionsError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl text-red-600 dark:text-red-400 text-sm">
              {suggestionsError}
            </div>
          )}

          {suggestions && (() => {
            // Deduplicate suggestions
            const seenIds = new Set<string>()
            const uniqueYtMix = suggestions.youtubeMix.filter(t => {
              if (seenIds.has(t.videoId)) return false
              seenIds.add(t.videoId)
              return true
            })
            const uniqueLastfm = suggestions.lastfmSimilar.filter(t => {
              if (!t.videoId || seenIds.has(t.videoId)) return false
              seenIds.add(t.videoId)
              return true
            })

            return (
            <div className="space-y-4">
              {/* YouTube Mix */}
              {uniqueYtMix.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">YouTube Mix</h3>
                  <div className="space-y-1">
                    {uniqueYtMix.slice(0, 8).map(track => (
                      <button
                        key={track.videoId}
                        onClick={() => playVideoInQueue(track.videoId, uniqueYtMix.map(t => t.videoId), uniqueYtMix)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
                      >
                        {track.thumbnail ? (
                          <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200 dark:bg-slate-700" />
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{track.title}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{track.artist}</div>
                        </div>
                        <PlayIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Last.fm Similar */}
              {uniqueLastfm.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Last.fm Similar</h3>
                  <div className="space-y-1">
                    {uniqueLastfm.map(track => (
                      <button
                        key={track.videoId}
                        onClick={() => playVideoInQueue(track.videoId, uniqueLastfm.map(t => t.videoId), uniqueLastfm)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
                      >
                        {track.thumbnail ? (
                          <img src={track.thumbnail} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-200 dark:bg-slate-700" />
                        )}
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{track.title}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{track.artist}</div>
                        </div>
                        <PlayIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {uniqueYtMix.length === 0 && uniqueLastfm.length === 0 && (
                <p className="text-gray-500 dark:text-slate-400 text-sm">No suggestions found</p>
              )}
            </div>
            )
          })()}
        </section>

        {/* Playlists containing this song */}
        <section>
          {(() => {
            const totalCount = playlists.length + (isLiked ? 1 : 0)
            return (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                In {totalCount} playlist{totalCount !== 1 ? 's' : ''}
              </h2>
            )
          })()}

          {playlists.length === 0 && !isLiked ? (
            <div className="flex items-center justify-between">
              <p className="text-gray-500 dark:text-slate-400">This track is not in any playlist</p>
              <button
                onClick={() => openModal('playlist-selector', { videoId: song.videoId })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Liked Songs virtual playlist */}
              {isLiked && (
                <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 group hover:border-gray-300 dark:hover:border-slate-600 transition-colors">
                  <button
                    onClick={() => router.push('/playlist/likes')}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center flex-shrink-0">
                      <HeartSolidIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-medium text-gray-900 dark:text-white truncate text-left">Liked Songs</div>
                  </button>
                  <button
                    onClick={() => toggleLike(song.videoId)}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from Liked Songs"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
              {/* Regular playlists */}
              {playlists.map(playlist => (
                <div
                  key={playlist.id}
                  className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 group hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
                >
                  <button
                    onClick={() => router.push(`/playlist/${playlist.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {playlist.thumbnail ? (
                      <img src={playlist.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex-shrink-0" />
                    )}
                    <div className="font-medium text-gray-900 dark:text-white truncate text-left">{playlist.title}</div>
                  </button>
                  <button
                    onClick={() => removeSongFromPlaylist(song.videoId, playlist.id)}
                    className="p-1.5 rounded-lg text-gray-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
                    title={`Remove from ${playlist.title}`}
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {/* Add to playlist button */}
              <button
                onClick={() => openModal('playlist-selector', { videoId: song.videoId })}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <PlusIcon className="w-5 h-5 text-gray-400 dark:text-slate-400" />
                </div>
                <span className="font-medium text-sm">Add to playlist</span>
              </button>
            </div>
          )}
        </section>

        {/* Song metadata */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Information</h2>
          <dl className="grid grid-cols-2 gap-4">
            {song.duration && (
              <>
                <dt className="text-gray-500 dark:text-slate-400">Duration</dt>
                <dd className="text-gray-900 dark:text-white">{song.duration}</dd>
              </>
            )}
            <dt className="text-gray-500 dark:text-slate-400">Video ID</dt>
            <dd className="text-gray-900 dark:text-white font-mono text-sm">{song.videoId}</dd>
          </dl>
        </section>
      </div>

      {/* Analysis Modal */}
      {showAnalysisModal && (
        <AnalysisModal
          videoId={song.videoId}
          title={song.title}
          artist={song.artist}
          forceRefresh={showAnalysisModal === 'refresh'}
          onClose={() => setShowAnalysisModal(false)}
          onComplete={handleAnalysisComplete}
        />
      )}
    </div>
  )
}
