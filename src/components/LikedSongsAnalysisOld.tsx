'use client'

import React, { useState } from 'react';
import { Search, BarChart3, Music, Heart, TrendingUp, Download, RefreshCw, Play, Pause, Plus } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/apiService';
import { PlaylistAnalysis, YouTubePlaylist } from '@/types/youtube';

export const LikedSongsAnalysis: React.FC = () => {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<PlaylistAnalysis | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [allPlaylists, setAllPlaylists] = useState<YouTubePlaylist[]>([]);
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false);

  // Load analysis from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('liked_songs_analysis');
    const savedPlaylists = localStorage.getItem('all_playlists');
    if (saved) {
      try {
        setAnalysis(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved analysis');
      }
    }
    if (savedPlaylists) {
      try {
        setAllPlaylists(JSON.parse(savedPlaylists));
      } catch (e) {
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
      // Save to localStorage
      localStorage.setItem('liked_songs_analysis', JSON.stringify(result));
      localStorage.setItem('all_playlists', JSON.stringify(playlists));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement');
    } finally {
      setIsFetching(false);
    }
  };

  // Recalculate suggestions without fetching
  const recalculateAnalysis = async () => {
    if (!analysis) return;

    setIsCalculating(true);
    try {
      // Re-run analysis on existing data
      const result = await apiService.analyzeLikedSongsInPlaylists();
      setAnalysis(result);
      localStorage.setItem('liked_songs_analysis', JSON.stringify(result));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du calcul');
    } finally {
      setIsCalculating(false);
    }
  };

  const addToPlaylist = async (videoId: string, playlistId: string) => {
    try {
      await apiService.addVideoToPlaylist(playlistId, videoId);
      setAddingToPlaylist(null);
      // Re-fetch data to update
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l&apos;ajout');
    }
  };

  // Memoize filtered references to avoid recalculating on every render
  const filteredCrossReferences = React.useMemo(() => {
    if (!analysis) return [];
    return analysis.crossReferences.filter((ref) => {
      // Search filter
      const matchesSearch = ref.track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ref.track.artist.toLowerCase().includes(searchTerm.toLowerCase());

      // Unassigned filter
      const matchesUnassigned = !showOnlyUnassigned || ref.foundInPlaylists.length === 0;

      return matchesSearch && matchesUnassigned;
    });
  }, [analysis, searchTerm, showOnlyUnassigned]);

  // Pre-calculate foundInPlaylists map for performance
  const foundInPlaylistsMap = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!analysis) return map;

    analysis.crossReferences.forEach(({ track, foundInPlaylists }) => {
      const playlistIds = new Set(foundInPlaylists.map(fp => fp.playlist.id));
      map.set(track.videoId, playlistIds);
    });
    return map;
  }, [analysis]);

  const exportToCSV = () => {
    if (!analysis) return;

    const headers = ['Titre', 'Artiste', 'Playlists trouvées', 'Positions'];
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
    <div className="h-screen flex flex-col">
      {/* Header - Responsive */}
      <div className="flex-shrink-0 px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 bg-white">
        {/* Mobile: 2 rows, Desktop: 1 row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          {/* Title */}
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 md:h-6 md:w-6 text-red-500" />
            <h2 className="text-lg md:text-xl font-bold text-gray-900">
              Morceaux likés ({analysis?.statistics.totalLikedSongs || 0})
            </h2>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {analysis && (
              <>
                <div className="relative flex-1 md:flex-initial">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-auto pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={() => setShowOnlyUnassigned(!showOnlyUnassigned)}
                  className={`text-sm flex items-center gap-2 px-3 py-2 rounded-lg transition-colors min-h-[44px] md:min-h-0 ${
                    showOnlyUnassigned
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title="Afficher uniquement les morceaux non associés"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden lg:inline">Sans playlist</span>
                </button>
                <button
                  onClick={exportToCSV}
                  className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0"
                  title="Exporter CSV"
                >
                  <Download className="h-4 w-4 mx-auto" />
                </button>
              </>
            )}
            <button
              onClick={fetchData}
              disabled={isFetching}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 min-h-[44px] md:min-h-0"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isFetching ? 'Chargement...' : 'Recharger'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {/* First load prompt */}
        {!analysis && !isFetching && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Heart className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Analyser vos morceaux likés
              </h3>
              <p className="text-gray-600 mb-6">
                Cette analyse peut prendre quelques minutes
              </p>
              <button
                onClick={fetchData}
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto"
              >
                <BarChart3 className="h-5 w-5" />
                Charger les morceaux
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6">
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
              <p className="text-gray-600">Chargement depuis YouTube...</p>
            </div>
          </div>
        )}

        {/* Tracks List */}
        {analysis && !isFetching && (
          <div className="p-3 md:p-6 space-y-3">
              {filteredCrossReferences.map(({ track, foundInPlaylists, suggestedPlaylists }) => (
                <div
                  key={track.id}
                  className="border border-gray-200 rounded-lg p-3 md:p-4 hover:border-red-300 transition-colors bg-white"
                >
                  {/* Desktop Layout: Single row with all elements */}
                  <div className="hidden md:grid md:grid-cols-[60px_56px_1fr_auto] md:gap-4 md:items-start">
                    {/* Thumbnail */}
                    <div className="relative group flex-shrink-0">
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

                    {/* Play button */}
                    <button
                      onClick={() => setCurrentlyPlaying(currentlyPlaying === track.videoId ? null : track.videoId)}
                      className="flex-shrink-0 w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                      title={currentlyPlaying === track.videoId ? 'Pause' : 'Lecture'}
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
                      <p className="text-sm text-gray-600 mb-2">{track.artist}</p>

                      {foundInPlaylists.length > 0 ? (
                        <div>
                          <p className="text-sm text-green-600 font-medium mb-1">
                            Trouvé dans {foundInPlaylists.length} playlist{foundInPlaylists.length > 1 ? 's' : ''} :
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {foundInPlaylists.map(({ playlist, position }, idx) => (
                              <button
                                key={`${playlist.id}-${position}-${idx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/playlist/${playlist.id}`);
                                }}
                                className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full hover:bg-green-200 transition-colors"
                              >
                                {playlist.title} (#{position})
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm text-orange-600 font-medium mb-2">
                            Non trouvé dans les playlists
                          </p>
                          {suggestedPlaylists && suggestedPlaylists.length > 0 && (
                            <div>
                              <p className="text-xs text-blue-600 font-medium mb-1">
                                Suggestions:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {suggestedPlaylists.map((suggestion, idx) => (
                                  <button
                                    key={`${suggestion.playlist.id}-${idx}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToPlaylist(track.videoId, suggestion.playlist.id);
                                    }}
                                    className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded border border-blue-200 hover:bg-blue-100 transition-colors"
                                    title={suggestion.reasons.join(', ')}
                                  >
                                    + {suggestion.playlist.title} ({suggestion.score}pts)
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Plus button */}
                    <div className="relative">
                      {addingToPlaylist === track.videoId ? (
                        <>
                          {/* Mobile: Full-screen overlay with bottom sheet */}
                          <div
                            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50"
                            onClick={() => {
                              setAddingToPlaylist(null);
                              setPlaylistSearch('');
                            }}
                          >
                            <div
                              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 max-h-[80vh] flex flex-col"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <span className="text-base font-medium">Ajouter à une playlist</span>
                                <button
                                  onClick={() => {
                                    setAddingToPlaylist(null);
                                    setPlaylistSearch('');
                                  }}
                                  className="text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                                >
                                  <span className="text-2xl">✕</span>
                                </button>
                              </div>

                              {/* Search input */}
                              <div className="relative mb-3">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Rechercher une playlist..."
                                  value={playlistSearch}
                                  onChange={(e) => setPlaylistSearch(e.target.value)}
                                  autoFocus
                                  className="w-full pl-10 pr-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                              </div>

                              <div className="flex-1 overflow-y-auto space-y-2">
                                {/* Debug info */}
                                {allPlaylists.length === 0 && (
                                  <div className="text-sm text-gray-500 px-3 py-2">
                                    Aucune playlist chargée. Cliquez sur &quot;Recharger&quot; en haut.
                                  </div>
                                )}

                                {/* Show suggested playlists first */}
                                {suggestedPlaylists && suggestedPlaylists.length > 0 && (
                                  <>
                                    <div className="text-sm text-blue-600 font-medium px-3 py-2">Suggestions:</div>
                                    {suggestedPlaylists
                                      .filter(s =>
                                        !foundInPlaylists.find(fp => fp.playlist.id === s.playlist.id) &&
                                        s.playlist.title.toLowerCase().includes(playlistSearch.toLowerCase())
                                      )
                                      .map(suggestion => (
                                        <button
                                          key={suggestion.playlist.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            addToPlaylist(track.videoId, suggestion.playlist.id);
                                            setPlaylistSearch('');
                                          }}
                                          className="w-full text-left px-3 py-3 text-base hover:bg-blue-50 rounded-lg bg-blue-50/50 min-h-[48px]"
                                          title={suggestion.reasons.join(', ')}
                                        >
                                          ⭐ {suggestion.playlist.title}
                                        </button>
                                      ))}
                                    {suggestedPlaylists.filter(s =>
                                      !foundInPlaylists.find(fp => fp.playlist.id === s.playlist.id) &&
                                      s.playlist.title.toLowerCase().includes(playlistSearch.toLowerCase())
                                    ).length > 0 && <div className="border-t border-gray-200 my-2"></div>}
                                  </>
                                )}

                                {/* All playlists */}
                                {allPlaylists
                                  .filter(p =>
                                    p.title.toLowerCase().includes(playlistSearch.toLowerCase())
                                  )
                                  .map(playlist => {
                                    const isAlreadyIn = foundInPlaylists.find(fp => fp.playlist.id === playlist.id);
                                    return (
                                      <button
                                        key={playlist.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isAlreadyIn) {
                                            addToPlaylist(track.videoId, playlist.id);
                                            setPlaylistSearch('');
                                          }
                                        }}
                                        disabled={!!isAlreadyIn}
                                        className={`w-full text-left px-3 py-3 text-base rounded-lg min-h-[48px] ${
                                          isAlreadyIn
                                            ? 'text-gray-400 cursor-not-allowed'
                                            : 'hover:bg-gray-100 active:bg-gray-200'
                                        }`}
                                      >
                                        {playlist.title} {isAlreadyIn && '✓'}
                                      </button>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>

                          {/* Desktop: Dropdown menu */}
                          <div className="hidden md:block absolute right-0 top-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-72 z-10">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium">Ajouter à</span>
                              <button
                                onClick={() => {
                                  setAddingToPlaylist(null);
                                  setPlaylistSearch('');
                                }}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Search input */}
                            <div className="relative mb-2">
                              <Search className="absolute left-2 top-2 h-3 w-3 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Rechercher une playlist..."
                                value={playlistSearch}
                                onChange={(e) => setPlaylistSearch(e.target.value)}
                                autoFocus
                                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-red-500 focus:border-transparent"
                              />
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {/* Debug info */}
                              {allPlaylists.length === 0 && (
                                <div className="text-xs text-gray-500 px-2 py-1">
                                  Aucune playlist chargée. Cliquez sur &quot;Recharger&quot; en haut.
                                </div>
                              )}

                              {/* Show suggested playlists first */}
                              {suggestedPlaylists && suggestedPlaylists.length > 0 && (
                                <>
                                  <div className="text-xs text-blue-600 font-medium px-2 py-1">Suggestions:</div>
                                  {suggestedPlaylists
                                    .filter(s =>
                                      !foundInPlaylists.find(fp => fp.playlist.id === s.playlist.id) &&
                                      s.playlist.title.toLowerCase().includes(playlistSearch.toLowerCase())
                                    )
                                    .map(suggestion => (
                                      <button
                                        key={suggestion.playlist.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          addToPlaylist(track.videoId, suggestion.playlist.id);
                                          setPlaylistSearch('');
                                        }}
                                        className="w-full text-left px-2 py-1 text-sm hover:bg-blue-50 rounded bg-blue-50/50"
                                        title={suggestion.reasons.join(', ')}
                                      >
                                        ⭐ {suggestion.playlist.title}
                                      </button>
                                    ))}
                                  {suggestedPlaylists.filter(s =>
                                    !foundInPlaylists.find(fp => fp.playlist.id === s.playlist.id) &&
                                    s.playlist.title.toLowerCase().includes(playlistSearch.toLowerCase())
                                  ).length > 0 && <div className="border-t border-gray-200 my-1"></div>}
                                </>
                              )}

                              {/* All playlists */}
                              {allPlaylists
                                .filter(p =>
                                  p.title.toLowerCase().includes(playlistSearch.toLowerCase())
                                )
                                .map(playlist => {
                                  const isAlreadyIn = foundInPlaylists.find(fp => fp.playlist.id === playlist.id);
                                  return (
                                    <button
                                      key={playlist.id}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isAlreadyIn) {
                                          addToPlaylist(track.videoId, playlist.id);
                                          setPlaylistSearch('');
                                        }
                                      }}
                                      disabled={!!isAlreadyIn}
                                      className={`w-full text-left px-2 py-1 text-sm rounded ${
                                        isAlreadyIn
                                          ? 'text-gray-400 cursor-not-allowed'
                                          : 'hover:bg-gray-100'
                                      }`}
                                    >
                                      {playlist.title} {isAlreadyIn && '✓'}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddingToPlaylist(track.videoId);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Ajouter à une playlist"
                        >
                          <Plus className="h-5 w-5 text-gray-600" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile Layout: 2 rows */}
                  <div className="md:hidden space-y-3">
                    {/* Row 1: Thumbnail + Title/Artist + Plus button */}
                    <div className="flex items-start gap-3">
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

                      {/* Title/Artist */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 line-clamp-2">{track.title}</h4>
                        <p className="text-sm text-gray-600">{track.artist}</p>
                      </div>

                      {/* Plus button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingToPlaylist(track.videoId);
                        }}
                        className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                        title="Ajouter à une playlist"
                      >
                        <Plus className="h-6 w-6 text-gray-600" />
                      </button>
                    </div>

                    {/* Row 2: Play button + Playlists/Suggestions */}
                    <div className="flex items-start gap-3">
                      {/* Play button */}
                      <button
                        onClick={() => setCurrentlyPlaying(currentlyPlaying === track.videoId ? null : track.videoId)}
                        className="flex-shrink-0 w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors active:scale-95"
                        title={currentlyPlaying === track.videoId ? 'Pause' : 'Lecture'}
                      >
                        {currentlyPlaying === track.videoId ? (
                          <Pause className="h-7 w-7 text-white" />
                        ) : (
                          <Play className="h-7 w-7 text-white ml-0.5" />
                        )}
                      </button>

                      {/* Playlists/Suggestions */}
                      <div className="flex-1 min-w-0">
                        {foundInPlaylists.length > 0 ? (
                          <div>
                            <p className="text-sm text-green-600 font-medium mb-2">
                              Trouvé dans {foundInPlaylists.length} playlist{foundInPlaylists.length > 1 ? 's' : ''} :
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {foundInPlaylists.map(({ playlist, position }, idx) => (
                                <button
                                  key={`${playlist.id}-${position}-${idx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/playlist/${playlist.id}`);
                                  }}
                                  className="text-xs bg-green-100 text-green-800 px-3 py-1.5 rounded-full hover:bg-green-200 transition-colors active:bg-green-300 min-h-[36px]"
                                >
                                  {playlist.title} (#{position})
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-orange-600 font-medium mb-2">
                              Non trouvé dans les playlists
                            </p>
                            {suggestedPlaylists && suggestedPlaylists.length > 0 && (
                              <div>
                                <p className="text-xs text-blue-600 font-medium mb-2">
                                  Suggestions:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {suggestedPlaylists.map((suggestion, idx) => (
                                    <button
                                      key={`${suggestion.playlist.id}-${idx}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        addToPlaylist(track.videoId, suggestion.playlist.id);
                                      }}
                                      className="text-xs bg-blue-50 text-blue-800 px-3 py-2 rounded border border-blue-200 hover:bg-blue-100 transition-colors min-h-[36px]"
                                      title={suggestion.reasons.join(', ')}
                                    >
                                      + {suggestion.playlist.title} ({suggestion.score}pts)
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}

      {/* Video Player - Responsive */}
      {currentlyPlaying && (
        <>
          {/* Mobile: Full-width sticky bottom bar */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">En lecture</span>
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
                <span className="text-xs text-gray-600">En lecture</span>
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
    </div>
  );
};