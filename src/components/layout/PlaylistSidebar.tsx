'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { HeartIcon, PlusIcon, MusicalNoteIcon, MagnifyingGlassIcon, ChartBarIcon } from '@heroicons/react/24/solid'
import { ArrowRightOnRectangleIcon, MoonIcon, SunIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'

export function PlaylistSidebar() {
  const router = useRouter()
  const playlistsMap = useMusicStore(state => state.playlists)
  const songsMap = useMusicStore(state => state.songs)
  const { selectedPlaylistId, openModal, setMobileTab, enterSearchMode, isSearchMode } = useUIStore()
  const { user, signOut } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)

  // Close menu on click outside
  useEffect(() => {
    if (!showAccountMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAccountMenu])

  const playlists = useMemo(() => Array.from(playlistsMap.values()), [playlistsMap])
  const likedCount = useMemo(() =>
    Array.from(songsMap.values()).filter(s => s.isLiked).length,
    [songsMap]
  )

  const handleSelect = (id: string | 'liked') => {
    // Navigate via URL - all playlists use /playlist/{id} pattern
    router.push(`/playlist/${id}`)
    setMobileTab('songs')
  }

  return (
    <div className="h-full flex flex-col bg-gray-50/50 dark:bg-slate-800/50">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-slate-700">
        <button
          onClick={() => router.push('/')}
          className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center">
            <MusicalNoteIcon className="w-4 h-4 text-white" />
          </div>
          Library
        </button>
      </div>

      {/* Quick actions */}
      <div className="p-3 space-y-1">
        {/* Search */}
        <button
          onClick={() => {
            enterSearchMode()
            setMobileTab('detail')
          }}
          className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-xl transition-all duration-150 ${
            isSearchMode
              ? 'bg-space-cadet text-white'
              : 'hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm'
          }`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isSearchMode ? 'bg-white/20' : 'bg-gray-100 dark:bg-slate-700'
          }`}>
            <MagnifyingGlassIcon className={`w-4 h-4 ${isSearchMode ? 'text-white' : 'text-gray-500 dark:text-slate-400'}`} />
          </div>
          <div className={`font-medium text-sm ${isSearchMode ? 'text-white' : 'text-gray-700 dark:text-slate-200'}`}>Search YouTube</div>
        </button>

        {/* Liked Songs (special) */}
        <button
          onClick={() => handleSelect('liked')}
          className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-xl transition-all duration-150 ${
            selectedPlaylistId === 'liked'
              ? 'bg-red-pantone/10 ring-1 ring-red-pantone/20'
              : 'hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center flex-shrink-0 shadow-sm">
            <HeartIcon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`font-medium text-sm truncate ${selectedPlaylistId === 'liked' ? 'text-red-pantone' : 'text-gray-700 dark:text-slate-200'}`}>Liked Songs</div>
            <div className="text-xs text-gray-400 dark:text-slate-500">{likedCount} tracks</div>
          </div>
        </button>
      </div>

      {/* Divider with label */}
      <div className="px-5 py-2">
        <div className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">Your Playlists</div>
      </div>

      {/* Playlist list */}
      <div className="flex-1 overflow-y-auto px-3">
        {playlists.length === 0 ? (
          <div className="p-4 text-center text-gray-400 dark:text-slate-500 text-sm">
            No playlists yet
          </div>
        ) : (
          <div className="space-y-0.5">
            {playlists.map(playlist => (
              <button
                key={playlist.id}
                onClick={() => handleSelect(playlist.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 rounded-xl transition-all duration-150 group ${
                  selectedPlaylistId === playlist.id
                    ? 'bg-red-pantone/10 ring-1 ring-red-pantone/20'
                    : 'hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm'
                }`}
              >
                {playlist.thumbnail ? (
                  <img
                    src={playlist.thumbnail}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0">
                    <MusicalNoteIcon className="w-4 h-4 text-gray-400 dark:text-slate-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-sm truncate ${selectedPlaylistId === playlist.id ? 'text-red-pantone' : 'text-gray-700 dark:text-slate-200'}`}>{playlist.title}</div>
                  <div className="text-xs text-gray-400 dark:text-slate-500 capitalize">{playlist.privacy}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 dark:border-slate-700 space-y-2">
        <button
          onClick={() => openModal('create-playlist')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-space-cadet to-space-cadet/90 text-white rounded-xl hover:shadow-lg hover:shadow-space-cadet/20 transition-all duration-200 font-medium text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          New playlist
        </button>
      </div>

      {/* Account */}
      {user && (
        <div className="p-3 border-t border-gray-100 dark:border-slate-700 relative" ref={accountMenuRef}>
          <button
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-full flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
          >
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt=""
                className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200 dark:ring-slate-600"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium text-gray-700 dark:text-slate-200 truncate">{user.name}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500 truncate">{user.email}</div>
            </div>
          </button>

          {/* Account menu popover */}
          {showAccountMenu && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50">
              {/* Dark mode toggle */}
              <button
                onClick={() => {
                  toggleTheme()
                  setShowAccountMenu(false)
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <SunIcon className="w-4 h-4" />
                  ) : (
                    <MoonIcon className="w-4 h-4" />
                  )}
                  <span className="text-sm">Dark mode</span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                    theme === 'dark' ? 'bg-space-cadet' : 'bg-gray-200 dark:bg-slate-600'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      theme === 'dark' ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </button>

              {/* Sync status */}
              <Link
                href="/users/me/sync"
                onClick={() => setShowAccountMenu(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ArrowPathIcon className="w-4 h-4" />
                <span className="text-sm">Sync status</span>
              </Link>

              {/* Analysis status */}
              <Link
                href="/users/me/analysis"
                onClick={() => setShowAccountMenu(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                <ChartBarIcon className="w-4 h-4" />
                <span className="text-sm">Audio analysis</span>
              </Link>

              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-slate-700 my-1" />

              {/* Sign out */}
              <button
                onClick={() => {
                  setShowAccountMenu(false)
                  signOut()
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span className="text-sm">Sign out</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
