'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Song } from '@/types/youtube'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { PlayIcon, PlusIcon, HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
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
  const { playVideo, openModal } = useUIStore()

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

  // Fetch analysis on mount
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
      <div className={`relative p-8 transition-all duration-500 ${isNowPlaying ? 'bg-gradient-to-b from-red-pantone/15 via-red-pantone/5 to-transparent' : 'bg-gradient-to-b from-gray-100/80 to-transparent'}`}>
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
              <div className="w-56 h-56 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-xl">
                <MusicalNoteIcon className="w-20 h-20 text-gray-400" />
              </div>
            )}
            {/* Play overlay on hover (only when not playing) */}
            {!isNowPlaying && (
              <button
                onClick={() => playVideo(song.videoId)}
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

          <h1 className="text-2xl font-bold text-gray-900 mb-1">{song.title}</h1>
          <p className="text-lg text-gray-500">{song.artist}</p>
        </div>
      </div>

      {/* Status indicators */}
      {(playlists.length === 0 || isLiked) && (
        <div className="mx-4 -mt-2 mb-4 space-y-2 max-w-2xl mx-auto">
          {/* Liked indicator */}
          {isLiked && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center flex-shrink-0">
                <HeartSolidIcon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium text-red-700">In your Liked Songs</span>
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
              className="w-full flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium text-amber-800">Not in any playlist</div>
                <div className="text-sm text-amber-600">Click to add this track to a playlist</div>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Audio Analysis</h2>

          {isLoadingAnalysis ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-red-pantone" />
            </div>
          ) : analysis ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {analysis.bpm && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">{analysis.bpm}</div>
                    <div className="text-sm text-gray-500">BPM</div>
                  </div>
                )}
                {analysis.key && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">
                      {analysis.key} {analysis.scale}
                    </div>
                    <div className="text-sm text-gray-500">Key</div>
                  </div>
                )}
                {analysis.energy !== undefined && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">{analysis.energy}%</div>
                    <div className="text-sm text-gray-500">Energy</div>
                  </div>
                )}
                {analysis.danceability !== undefined && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">{analysis.danceability}%</div>
                    <div className="text-sm text-gray-500">Danceability</div>
                  </div>
                )}
              </div>
              <button
                onClick={() => openAnalysisModal(true)}
                className="mt-4 flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Re-analyze
              </button>
            </>
          ) : (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <p className="text-gray-500 mb-4">No analysis available</p>
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
              <h2 className="text-lg font-semibold text-gray-900">Tags</h2>
              <a
                href={buildLastFmUrl(song.artist, song.title)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors"
              >
                Last.fm
                <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              </a>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.lastfmTags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
            {(analysis.lastfmListeners || analysis.lastfmPlaycount) && (
              <div className="flex gap-6 mt-4 text-sm text-gray-500">
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

        {/* Playlists containing this song */}
        <section>
          {(() => {
            const totalCount = playlists.length + (isLiked ? 1 : 0)
            return (
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                In {totalCount} playlist{totalCount !== 1 ? 's' : ''}
              </h2>
            )
          })()}

          {playlists.length === 0 && !isLiked ? (
            <div className="flex items-center justify-between">
              <p className="text-gray-500">This track is not in any playlist</p>
              <button
                onClick={() => openModal('playlist-selector', { videoId: song.videoId })}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Liked Songs virtual playlist */}
              {isLiked && (
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 group hover:border-gray-300 transition-colors">
                  <button
                    onClick={() => router.push('/')}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center flex-shrink-0">
                      <HeartSolidIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="font-medium text-gray-900 truncate text-left">Liked Songs</div>
                  </button>
                  <button
                    onClick={() => toggleLike(song.videoId)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
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
                  className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 group hover:border-gray-300 transition-colors"
                >
                  <button
                    onClick={() => router.push(`/playlist/${playlist.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {playlist.thumbnail ? (
                      <img src={playlist.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex-shrink-0" />
                    )}
                    <div className="font-medium text-gray-900 truncate text-left">{playlist.title}</div>
                  </button>
                  <button
                    onClick={() => removeSongFromPlaylist(song.videoId, playlist.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title={`Remove from ${playlist.title}`}
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {/* Add to playlist button */}
              <button
                onClick={() => openModal('playlist-selector', { videoId: song.videoId })}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all"
              >
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <PlusIcon className="w-5 h-5 text-gray-400" />
                </div>
                <span className="font-medium text-sm">Add to playlist</span>
              </button>
            </div>
          )}
        </section>

        {/* Song metadata */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Information</h2>
          <dl className="grid grid-cols-2 gap-4">
            {song.duration && (
              <>
                <dt className="text-gray-500">Duration</dt>
                <dd className="text-gray-900">{song.duration}</dd>
              </>
            )}
            <dt className="text-gray-500">Video ID</dt>
            <dd className="text-gray-900 font-mono text-sm">{song.videoId}</dd>
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
