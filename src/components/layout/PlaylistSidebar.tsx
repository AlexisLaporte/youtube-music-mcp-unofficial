'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { HeartIcon, PlusIcon, MusicalNoteIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid'

export function PlaylistSidebar() {
  const router = useRouter()
  const playlistsMap = useMusicStore(state => state.playlists)
  const songsMap = useMusicStore(state => state.songs)
  const { selectedPlaylistId, openModal, setMobileTab, enterSearchMode, isSearchMode } = useUIStore()

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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MusicalNoteIcon className="w-5 h-5 text-red-pantone" />
          Playlists
        </h2>
      </div>

      {/* Search */}
      <button
        onClick={() => {
          enterSearchMode()
          setMobileTab('detail')
        }}
        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
          isSearchMode
            ? 'bg-gray-100 border-l-4 border-gray-600'
            : 'hover:bg-gray-50 border-l-4 border-transparent'
        }`}
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isSearchMode ? 'bg-gray-600' : 'bg-gray-100'
        }`}>
          <MagnifyingGlassIcon className={`w-5 h-5 ${isSearchMode ? 'text-white' : 'text-gray-600'}`} />
        </div>
        <div className="font-medium text-gray-900">Search</div>
      </button>

      {/* Liked Songs (special) */}
      <button
        onClick={() => handleSelect('liked')}
        className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
          selectedPlaylistId === 'liked'
            ? 'bg-red-50 border-l-4 border-red-pantone'
            : 'hover:bg-gray-50 border-l-4 border-transparent'
        }`}
      >
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-pantone to-crimson flex items-center justify-center flex-shrink-0">
          <HeartIcon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 truncate">Liked Songs</div>
          <div className="text-sm text-gray-500">{likedCount} tracks</div>
        </div>
      </button>

      {/* Divider */}
      <div className="border-b border-gray-200 my-2" />

      {/* Playlist list */}
      <div className="flex-1 overflow-y-auto">
        {playlists.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No playlists
          </div>
        ) : (
          playlists.map(playlist => (
            <button
              key={playlist.id}
              onClick={() => handleSelect(playlist.id)}
              className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                selectedPlaylistId === playlist.id
                  ? 'bg-red-50 border-l-4 border-red-pantone'
                  : 'hover:bg-gray-50 border-l-4 border-transparent'
              }`}
            >
              {playlist.thumbnail ? (
                <img
                  src={playlist.thumbnail}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <MusicalNoteIcon className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">{playlist.title}</div>
                <div className="text-xs text-gray-500 capitalize">{playlist.privacy}</div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Create playlist button */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={() => openModal('create-playlist')}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-space-cadet text-white rounded-lg hover:bg-space-cadet/90 transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          New playlist
        </button>
      </div>
    </div>
  )
}
