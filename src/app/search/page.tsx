'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'
import { Header } from '@/components/Header'
import { LoginPrompt } from '@/components/LoginPrompt'
import { SearchView } from '@/components/SearchView'
import { MiniPlayer } from '@/components/MiniPlayer'
import { useUIStore } from '@/stores/useUIStore'

export default function SearchPage() {
  const { isConnected, isLoading: authLoading, user, signIn, signOut, initialize } = useAuthStore()
  const { fetchPlaylists, fetchLikedSongs } = usePlaylistsStore()
  const { playerVideoId, isPlayerVisible, closePlayer } = useUIStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Load playlists and liked songs for cross-reference
  useEffect(() => {
    if (isConnected) {
      fetchPlaylists()
      fetchLikedSongs()
    }
  }, [isConnected, fetchPlaylists, fetchLikedSongs])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" />
      </div>
    )
  }

  if (!isConnected) {
    return <LoginPrompt onConnect={signIn} />
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        isConnected={isConnected}
        onConnect={signIn}
        onDisconnect={signOut}
        userName={user?.name}
        userEmail={user?.email}
        userAvatar={user?.profilePicture}
      />
      <main className="flex-1 pt-16">
        <SearchView />
      </main>
      {isPlayerVisible && playerVideoId && (
        <MiniPlayer videoId={playerVideoId} onClose={closePlayer} />
      )}
    </div>
  )
}
