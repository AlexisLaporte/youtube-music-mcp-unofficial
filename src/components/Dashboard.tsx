'use client'

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Search, Filter } from 'lucide-react';
import { PlaylistCard } from './PlaylistCard';
import { apiService } from '@/services/apiService';
import { YouTubePlaylist } from '@/types/youtube';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardProps {
  userName: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ userName }) => {
  const [playlists, setPlaylists] = useState<YouTubePlaylist[]>([]);
  const [filteredPlaylists, setFilteredPlaylists] = useState<YouTubePlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string>('');
  
  const [newPlaylist, setNewPlaylist] = useState({
    title: '',
    description: '',
    privacy: 'private' as 'public' | 'private' | 'unlisted'
  });

  const filterPlaylists = useCallback(() => {
    let filtered = playlists;

    if (searchTerm) {
      filtered = filtered.filter(playlist =>
        playlist.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        playlist.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (privacyFilter !== 'all') {
      filtered = filtered.filter(playlist => playlist.privacy === privacyFilter);
    }

    setFilteredPlaylists(filtered);
  }, [playlists, searchTerm, privacyFilter]);

  useEffect(() => {
    loadPlaylists();
  }, []);

  useEffect(() => {
    filterPlaylists();
  }, [filterPlaylists]);

  const loadPlaylists = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await apiService.getPlaylists();
      setPlaylists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des playlists');
    } finally {
      setIsLoading(false);
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylist.title.trim()) return;
    
    setIsCreating(true);
    try {
      await apiService.createPlaylist(
        newPlaylist.title,
        newPlaylist.description,
        newPlaylist.privacy
      );
      
      setNewPlaylist({ title: '', description: '', privacy: 'private' });
      await loadPlaylists(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création de la playlist');
    } finally {
      setIsCreating(false);
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette playlist ?')) return;
    
    setDeletingId(playlistId);
    try {
      const success = await apiService.deletePlaylist(playlistId);
      if (success) {
        setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      } else {
        setError('Erreur lors de la suppression de la playlist');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeletingId('');
    }
  };

  if (isLoading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement de vos playlists...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Bonjour {userName} ! 👋
        </h2>
        <p className="text-gray-600">
          Gérez vos playlists YouTube Music facilement
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Create Playlist Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Créer une nouvelle playlist</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="Nom de la playlist"
            value={newPlaylist.title}
            onChange={(e) => setNewPlaylist(prev => ({ ...prev, title: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
          
          <select
            value={newPlaylist.privacy}
            onChange={(e) => setNewPlaylist(prev => ({ ...prev, privacy: e.target.value as 'public' | 'private' | 'unlisted' }))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            <option value="private">Privée</option>
            <option value="unlisted">Non répertoriée</option>
            <option value="public">Publique</option>
          </select>
        </div>
        
        <textarea
          placeholder="Description (optionnelle)"
          value={newPlaylist.description}
          onChange={(e) => setNewPlaylist(prev => ({ ...prev, description: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
          rows={3}
        />
        
        <button
          onClick={createPlaylist}
          disabled={!newPlaylist.title.trim() || isCreating}
          className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-4 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>{isCreating ? 'Création...' : 'Créer la playlist'}</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher dans vos playlists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={privacyFilter}
              onChange={(e) => setPrivacyFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">Toutes</option>
              <option value="private">Privées</option>
              <option value="unlisted">Non répertoriées</option>
              <option value="public">Publiques</option>
            </select>
          </div>
          
          <button
            onClick={loadPlaylists}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Playlists Grid */}
      {filteredPlaylists.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <Plus className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || privacyFilter !== 'all' ? 'Aucune playlist trouvée' : 'Aucune playlist'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || privacyFilter !== 'all' 
              ? 'Essayez de modifier vos critères de recherche'
              : 'Créez votre première playlist pour commencer'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlaylists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onDelete={deletePlaylist}
              isDeleting={deletingId === playlist.id}
            />
          ))}
        </div>
      )}
    </main>
  );
};