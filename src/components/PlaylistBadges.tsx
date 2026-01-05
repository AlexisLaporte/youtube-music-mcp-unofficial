'use client'

import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePlaylistsStore } from '@/stores/usePlaylistsStore'

interface PlaylistBadgesProps {
  videoId: string
  maxVisible?: number
  size?: 'sm' | 'md'
  showEmpty?: boolean
}

export const PlaylistBadges: React.FC<PlaylistBadgesProps> = ({
  videoId,
  maxVisible = 3,
  size = 'sm',
  showEmpty = true,
}) => {
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)

  const playlists = usePlaylistsStore(state => state.playlists)
  const playlistTracks = usePlaylistsStore(state => state.playlistTracks)

  const matchedPlaylists = useMemo(() => {
    return playlists.filter(playlist => {
      const tracks = playlistTracks[playlist.id]
      return tracks?.some(t => t.videoId === videoId)
    })
  }, [playlists, playlistTracks, videoId])

  const count = matchedPlaylists.length

  if (count === 0) {
    if (!showEmpty) return null
    return (
      <span className={`text-orange-600 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
        Not in any playlist
      </span>
    )
  }

  const visiblePlaylists = showAll ? matchedPlaylists : matchedPlaylists.slice(0, maxVisible)
  const hiddenCount = count - maxVisible

  const badgeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-2.5 py-1 text-sm'

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visiblePlaylists.map(playlist => (
        <button
          key={playlist.id}
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/playlist/${playlist.id}`)
          }}
          className={`inline-flex items-center rounded-full font-medium bg-green-100 text-green-800 hover:bg-green-200 transition-colors ${badgeClasses}`}
        >
          {playlist.title}
        </button>
      ))}
      {!showAll && hiddenCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowAll(true)
          }}
          className={`inline-flex items-center rounded-full font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors ${badgeClasses}`}
        >
          +{hiddenCount}
        </button>
      )}
      {showAll && count > maxVisible && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowAll(false)
          }}
          className={`inline-flex items-center rounded-full font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors ${badgeClasses}`}
        >
          Show less
        </button>
      )}
    </div>
  )
}
