'use client'

import React, { useEffect, useState } from 'react'
import { Music, Play, ArrowLeft, Edit2, CheckSquare } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { useUIStore } from '@/stores/useUIStore'
import { MiniPlayer } from './MiniPlayer'
import { SplitPlaylistModal } from './SplitPlaylistModal'

interface PlaylistEditorProps {
  playlistId: string
}

export const PlaylistEditor: React.FC<PlaylistEditorProps> = ({ playlistId }) => {
  const router = useRouter()
  const {
    playlists,
    playlistTracks,
    selectedTracks,
    fetchPlaylists,
    fetchPlaylistTracks,
    toggleTrackSelection,
    clearTrackSelection
  } = usePlaylistsStore()

  const {
    playerVideoId,
    isPlayerVisible,
    playVideo,
    closePlayer,
    isBatchMode,
    toggleBatchMode,
    exitBatchMode
  } = useUIStore()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [showSplitModal, setShowSplitModal] = useState(false)

  const playlist = playlists.find(p => p.id === playlistId)
  const tracks = playlistTracks[playlistId] || []
  const selectedTracksData = tracks.filter(t => selectedTracks.has(t.id))

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      setError('')
      try {
        if (playlists.length === 0) {
          await fetchPlaylists()
        }
        await fetchPlaylistTracks(playlistId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading playlist')
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [playlistId])

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading playlist...</p>
        </div>
      </div>
    )
  }

  if (error || !playlist) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-red-700 mb-4">{error || 'Playlist not found'}</p>
          <button
            onClick={() => router.push('/playlists')}
            className="text-red-600 hover:text-red-700 flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to playlists
          </button>
        </div>
      </div>
    )
  }

  const selectedCount = selectedTracks.size

  const handleSplit = async (
    title: string,
    description: string,
    privacy: 'public' | 'private' | 'unlisted',
    removeFromSource: boolean
  ) => {
    try {
      // Create new playlist
      const newPlaylistId = await usePlaylistsStore.getState().createPlaylist(title, description, privacy)

      // Add selected tracks to new playlist
      const videoIds = selectedTracksData.map(t => t.videoId)
      await usePlaylistsStore.getState().addTracksToPlaylist(newPlaylistId, videoIds)

      // Remove from source if requested (when API is available)
      if (removeFromSource) {
        console.log('TODO: Remove tracks from source playlist')
        // This will need a removeTracksFromPlaylist API method
      }

      // Clean up
      clearTrackSelection()
      exitBatchMode()
      setShowSplitModal(false)

      // Redirect to new playlist
      router.push(`/playlist/${newPlaylistId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error splitting playlist')
      setShowSplitModal(false)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => router.push('/playlists')}
              className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100"
              title="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-gray-900 truncate">
                {playlist.title}
              </h1>
              {playlist.description && (
                <p className="text-sm text-gray-600 line-clamp-1">{playlist.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleBatchMode}
              className={`p-2 rounded-lg transition-colors ${
                isBatchMode
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={isBatchMode ? 'Exit selection mode' : 'Select tracks'}
            >
              <CheckSquare className="h-5 w-5" />
            </button>

            <button
              onClick={() => {
                // Open edit modal (to be implemented)
                console.log('Edit playlist metadata')
              }}
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Edit playlist"
            >
              <Edit2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Batch mode actions */}
        {isBatchMode && (
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm text-blue-900">
                {selectedCount} selected
              </span>
              <button
                onClick={clearTrackSelection}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSplitModal(true)}
                disabled={selectedCount === 0}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Split to new playlist
              </button>
              <button
                onClick={() => {
                  exitBatchMode()
                  clearTrackSelection()
                }}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600 mt-2">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          {selectedCount > 0 && ` • ${selectedCount} selected`}
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-2">
          {tracks.length === 0 ? (
            <div className="text-center py-12">
              <Music className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">This playlist is empty</p>
            </div>
          ) : (
            tracks.map((track, index) => {
              const isSelected = selectedTracks.has(track.id)

              return (
                <div
                  key={`${track.id}-${index}`}
                  className={`border rounded-lg p-4 transition-all bg-white cursor-pointer ${
                    isSelected
                      ? 'border-red-500 ring-2 ring-red-500'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    if (isBatchMode) {
                      toggleTrackSelection(track.id)
                    }
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Selection checkbox (batch mode) */}
                    {isBatchMode && (
                      <div className="flex-shrink-0 pt-1">
                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            isSelected
                              ? 'bg-red-500 border-red-500'
                              : 'bg-white border-gray-300'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                              <path d="M5 13l4 4L19 7"></path>
                            </svg>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Thumbnail */}
                    <div className="relative flex-shrink-0">
                      {track.thumbnail ? (
                        <Image
                          src={track.thumbnail}
                          alt={track.title}
                          width={60}
                          height={60}
                          className="rounded-lg"
                        />
                      ) : (
                        <div className="w-15 h-15 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Music className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{track.title}</h4>
                      <p className="text-sm text-gray-600">{track.artist}</p>
                      {track.duration && (
                        <p className="text-xs text-gray-500 mt-1">{track.duration}</p>
                      )}
                    </div>

                    {/* Play button (not in batch mode) */}
                    {!isBatchMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (playerVideoId === track.videoId) {
                            closePlayer()
                          } else {
                            playVideo(track.videoId)
                          }
                        }}
                        className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                        title="Play"
                      >
                        <Play className="h-5 w-5 text-white ml-0.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Mini Player */}
      {isPlayerVisible && playerVideoId && (
        <MiniPlayer videoId={playerVideoId} onClose={closePlayer} />
      )}

      {/* Split Playlist Modal */}
      {showSplitModal && playlist && (
        <SplitPlaylistModal
          sourcePlaylistTitle={playlist.title}
          selectedTracks={selectedTracksData}
          onConfirm={handleSplit}
          onClose={() => setShowSplitModal(false)}
        />
      )}
    </div>
  )
}
