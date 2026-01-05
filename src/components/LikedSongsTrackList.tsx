'use client'

import React from 'react'
import { TrackCard } from './TrackCard'
import { Song } from '@/types/youtube'

interface LikedSongsTrackListProps {
  tracks: Song[]
  currentlyPlaying: string | null
  onPlayToggle: (videoId: string) => void
  onAddToPlaylist: (videoId: string, playlistId?: string) => void
  searchQuery: string
}

export const LikedSongsTrackList: React.FC<LikedSongsTrackListProps> = ({
  tracks,
  currentlyPlaying,
  onPlayToggle,
  onAddToPlaylist,
  searchQuery
}) => {
  if (tracks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">
          {searchQuery ? 'No tracks match your search' : 'No tracks to display'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tracks.map((song) => (
        <TrackCard
          key={song.videoId}
          song={song}
          isPlaying={currentlyPlaying === song.videoId}
          onPlayToggle={() => onPlayToggle(song.videoId)}
          onAddToPlaylist={(playlistId?: string) => {
            onAddToPlaylist(song.videoId, playlistId)
          }}
        />
      ))}
    </div>
  )
}
