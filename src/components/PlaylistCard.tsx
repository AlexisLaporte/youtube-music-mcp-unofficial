'use client'

import React from 'react';
import { Music, Calendar, Eye, EyeOff, Globe, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { YouTubePlaylist } from '@/types/youtube';

interface PlaylistCardProps {
  playlist: YouTubePlaylist;
  onDelete?: (playlistId: string) => void;
  isDeleting?: boolean;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({ 
  playlist, 
  onDelete,
  isDeleting = false 
}) => {
  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case 'public':
        return <Globe className="h-4 w-4 text-green-600" />;
      case 'unlisted':
        return <EyeOff className="h-4 w-4 text-yellow-600" />;
      default:
        return <Eye className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPrivacyColor = (privacy: string) => {
    switch (privacy) {
      case 'public':
        return 'bg-green-100 text-green-800';
      case 'unlisted':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="card-interactive music-glow overflow-hidden group">
      {playlist.thumbnail ? (
        <div className="relative overflow-hidden">
          <Image
            src={playlist.thumbnail}
            alt={playlist.title}
            width={320}
            height={160}
            className="w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        </div>
      ) : (
        <div className="w-full h-40 bg-gradient-to-br from-red-100 via-orange-100 to-purple-100 flex items-center justify-center relative overflow-hidden">
          <Music className="h-16 w-16 text-red-500 float-note" />
          <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent"></div>
        </div>
      )}
      
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-bold text-gray-900 text-lg line-clamp-2 flex-1 group-hover:text-red-600 transition-colors">
            {playlist.title}
          </h3>
          {onDelete && (
            <button
              onClick={() => onDelete(playlist.id)}
              disabled={isDeleting}
              className="ml-3 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all duration-200 disabled:opacity-50 hover:scale-110"
              title="Supprimer la playlist"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {playlist.description && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
            {playlist.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2 bg-gradient-to-r from-red-50 to-orange-50 px-3 py-2 rounded-xl">
            <Music className="h-4 w-4 text-red-500" />
            <span className="font-medium text-gray-700">
              {playlist.trackCount} titre{playlist.trackCount !== 1 ? 's' : ''}
            </span>
          </div>
          
          <div className={`flex items-center space-x-2 px-3 py-2 rounded-xl font-medium ${getPrivacyColor(playlist.privacy)}`}>
            {getPrivacyIcon(playlist.privacy)}
            <span className="capitalize">{playlist.privacy}</span>
          </div>
        </div>
        
        {playlist.publishedAt && (
          <div className="flex items-center space-x-2 text-sm text-gray-500 mt-4 pt-4 border-t border-gray-100">
            <Calendar className="h-4 w-4 text-red-400" />
            <span>Créée le {formatDate(playlist.publishedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
};