import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { users } from '@/lib/pg'
import { syncUser } from '@/services/syncService'

/**
 * POST /api/sync - Trigger manual sync for current user
 * GET /api/sync - Get sync status for current user
 */

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user from PostgreSQL
  const user = await users.getById(session.userId)
  if (!user) {
    return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
  }

  if (!user.google_refresh_token) {
    return NextResponse.json(
      { error: 'No refresh token. Please re-authenticate with offline access.' },
      { status: 400 }
    )
  }

  // Run sync
  const result = await syncUser(user)

  return NextResponse.json({
    success: result.success,
    playlistsSynced: result.playlistsSynced,
    tracksAdded: result.tracksAdded,
    tracksRemoved: result.tracksRemoved,
    error: result.error,
  })
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await users.getById(session.userId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    syncEnabled: user.sync_enabled,
    lastSyncAt: user.last_sync_at,
    nextSyncAt: user.next_sync_at,
    syncError: user.sync_error,
    hasRefreshToken: !!user.google_refresh_token,
  })
}
