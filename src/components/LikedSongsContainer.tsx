'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Heart } from 'lucide-react'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { useUIStore } from '@/stores/useUIStore'
import { LikedSongsHeader } from './LikedSongsHeader'
import { LikedSongsFilters } from './LikedSongsFilters'
import { LikedSongsTrackList } from './LikedSongsTrackList'
import { PlaylistSelectorModal } from './PlaylistSelectorModal'
import { MiniPlayer } from './MiniPlayer'

export const LikedSongsContainer: React.FC = () => {
  const {
    analysis,
    playlists,
    isLoadingAnalysis,
    fetchAnalysis,
    addTrackToPlaylist
  } = usePlaylistsStore()

  const {
    playerVideoId,
    isPlayerVisible,
    playVideo,
    closePlayer,
    searchQuery,
    setSearchQuery,
    filterMode,
    setFilterMode,
    activeModal,
    modalData,
    openModal,
    closeModal
  } = useUIStore()

  const [error, setError] = useState<string>('')
  const [showSearch, setShowSearch] = useState(false)
  const [isAddingTrack, setIsAddingTrack] = useState<string | null>(null)

  // Load data on mount if not already loaded
  useEffect(() => {
    if (!analysis) {
      fetchAnalysis().catch(err => {
        setError(err instanceof Error ? err.message : 'Error loading data')
      })
    }
  }, [])

  const handleRefresh = async () => {
    setError('')
    try {
      await fetchAnalysis(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data')
    }
  }

  const handleAddToPlaylist = async (videoId: string, playlistId?: string) => {
    if (playlistId) {
      // Direct add to suggested playlist
      try {
        setIsAddingTrack(`${videoId}-${playlistId}`)
        await addTrackToPlaylist(playlistId, videoId)
        // Refresh analysis after adding
        await fetchAnalysis(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error adding to playlist')
      } finally {
        setIsAddingTrack(null)
      }
    } else {
      // Open playlist selector modal
      const track = analysis?.crossReferences.find(ref => ref.track.videoId === videoId)
      const foundInPlaylistIds = track?.foundInPlaylists.map(fp => fp.playlist.id) || []

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
        setIsAddingTrack(`${videoId}-${playlistId}`)
        await addTrackToPlaylist(playlistId, videoId)
        closeModal()
        // Refresh analysis after adding
        await fetchAnalysis(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error adding to playlist')
      } finally {
        setIsAddingTrack(null)
      }
    }
  }

  const exportToCSV = () => {
    if (!analysis) return
    const headers = ['Title', 'Artist', 'Playlists', 'Positions']
    const rows = analysis.crossReferences.map(({ track, foundInPlaylists }) => [
      track.title,
      track.artist,
      foundInPlaylists.map(fp => fp.playlist.title).join('; '),
      foundInPlaylists.map(fp => fp.position).join('; ')
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'liked-songs-analysis.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    if (!analysis) return []

    return analysis.crossReferences.filter((ref) => {
      const matchesTab = filterMode === 'all' || (filterMode === 'not-in-playlists' && ref.foundInPlaylists.length === 0)
      const matchesSearch = !searchQuery ||
        ref.track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ref.track.artist.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesTab && matchesSearch
    })
  }, [analysis, filterMode, searchQuery])

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-4 md:px-6 py-4">
          <LikedSongsHeader
            totalSongs={analysis?.statistics.totalLikedSongs || 0}
            isFetching={isLoadingAnalysis}
            onRefresh={handleRefresh}
            onExport={exportToCSV}
            onToggleSearch={() => setShowSearch(!showSearch)}
          />

          {analysis && (
            <div className="mt-3">
              <LikedSongsFilters
                activeTab={filterMode === 'all' ? 'all' : 'unassigned'}
                onTabChange={(tab) => setFilterMode(tab === 'all' ? 'all' : 'not-in-playlists')}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                showSearch={showSearch}
                notInPlaylistsCount={analysis.statistics.songsNotFoundInPlaylists}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* First load prompt */}
        {!analysis && !isLoadingAnalysis && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md mx-auto p-6">
              <Heart className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Analyze Your Liked Songs
              </h3>
              <p className="text-gray-600 mb-6">
                Discover which of your liked songs are in your playlists and get smart suggestions
              </p>
              <button
                onClick={handleRefresh}
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-all"
              >
                Load Songs
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
        {isLoadingAnalysis && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading from YouTube...</p>
            </div>
          </div>
        )}

        {/* Track List */}
        {analysis && !isLoadingAnalysis && (
          <div className="px-4 md:px-6 py-4">
            <LikedSongsTrackList
              tracks={filteredTracks}
              currentlyPlaying={playerVideoId}
              isAddingTrack={isAddingTrack}
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
