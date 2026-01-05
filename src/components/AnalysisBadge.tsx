'use client'

import { useState, useEffect } from 'react'
import { BeakerIcon } from '@heroicons/react/24/outline'
import { BeakerIcon as BeakerSolidIcon } from '@heroicons/react/24/solid'

interface AnalysisBadgeProps {
  videoId: string
  showBpm?: boolean
}

interface AnalysisData {
  cached: boolean
  bpm?: number
  key?: string
  scale?: string
}

// Simple cache to avoid repeated fetches
const analysisCache = new Map<string, AnalysisData | null>()

export function AnalysisBadge({ videoId, showBpm = true }: AnalysisBadgeProps) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(
    analysisCache.get(videoId) ?? null
  )
  const [loading, setLoading] = useState(!analysisCache.has(videoId))

  useEffect(() => {
    if (analysisCache.has(videoId)) {
      setAnalysis(analysisCache.get(videoId) ?? null)
      setLoading(false)
      return
    }

    const fetchAnalysis = async () => {
      try {
        const res = await fetch(`/api/analysis?v=${videoId}`)
        if (res.ok) {
          const data = await res.json()
          const result = data.cached && data.bpm ? data : null
          analysisCache.set(videoId, result)
          setAnalysis(result)
        }
      } catch {
        analysisCache.set(videoId, null)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [videoId])

  if (loading) {
    return null
  }

  if (analysis?.bpm && showBpm) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
        <BeakerSolidIcon className="w-3 h-3" />
        {analysis.bpm}
      </span>
    )
  }

  if (analysis?.bpm) {
    return (
      <BeakerSolidIcon className="w-3.5 h-3.5 text-purple-500" title={`${analysis.bpm} BPM`} />
    )
  }

  return (
    <BeakerIcon className="w-3.5 h-3.5 text-gray-300" title="Not analyzed" />
  )
}
