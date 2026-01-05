'use client'

import { useEffect } from 'react'
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useEssentia, AnalysisStatus, AnalysisResult } from '@/hooks/useEssentia'

interface AnalysisModalProps {
  videoId: string
  title: string
  artist: string
  forceRefresh?: boolean
  onClose: () => void
  onComplete: (result: AnalysisResult) => void
}

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  'idle': 'Pending',
  'loading-essentia': 'Loading Essentia.js...',
  'checking-cache': 'Checking cache...',
  'fetching-audio': 'Extracting YouTube audio...',
  'decoding': 'Decoding audio...',
  'analyzing': 'Analyzing...',
  'fetching-tags': 'Fetching Last.fm tags...',
  'saving': 'Saving...',
  'done': 'Done',
  'error': 'Error',
}

const STATUS_ORDER: AnalysisStatus[] = [
  'loading-essentia',
  'checking-cache',
  'fetching-audio',
  'decoding',
  'analyzing',
  'fetching-tags',
  'saving',
  'done',
]

export function AnalysisModal({ videoId, title, artist, forceRefresh = false, onClose, onComplete }: AnalysisModalProps) {
  const { status, error, analyze } = useEssentia()

  useEffect(() => {
    let cancelled = false

    const runAnalysis = async () => {
      const result = await analyze(videoId, title, artist, forceRefresh)
      if (!cancelled && result) {
        onComplete(result)
      }
    }

    runAnalysis()

    return () => {
      cancelled = true
    }
  }, [videoId, title, artist, forceRefresh, analyze, onComplete])

  const currentIndex = STATUS_ORDER.indexOf(status)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{title}</h2>
            <p className="text-sm text-gray-500 truncate">{artist}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="space-y-3 mb-6">
          {STATUS_ORDER.slice(0, -1).map((step, index) => {
            const isComplete = currentIndex > index
            const isCurrent = status === step

            return (
              <div key={step} className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  isComplete ? 'bg-green-500' :
                  isCurrent ? 'bg-red-500' :
                  'bg-gray-200'
                }`}>
                  {isComplete ? (
                    <CheckIcon className="w-4 h-4 text-white" />
                  ) : isCurrent ? (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : null}
                </div>
                <span className={`text-sm ${
                  isComplete ? 'text-gray-500' :
                  isCurrent ? 'text-gray-900 font-medium' :
                  'text-gray-400'
                }`}>
                  {STATUS_LABELS[step]}
                </span>
              </div>
            )
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Done */}
        {status === 'done' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
            <p className="text-sm text-green-700">Analysis completed successfully</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          {(status === 'done' || status === 'error') && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
