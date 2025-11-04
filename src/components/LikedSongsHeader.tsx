'use client'

import React from 'react'
import { Heart, Search, RefreshCw, Download } from 'lucide-react'

interface LikedSongsHeaderProps {
  totalSongs: number
  isFetching: boolean
  onRefresh: () => void
  onExport: () => void
  onToggleSearch: () => void
}

export const LikedSongsHeader: React.FC<LikedSongsHeaderProps> = ({
  totalSongs,
  isFetching,
  onRefresh,
  onExport,
  onToggleSearch
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Heart className="h-5 w-5 text-red-500" />
        <h1 className="text-xl font-bold text-gray-900">
          Liked Songs
          {totalSongs > 0 && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({totalSongs})
            </span>
          )}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSearch}
          className="md:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
        {totalSongs > 0 && (
          <button
            onClick={onExport}
            className="hidden md:block p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Export CSV"
          >
            <Download className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  )
}
