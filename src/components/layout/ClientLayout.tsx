'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { useMusicStore } from '@/stores/useMusicStore'
// import { useAutoAnalysis } from '@/hooks/useAutoAnalysis'
import { PlayerBar } from './PlayerBar'

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const playerVideoId = useUIStore(state => state.playerVideoId)
  const selectedSongId = useUIStore(state => state.selectedSongId)
  const selectedPlaylistId = useUIStore(state => state.selectedPlaylistId)
  const playVideo = useUIStore(state => state.playVideo)
  const getSongsForPlaylist = useMusicStore(state => state.getSongsForPlaylist)
  const getLikedSongs = useMusicStore(state => state.getLikedSongs)
  const hasPlayer = !!playerVideoId

  // Auto-start audio analysis for pending tracks (disabled - manual only)
  // useAutoAnalysis()

  // Global space bar to start playback when no player is active
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle space when no player is active
      if (playerVideoId) return

      // Don't capture when typing in inputs
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()

        // Play selected song if any
        if (selectedSongId) {
          playVideo(selectedSongId)
          return
        }

        // Otherwise play first song from current playlist
        const songs = selectedPlaylistId === 'liked'
          ? getLikedSongs()
          : selectedPlaylistId
            ? getSongsForPlaylist(selectedPlaylistId)
            : []

        if (songs.length > 0) {
          playVideo(songs[0].videoId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [playerVideoId, selectedSongId, selectedPlaylistId, playVideo, getSongsForPlaylist, getLikedSongs])

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
      {hasPlayer && <PlayerBar />}
    </div>
  )
}
