import { NextRequest, NextResponse } from 'next/server'
import { syncAllDueUsers } from '@/services/syncService'
import { computeAllRecommendations } from '@/services/recommendationService'
import { enrichPendingTracks } from '@/services/enrichmentService'

/**
 * POST /api/sync/cron - Trigger background sync jobs
 *
 * Query params:
 * - job: 'sync' | 'reco' | 'all' (default: 'sync')
 * - secret: must match CRON_SECRET env var
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const secret = request.nextUrl.searchParams.get('secret')
  const expectedSecret = process.env.CRON_SECRET || 'dev-cron-secret'

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const job = request.nextUrl.searchParams.get('job') || 'sync'

  try {
    const results: Record<string, unknown> = {}

    if (job === 'sync' || job === 'all') {
      console.log('[Cron] Starting user sync...')
      await syncAllDueUsers()
      results.sync = 'completed'
    }

    if (job === 'enrich' || job === 'all') {
      console.log('[Cron] Starting track enrichment...')
      const enrichResult = await enrichPendingTracks()
      results.enrichment = enrichResult
    }

    if (job === 'reco' || job === 'all') {
      console.log('[Cron] Starting recommendation computation...')
      const count = await computeAllRecommendations()
      results.recommendations = count
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    console.error('[Cron] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Also allow GET for simple cron services
export async function GET(request: NextRequest) {
  return POST(request)
}
