'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { LoginPrompt } from '@/components/LoginPrompt'
import { PlaylistSidebar } from './PlaylistSidebar'
import { SongList } from './SongList'
import { DetailPanel } from './DetailPanel'
import { MobileBottomTabs } from './MobileBottomTabs'
import { PlaylistSelectorModal } from '@/components/PlaylistSelectorModal'

export function AppLayout() {
  const { isConnected, isLoading: authLoading, initialize, signIn } = useAuthStore()
  const { smartSync, isSyncing, getAllPlaylists, getSong, addSongToPlaylist } = useMusicStore()
  const { mobileTab, activeModal, modalData, closeModal } = useUIStore()

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

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop: 3 columns */}
        <div className="hidden md:flex flex-1">
          {/* Col 1: Playlists */}
          <aside className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-y-auto">
            <PlaylistSidebar />
          </aside>

          {/* Col 2: Songs */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
            <SongList />
          </div>

          {/* Col 3: Detail */}
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900">
            <DetailPanel />
          </main>
        </div>

        {/* Mobile: Single column based on tab */}
        <div className="flex-1 md:hidden overflow-y-auto">
          {mobileTab === 'playlists' && <PlaylistSidebar />}
          {mobileTab === 'songs' && <SongList />}
          {mobileTab === 'detail' && <DetailPanel />}
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

      {/* Global Playlist Selector Modal */}
      {activeModal === 'playlist-selector' && modalData?.videoId && (
        <PlaylistSelectorModal
          videoId={modalData.videoId as string}
          playlists={getAllPlaylists().map(p => ({ id: p.id, title: p.title, thumbnail: p.thumbnail }))}
          foundInPlaylistIds={getSong(modalData.videoId as string)?.playlistIds || []}
          onSelect={(playlistId) => {
            addSongToPlaylist(modalData.videoId as string, playlistId)
            closeModal()
          }}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
