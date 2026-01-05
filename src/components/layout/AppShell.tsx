'use client'

import { useEffect, useRef } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { AppLayout } from './AppLayout'

interface AppShellProps {
  playlistId?: string | 'liked'
  songId?: string
}

export function AppShell({ playlistId = 'liked', songId }: AppShellProps) {
  const { selectPlaylist, selectSong } = useUIStore()
  const initializedRef = useRef(false)

  // Sync URL params to store on mount and when they change
  useEffect(() => {
    // Only sync if we have valid params or on initial mount
    if (!initializedRef.current || playlistId) {
      selectPlaylist(playlistId)
      initializedRef.current = true
    }
  }, [playlistId, selectPlaylist])

  useEffect(() => {
    if (songId) {
      selectSong(songId)
    } else if (initializedRef.current) {
      // Clear song selection when navigating away from song detail
      selectSong(null)
    }
  }, [songId, selectSong])

  return <AppLayout />
}
