'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { LoginPrompt } from '@/components/LoginPrompt'
import { PlaylistSidebar } from '@/components/layout/PlaylistSidebar'
import { MobileBottomTabs } from '@/components/layout/MobileBottomTabs'
import { PlayerBar } from '@/components/layout/PlayerBar'
import { HeartIcon, MusicalNoteIcon, ExclamationTriangleIcon, PlayIcon } from '@heroicons/react/24/solid'
import { ArrowRightIcon } from '@heroicons/react/24/outline'

export default function Home() {
  const router = useRouter()
  const { isConnected, isLoading: authLoading, initialize, signIn } = useAuthStore()
  const { smartSync, isSyncing, getAllPlaylists, getLikedSongs, getAllSongs } = useMusicStore()
  const { playerVideoId, playVideoInQueue, mobileTab } = useUIStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isConnected) {
      smartSync()
    }
  }, [isConnected, smartSync])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-cadet via-cool-gray to-antiflash-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-antiflash-white/30 border-t-red-pantone mx-auto mb-6" />
          <p className="text-antiflash-white text-lg font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return <LoginPrompt onConnect={signIn} />
  }

  const playlists = getAllPlaylists()
  const likedSongs = getLikedSongs()
  const allSongs = getAllSongs()
  const orphanSongs = allSongs.filter(s => s.playlistIds.length === 0 && s.isLiked)

  const handlePlayLiked = () => {
    if (likedSongs.length > 0) {
      const queue = likedSongs.map(s => s.videoId)
      playVideoInQueue(queue[0], queue)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: Sidebar + Content */}
        <div className="hidden md:flex flex-1">
          {/* Sidebar */}
          <aside className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
            <PlaylistSidebar />
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 p-8">
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Welcome back
                </h1>
                <p className="text-gray-500 dark:text-slate-400">
                  Your music library at a glance
                </p>
              </div>

              {/* Stats cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {/* Liked songs */}
                <button
                  onClick={() => router.push('/playlist/likes')}
                  className="bg-gradient-to-br from-red-pantone to-crimson p-6 rounded-2xl text-white text-left hover:shadow-lg hover:shadow-red-pantone/25 transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                      <HeartIcon className="w-6 h-6 text-white" />
                    </div>
                    <ArrowRightIcon className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-3xl font-bold mb-1">{likedSongs.length}</div>
                  <div className="text-white/80 text-sm">Liked Songs</div>
                </button>

                {/* Playlists */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700">
                  <div className="w-12 h-12 rounded-xl bg-space-cadet/10 dark:bg-space-cadet/30 flex items-center justify-center mb-4">
                    <MusicalNoteIcon className="w-6 h-6 text-space-cadet dark:text-slate-300" />
                  </div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{playlists.length}</div>
                  <div className="text-gray-500 dark:text-slate-400 text-sm">Playlists</div>
                </div>

                {/* To organize */}
                {orphanSongs.length > 0 ? (
                  <button
                    onClick={() => router.push('/playlist/likes')}
                    className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl border border-amber-200 dark:border-amber-700 text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                        <ExclamationTriangleIcon className="w-6 h-6 text-amber-600 dark:text-amber-500" />
                      </div>
                      <ArrowRightIcon className="w-5 h-5 text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-3xl font-bold text-amber-800 dark:text-amber-400 mb-1">{orphanSongs.length}</div>
                    <div className="text-amber-600 dark:text-amber-500 text-sm">Songs to organize</div>
                  </button>
                ) : (
                  <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl border border-green-200 dark:border-green-700">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-4">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="text-xl font-bold text-green-800 dark:text-green-400 mb-1">All organized!</div>
                    <div className="text-green-600 dark:text-green-500 text-sm">Every song is in a playlist</div>
                  </div>
                )}
              </div>

              {/* Quick play */}
              {likedSongs.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Play</h2>
                  <button
                    onClick={handlePlayLiked}
                    className="flex items-center gap-4 w-full p-4 rounded-xl bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors group"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center shadow-lg group-hover:shadow-red-pantone/25 transition-shadow">
                      <PlayIcon className="w-7 h-7 text-white ml-0.5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-gray-900 dark:text-white">Shuffle Liked Songs</div>
                      <div className="text-sm text-gray-500 dark:text-slate-400">{likedSongs.length} tracks</div>
                    </div>
                  </button>
                </div>
              )}

              {/* Recent playlists */}
              {playlists.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Your Playlists</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {playlists.slice(0, 8).map(playlist => (
                      <button
                        key={playlist.id}
                        onClick={() => router.push(`/playlist/${playlist.id}`)}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-left hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all group"
                      >
                        {playlist.thumbnail ? (
                          <img
                            src={playlist.thumbnail}
                            alt=""
                            className="w-full aspect-square rounded-lg object-cover mb-3 shadow-sm"
                          />
                        ) : (
                          <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 mb-3 flex items-center justify-center">
                            <MusicalNoteIcon className="w-10 h-10 text-gray-400 dark:text-slate-400" />
                          </div>
                        )}
                        <div className="font-medium text-gray-900 dark:text-white truncate text-sm">{playlist.title}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500 capitalize">{playlist.privacy}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Mobile: Single column */}
        <div className="flex-1 md:hidden overflow-y-auto">
          {mobileTab === 'playlists' && <PlaylistSidebar />}
          {mobileTab === 'songs' && (
            <div className="p-6 text-center text-gray-500 dark:text-slate-400">
              Select a playlist to see songs
            </div>
          )}
          {mobileTab === 'detail' && (
            <div className="p-6 text-center text-gray-500 dark:text-slate-400">
              Select a song to see details
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <div className="md:hidden">
        <MobileBottomTabs />
      </div>

      {/* Player bar */}
      {playerVideoId && <PlayerBar />}

      {/* Sync indicator */}
      {isSyncing && (
        <div className="fixed top-4 right-4 bg-space-cadet text-white px-3 py-1.5 rounded-full text-sm flex items-center gap-2 shadow-lg z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
          Syncing...
        </div>
      )}
    </div>
  )
}
