'use client'

import { useEffect, useState } from 'react'
import { useMusicStore } from '@/stores/useMusicStore'

interface SyncDebugData {
  browser: {
    songsCount: number
    playlistsCount: number
    lastSyncAt: number | null
    sampleSongs: { videoId: string; title: string; playlistIds: string[] }[]
  }
  db: {
    playlistsCount: number
    tracksCount: number
    analysisCount: number
  } | null
  youtube: {
    playlistsCount: number
    likedSongsCount: number
    playlists: { id: string; title: string; trackCount: number }[]
  } | null
  errors: string[]
}

export default function SyncDebugPage() {
  const [data, setData] = useState<SyncDebugData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshingYT, setRefreshingYT] = useState(false)
  const [forceSync, setForceSync] = useState(false)

  const store = useMusicStore()

  const loadData = async (fetchYouTube = false, doForceSync = false) => {
    const errors: string[] = []

    // Browser data
    const browserData = {
      songsCount: store.songs.size,
      playlistsCount: store.playlists.size,
      lastSyncAt: store.lastSyncAt,
      sampleSongs: Array.from(store.songs.values())
        .slice(0, 10)
        .map(s => ({ videoId: s.videoId, title: s.title, playlistIds: s.playlistIds }))
    }

    // DB data
    let dbData = null
    try {
      const res = await fetch('/api/debug/cache-stats')
      if (res.ok) {
        dbData = await res.json()
      } else {
        errors.push(`DB fetch failed: ${res.status}`)
      }
    } catch (e) {
      errors.push(`DB fetch error: ${e}`)
    }

    // YouTube data (optional - expensive)
    let ytData = null
    if (fetchYouTube) {
      try {
        const res = await fetch('/api/debug/youtube-stats')
        if (res.ok) {
          ytData = await res.json()
        } else {
          errors.push(`YouTube fetch failed: ${res.status}`)
        }
      } catch (e) {
        errors.push(`YouTube fetch error: ${e}`)
      }
    }

    setData({
      browser: browserData,
      db: dbData,
      youtube: ytData,
      errors
    })

    if (doForceSync) {
      await store.fullSync()
      // Reload browser data after sync
      setData(prev => prev ? {
        ...prev,
        browser: {
          songsCount: store.songs.size,
          playlistsCount: store.playlists.size,
          lastSyncAt: store.lastSyncAt,
          sampleSongs: Array.from(store.songs.values())
            .slice(0, 10)
            .map(s => ({ videoId: s.videoId, title: s.title, playlistIds: s.playlistIds }))
        }
      } : null)
    }
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false))
  }, [])

  const handleRefreshYouTube = async () => {
    setRefreshingYT(true)
    await loadData(true)
    setRefreshingYT(false)
  }

  const handleForceSync = async () => {
    setForceSync(true)
    await loadData(false, true)
    setForceSync(false)
  }

  const formatDate = (ts: number | null) => {
    if (!ts) return 'Never'
    return new Date(ts).toLocaleString()
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-red-500 rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sync Debug</h1>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleRefreshYouTube}
          disabled={refreshingYT}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshingYT ? 'Fetching YouTube...' : 'Fetch YouTube Data'}
        </button>
        <button
          onClick={handleForceSync}
          disabled={forceSync}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {forceSync ? 'Syncing...' : 'Force Full Sync'}
        </button>
      </div>

      {/* Errors */}
      {data?.errors && data.errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h2 className="font-semibold text-red-800 dark:text-red-200 mb-2">Errors</h2>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
            {data.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Browser Cache */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Browser Cache (localStorage)
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-slate-400">Songs</dt>
            <dd className="text-2xl font-bold text-gray-900 dark:text-white">{data?.browser.songsCount}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-slate-400">Playlists</dt>
            <dd className="text-2xl font-bold text-gray-900 dark:text-white">{data?.browser.playlistsCount}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-gray-500 dark:text-slate-400">Last Sync</dt>
            <dd className="text-gray-900 dark:text-white">{formatDate(data?.browser.lastSyncAt ?? null)}</dd>
          </div>
        </dl>
        {data?.browser.sampleSongs && data.browser.sampleSongs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Sample Songs</h3>
            <div className="text-xs font-mono bg-gray-50 dark:bg-slate-900 rounded p-2 max-h-40 overflow-auto">
              {data.browser.sampleSongs.map(s => (
                <div key={s.videoId} className="text-gray-600 dark:text-slate-400">
                  {s.videoId}: {s.title} [{s.playlistIds.length} playlists]
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* DB Cache */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Server DB Cache (SQLite)
        </h2>
        {data?.db ? (
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500 dark:text-slate-400">Playlists</dt>
              <dd className="text-2xl font-bold text-gray-900 dark:text-white">{data.db.playlistsCount}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-slate-400">Tracks</dt>
              <dd className="text-2xl font-bold text-gray-900 dark:text-white">{data.db.tracksCount}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-slate-400">Audio Analyses</dt>
              <dd className="text-2xl font-bold text-gray-900 dark:text-white">{data.db.analysisCount}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-gray-500 dark:text-slate-400">Not loaded</p>
        )}
      </div>

      {/* YouTube Live */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          YouTube API (Live)
        </h2>
        {data?.youtube ? (
          <>
            <dl className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <dt className="text-gray-500 dark:text-slate-400">Playlists</dt>
                <dd className="text-2xl font-bold text-gray-900 dark:text-white">{data.youtube.playlistsCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-slate-400">Liked Songs</dt>
                <dd className="text-2xl font-bold text-gray-900 dark:text-white">{data.youtube.likedSongsCount}</dd>
              </div>
            </dl>
            {data.youtube.playlists && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Playlists</h3>
                <div className="text-xs font-mono bg-gray-50 dark:bg-slate-900 rounded p-2 max-h-40 overflow-auto">
                  {data.youtube.playlists.map(p => (
                    <div key={p.id} className="text-gray-600 dark:text-slate-400">
                      {p.id}: {p.title} ({p.trackCount} tracks)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 dark:text-slate-400">
            Click &quot;Fetch YouTube Data&quot; to load (expensive API calls)
          </p>
        )}
      </div>
    </div>
  )
}
