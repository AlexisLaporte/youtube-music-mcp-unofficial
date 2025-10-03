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

  const handleOAuthCallback = React.useCallback(async (code: string) => {
    console.log('🔄 Processing OAuth callback with code:', code.slice(0, 10) + '...');
    setIsLoading(true);

    try {
      // Utiliser Supabase pour échanger le code contre une session
      const { data, error } = await apiService.supabaseClient.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('❌ Error exchanging code for session:', error);
        console.error('❌ Full error object:', JSON.stringify(error, null, 2));
        setAuthStatus({ isConnected: false, error: 'OAuth connection error' });
        setIsLoading(false);
        // Nettoyer l'URL
        window.history.replaceState({}, document.title, '/');
        return;
      }

      console.log('✅ OAuth exchange successful!');
      console.log('📦 Full session data:', {
        session: data.session,
        provider_token: data.session?.provider_token,
        provider_refresh_token: data.session?.provider_refresh_token,
        user: data.session?.user
      });

      // Store provider tokens in localStorage
      if (data.session?.provider_token) {
        console.log('💾 Storing provider tokens...');
        apiService.storeProviderTokens(
          data.session.provider_token,
          data.session.provider_refresh_token || undefined
        );
      } else {
        console.error('❌ No provider_token in session!');
      }

      // Nettoyer l'URL
      window.history.replaceState({}, document.title, '/');

      // Vérifier le statut d'auth maintenant
      await checkAuthStatus();

    } catch (error) {
      console.error('❌ Error in OAuth callback:', error);
      setAuthStatus({ isConnected: false, error: 'OAuth processing error' });
      setIsLoading(false);
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, '/');
    }
  }, []);

  useEffect(() => {
    console.log('🚀 App starting - useEffect triggered');

    // Check for provider tokens in cookies (set by middleware)
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
    };

    const providerToken = getCookie('provider_token');
    const providerRefreshToken = getCookie('provider_refresh_token');

    if (providerToken) {
      console.log('🍪 Found provider tokens in cookies, storing them...');
      apiService.storeProviderTokens(providerToken, providerRefreshToken);
      // Clear cookies after storing
      document.cookie = 'provider_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'provider_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    }

    // Vérifier s'il y a un code OAuth dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const authError = urlParams.get('error');

    if (authError) {
      console.error('❌ Auth callback error:', authError);
      setAuthStatus({ isConnected: false, error: 'Connection error. Please try again.' });
      setIsLoading(false);
      // Nettoyer l'URL
      window.history.replaceState({}, document.title, '/');
      return;
    }

    // Si on a un code OAuth, le traiter
    if (code) {
      console.log('🔄 OAuth code detected, processing...', { code: code.slice(0, 10) + '...' });
      handleOAuthCallback(code);
      return;
    }

    console.log('🔍 Starting initial auth check...');
    checkAuthStatus();

    // Écouter les changements d'auth
    const { data: { subscription } } = apiService.supabaseClient.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state changed:', {
          event,
          userEmail: session?.user?.email,
          hasSession: !!session,
          hasUser: !!session?.user,
          providerToken: !!session?.provider_token,
          sessionData: session
        });

        // Store provider tokens when they're available
        if (session?.provider_token) {
          console.log('💾 Storing provider tokens from auth state change...');
          apiService.storeProviderTokens(
            session.provider_token,
            session.provider_refresh_token || undefined
          );
        }

        if (event === 'SIGNED_IN' && session) {
          console.log('✅ User signed in, checking auth status...');
          await checkAuthStatus();
        } else if (event === 'SIGNED_OUT') {
          console.log('🚪 User signed out');
          apiService.clearProviderTokens();
          setAuthStatus({ isConnected: false });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          console.log('🔄 Token refreshed, updating auth status...');
          await checkAuthStatus();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleOAuthCallback]);

  const checkAuthStatus = async () => {
    console.log('🔍 checkAuthStatus called');
    setIsLoading(true);
    try {
      const status = await apiService.checkAuthStatus();
      console.log('📊 Auth status result:', {
        isConnected: status.isConnected,
        hasUser: !!status.user,
        userName: status.user?.name,
        userEmail: status.user?.email,
        error: status.error,
        fullStatus: status
      });
      setAuthStatus(status);
    } catch (error) {
      console.error('❌ Error checking auth status:', error);
      setAuthStatus({ isConnected: false, error: 'Failed to check authentication' });
    } finally {
      setIsLoading(false);
      console.log('✅ checkAuthStatus completed, isLoading set to false');
    }
  };

  const handleConnect = async () => {
    console.log('🔐 handleConnect called - initiating OAuth...');
    try {
      await apiService.signInWithGoogle();
      console.log('✅ OAuth initiation successful, redirecting to Google...');
    } catch (error) {
      console.error('❌ Error initiating OAuth:', error);
      alert('Authentication initialization error: ' + (error as Error).message);
    }
  };

  const handleDisconnect = async () => {
    console.log('🚪 handleDisconnect called');
    try {
      const success = await apiService.disconnect();
      console.log('📤 Disconnect result:', success);
      if (success) {
        setAuthStatus({ isConnected: false });
        console.log('✅ User disconnected successfully');
      } else {
        alert('Disconnect error');
      }
    } catch (error) {
      console.error('❌ Error disconnecting:', error);
      alert('Disconnect error: ' + (error as Error).message);
    }
  };

  console.log('🔄 Render decision:', {
    isLoading,
    isConnected: authStatus.isConnected,
    hasUser: !!authStatus.user,
    userName: authStatus.user?.name,
    error: authStatus.error
  });

  if (isLoading) {
    console.log('⏳ Rendering loading screen');
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-cadet via-cool-gray to-antiflash-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-antiflash-white/30 border-t-red-pantone mx-auto mb-6"></div>
          <p className="text-antiflash-white text-lg font-medium">Checking authentication...</p>
          <div className="mt-4 text-red-pantone text-2xl animate-pulse">♪</div>
        </div>
      </div>
    );
  }

  if (!authStatus.isConnected) {
    console.log('🔑 Rendering login screen');
    return <LoginPrompt onConnect={handleConnect} error={authStatus.error} />;
  }

  console.log('🎛️ Rendering dashboard for user:', authStatus.user?.name);
  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        isConnected={authStatus.isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        userName={authStatus.user?.name}
        userEmail={authStatus.user?.email}
        userAvatar={authStatus.user?.profilePicture}
      />
      <Dashboard userName={authStatus.user?.name || 'User'} />
    </div>
  );
}