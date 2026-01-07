/**
 * Feature documentation type for co-located user-facing docs.
 * Aggregated in /help page for FAQ display.
 */
export interface FeatureMeta {
  id: string
  name: string
  description: string
  faq?: { q: string; a: string }[]
}
