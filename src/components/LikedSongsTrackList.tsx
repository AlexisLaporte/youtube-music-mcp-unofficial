'use client'

import React from 'react'
import { TrackCard } from './TrackCard'
import { YouTubeTrack, YouTubePlaylist, PlaylistSuggestion } from '@/types/youtube'

interface TrackListItem {
  track: YouTubeTrack
  foundInPlaylists: { playlist: YouTubePlaylist; position: number }[]
  suggestedPlaylists: PlaylistSuggestion[]
}

interface LikedSongsTrackListProps {
  tracks: TrackListItem[]
  currentlyPlaying: string | null
  isAddingTrack: string | null
  onPlayToggle: (videoId: string) => void
  onAddToPlaylist: (videoId: string, playlistId?: string) => void
  searchQuery: string
}

export const LikedSongsTrackList: React.FC<LikedSongsTrackListProps> = ({
  tracks,
  currentlyPlaying,
  isAddingTrack,
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
      {tracks.map(({ track, foundInPlaylists, suggestedPlaylists }) => (
        <TrackCard
          key={track.id}
          track={track}
          foundInPlaylists={foundInPlaylists}
          suggestedPlaylists={suggestedPlaylists}
          isPlaying={currentlyPlaying === track.videoId}
          isAdding={isAddingTrack?.startsWith(track.videoId)}
          onPlayToggle={() => onPlayToggle(track.videoId)}
          onAddToPlaylist={(playlistId?: string) => {
            onAddToPlaylist(track.videoId, playlistId)
          }}
        />
      ))}
    </div>
  )
}
