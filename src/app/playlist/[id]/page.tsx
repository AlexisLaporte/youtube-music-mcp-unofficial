'use client'

import React, { useEffect } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { Header } from '@/components/Header'
import { LoginPrompt } from '@/components/LoginPrompt'
import { PlaylistEditor } from '@/components/PlaylistEditor'

export default function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const [playlistId, setPlaylistId] = React.useState<string>('')

  const {
    isConnected,
    user,
    isLoading,
    error,
    initialize,
    signIn,
    signOut
  } = useAuthStore()

  useEffect(() => {
    initialize()
    params.then(p => setPlaylistId(p.id))
  }, [initialize, params])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-space-cadet via-cool-gray to-antiflash-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-antiflash-white/30 border-t-red-pantone mx-auto mb-6"></div>
          <p className="text-antiflash-white text-lg font-medium">Checking authentication...</p>
          <div className="mt-4 text-red-pantone text-2xl animate-pulse">♪</div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return <LoginPrompt onConnect={signIn} error={error || undefined} />
  }

  if (!playlistId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        isConnected={isConnected}
        onConnect={signIn}
        onDisconnect={signOut}
        userName={user?.name}
        userEmail={user?.email}
        userAvatar={user?.profilePicture}
      />
      <PlaylistEditor playlistId={playlistId} />
    </div>
  )
}