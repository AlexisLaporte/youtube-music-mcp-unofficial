'use client'

import React from 'react'
import { Search, ArrowUpDown } from 'lucide-react'

type FilterTab = 'all' | 'unassigned'
type SortBy = 'date' | 'artist' | 'title' | 'playlistCount'
type SortOrder = 'asc' | 'desc'

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'artist', label: 'Artist' },
  { value: 'title', label: 'Title' },
  { value: 'playlistCount', label: 'Playlists' },
]

interface LikedSongsFiltersProps {
  activeTab: FilterTab
  onTabChange: (tab: FilterTab) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  showSearch: boolean
  notInPlaylistsCount: number
  sortBy: SortBy
  sortOrder: SortOrder
  onSortByChange: (sortBy: SortBy) => void
  onToggleSortOrder: () => void
}

export const LikedSongsFilters: React.FC<LikedSongsFiltersProps> = ({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  showSearch,
  notInPlaylistsCount,
  sortBy,
  sortOrder,
  onSortByChange,
  onToggleSortOrder
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      {/* Filter Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => onTabChange('all')}
          className={`flex-1 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onTabChange('unassigned')}
          className={`flex-1 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'unassigned'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Not in Playlists
          <span className="ml-1.5 text-xs text-gray-500">
            ({notInPlaylistsCount})
          </span>
        </button>
      </div>

      {/* Sort and Search */}
      <div className={`flex items-center gap-2 ${showSearch || 'hidden md:flex'}`}>
        {/* Sort Dropdown */}
        <div className="flex items-center gap-1">
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortBy)}
            className="text-sm border border-gray-300 rounded-lg py-2 px-3 bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={onToggleSortOrder}
            className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <ArrowUpDown className={`h-4 w-4 text-gray-600 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent w-full md:w-48"
          />
        </div>
      </div>
    </div>
  )
}
