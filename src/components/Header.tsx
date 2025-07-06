'use client'

import React from 'react';
import { Music, LogOut, User } from 'lucide-react';
import Image from 'next/image';

interface HeaderProps {
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  onConnect,
  onDisconnect,
  userName,
  userEmail,
  userAvatar
}) => {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 p-2 rounded-lg">
              <Music className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">YouTube Music Manager</h1>
              <p className="text-sm text-gray-600">Gérez vos playlists YouTube facilement</p>
            </div>
          </div>

          {isConnected ? (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                {userAvatar ? (
                  <Image
                    src={userAvatar}
                    alt={userName || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{userName}</p>
                  <p className="text-xs text-gray-600">{userEmail}</p>
                </div>
              </div>
              
              <button
                onClick={onDisconnect}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:block">Déconnexion</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onConnect}
              className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
            >
              Se connecter
            </button>
          )}
        </div>
      </div>
    </header>
  );
};