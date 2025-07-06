'use client'

import React from 'react';
import { Music, Youtube, Shield, Zap, AlertCircle } from 'lucide-react';

interface LoginPromptProps {
  onConnect: () => void;
  error?: string;
}

export const LoginPrompt: React.FC<LoginPromptProps> = ({ onConnect, error }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Music className="h-8 w-8 text-white" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            YouTube Music Manager
          </h1>
          <p className="text-gray-600 mb-8">
            Connectez-vous à YouTube pour gérer vos playlists facilement
          </p>

          {error && error !== 'YouTube connection required' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {error === 'YouTube connection required' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-blue-500 mr-2" />
                <p className="text-sm text-blue-700">
                  Connexion à YouTube requise pour accéder à vos playlists
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4 mb-8">
            <div className="flex items-center space-x-3 text-left">
              <div className="bg-red-100 p-2 rounded-lg">
                <Youtube className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Synchronisation complète</p>
                <p className="text-sm text-gray-600">Accès à toutes vos playlists</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 text-left">
              <div className="bg-green-100 p-2 rounded-lg">
                <Shield className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Sécurisé</p>
                <p className="text-sm text-gray-600">Authentification Supabase + Google</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 text-left">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Zap className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Gestion avancée</p>
                <p className="text-sm text-gray-600">Créez, modifiez et organisez</p>
              </div>
            </div>
          </div>

          <button
            onClick={onConnect}
            className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Se connecter avec Google
          </button>
          
          <p className="text-xs text-gray-500 mt-4">
            En vous connectant, vous acceptez nos conditions d&apos;utilisation
          </p>
        </div>
      </div>
    </div>
  );
};