'use client'

import { useState, useRef, useCallback } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EssentiaInstance = any

export interface AudioFeatures {
  bpm: number | null
  key: string | null
  scale: string | null
  energy: number | null
  danceability: number | null
}

export interface AnalysisResult extends AudioFeatures {
  videoId: string
  title: string | null
  artist: string | null
  lastfmTags: string[] | null
  lastfmListeners: string | null
  lastfmPlaycount: string | null
}

export type AnalysisStatus =
  | 'idle'
  | 'loading-essentia'
  | 'checking-cache'
  | 'fetching-audio'
  | 'decoding'
  | 'analyzing'
  | 'fetching-tags'
  | 'saving'
  | 'done'
  | 'error'

declare global {
  interface Window {
    Essentia: EssentiaInstance
    EssentiaWASM: EssentiaInstance
  }
}

export function useEssentia() {
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const essentiaRef = useRef<EssentiaInstance>(null)

  const loadEssentia = useCallback(async () => {
    if (essentiaRef.current) {
      setIsReady(true)
      return true
    }

    setStatus('loading-essentia')
    setIsLoading(true)
    setError(null)

    try {
      // Load WASM script
      const wasmScript = document.createElement('script')
      wasmScript.src = 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.js'
      document.head.appendChild(wasmScript)
      await new Promise(resolve => { wasmScript.onload = resolve })

      // Load core script
      const coreScript = document.createElement('script')
      coreScript.src = 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js'
      document.head.appendChild(coreScript)
      await new Promise(resolve => { coreScript.onload = resolve })

      // Initialize WASM
      const wasm = await window.EssentiaWASM()
      essentiaRef.current = new window.Essentia(wasm)
      setIsReady(true)
      return true
    } catch (err) {
      console.error('Failed to load Essentia:', err)
      setError('Impossible de charger Essentia.js')
      setStatus('error')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const extractFeatures = useCallback((signal: unknown): AudioFeatures => {
    const essentia = essentiaRef.current
    if (!essentia) throw new Error('Essentia not loaded')

    const features: AudioFeatures = {
      bpm: null,
      key: null,
      scale: null,
      energy: null,
      danceability: null,
    }

    try {
      const rhythm = essentia.RhythmExtractor2013(signal)
      features.bpm = Math.round(rhythm.bpm)
    } catch (e) {
      console.warn('BPM extraction failed:', e)
    }

    try {
      const keyResult = essentia.KeyExtractor(signal)
      features.key = keyResult.key
      features.scale = keyResult.scale
    } catch (e) {
      console.warn('Key extraction failed:', e)
    }

    try {
      const rms = essentia.RMS(signal)
      features.energy = Math.round(rms.rms * 1000) / 10
    } catch (e) {
      console.warn('Energy extraction failed:', e)
    }

    try {
      const danceability = essentia.Danceability(signal)
      features.danceability = Math.round(danceability.danceability * 100)
    } catch (e) {
      console.warn('Danceability extraction failed:', e)
    }

    return features
  }, [])

  const analyze = useCallback(async (
    videoId: string,
    title?: string,
    artist?: string,
    forceRefresh = false
  ): Promise<AnalysisResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      // Load Essentia if not ready
      if (!essentiaRef.current) {
        const loaded = await loadEssentia()
        if (!loaded) return null
      }

      // Check cache (skip if forceRefresh)
      setStatus('checking-cache')
      const cacheRes = await fetch(`/api/analysis?v=${videoId}`)
      const cacheData = await cacheRes.json()

      if (!forceRefresh && cacheData.cached && cacheData.bpm !== undefined) {
        setStatus('done')
        return {
          videoId,
          title: cacheData.title || title || null,
          artist: cacheData.artist || artist || null,
          bpm: cacheData.bpm,
          key: cacheData.key || null,
          scale: cacheData.scale || null,
          energy: cacheData.energy ?? null,
          danceability: cacheData.danceability ?? null,
          lastfmTags: cacheData.lastfmTags || null,
          lastfmListeners: null,
          lastfmPlaycount: null,
        }
      }

      // Use metadata from cache response or params
      const trackTitle = title || cacheData.title
      const trackArtist = artist || cacheData.artist

      // Fetch audio
      setStatus('fetching-audio')
      const audioRes = await fetch(`/api/audio?v=${videoId}`)
      if (!audioRes.ok) throw new Error("Impossible d'extraire l'audio")

      // Decode
      setStatus('decoding')
      const arrayBuffer = await audioRes.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const audioData = audioBuffer.getChannelData(0)
      const signal = essentiaRef.current.arrayToVector(audioData)

      // Analyze
      setStatus('analyzing')
      const features = extractFeatures(signal)
      await audioContext.close()

      // Fetch Last.fm data
      let lastfmTags: string[] | null = null
      let lastfmListeners: string | null = null
      let lastfmPlaycount: string | null = null
      if (trackTitle && trackArtist) {
        setStatus('fetching-tags')
        try {
          const tagRes = await fetch(
            `/api/lastfm?artist=${encodeURIComponent(trackArtist)}&track=${encodeURIComponent(trackTitle)}`
          )
          if (tagRes.ok) {
            const tagData = await tagRes.json()
            lastfmTags = tagData.tags || null
            lastfmListeners = tagData.listeners || null
            lastfmPlaycount = tagData.playcount || null
          }
        } catch (e) {
          console.warn('Last.fm fetch failed:', e)
        }
      }

      // Save to cache
      setStatus('saving')
      await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          title: trackTitle,
          artist: trackArtist,
          ...features,
          lastfmTags,
        }),
      })

      setStatus('done')
      return {
        videoId,
        title: trackTitle || null,
        artist: trackArtist || null,
        ...features,
        lastfmTags,
        lastfmListeners,
        lastfmPlaycount,
      }
    } catch (err) {
      console.error('Analysis failed:', err)
      setError(err instanceof Error ? err.message : "Erreur d'analyse")
      setStatus('error')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [loadEssentia, extractFeatures])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return {
    isReady,
    isLoading,
    status,
    error,
    analyze,
    reset,
  }
}
