'use client'

import React, { useState } from 'react';
import { Search, BarChart3, Music, Heart, TrendingUp, Download, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { apiService } from '@/services/apiService';
import { PlaylistAnalysis } from '@/types/youtube';

export const LikedSongsAnalysis: React.FC = () => {
  const [analysis, setAnalysis] = useState<PlaylistAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const runAnalysis = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await apiService.analyzeLikedSongsInPlaylists();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l&apos;analyse');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCrossReferences = analysis?.crossReferences.filter((ref) =>
    ref.track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ref.track.artist.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4 flex items-center gap-3">
          <Heart className="h-8 w-8 text-red-500" />
          Analyse des morceaux likés
        </h2>
        <p className="text-gray-600 text-lg">
          Découvrez dans quelles playlists se trouvent vos morceaux favoris
        </p>
      </div>

      {/* Action Button */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Lancer l&apos;analyse
            </h3>
            <p className="text-gray-600">
              Cette analyse peut prendre quelques minutes selon le nombre de playlists
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={isLoading}
            className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-6 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Analyse en cours...
              </>
            ) : (
              <>
                <BarChart3 className="h-5 w-5" />
                Analyser les morceaux
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyse en cours...</p>
          <p className="text-sm text-gray-500 mt-2">
            Récupération des morceaux likés et analyse des playlists
          </p>
        </div>
      )}

      {/* Results */}
      {analysis && !isLoading && (
        <div className="space-y-8">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total morceaux likés</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analysis.statistics.totalLikedSongs}
                  </p>
                </div>
                <Heart className="h-8 w-8 text-red-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Trouvés dans playlists</p>
                  <p className="text-2xl font-bold text-green-600">
                    {analysis.statistics.songsFoundInPlaylists}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Non trouvés</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {analysis.statistics.songsNotFoundInPlaylists}
                  </p>
                </div>
                <Music className="h-8 w-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Taux de couverture</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {Math.round((analysis.statistics.songsFoundInPlaylists / analysis.statistics.totalLikedSongs) * 100)}%
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Most Common Playlists */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Playlists contenant le plus de morceaux likés
            </h3>
            <div className="space-y-3">
              {analysis.statistics.mostCommonPlaylists.slice(0, 5).map((item, index) => (
                <div key={item.playlist.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                    <div>
                      <p className="font-medium text-gray-900">{item.playlist.title}</p>
                      <p className="text-sm text-gray-600">
                        {item.songCount} morceau{item.songCount > 1 ? 's' : ''} liké{item.songCount > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-red-500 h-2 rounded-full"
                        style={{ 
                          width: `${(item.songCount / analysis.statistics.mostCommonPlaylists[0].songCount) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Search and Export */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Détail des morceaux ({filteredCrossReferences.length})
              </h3>
              <div className="flex gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Rechercher un morceau..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={exportToCSV}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exporter CSV
                </button>
              </div>
            </div>

            {/* Tracks List */}
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {filteredCrossReferences.map(({ track, foundInPlaylists }) => (
                <div key={track.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-4">
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
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{track.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{track.artist}</p>
                      
                      {foundInPlaylists.length > 0 ? (
                        <div>
                          <p className="text-sm text-green-600 font-medium mb-1">
                            Trouvé dans {foundInPlaylists.length} playlist{foundInPlaylists.length > 1 ? 's' : ''} :
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {foundInPlaylists.map(({ playlist, position }) => (
                              <span
                                key={playlist.id}
                                className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full"
                              >
                                {playlist.title} (#{position})
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-orange-600 font-medium">
                          Non trouvé dans les playlists
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};