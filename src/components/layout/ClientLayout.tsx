'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { useMusicStore } from '@/stores/useMusicStore'
import { useThemeStore } from '@/stores/useThemeStore'
import { PlayerBar } from './PlayerBar'
import { PlaylistSelectorModal } from '@/components/PlaylistSelectorModal'

interface ClientLayoutProps {
  children: React.ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const playerVideoId = useUIStore(state => state.playerVideoId)
  const selectedSongId = useUIStore(state => state.selectedSongId)
  const selectedPlaylistId = useUIStore(state => state.selectedPlaylistId)
  const playVideo = useUIStore(state => state.playVideo)
  const { activeModal, modalData, closeModal } = useUIStore()
  const { getSongsForPlaylist, getLikedSongs, getAllPlaylists, getSong, addSongToPlaylist } = useMusicStore()
  const hasPlayer = !!playerVideoId

  // Apply theme to document
  const theme = useThemeStore(state => state.theme)
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

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
    <div className="h-screen flex flex-col bg-white dark:bg-slate-900 transition-colors">
      <div className="flex-1 overflow-auto">
        {children}
      </div>
      {hasPlayer && <PlayerBar />}

      {/* Global Playlist Selector Modal */}
      {activeModal === 'playlist-selector' && modalData?.videoId && (
        <PlaylistSelectorModal
          videoId={modalData.videoId as string}
          playlists={getAllPlaylists().map(p => ({ id: p.id, title: p.title, thumbnail: p.thumbnail }))}
          foundInPlaylistIds={getSong(modalData.videoId as string)?.playlistIds || []}
          onSelect={(playlistId) => {
            addSongToPlaylist(modalData.videoId as string, playlistId)
            closeModal()
          }}
          onClose={closeModal}
        />
      )}
    </div>
  )
}
