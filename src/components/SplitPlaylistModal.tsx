'use client'

import React, { useState } from 'react'
import { YouTubeTrack } from '@/types/youtube'

interface SplitPlaylistModalProps {
  sourcePlaylistTitle: string
  selectedTracks: YouTubeTrack[]
  onConfirm: (
    title: string,
    description: string,
    privacy: 'public' | 'private' | 'unlisted',
    removeFromSource: boolean
  ) => void
  onClose: () => void
}

export const SplitPlaylistModal: React.FC<SplitPlaylistModalProps> = ({
  sourcePlaylistTitle,
  selectedTracks,
  onConfirm,
  onClose
}) => {
  const [title, setTitle] = useState(`${sourcePlaylistTitle} - Split`)
  const [description, setDescription] = useState(`Split from ${sourcePlaylistTitle}`)
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'unlisted'>('private')
  const [removeFromSource, setRemoveFromSource] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) {
      onConfirm(title.trim(), description.trim(), privacy, removeFromSource)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-gray-900 mb-4">Split Playlist</h2>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            Creating a new playlist with <strong>{selectedTracks.length}</strong> selected track
            {selectedTracks.length !== 1 ? 's' : ''}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              New playlist title *
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Split Playlist"
              required
              autoFocus
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A collection of tracks from my original playlist"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Privacy</label>
            <div className="space-y-2">
              {(['public', 'unlisted', 'private'] as const).map((option) => (
                <label key={option} className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="privacy"
                    value={option}
                    checked={privacy === option}
                    onChange={(e) =>
                      setPrivacy(e.target.value as 'public' | 'private' | 'unlisted')
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 capitalize">{option}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-start cursor-pointer">
              <input
                type="checkbox"
                checked={removeFromSource}
                onChange={(e) => setRemoveFromSource(e.target.checked)}
                className="mt-1 mr-2"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Remove tracks from source playlist
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  If checked, selected tracks will be removed from &quot;{sourcePlaylistTitle}&quot; after
                  being added to the new playlist
                </p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || selectedTracks.length === 0}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create & Split
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
