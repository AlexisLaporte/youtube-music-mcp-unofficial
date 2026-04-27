'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { useMusicStore } from '@/stores/useMusicStore'
import { PageWithSidebar } from '@/components/layout/PageWithSidebar'

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
  } | null
  backendError: string | null
}

function SyncContent() {
  const [data, setData] = useState<SyncData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  const store = useMusicStore()

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
        backendData = {
          playlistsCount: stats.playlistsCount,
          likedSongsCount: stats.likedSongsCount,
          uniqueTracksCount: stats.uniqueTracksCount,
          enrichedCount: stats.enrichedCount || 0,
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

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadData()
      setLoading(false)
    }
    init()
  }, [loadData])

  const isSynced = !!data?.backend

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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Sync</h1>
                <p className="text-sm text-gray-500 dark:text-slate-400">YouTube Music data sync</p>
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
            {/* Sync status */}
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
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{data.backend.likedSongsCount}</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Liked songs</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{data.backend.enrichedCount}</div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">Enriched (Last.fm)</div>
                </div>
              </div>
            )}

            {/* Frontend stats */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Frontend Cache</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-slate-400">Songs in store</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{data.frontend.songsCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-slate-400">Playlists in store</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{data.frontend.playlistsCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-slate-400">Last sync</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">
                    {data.frontend.lastSyncAt
                      ? new Date(data.frontend.lastSyncAt).toLocaleString()
                      : 'Never'}
                  </dd>
                </div>
              </dl>
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
