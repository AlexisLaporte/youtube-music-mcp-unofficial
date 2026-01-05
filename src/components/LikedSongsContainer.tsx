'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Heart } from 'lucide-react'
import { useMusicStore } from '@/stores/useMusicStore'
import { useUIStore } from '@/stores/useUIStore'
import { LikedSongsHeader } from './LikedSongsHeader'
import { LikedSongsFilters } from './LikedSongsFilters'
import { LikedSongsTrackList } from './LikedSongsTrackList'
import { PlaylistSelectorModal } from './PlaylistSelectorModal'
import { MiniPlayer } from './MiniPlayer'

export const LikedSongsContainer: React.FC = () => {
  const {
    isSyncing,
    lastSyncAt,
    smartSync,
    fullSync,
    getLikedSongs,
    getAllPlaylists,
    addSongToPlaylist,
    getSong,
  } = useMusicStore()

  const {
    playerVideoId,
    isPlayerVisible,
    playVideo,
    closePlayer,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    sortBy,
    sortOrder,
    setSortBy,
    toggleSortOrder,
    activeModal,
    modalData,
    openModal,
    closeModal
  } = useUIStore()

  const [error, setError] = useState<string>('')
  const [showSearch, setShowSearch] = useState(false)

  const likedSongs = getLikedSongs()
  const playlists = getAllPlaylists()
  const hasData = lastSyncAt !== null

  // Load data on mount
  useEffect(() => {
    if (!hasData) {
      smartSync().catch(err => {
        setError(err instanceof Error ? err.message : 'Error loading data')
      })
    }
  }, [hasData, smartSync])

  const handleRefresh = async () => {
    setError('')
    try {
      await fullSync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data')
    }
  }

  const handleAddToPlaylist = async (videoId: string, playlistId?: string) => {
    if (playlistId) {
      // Direct add - optimistic, no need to refresh
      try {
        await addSongToPlaylist(videoId, playlistId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error adding to playlist')
      }
    } else {
      // Open playlist selector modal
      const song = getSong(videoId)
      const foundInPlaylistIds = song?.playlistIds || []

      openModal('playlist-selector', {
        videoId,
        foundInPlaylistIds
      })
    }
  }

  const handleModalSelect = async (playlistId: string) => {
    const videoId = modalData.videoId as string
    if (videoId) {
      try {
        await addSongToPlaylist(videoId, playlistId)
        closeModal()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error adding to playlist')
      }
    }
  }

  const exportToCSV = () => {
    if (likedSongs.length === 0) return
    const headers = ['Title', 'Artist', 'Playlists']
    const rows = likedSongs.map(song => {
      const songPlaylists = song.playlistIds
        .map(id => playlists.find(p => p.id === id)?.title)
        .filter(Boolean)
        .join('; ')
      return [song.title, song.artist, songPlaylists]
    })
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'liked-songs.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Statistics
  const notInPlaylistsCount = useMemo(() => {
    return likedSongs.filter(s => s.playlistIds.length === 0).length
  }, [likedSongs])

  // Filtered and sorted tracks
  const filteredTracks = useMemo(() => {
    // Filter
    const filtered = likedSongs.filter((song) => {
      const matchesTab = filterMode === 'all' || (filterMode === 'not-in-playlists' && song.playlistIds.length === 0)
      const matchesSearch = !searchQuery ||
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesTab && matchesSearch
    })

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'date':
          comparison = (a.addedAt || '').localeCompare(b.addedAt || '')
          break
        case 'artist':
          comparison = a.artist.localeCompare(b.artist)
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'playlistCount':
          comparison = a.playlistIds.length - b.playlistIds.length
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [likedSongs, filterMode, searchQuery, sortBy, sortOrder])


  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-4 md:px-6 py-4">
          <LikedSongsHeader
            totalSongs={likedSongs.length}
            isFetching={isSyncing}
            onRefresh={handleRefresh}
            onExport={exportToCSV}
            onToggleSearch={() => setShowSearch(!showSearch)}
          />

          {hasData && (
            <div className="mt-3">
              <LikedSongsFilters
                activeTab={filterMode === 'all' ? 'all' : 'unassigned'}
                onTabChange={(tab) => setFilterMode(tab === 'all' ? 'all' : 'not-in-playlists')}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                showSearch={showSearch}
                notInPlaylistsCount={notInPlaylistsCount}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortByChange={setSortBy}
                onToggleSortOrder={toggleSortOrder}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* First load prompt */}
        {!hasData && !isSyncing && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md mx-auto p-6">
              <Heart className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Load Your Music Library
              </h3>
              <p className="text-gray-600 mb-6">
                Sync your liked songs and playlists from YouTube Music
              </p>
              <button
                onClick={handleRefresh}
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-all"
              >
                Sync Library
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 md:px-6 py-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {isSyncing && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Syncing from YouTube...</p>
            </div>
          </div>
        )}

        {/* Track List */}
        {hasData && !isSyncing && (
          <div className="px-4 md:px-6 py-4">
            <LikedSongsTrackList
              tracks={filteredTracks}
              currentlyPlaying={playerVideoId}
              onPlayToggle={(videoId) => {
                if (playerVideoId === videoId) {
                  closePlayer()
                } else {
                  playVideo(videoId)
                }
              }}
              onAddToPlaylist={handleAddToPlaylist}
              searchQuery={searchQuery}
            />
          </div>
        )}
      </div>

      {/* Playlist Selector Modal */}
      {activeModal === 'playlist-selector' && (
        <PlaylistSelectorModal
          videoId={modalData.videoId as string}
          playlists={playlists}
          foundInPlaylistIds={(modalData.foundInPlaylistIds as string[]) || []}
          onSelect={handleModalSelect}
          onClose={closeModal}
        />
      )}

      {/* Mini Player */}
      {isPlayerVisible && playerVideoId && (
        <MiniPlayer
          videoId={playerVideoId}
          onClose={closePlayer}
        />
      )}
    </div>
  )
}
