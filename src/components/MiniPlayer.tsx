'use client'

import React, { useState } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface MiniPlayerProps {
  videoId: string;
  onClose: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ videoId, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (isExpanded) {
    // Full-screen player
    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white text-sm">Now Playing</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="text-white hover:text-gray-300 p-2"
                title="Minimize"
              >
                <Minimize2 className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 p-2"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="aspect-video">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  // Mini player bar (bottom)
  return (
    <>
      {/* Mobile: Full-width bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-50">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">Now Playing</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(true)}
                className="text-gray-600 hover:text-gray-900 p-2"
                title="Expand"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 p-2"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="aspect-video">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Desktop: Bottom-right floating box */}
      <div className="hidden md:block fixed bottom-4 right-4 w-80 bg-white border border-gray-200 shadow-xl rounded-lg z-50">
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">Now Playing</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(true)}
                className="text-gray-500 hover:text-gray-700 p-1"
                title="Expand"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 p-1"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="aspect-video">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="rounded"
            />
          </div>
        </div>
      </div>
    </>
  );
};
