'use client'

import React from 'react';
import { Music, Play, Pause, Plus, BarChart3 } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { YouTubeTrack, YouTubePlaylist } from '@/types/youtube';
import { PlaylistBadges } from './PlaylistBadges';

interface TrackCardProps {
  track: YouTubeTrack;
  suggestedPlaylists?: {
    playlist: YouTubePlaylist;
    score: number;
    reasons: string[];
  }[];
  isPlaying: boolean;
  isAdding?: boolean;
  onPlayToggle: () => void;
  onAddToPlaylist: (playlistId?: string) => void;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  suggestedPlaylists,
  isPlaying,
  isAdding = false,
  onPlayToggle,
  onAddToPlaylist,
}) => {
  const router = useRouter();

  return (
    <div className="bg-white border border-gray-200 rounded-xl transition-all duration-200 hover:border-red-300 hover:shadow-sm p-3">
      {/* Main Row - Always Visible */}
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-12 h-12 md:w-14 md:h-14">
          {track.thumbnail ? (
            <Image
              src={track.thumbnail}
              alt={track.title}
              width={56}
              height={56}
              className="rounded-lg object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
              <Music className="h-5 w-5 text-gray-400" />
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 truncate text-sm md:text-base">
            {track.title}
          </h4>
          <p className="text-xs md:text-sm text-gray-600 truncate">
            {track.artist}
          </p>
          {/* Playlist Badges */}
          <div className="mt-0.5">
            <PlaylistBadges videoId={track.videoId} maxVisible={2} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Play Button */}
          <button
            onClick={onPlayToggle}
            className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4 md:h-5 md:w-5 text-white" />
            ) : (
              <Play className="h-4 w-4 md:h-5 md:w-5 text-white ml-0.5" />
            )}
          </button>

          {/* Analyze Button */}
          <button
            onClick={() => router.push(`/analyze?v=${track.videoId}&title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`)}
            className="p-2 rounded-lg transition-colors text-gray-600 hover:text-purple-600 hover:bg-purple-50 active:scale-95 w-10 h-10"
            title="Analyser l'audio"
          >
            <BarChart3 className="h-5 w-5" />
          </button>

          {/* Add to Playlist Button */}
          <button
            onClick={() => onAddToPlaylist()}
            className="p-2 rounded-lg transition-colors text-gray-600 hover:text-gray-900 hover:bg-gray-100 active:scale-95 w-10 h-10 md:w-auto md:px-3"
            title="Add to playlist"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Suggestions - Always Visible */}
      {suggestedPlaylists && suggestedPlaylists.length > 0 && (
        <div className="mt-2 px-3">
          <div className="flex flex-wrap gap-1">
            {suggestedPlaylists.slice(0, 3).map((suggestion, idx) => (
              <button
                key={`${suggestion.playlist.id}-${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log(`Adding to playlist: ${suggestion.playlist.id}`);
                  onAddToPlaylist(suggestion.playlist.id);
                }}
                disabled={isAdding}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  isAdding
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                }`}
                title={`Add to ${suggestion.playlist.title}. Match: ${suggestion.reasons.join(', ')}`}
              >
                + {suggestion.playlist.title}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
