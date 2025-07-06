'use client'

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { LoginPrompt } from '@/components/LoginPrompt';
import { apiService } from '@/services/apiService';
import { AuthStatus } from '@/types/youtube';

export default function Home() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const status = await apiService.checkAuthStatus();
      setAuthStatus(status);
    } catch (error) {
      console.error('Error checking auth status:', error);
      setAuthStatus({ isConnected: false, error: 'Failed to check authentication' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      await apiService.signInWithGoogle();
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      alert('Erreur lors de l&apos;initialisation de l&apos;authentification: ' + (error as Error).message);
    }
  };

  const handleDisconnect = async () => {
    try {
      const success = await apiService.disconnect();
      if (success) {
        setAuthStatus({ isConnected: false });
      } else {
        alert('Erreur lors de la déconnexion');
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      alert('Erreur lors de la déconnexion: ' + (error as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600 mx-auto mb-6"></div>
          <p className="text-slate-600 text-lg font-medium">Vérification de l&apos;authentification...</p>
        </div>
      </div>
    );
  }

  if (!authStatus.isConnected) {
    return <LoginPrompt onConnect={handleConnect} error={authStatus.error} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header
        isConnected={authStatus.isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        userName={authStatus.user?.name}
        userEmail={authStatus.user?.email}
        userAvatar={authStatus.user?.profilePicture}
      />
      <Dashboard userName={authStatus.user?.name || 'Utilisateur'} />
    </div>
  );
}