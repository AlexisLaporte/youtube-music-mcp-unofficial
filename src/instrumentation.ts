/**
 * Next.js instrumentation - runs when server starts.
 * Schedules background sync jobs via internal API calls.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  if (process.env.ENABLE_SYNC !== 'true') {
    console.log('[Scheduler] Disabled (set ENABLE_SYNC=true)')
    return
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET || 'dev-cron-secret'

  console.log('[Scheduler] Starting background jobs...')

  // Helper to call internal API
  const triggerJob = async (job: string) => {
    try {
      const res = await fetch(`${baseUrl}/api/sync/cron?secret=${cronSecret}&job=${job}`, {
        method: 'POST',
      })
      if (!res.ok) {
        console.error(`[Scheduler] ${job} failed:`, res.status)
      }
    } catch (err) {
      console.error(`[Scheduler] ${job} error:`, err)
    }
  }

  // Sync every hour (3600000ms)
  setInterval(() => {
    console.log('[Scheduler] Triggering hourly sync')
    triggerJob('sync')
  }, 60 * 60 * 1000)

  // Enrichment every 15 minutes (processes 20 tracks per batch)
  setInterval(() => {
    console.log('[Scheduler] Triggering track enrichment')
    triggerJob('enrich')
  }, 15 * 60 * 1000)

  // Recommendations every 24h (start after 1h to not overlap with first sync)
  setTimeout(() => {
    setInterval(() => {
      console.log('[Scheduler] Triggering daily recommendations')
      triggerJob('reco')
    }, 24 * 60 * 60 * 1000)
  }, 60 * 60 * 1000)

  console.log('[Scheduler] Scheduled: sync (hourly), enrich (15min), reco (daily)')
}
