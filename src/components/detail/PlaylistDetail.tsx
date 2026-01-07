'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Playlist, Song } from '@/types/youtube'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { MusicalNoteIcon, TrashIcon, PencilIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { PlayIcon } from '@heroicons/react/24/solid'

interface PlaylistDetailProps {
  playlist: Playlist
}

interface BatchStatus {
  running: boolean
  processedCount: number
  lastVideoId: string | null
}

export function PlaylistDetail({ playlist }: PlaylistDetailProps) {
  const songsMap = useMusicStore(state => state.songs)
  const playlistSongsMap = useMusicStore(state => state.playlistSongs)
  const { openModal, playShuffled } = useUIStore()
  const [isStarting, setIsStarting] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null)

  const songs = useMemo(() => {
    const videoIds = playlistSongsMap.get(playlist.id) || []
    return videoIds
      .map(id => songsMap.get(id))
      .filter((s): s is Song => s !== undefined)
  }, [playlist.id, songsMap, playlistSongsMap])

  // Calculate stats
  const artists = new Set(songs.map(s => s.artist))
  const likedCount = songs.filter(s => s.isLiked).length

  // Check batch status
  const fetchBatchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis/batch')
      if (res.ok) {
        const data = await res.json()
        setBatchStatus(data)
      }
    } catch {
      // Ignore
    }
  }, [])

  // Poll batch status
  useEffect(() => {
    fetchBatchStatus()

    const interval = setInterval(fetchBatchStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchBatchStatus])

  const analyzePlaylist = async () => {
    if (songs.length === 0 || batchStatus?.running) return

    setIsStarting(true)
    setAnalyzeError(null)

    try {
      const videoIds = songs.map(s => s.videoId)
      const res = await fetch('/api/analysis/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start analysis')
      }

      if (data.status) {
        setBatchStatus(data.status)
      }
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setIsStarting(false)
    }
  }

  const isRunning = batchStatus?.running ?? false

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

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={analyzePlaylist}
            disabled={isStarting || isRunning || songs.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              isRunning
                ? 'bg-green-600 text-white'
                : 'bg-space-cadet text-white hover:bg-space-cadet/90 disabled:bg-gray-300 disabled:cursor-not-allowed'
            }`}
          >
            <BeakerIcon className={`w-4 h-4 ${isRunning ? 'animate-pulse' : ''}`} />
            {isStarting
              ? 'Starting...'
              : isRunning
                ? `Analyzing... (${batchStatus?.processedCount || 0} done)`
                : `Analyze ${songs.length} tracks`}
          </button>
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
        {analyzeError && (
          <p className="mt-2 text-sm text-red-600">{analyzeError}</p>
        )}
      </div>
    </div>
  )
}
