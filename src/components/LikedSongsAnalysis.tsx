'use client'

import React, { useState } from 'react';
import { Search, Heart, Download, RefreshCw } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { PlaylistAnalysis, YouTubePlaylist } from '@/types/youtube';
import { TrackCard } from './TrackCard';
import { MiniPlayer } from './MiniPlayer';

type FilterTab = 'all' | 'unassigned';

export const LikedSongsAnalysis: React.FC = () => {
  const [analysis, setAnalysis] = useState<PlaylistAnalysis | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [allPlaylists, setAllPlaylists] = useState<YouTubePlaylist[]>([]);
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [isAddingTrack, setIsAddingTrack] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showSearch, setShowSearch] = useState(false);

  // Load analysis from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('liked_songs_analysis');
    const savedPlaylists = localStorage.getItem('all_playlists');
    if (saved) {
      try {
        setAnalysis(JSON.parse(saved));
      } catch {
        console.error('Failed to parse saved analysis');
      }
    }
    if (savedPlaylists) {
      try {
        setAllPlaylists(JSON.parse(savedPlaylists));
      } catch {
        console.error('Failed to parse saved playlists');
      }
    }
  }, []);

  // Fetch fresh data from YouTube
  const fetchData = async () => {
    setIsFetching(true);
    setError('');
    try {
      const [result, playlists] = await Promise.all([
        apiService.analyzeLikedSongsInPlaylists(),
        apiService.getPlaylists()
      ]);
      setAnalysis(result);
      setAllPlaylists(playlists);
      localStorage.setItem('liked_songs_analysis', JSON.stringify(result));
      localStorage.setItem('all_playlists', JSON.stringify(playlists));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setIsFetching(false);
    }
  };

  const addToPlaylist = async (videoId: string, playlistId: string) => {
    try {
      setIsAddingTrack(`${videoId}-${playlistId}`);
      console.log(`Adding video ${videoId} to playlist ${playlistId}`);

      const success = await apiService.addVideoToPlaylist(playlistId, videoId);
      console.log(`Add result: ${success}`);

      if (success) {
        setAddingToPlaylist(null);

        // Update local state immediately instead of refetching everything
        if (analysis) {
          const playlist = allPlaylists.find(p => p.id === playlistId);
          if (playlist) {
            const updatedAnalysis = {
              ...analysis,
              crossReferences: analysis.crossReferences.map(ref => {
                if (ref.track.videoId === videoId) {
                  // Add this playlist to foundInPlaylists
                  const newFoundIn = [...ref.foundInPlaylists, {
                    playlist: playlist,
                    position: playlist.trackCount + 1 // Approximate position
                  }];

                  // Remove from suggestions since it's now added
                  const newSuggestions = ref.suggestedPlaylists?.filter(
                    s => s.playlist.id !== playlistId
                  );

                  return {
                    ...ref,
                    foundInPlaylists: newFoundIn,
                    suggestedPlaylists: newSuggestions
                  };
                }
                return ref;
              })
            };

            setAnalysis(updatedAnalysis);
            // Update localStorage with new state
            localStorage.setItem('liked_songs_analysis', JSON.stringify(updatedAnalysis));

            // Update playlist track count
            const updatedPlaylists = allPlaylists.map(p =>
              p.id === playlistId
                ? { ...p, trackCount: p.trackCount + 1 }
                : p
            );
            setAllPlaylists(updatedPlaylists);
            localStorage.setItem('all_playlists', JSON.stringify(updatedPlaylists));
          }
        }
      } else {
        console.error('Failed to add video to playlist');
        setError('Failed to add video to playlist');
      }
    } catch (err) {
      console.error('Error in addToPlaylist:', err);
      setError(err instanceof Error ? err.message : 'Error adding to playlist');
    } finally {
      setIsAddingTrack(null);
    }
  };

  // Filtered and sorted tracks
  const filteredTracks = React.useMemo(() => {
    if (!analysis) return [];

    return analysis.crossReferences.filter((ref) => {
      // Tab filter
      const matchesTab = activeTab === 'all' || (activeTab === 'unassigned' && ref.foundInPlaylists.length === 0);

      // Search filter
      const matchesSearch = !searchTerm ||
        ref.track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ref.track.artist.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [analysis, activeTab, searchTerm]);

  const exportToCSV = () => {
    if (!analysis) return;
    const headers = ['Title', 'Artist', 'Playlists', 'Positions'];
    const rows = analysis.crossReferences.map(({ track, foundInPlaylists }) => [
      track.title,
      track.artist,
      foundInPlaylists.map(fp => fp.playlist.title).join('; '),
      foundInPlaylists.map(fp => fp.position).join('; ')
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'liked-songs-analysis.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200">
        <div className="px-4 md:px-6 py-4">
          {/* Title Row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              <h1 className="text-xl font-bold text-gray-900">
                Liked Songs
                {analysis && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({analysis.statistics.totalLikedSongs})
                  </span>
                )}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title="Search"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                onClick={fetchData}
                disabled={isFetching}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
              {analysis && (
                <button
                  onClick={exportToCSV}
                  className="hidden md:block p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  title="Export CSV"
                >
                  <Download className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Tabs and Search Row */}
          {analysis && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab('unassigned')}
                  className={`flex-1 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'unassigned'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Not in Playlists
                  <span className="ml-1.5 text-xs text-gray-500">
                    ({analysis.statistics.songsNotFoundInPlaylists})
                  </span>
                </button>
              </div>

              {/* Search Bar */}
              <div className={`relative ${showSearch || 'hidden md:block'}`}>
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tracks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent w-full md:w-64"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* First load prompt */}
        {!analysis && !isFetching && (
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
                onClick={fetchData}
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
        {isFetching && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading from YouTube...</p>
            </div>
          </div>
        )}

        {/* Track List */}
        {analysis && !isFetching && (
          <div className="px-4 md:px-6 py-4 space-y-2">
            {filteredTracks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">
                  {searchTerm ? 'No tracks match your search' : 'No tracks to display'}
                </p>
              </div>
            ) : (
              filteredTracks.map(({ track, suggestedPlaylists }) => (
                <TrackCard
                  key={track.id}
                  track={track}
                  suggestedPlaylists={suggestedPlaylists}
                  isPlaying={currentlyPlaying === track.videoId}
                  isAdding={isAddingTrack?.startsWith(track.videoId)}
                  onPlayToggle={() => setCurrentlyPlaying(currentlyPlaying === track.videoId ? null : track.videoId)}
                  onAddToPlaylist={(playlistId?: string) => {
                    if (playlistId) {
                      addToPlaylist(track.videoId, playlistId);
                    } else {
                      setAddingToPlaylist(track.videoId);
                    }
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Playlist Dropdown Modal */}
      {addingToPlaylist && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-end md:items-center md:justify-center"
          onClick={() => {
            setAddingToPlaylist(null);
            setPlaylistSearch('');
          }}
        >
          <div
            className="bg-white rounded-t-2xl md:rounded-2xl p-6 w-full md:w-96 md:max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add to Playlist</h3>
              <button
                onClick={() => {
                  setAddingToPlaylist(null);
                  setPlaylistSearch('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search playlists..."
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1">
              {allPlaylists.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No playlists loaded. Click Refresh.
                </p>
              ) : (
                allPlaylists
                  .filter(p => p.title.toLowerCase().includes(playlistSearch.toLowerCase()))
                  .map(playlist => {
                    const currentTrack = analysis?.crossReferences.find(
                      ref => ref.track.videoId === addingToPlaylist
                    );
                    const isAlreadyIn = currentTrack?.foundInPlaylists.find(
                      fp => fp.playlist.id === playlist.id
                    );

                    return (
                      <button
                        key={playlist.id}
                        onClick={() => {
                          if (!isAlreadyIn) {
                            addToPlaylist(addingToPlaylist, playlist.id);
                            setPlaylistSearch('');
                          }
                        }}
                        disabled={!!isAlreadyIn}
                        className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors ${
                          isAlreadyIn
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'hover:bg-gray-100 active:bg-gray-200'
                        }`}
                      >
                        {playlist.title} {isAlreadyIn && '✓'}
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mini Player */}
      {currentlyPlaying && (
        <MiniPlayer
          videoId={currentlyPlaying}
          onClose={() => setCurrentlyPlaying(null)}
        />
      )}
    </div>
  );
};
