'use client'

import { useState, useCallback, useRef } from 'react'

/**
 * Hook for server-side track enrichment with polling.
 * Replaces useEssentia with a backend-only approach.
 */

export interface AudioFeatures {
  bpm: number | null
  key: string | null
  scale: string | null
  energy: number | null
  danceability: number | null
}

export interface AnalysisResult extends AudioFeatures {
  videoId: string
  lastfmTags: string[] | null
}

// Server steps mapped to UI-friendly status
export type EnrichmentStatus =
  | 'idle'
  | 'starting'
  | 'yt-metadata'
  | 'downloading'
  | 'analyzing'
  | 'lastfm'
  | 'complete'
  | 'error'

const POLL_INTERVAL = 1000 // 1 second

export function useEnrichment() {
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<EnrichmentStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const enrich = useCallback(async (videoId: string): Promise<AnalysisResult | null> => {
    setIsLoading(true)
    setError(null)
    setResult(null)
    setStatus('starting')
    stopPolling()

    try {
      // Start enrichment job
      const res = await fetch('/api/track/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds: [videoId] }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to start enrichment')
      }

      // Poll for status
      return new Promise((resolve) => {
        const poll = async () => {
          try {
            const statusRes = await fetch(`/api/track/enrich/status?v=${videoId}`)
            const data = await statusRes.json()

            if (data.status === 'complete') {
              stopPolling()
              setStatus('complete')
              setIsLoading(false)
              const analysisResult: AnalysisResult = {
                videoId,
                bpm: data.result?.bpm ?? null,
                key: data.result?.key ?? null,
                scale: data.result?.scale ?? null,
                energy: data.result?.energy ?? null,
                danceability: data.result?.danceability ?? null,
                lastfmTags: data.result?.lastfmTags ?? null,
              }
              setResult(analysisResult)
              resolve(analysisResult)
            } else if (data.status === 'error') {
              stopPolling()
              setStatus('error')
              setError(data.error || 'Analysis failed')
              setIsLoading(false)
              resolve(null)
            } else if (data.status === 'in_progress') {
              // Map step to status
              const step = data.step as EnrichmentStatus
              if (step && ['yt-metadata', 'downloading', 'analyzing', 'lastfm'].includes(step)) {
                setStatus(step)
              }
            } else if (data.status === 'not_found') {
              // Job not started yet, keep polling
              setStatus('starting')
            }
          } catch (e) {
            console.error('Poll error:', e)
          }
        }

        // Initial poll
        poll()
        // Continue polling
        pollRef.current = setInterval(poll, POLL_INTERVAL)
      })
    } catch (err) {
      console.error('Enrichment failed:', err)
      setError(err instanceof Error ? err.message : 'Enrichment failed')
      setStatus('error')
      setIsLoading(false)
      return null
    }
  }, [stopPolling])

  const reset = useCallback(() => {
    stopPolling()
    setStatus('idle')
    setError(null)
    setResult(null)
    setIsLoading(false)
  }, [stopPolling])

  return {
    isLoading,
    status,
    error,
    result,
    enrich,
    reset,
  }
}
