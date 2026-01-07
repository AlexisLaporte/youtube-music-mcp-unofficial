import type { FeatureMeta } from '@/types/docs'

/**
 * Library sync - fetches playlists and tracks from YouTube Music.
 *
 * Sync is manual only (no background refresh) to respect API quotas.
 * Data is stored in Zustand with localStorage persistence.
 * Backend enrichment (Last.fm tags, audio analysis) runs separately.
 */
export const featureMeta: FeatureMeta = {
  id: 'library-sync',
  name: 'Library Sync',
  description: 'Import your YouTube Music library (playlists and liked songs).',
  faq: [
    { q: 'How often should I sync?', a: 'Manually when you add new music. No auto-sync to save API quota.' },
    { q: 'Why are some songs missing?', a: 'Private, deleted, or region-locked videos are excluded.' },
    { q: 'What is enrichment?', a: 'Fetches Last.fm tags and audio features (BPM, key) for each track.' },
  ]
}
