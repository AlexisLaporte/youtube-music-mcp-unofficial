'use client'

import React, { useEffect, useState } from 'react'
import { Plus, RefreshCw, Grid, List, CheckSquare } from 'lucide-react'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { useUIStore } from '@/stores/useUIStore'
import { PlaylistGrid } from './PlaylistGrid'
import { CreatePlaylistModal } from './CreatePlaylistModal'

export const PlaylistsView: React.FC = () => {
  const {
    playlists,
    isLoadingPlaylists,
    selectedPlaylists,
    fetchPlaylists,
    createPlaylist,
    deletePlaylist,
    togglePlaylistSelection,
    clearPlaylistSelection
  } = usePlaylistsStore()

  const {
    view,
    setView,
    isBatchMode,
    toggleBatchMode,
    exitBatchMode
  } = useUIStore()

  const [error, setError] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (playlists.length === 0) {
      fetchPlaylists().catch(err => {
        setError(err instanceof Error ? err.message : 'Error loading playlists')
      })
    }
  }, [])

  const handleRefresh = async () => {
    setError('')
    try {
      await fetchPlaylists(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading playlists')
    }
  }

  const handleCreate = async (title: string, description: string, privacy: 'public' | 'private' | 'unlisted') => {
    try {
      await createPlaylist(title, description, privacy)
      setShowCreateModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating playlist')
    }
  }

  const handleDelete = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist? This cannot be undone.')) {
      return
    }

    try {
      await deletePlaylist(playlistId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting playlist')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedPlaylists.size === 0) return

    const count = selectedPlaylists.size
    if (!confirm(`Are you sure you want to delete ${count} playlist(s)? This cannot be undone.`)) {
      return
    }

    try {
      await Promise.all(
        Array.from(selectedPlaylists).map(id => deletePlaylist(id))
      )
      clearPlaylistSelection()
      exitBatchMode()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting playlists')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Playlists</h1>
              <p className="text-gray-600 mt-1">
                {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Batch mode toggle */}
              <button
                onClick={toggleBatchMode}
                className={`p-2 rounded-lg transition-colors ${
                  isBatchMode
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
                title={isBatchMode ? 'Exit batch mode' : 'Select multiple'}
              >
                <CheckSquare className="h-5 w-5" />
              </button>

              {/* View toggle */}
              <div className="hidden sm:flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setView('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    view === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Grid view"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-1.5 rounded transition-colors ${
                    view === 'list' ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={isLoadingPlaylists}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${isLoadingPlaylists ? 'animate-spin' : ''}`} />
              </button>

              {/* Create playlist */}
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white rounded-lg font-medium transition-all"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Create</span>
              </button>
            </div>
          </div>

          {/* Batch mode actions */}
          {isBatchMode && (
            <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-4">
                <span className="text-sm text-blue-900">
                  {selectedPlaylists.size} selected
                </span>
                <button
                  onClick={clearPlaylistSelection}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedPlaylists.size === 0}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete selected
                </button>
                <button
                  onClick={() => {
                    exitBatchMode()
                    clearPlaylistSelection()
                  }}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoadingPlaylists && playlists.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading playlists...</p>
            </div>
          </div>
        ) : (
          <PlaylistGrid
            playlists={playlists}
            selectedIds={selectedPlaylists}
            onToggleSelect={togglePlaylistSelection}
            onDelete={handleDelete}
            isBatchMode={isBatchMode}
          />
        )}
      </div>

      {/* Create playlist modal */}
      {showCreateModal && (
        <CreatePlaylistModal
          onConfirm={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}
