'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { LoginPrompt } from '@/components/LoginPrompt'
import { PlaylistSidebar } from '@/components/layout/PlaylistSidebar'
import { MobileBottomTabs } from '@/components/layout/MobileBottomTabs'
import { HeartIcon, MusicalNoteIcon, PlayIcon, SparklesIcon } from '@heroicons/react/24/solid'
import { ArrowRightIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

const PLAYLISTS_PER_PAGE = 12

export default function Home() {
  const router = useRouter()
  const { isConnected, isLoading: authLoading, initialize, signIn, user } = useAuthStore()
  const { smartSync, isSyncing, getAllPlaylists, getLikedSongs, getAllSongs } = useMusicStore()
  const { playVideoInQueue, playShuffled, mobileTab } = useUIStore()
  const [playlistPage, setPlaylistPage] = useState(0)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isConnected) {
      smartSync()
    }
  }, [isConnected, smartSync])

  // Redirect pending/blocked users (unless admin)
  useEffect(() => {
    if (user && !user.isAdmin) {
      if (user.status === 'pending') {
        router.push('/pending')
      } else if (user.status === 'blocked') {
        router.push('/blocked')
      }
    }
  }, [user, router])

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

  // Show loading while initial sync (no cached data yet)
  if (isSyncing && playlists.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-cadet via-cool-gray to-antiflash-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-antiflash-white/30 border-t-red-pantone mx-auto mb-6" />
          <p className="text-antiflash-white text-lg font-medium">Syncing your library...</p>
        </div>
      </div>
    )
  }
  const likedSongs = getLikedSongs()
  const allSongs = getAllSongs()
  const orphanSongs = allSongs.filter(s => s.playlistIds.length === 0 && s.isLiked && !s.noPlaylistNeeded)

  const totalPages = Math.ceil(playlists.length / PLAYLISTS_PER_PAGE)
  const paginatedPlaylists = playlists.slice(
    playlistPage * PLAYLISTS_PER_PAGE,
    (playlistPage + 1) * PLAYLISTS_PER_PAGE
  )

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

          {/* Main content - Two columns */}
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 p-8">
            <div className="flex gap-8">
              {/* Left column - Stats & Quick actions */}
              <div className="w-80 flex-shrink-0 space-y-6">
                {/* Header */}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    Welcome back
                  </h1>
                  <p className="text-gray-500 dark:text-slate-400 text-sm">
                    Your music library
                  </p>
                </div>

                {/* Liked songs card */}
                <button
                  onClick={() => router.push('/playlist/liked')}
                  className="w-full bg-gradient-to-br from-red-pantone to-crimson p-5 rounded-2xl text-white text-left hover:shadow-lg hover:shadow-red-pantone/25 transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <HeartIcon className="w-5 h-5 text-white" />
                    </div>
                    <ArrowRightIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-2xl font-bold mb-0.5">{likedSongs.length}</div>
                  <div className="text-white/80 text-sm">Liked Songs</div>
                </button>

                {/* Stats row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{playlists.length}</div>
                    <div className="text-gray-500 dark:text-slate-400 text-xs">Playlists</div>
                  </div>

                  {orphanSongs.length > 0 ? (
                    <button
                      onClick={() => router.push('/playlist/liked')}
                      className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-700 text-left hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                    >
                      <div className="text-2xl font-bold text-amber-800 dark:text-amber-400">{orphanSongs.length}</div>
                      <div className="text-amber-600 dark:text-amber-500 text-xs">To organize</div>
                    </button>
                  ) : (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-700">
                      <div className="text-lg font-bold text-green-800 dark:text-green-400">✓</div>
                      <div className="text-green-600 dark:text-green-500 text-xs">All organized</div>
                    </div>
                  )}
                </div>

                {/* Quick play */}
                <div className="space-y-3">
                  {allSongs.length > 0 && (
                    <button
                      onClick={() => playShuffled(allSongs.map(s => s.videoId))}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-space-cadet to-cool-gray text-white hover:shadow-lg hover:shadow-space-cadet/25 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                        <SparklesIcon className="w-6 h-6 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-sm">Shuffle All</div>
                        <div className="text-xs text-white/70">{allSongs.length} tracks</div>
                      </div>
                    </button>
                  )}

                  {likedSongs.length > 0 && (
                    <button
                      onClick={handlePlayLiked}
                      className="w-full flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-colors group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center shadow-lg group-hover:shadow-red-pantone/25 transition-shadow">
                        <PlayIcon className="w-6 h-6 text-white ml-0.5" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900 dark:text-white text-sm">Shuffle Liked</div>
                        <div className="text-xs text-gray-500 dark:text-slate-400">{likedSongs.length} tracks</div>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* Right column - Playlists grid */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your Playlists</h2>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-slate-400">
                        {playlistPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPlaylistPage(p => Math.max(0, p - 1))}
                        disabled={playlistPage === 0}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeftIcon className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                      </button>
                      <button
                        onClick={() => setPlaylistPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={playlistPage >= totalPages - 1}
                        className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRightIcon className="w-4 h-4 text-gray-600 dark:text-slate-400" />
                      </button>
                    </div>
                  )}
                </div>

                {playlists.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {paginatedPlaylists.map(playlist => (
                      <button
                        key={playlist.id}
                        onClick={() => router.push(`/playlist/${playlist.id}`)}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3 text-left hover:shadow-md hover:border-gray-300 dark:hover:border-slate-600 transition-all group"
                      >
                        {playlist.thumbnail ? (
                          <img
                            src={playlist.thumbnail}
                            alt=""
                            className="w-full aspect-square rounded-lg object-cover mb-2 shadow-sm"
                          />
                        ) : (
                          <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 mb-2 flex items-center justify-center">
                            <MusicalNoteIcon className="w-8 h-8 text-gray-400 dark:text-slate-400" />
                          </div>
                        )}
                        <div className="font-medium text-gray-900 dark:text-white truncate text-sm">{playlist.title}</div>
                        <div className="text-xs text-gray-400 dark:text-slate-500 capitalize">{playlist.privacy}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-slate-400">
                    No playlists yet. Sync your library to get started.
                  </div>
                )}
              </div>
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
