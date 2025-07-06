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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {playlist.thumbnail ? (
        <Image
          src={playlist.thumbnail}
          alt={playlist.title}
          width={320}
          height={128}
          className="w-full h-32 object-cover"
        />
      ) : (
        <div className="w-full h-32 bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center">
          <Music className="h-12 w-12 text-red-500" />
        </div>
      )}
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 flex-1">
            {playlist.title}
          </h3>
          {onDelete && (
            <button
              onClick={() => onDelete(playlist.id)}
              disabled={isDeleting}
              className="ml-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-50"
              title="Supprimer la playlist"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
        
        {playlist.description && (
          <p className="text-gray-600 text-xs mb-3 line-clamp-2">
            {playlist.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Music className="h-3 w-3" />
            <span>{playlist.trackCount} titre{playlist.trackCount !== 1 ? 's' : ''}</span>
          </div>
          
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${getPrivacyColor(playlist.privacy)}`}>
            {getPrivacyIcon(playlist.privacy)}
            <span className="capitalize">{playlist.privacy}</span>
          </div>
        </div>
        
        {playlist.publishedAt && (
          <div className="flex items-center space-x-1 text-xs text-gray-500 mt-2">
            <Calendar className="h-3 w-3" />
            <span>Créée le {formatDate(playlist.publishedAt)}</span>
          </div>
        )}
      </div>
    </div>
  );
};