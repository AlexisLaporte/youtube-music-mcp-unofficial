'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/useAuthStore'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { LoginPrompt } from '@/components/LoginPrompt'
import { PlaylistSidebar } from './PlaylistSidebar'
import { SongList } from './SongList'
import { DetailPanel } from './DetailPanel'
import { MobileBottomTabs } from './MobileBottomTabs'
import { PlaylistSelectorModal } from '@/components/PlaylistSelectorModal'
import { XMarkIcon } from '@heroicons/react/24/outline'

export function AppLayout() {
  const router = useRouter()
  const { isConnected, isLoading: authLoading, initialize, signIn } = useAuthStore()
  const { smartSync, isSyncing, getAllPlaylists, getSong, getPlaylist, addSongToPlaylist, updatePlaylist, deletePlaylist } = useMusicStore()
  const { mobileTab, activeModal, modalData, closeModal, selectPlaylist } = useUIStore()

  // Edit modal state
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (isConnected) {
      smartSync()
    }
  }, [isConnected, smartSync])

  // Populate edit form when modal opens
  useEffect(() => {
    if (activeModal === 'edit-playlist' && modalData?.playlistId) {
      const playlist = getPlaylist(modalData.playlistId as string)
      if (playlist) {
        setEditTitle(playlist.title)
        setEditDescription(playlist.description || '')
      }
    }
  }, [activeModal, modalData?.playlistId, getPlaylist])

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modalData?.playlistId || !editTitle.trim()) return

    setIsSubmitting(true)
    await updatePlaylist(modalData.playlistId as string, editTitle.trim(), editDescription.trim())
    setIsSubmitting(false)
    closeModal()
  }

  const handleDeleteConfirm = async () => {
    if (!modalData?.playlistId) return

    setIsSubmitting(true)
    await deletePlaylist(modalData.playlistId as string)
    setIsSubmitting(false)
    closeModal()
    selectPlaylist('liked')
    router.push('/playlist/liked')
  }

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

      {/* Edit Playlist Modal */}
      {activeModal === 'edit-playlist' && modalData?.playlistId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Playlist</h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-pantone focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-pantone focus:border-transparent resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !editTitle.trim()}
                  className="px-4 py-2 bg-red-pantone text-white rounded-lg hover:bg-crimson transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Playlist Confirmation Modal */}
      {activeModal === 'delete-playlist-confirm' && modalData?.playlistId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Playlist</h2>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-600 dark:text-slate-300 mb-6">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{modalData.playlistTitle}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
