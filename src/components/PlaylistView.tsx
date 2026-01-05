'use client'

import React, { useState, useEffect } from 'react';
import { Music, Play, Pause, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/apiService';
import { YouTubeTrack, YouTubePlaylist } from '@/types/youtube';

interface PlaylistViewProps {
  playlistId: string;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistId }) => {
  const router = useRouter();
  const [playlist, setPlaylist] = useState<YouTubePlaylist | null>(null);
  const [tracks, setTracks] = useState<YouTubeTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  useEffect(() => {
    const loadPlaylist = async () => {
      setIsLoading(true);
      setError('');
      try {
        // Get all playlists to find the current one
        const playlists = await apiService.getPlaylists();
        const currentPlaylist = playlists.find(p => p.id === playlistId);

        if (!currentPlaylist) {
          setError('Playlist not found');
          return;
        }

        setPlaylist(currentPlaylist);

        // Get tracks for this playlist
        const playlistTracks = await apiService.getPlaylistTracks(playlistId);
        setTracks(playlistTracks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading playlist');
      } finally {
        setIsLoading(false);
      }
    };

    loadPlaylist();
  }, [playlistId]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading playlist...</p>
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    const isAuthError = error?.includes('YouTube authentication expired');
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-red-700 mb-4">{error || 'Playlist not found'}</p>
          {isAuthError && (
            <p className="text-gray-600 mb-4">
              Your YouTube session has expired. Please reconnect to YouTube Music.
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => router.push('/')}
              className="text-red-600 hover:text-red-700 flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {isAuthError ? 'Back to home' : 'Go back'}
            </button>
            {isAuthError && (
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-bold text-gray-900">{playlist.title}</h1>
            {playlist.description && (
              <p className="text-sm text-gray-600 line-clamp-1">{playlist.description}</p>
            )}
          </div>
          <div className="text-sm text-gray-600">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="p-3 md:p-6 space-y-3">
          {tracks.length === 0 ? (
            <div className="text-center py-12">
              <Music className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">This playlist is empty</p>
            </div>
          ) : (
            tracks.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                className="border border-gray-200 rounded-lg p-3 md:p-4 hover:border-red-300 transition-colors bg-white"
              >
                {/* Desktop Layout */}
                <div className="hidden md:grid md:grid-cols-[60px_56px_1fr] md:gap-4 md:items-start">
                  {/* Thumbnail */}
                  <div className="relative flex-shrink-0 w-[60px] h-[60px]">
                    {track.thumbnail ? (
                      <Image
                        src={track.thumbnail}
                        alt={track.title}
                        fill
                        sizes="60px"
                        className="rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                        <Music className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Play button */}
                  <button
                    onClick={() => setCurrentlyPlaying(currentlyPlaying === track.videoId ? null : track.videoId)}
                    className="flex-shrink-0 w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                    title={currentlyPlaying === track.videoId ? 'Pause' : 'Play'}
                  >
                    {currentlyPlaying === track.videoId ? (
                      <Pause className="h-6 w-6 text-white" />
                    ) : (
                      <Play className="h-6 w-6 text-white ml-0.5" />
                    )}
                  </button>

                  {/* Content */}
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{track.title}</h4>
                    <p className="text-sm text-gray-600">{track.artist}</p>
                    {track.duration && (
                      <p className="text-xs text-gray-500 mt-1">{track.duration}</p>
                    )}
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden space-y-3">
                  {/* Row 1: Thumbnail + Title/Artist */}
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0 w-[60px] h-[60px]">
                      {track.thumbnail ? (
                        <Image
                          src={track.thumbnail}
                          alt={track.title}
                          fill
                          sizes="60px"
                          className="rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                          <Music className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 line-clamp-2">{track.title}</h4>
                      <p className="text-sm text-gray-600">{track.artist}</p>
                      {track.duration && (
                        <p className="text-xs text-gray-500 mt-1">{track.duration}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Play button */}
                  <button
                    onClick={() => setCurrentlyPlaying(currentlyPlaying === track.videoId ? null : track.videoId)}
                    className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors active:scale-95"
                    title={currentlyPlaying === track.videoId ? 'Pause' : 'Play'}
                  >
                    {currentlyPlaying === track.videoId ? (
                      <Pause className="h-7 w-7 text-white" />
                    ) : (
                      <Play className="h-7 w-7 text-white ml-0.5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Video Player - Responsive */}
      {currentlyPlaying && (
        <>
          {/* Mobile: Full-width sticky bottom bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">Now playing</span>
                <button
                  onClick={() => setCurrentlyPlaying(null)}
                  className="text-gray-400 hover:text-gray-700 min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>
              <div className="aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${currentlyPlaying}?autoplay=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded"
                />
              </div>
            </div>
          </div>

          {/* Desktop: Bottom-right floating box */}
          <div className="hidden md:block fixed bottom-4 right-4 w-80 bg-white border border-gray-200 shadow-lg rounded-lg z-50">
            <div className="p-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-600">Now playing</span>
                <button
                  onClick={() => setCurrentlyPlaying(null)}
                  className="text-gray-400 hover:text-gray-700 text-xs"
                >
                  ✕
                </button>
              </div>
              <div className="aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${currentlyPlaying}?autoplay=1`}
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="rounded"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
