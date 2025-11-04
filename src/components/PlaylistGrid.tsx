'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Music, Trash2 } from 'lucide-react'
import { YouTubePlaylist } from '@/types/youtube'

interface PlaylistGridProps {
  playlists: YouTubePlaylist[]
  selectedIds: Set<string>
  onToggleSelect?: (playlistId: string) => void
  onDelete?: (playlistId: string) => void
  isBatchMode?: boolean
}

export const PlaylistGrid: React.FC<PlaylistGridProps> = ({
  playlists,
  selectedIds,
  onToggleSelect,
  onDelete,
  isBatchMode = false
}) => {
  const router = useRouter()

  if (playlists.length === 0) {
    return (
      <div className="text-center py-12">
        <Music className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No playlists yet</h3>
        <p className="text-gray-600">Create your first playlist to get started</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {playlists.map((playlist) => {
        const isSelected = selectedIds.has(playlist.id)

        return (
          <div
            key={playlist.id}
            className={`group relative bg-white rounded-lg overflow-hidden border transition-all cursor-pointer ${
              isSelected
                ? 'border-red-500 ring-2 ring-red-500'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
            }`}
            onClick={() => {
              if (isBatchMode && onToggleSelect) {
                onToggleSelect(playlist.id)
              } else {
                router.push(`/playlist/${playlist.id}`)
              }
            }}
          >
            {/* Thumbnail */}
            <div className="relative aspect-square bg-gray-100">
              {playlist.thumbnail ? (
                <Image
                  src={playlist.thumbnail}
                  alt={playlist.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Music className="h-12 w-12 text-gray-400" />
                </div>
              )}

              {/* Selection checkbox (batch mode) */}
              {isBatchMode && (
                <div className="absolute top-2 right-2">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected
                        ? 'bg-red-500 border-red-500'
                        : 'bg-white border-gray-300'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-4 h-4 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    )}
                  </div>
                </div>
              )}

              {/* Delete button (hover, not in batch mode) */}
              {!isBatchMode && onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(playlist.id)
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Delete playlist"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {/* Track count badge */}
              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black bg-opacity-70 text-white text-xs rounded">
                {playlist.trackCount} tracks
              </div>
            </div>

            {/* Info */}
            <div className="p-3">
              <h3 className="font-medium text-sm text-gray-900 truncate" title={playlist.title}>
                {playlist.title}
              </h3>
              {playlist.description && (
                <p className="text-xs text-gray-600 mt-1 line-clamp-2" title={playlist.description}>
                  {playlist.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  playlist.privacy === 'public'
                    ? 'bg-green-100 text-green-700'
                    : playlist.privacy === 'unlisted'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {playlist.privacy}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
