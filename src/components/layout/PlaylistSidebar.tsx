'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { HeartIcon, PlusIcon, MusicalNoteIcon, MagnifyingGlassIcon, ChartBarIcon } from '@heroicons/react/24/solid'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'

export function PlaylistSidebar() {
  const router = useRouter()
  const playlistsMap = useMusicStore(state => state.playlists)
  const songsMap = useMusicStore(state => state.songs)
  const { selectedPlaylistId, openModal, setMobileTab, enterSearchMode, isSearchMode } = useUIStore()
  const { user, signOut } = useAuthStore()

  const playlists = useMemo(() => Array.from(playlistsMap.values()), [playlistsMap])
  const likedCount = useMemo(() =>
    Array.from(songsMap.values()).filter(s => s.isLiked).length,
    [songsMap]
  )

  const handleSelect = (id: string | 'liked') => {
    // Navigate via URL
    router.push(id === 'liked' ? '/' : `/playlist/${id}`)
    setMobileTab('songs')
  }

  return (
    <div className="h-full flex flex-col bg-gray-50/50">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <button
          onClick={() => handleSelect('liked')}
          className="text-xl font-bold text-gray-900 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
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
              : 'hover:bg-white hover:shadow-sm'
          }`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isSearchMode ? 'bg-white/20' : 'bg-gray-100'
          }`}>
            <MagnifyingGlassIcon className={`w-4 h-4 ${isSearchMode ? 'text-white' : 'text-gray-500'}`} />
          </div>
          <div className={`font-medium text-sm ${isSearchMode ? 'text-white' : 'text-gray-700'}`}>Search YouTube</div>
        </button>

        {/* Liked Songs (special) */}
        <button
          onClick={() => handleSelect('liked')}
          className={`w-full text-left px-3 py-2.5 flex items-center gap-3 rounded-xl transition-all duration-150 ${
            selectedPlaylistId === 'liked'
              ? 'bg-red-pantone/10 ring-1 ring-red-pantone/20'
              : 'hover:bg-white hover:shadow-sm'
          }`}
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center flex-shrink-0 shadow-sm">
            <HeartIcon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`font-medium text-sm truncate ${selectedPlaylistId === 'liked' ? 'text-red-pantone' : 'text-gray-700'}`}>Liked Songs</div>
            <div className="text-xs text-gray-400">{likedCount} tracks</div>
          </div>
        </button>
      </div>

      {/* Divider with label */}
      <div className="px-5 py-2">
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Your Playlists</div>
      </div>

      {/* Playlist list */}
      <div className="flex-1 overflow-y-auto px-3">
        {playlists.length === 0 ? (
          <div className="p-4 text-center text-gray-400 text-sm">
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
                    : 'hover:bg-white hover:shadow-sm'
                }`}
              >
                {playlist.thumbnail ? (
                  <img
                    src={playlist.thumbnail}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center flex-shrink-0">
                    <MusicalNoteIcon className="w-4 h-4 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-sm truncate ${selectedPlaylistId === playlist.id ? 'text-red-pantone' : 'text-gray-700'}`}>{playlist.title}</div>
                  <div className="text-xs text-gray-400 capitalize">{playlist.privacy}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100 space-y-2">
        <button
          onClick={() => openModal('create-playlist')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-space-cadet to-space-cadet/90 text-white rounded-xl hover:shadow-lg hover:shadow-space-cadet/20 transition-all duration-200 font-medium text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          New playlist
        </button>
        <button
          onClick={() => router.push('/analysis-status')}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-150 text-xs font-medium"
        >
          <ChartBarIcon className="w-3.5 h-3.5" />
          Analysis status
        </button>
      </div>

      {/* Account */}
      {user && (
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2">
            {user.profilePicture ? (
              <img
                src={user.profilePicture}
                alt=""
                className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-500">
                  {user.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-700 truncate">{user.name}</div>
              <div className="text-xs text-gray-400 truncate">{user.email}</div>
            </div>
            <button
              onClick={signOut}
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
