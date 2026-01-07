'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline'
import { useMusicStore } from '@/stores/useMusicStore'
import { PageWithSidebar } from '@/components/layout/PageWithSidebar'

// Feature documentation in ./meta.ts (Next.js pages can't have custom exports)

interface SyncData {
  frontend: {
    songsCount: number
    playlistsCount: number
    lastSyncAt: number | null
  }
  backend: {
    playlistsCount: number
    likedSongsCount: number
    uniqueTracksCount: number
    enrichedCount: number
    analyzedCount: number
  } | null
  backendError: string | null
}

interface ProcessingStatus {
  running: boolean
  paused: boolean
  currentTrack: { videoId: string; title: string } | null
  progress: {
    done: number
    total: number
  }
  error: string | null
}

function SyncContent() {
  const [data, setData] = useState<SyncData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>('all')
  const [status, setStatus] = useState<ProcessingStatus>({
    running: false,
    paused: false,
    currentTrack: null,
    progress: { done: 0, total: 0 },
    error: null,
  })
  const [shouldStop, setShouldStop] = useState(false)
  const [progressData, setProgressData] = useState<{ enrichedIds: Set<string>; analyzedIds: Set<string>; unavailableIds: Set<string> }>({
    enrichedIds: new Set(),
    analyzedIds: new Set(),
    unavailableIds: new Set(),
  })

  const store = useMusicStore()
  const playlists = Array.from(store.playlists.values())

  // Compute progress for a set of track IDs (analyzed + unavailable = done)
  const getProgress = useCallback((trackIds: string[]) => {
    const analyzed = trackIds.filter(id => progressData.analyzedIds.has(id)).length
    const unavailable = trackIds.filter(id => progressData.unavailableIds.has(id)).length
    return { analyzed: analyzed + unavailable, total: trackIds.length }
  }, [progressData])

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis/progress')
      if (res.ok) {
        const data = await res.json()
        setProgressData({
          enrichedIds: new Set(data.enrichedIds || []),
          analyzedIds: new Set(data.analyzedIds || []),
          unavailableIds: new Set(data.unavailableIds || []),
        })
      }
    } catch {
      // Ignore
    }
  }, [])

  const loadData = useCallback(async () => {
    const frontendData = {
      songsCount: store.songs.size,
      playlistsCount: store.playlists.size,
      lastSyncAt: store.lastSyncAt,
    }

    let backendData = null
    let backendError = null

    try {
      const res = await fetch('/api/debug/cache-stats')
      if (res.ok) {
        const stats = await res.json()
        // Also get enrichment stats
        const enrichRes = await fetch('/api/track/enrich')
        const enrichStats = enrichRes.ok ? await enrichRes.json() : { enrichedCount: 0 }

        backendData = {
          playlistsCount: stats.playlistsCount,
          likedSongsCount: stats.likedSongsCount,
          uniqueTracksCount: stats.uniqueTracksCount,
          enrichedCount: enrichStats.enrichedCount || 0,
          analyzedCount: stats.analysisCount || 0,
        }
      } else {
        backendError = `HTTP ${res.status}`
      }
    } catch (e) {
      backendError = e instanceof Error ? e.message : 'Unknown error'
    }

    setData({
      frontend: frontendData,
      backend: backendData,
      backendError,
    })
  }, [store.songs.size, store.playlists.size, store.lastSyncAt])

  const handleForceSync = async () => {
    setSyncing(true)
    try {
      await store.fullSync()
      await loadData()
    } finally {
      setSyncing(false)
    }
  }

  // Get tracks for selected playlist
  const getTracksToProcess = useCallback(async (): Promise<string[]> => {
    if (selectedPlaylist === 'all') {
      // Get all unique track IDs
      const allIds = new Set<string>()
      store.songs.forEach((song) => allIds.add(song.videoId))
      return Array.from(allIds)
    } else if (selectedPlaylist === 'liked') {
      return Array.from(store.songs.values())
        .filter(s => s.isLiked)
        .map(s => s.videoId)
    } else {
      // Get tracks from specific playlist
      return store.playlistSongs.get(selectedPlaylist) || []
    }
  }, [selectedPlaylist, store.songs, store.playlistSongs])

  const startAnalysis = async () => {
    setShouldStop(false)
    setStatus(prev => ({ ...prev, running: true, paused: false, error: null }))

    try {
      const trackIds = await getTracksToProcess()
      if (trackIds.length === 0) {
        setStatus(prev => ({ ...prev, running: false, error: 'No tracks to process' }))
        return
      }

      // Filter out already analyzed tracks
      const pendingIds = trackIds.filter(id =>
        !progressData.analyzedIds.has(id) && !progressData.unavailableIds.has(id)
      )

      if (pendingIds.length === 0) {
        setStatus(prev => ({ ...prev, running: false, error: 'All tracks already analyzed' }))
        return
      }

      setStatus(prev => ({
        ...prev,
        progress: { done: 0, total: pendingIds.length },
      }))

      // Process one track at a time
      for (let i = 0; i < pendingIds.length; i++) {
        if (shouldStop) break

        const videoId = pendingIds[i]
        const song = store.songs.get(videoId)

        setStatus(prev => ({
          ...prev,
          currentTrack: { videoId, title: song?.title || videoId },
          progress: { ...prev.progress, done: i },
        }))

        // Call unified enrichment (YT metadata + replacement + audio analysis)
        await fetch('/api/track/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoIds: [videoId] }),
        })

        setStatus(prev => ({
          ...prev,
          progress: { ...prev.progress, done: i + 1 },
        }))
      }

      // Done
      setStatus(prev => ({ ...prev, running: false, currentTrack: null }))
      await fetchProgress()
      await loadData()

    } catch (e) {
      setStatus(prev => ({
        ...prev,
        running: false,
        error: e instanceof Error ? e.message : 'Analysis failed',
      }))
    }
  }

  const pauseAnalysis = () => {
    setShouldStop(true)
    setStatus(prev => ({ ...prev, running: false, paused: true }))
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadData()
      await fetchProgress()
      setLoading(false)
    }
    init()
  }, [loadData, fetchProgress])

  // Sync is OK if we have backend data
  const isSynced = !!data?.backend

  // Calculate total pending analysis
  const allTrackIds = Array.from(store.songs.values()).map(s => s.videoId)
  const pendingAnalysisCount = allTrackIds.filter(id =>
    !progressData.analyzedIds.has(id) && !progressData.unavailableIds.has(id)
  ).length

  // Background analysis state
  const [bgRunning, setBgRunning] = useState(false)
  const [bgStartedAt, setBgStartedAt] = useState<number | null>(null)

  // Check background status
  const checkBackgroundStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis/background')
      if (res.ok) {
        const data = await res.json()
        setBgRunning(data.running)
        setBgStartedAt(data.startedAt)
      }
    } catch {
      // Ignore
    }
  }, [])

  // Start background analysis (server-side)
  const startBackgroundAnalysis = async () => {
    try {
      const res = await fetch('/api/analysis/background', { method: 'POST' })
      if (res.ok) {
        setBgRunning(true)
        setBgStartedAt(Date.now())
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to start')
      }
    } catch (e) {
      alert('Failed to start background analysis')
    }
  }

  // Stop background analysis
  const stopBackgroundAnalysis = async () => {
    try {
      await fetch('/api/analysis/background', { method: 'DELETE' })
      setBgRunning(false)
      setBgStartedAt(null)
    } catch {
      // Ignore
    }
  }

  // Poll background status when running
  useEffect(() => {
    checkBackgroundStatus()
    if (bgRunning) {
      const interval = setInterval(() => {
        checkBackgroundStatus()
        fetchProgress()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [bgRunning, checkBackgroundStatus, fetchProgress])

  return (
    <div className="bg-gray-50 dark:bg-slate-900 min-h-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-space-cadet flex items-center justify-center">
                <ArrowPathIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sync & Analysis</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">Data sync + audio processing</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-sm"
              >
                Refresh
              </button>
              <button
                onClick={handleForceSync}
                disabled={syncing}
                className="px-4 py-2 bg-space-cadet text-white rounded-lg hover:bg-space-cadet/90 disabled:opacity-50 text-sm"
              >
                {syncing ? 'Syncing...' : 'Sync from YT'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-300 border-t-space-cadet" />
          </div>
        ) : data ? (
          <>
            {/* Background Analysis - server-side */}
            {(pendingAnalysisCount > 0 || bgRunning) && (
              <div className={`p-6 rounded-xl text-white ${bgRunning ? 'bg-gradient-to-r from-green-600 to-green-500' : 'bg-gradient-to-r from-space-cadet to-cool-gray'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold mb-1">
                      {bgRunning ? 'Analysis Running (Server)' : 'Audio Analysis'}
                    </h2>
                    <p className="text-white/80 text-sm">
                      {bgRunning
                        ? `Running for ${bgStartedAt ? Math.round((Date.now() - bgStartedAt) / 60000) : 0} min - ${pendingAnalysisCount} remaining`
                        : `${pendingAnalysisCount} tracks pending`
                      }
                    </p>
                  </div>
                  {bgRunning ? (
                    <button
                      onClick={stopBackgroundAnalysis}
                      className="flex items-center gap-2 px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <PauseIcon className="w-5 h-5" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={startBackgroundAnalysis}
                      className="flex items-center gap-2 px-6 py-3 bg-white text-space-cadet font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <PlayIcon className="w-5 h-5" />
                      Analyze All (Background)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Sync status - simplified */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${
              isSynced
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            }`}>
              {isSynced ? (
                <>
                  <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  <span className="text-green-800 dark:text-green-300 font-medium">
                    Backend connected ({data.backend?.uniqueTracksCount} tracks in DB)
                  </span>
                </>
              ) : (
                <>
                  <ExclamationCircleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  <span className="text-amber-800 dark:text-amber-300 font-medium">
                    {data.backendError || 'Backend not reachable'}
                  </span>
                </>
              )}
            </div>

            {/* Stats overview */}
            {data.backend && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.backend.uniqueTracksCount}</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Total tracks</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.backend.playlistsCount}</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Playlists</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{data.backend.enrichedCount}</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">YT metadata</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                  <div className="text-2xl font-bold text-space-cadet dark:text-blue-400">{data.backend.analyzedCount}</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Audio analyzed</div>
                </div>
              </div>
            )}

            {/* Analysis Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Analysis</h2>

              {/* Playlist selector + Start/Pause button */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1">
                  <label className="block text-sm text-gray-600 dark:text-slate-400 mb-1">Playlist</label>
                  <select
                    value={selectedPlaylist}
                    onChange={(e) => setSelectedPlaylist(e.target.value)}
                    disabled={status.running}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-lg text-sm text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    {(() => {
                      const allTracks = Array.from(store.songs.values()).map(s => s.videoId)
                      const allProgress = getProgress(allTracks)
                      return <option value="all">All tracks ({allProgress.analyzed}/{allProgress.total})</option>
                    })()}
                    {(() => {
                      const likedTracks = Array.from(store.songs.values()).filter(s => s.isLiked).map(s => s.videoId)
                      const likedProgress = getProgress(likedTracks)
                      return <option value="liked">Liked songs ({likedProgress.analyzed}/{likedProgress.total})</option>
                    })()}
                    {playlists.map(pl => {
                      const trackIds = store.playlistSongs.get(pl.id) || []
                      const progress = getProgress(trackIds)
                      return (
                        <option key={pl.id} value={pl.id}>
                          {pl.title} ({progress.analyzed}/{progress.total})
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="pt-6">
                  {status.running ? (
                    <button
                      onClick={pauseAnalysis}
                      className="flex items-center gap-2 px-6 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
                    >
                      <PauseIcon className="w-5 h-5" />
                      Pause
                    </button>
                  ) : (
                    <button
                      onClick={startAnalysis}
                      className="flex items-center gap-2 px-6 py-2 bg-space-cadet text-white hover:bg-space-cadet/90 rounded-lg transition-colors"
                    >
                      <PlayIcon className="w-5 h-5" />
                      {status.paused ? 'Resume' : 'Start Analysis'}
                    </button>
                  )}
                </div>
              </div>

              {/* Status display */}
              {status.running && (
                <div className="space-y-4">
                  {/* Current track */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      Analyzing...
                    </span>
                    {status.currentTrack && (
                      <span className="text-xs text-gray-500 dark:text-slate-400 truncate flex-1">
                        {status.currentTrack.title}
                      </span>
                    )}
                  </div>

                  {/* Single progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 dark:text-slate-400">Progress</span>
                      <span className="text-xs text-gray-600 dark:text-slate-400">
                        {status.progress.done} / {status.progress.total}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-space-cadet rounded-full transition-all duration-300"
                        style={{ width: status.progress.total > 0 ? `${(status.progress.done / status.progress.total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Error */}
              {status.error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                  {status.error}
                </div>
              )}

              {/* Info */}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-slate-700">
                <p className="text-xs text-gray-500 dark:text-slate-500">
                  Pour chaque track : YT metadata → remplacement auto si indisponible → audio analysis (BPM, key, energy)
                </p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

export default function SyncPage() {
  return (
    <PageWithSidebar>
      <SyncContent />
    </PageWithSidebar>
  )
}
