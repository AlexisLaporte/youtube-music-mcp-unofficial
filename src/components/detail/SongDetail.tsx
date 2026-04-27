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
import { MusicalNoteIcon, ArrowTopRightOnSquareIcon, XMarkIcon, ExclamationTriangleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

interface SongDetailProps {
  song: Song
  isNowPlaying?: boolean
}

function buildLastFmUrl(artist: string, track: string): string {
  // Remove feat./ft. parts but keep duo names like "Amadou & Mariam"
  const cleanArtist = artist.replace(/\s*\(.*\)$/, '').replace(/\s+(feat\.?|ft\.?).*$/i, '').trim()
  return `https://www.last.fm/music/${encodeURIComponent(cleanArtist)}/_/${encodeURIComponent(track)}`
}

interface TrackMetadata {
  lastfmTags?: string[]
  lastfmListeners?: string
  lastfmPlaycount?: string
}

export function SongDetail({ song, isNowPlaying }: SongDetailProps) {
  const router = useRouter()
  const playlistsMap = useMusicStore(state => state.playlists)
  const songsMap = useMusicStore(state => state.songs)
  const toggleLike = useMusicStore(state => state.toggleLike)
  const removeSongFromPlaylist = useMusicStore(state => state.removeSongFromPlaylist)
  const toggleNoPlaylistNeeded = useMusicStore(state => state.toggleNoPlaylistNeeded)
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

  // Track metadata (tags from enrichment)
  const [metadata, setMetadata] = useState<TrackMetadata | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)

  // Suggestions state
  const [suggestions, setSuggestions] = useState<{
    youtubeMix: { videoId: string; title: string; artist: string; thumbnail?: string }[]
    lastfmSimilar: { videoId: string; title: string; artist: string; thumbnail?: string }[]
  } | null>(null)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)

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

  // Fetch metadata and suggestions on mount
  useEffect(() => {
    fetchSuggestions()
  }, [song.videoId])

  useEffect(() => {
    const fetchMetadata = async () => {
      setIsLoadingMetadata(true)
      try {
        const res = await fetch(`/api/track/${song.videoId}/metadata`)
        if (res.ok) {
          const data = await res.json()
          setMetadata(data)
        }
      } catch (e) {
        console.warn('Failed to fetch metadata:', e)
      } finally {
        setIsLoadingMetadata(false)
      }
    }

    fetchMetadata()
  }, [song.videoId])

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 lg:p-8">
        {/* 2-column layout on large screens */}
        <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
          {/* Left column: Album art, title, status */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="lg:sticky lg:top-6 space-y-6">
              {/* Album art */}
              <div className={`relative group mx-auto lg:mx-0 w-fit rounded-2xl ${isNowPlaying ? 'ring-4 ring-red-pantone/30' : ''}`}>
                {song.thumbnail ? (
                  <img
                    src={song.thumbnail}
                    alt=""
                    className="w-56 h-56 lg:w-72 lg:h-72 rounded-2xl shadow-xl object-cover"
                  />
                ) : (
                  <div className="w-56 h-56 lg:w-72 lg:h-72 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center shadow-xl">
                    <MusicalNoteIcon className="w-20 h-20 text-gray-400 dark:text-slate-400" />
                  </div>
                )}
                {/* Play overlay */}
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
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-red-pantone text-white text-xs font-medium rounded-full shadow-lg">
                    <span className="flex gap-0.5">
                      <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    Now Playing
                  </div>
                )}
              </div>

              {/* Title & artist */}
              <div className="text-center lg:text-left">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{song.title}</h1>
                <p className="text-lg text-gray-500 dark:text-slate-400">{song.artist}</p>
              </div>

              {/* Playing from context */}
              {selectedPlaylistId && (
                <button
                  onClick={() => router.push(selectedPlaylistId === 'liked' ? '/playlist/likes' : `/playlist/${selectedPlaylistId}`)}
                  className="w-full flex items-center gap-2 p-2.5 bg-space-cadet/5 dark:bg-space-cadet/20 border border-space-cadet/20 dark:border-space-cadet/30 rounded-xl text-left hover:bg-space-cadet/10 dark:hover:bg-space-cadet/30 transition-colors group"
                >
                  <ArrowLeftIcon className="w-4 h-4 text-space-cadet dark:text-slate-300 group-hover:-translate-x-0.5 transition-transform" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 dark:text-slate-400">Playing from</div>
                    <div className="text-sm font-medium text-space-cadet dark:text-white truncate">
                      {selectedPlaylistId === 'liked' ? 'Liked Songs' : playlistsMap.get(selectedPlaylistId)?.title || 'Playlist'}
                    </div>
                  </div>
                </button>
              )}

              {/* Playlists section */}
              <div>
                {(() => {
                  const totalCount = playlists.length + (isLiked ? 1 : 0)
                  return (
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                      In {totalCount} playlist{totalCount !== 1 ? 's' : ''}
                    </h3>
                  )
                })()}

                {playlists.length === 0 && !isLiked ? (
                  <div className="space-y-2">
                    {!liveSong.noPlaylistNeeded ? (
                      <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                          <span className="text-sm font-medium text-amber-800 dark:text-amber-400">Not in any playlist</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openModal('playlist-selector', { videoId: song.videoId })}
                            className="flex-1 px-3 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => toggleNoPlaylistNeeded(song.videoId)}
                            className="px-3 py-1.5 text-xs text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded-lg transition-colors"
                          >
                            Standalone
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
                        <MusicalNoteIcon className="w-4 h-4 text-gray-500 dark:text-slate-400" />
                        <span className="flex-1 text-sm text-gray-600 dark:text-slate-400">Standalone track</span>
                        <button
                          onClick={() => toggleNoPlaylistNeeded(song.videoId)}
                          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
                        >
                          Undo
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Liked Songs */}
                    {isLiked && (
                      <div className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 group hover:border-gray-300 dark:hover:border-slate-600 transition-colors">
                        <button
                          onClick={() => router.push('/playlist/likes')}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center flex-shrink-0">
                            <HeartSolidIcon className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate text-left">Liked Songs</span>
                        </button>
                        <button
                          onClick={() => toggleLike(song.videoId)}
                          className="p-1 rounded text-gray-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
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
                        className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 group hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
                      >
                        <button
                          onClick={() => router.push(`/playlist/${playlist.id}`)}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          {playlist.thumbnail ? (
                            <img src={playlist.thumbnail} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate text-left">{playlist.title}</span>
                        </button>
                        <button
                          onClick={() => removeSongFromPlaylist(song.videoId, playlist.id)}
                          className="p-1 rounded text-gray-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
                          title={`Remove from ${playlist.title}`}
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {/* Add to playlist button */}
                    <button
                      onClick={() => openModal('playlist-selector', { videoId: song.videoId })}
                      className="w-full flex items-center gap-2 p-2 rounded-lg border border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <PlusIcon className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                      </div>
                      <span className="text-sm">Add to playlist</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Track Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Track Info</h3>
                <dl className="space-y-2 text-sm">
                  {song.duration && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500 dark:text-slate-400">Duration</dt>
                      <dd className="text-gray-900 dark:text-white">{song.duration}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500 dark:text-slate-400">Video ID</dt>
                    <dd className="text-gray-900 dark:text-white font-mono text-xs">{song.videoId}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          {/* Right column: Tags, Discover */}
          <div className="flex-1 space-y-8">
            {/* Last.fm Tags */}
            {metadata?.lastfmTags && metadata.lastfmTags.length > 0 && (
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
                  {metadata.lastfmTags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {(metadata.lastfmListeners || metadata.lastfmPlaycount) && (
                  <div className="flex gap-6 mt-4 text-sm text-gray-500 dark:text-slate-400">
                    {metadata.lastfmListeners && (
                      <span>{Number(metadata.lastfmListeners).toLocaleString()} listeners</span>
                    )}
                    {metadata.lastfmPlaycount && (
                      <span>{Number(metadata.lastfmPlaycount).toLocaleString()} plays</span>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Loading state for metadata */}
            {isLoadingMetadata && !metadata && (
              <section>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tags</h2>
                <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                  <div className="w-4 h-4 border-2 border-gray-300 dark:border-slate-600 border-t-purple-600 rounded-full animate-spin" />
                  Loading tags...
                </div>
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

          </div>
        </div>
      </div>
    </div>
  )
}
