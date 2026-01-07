import { NextRequest, NextResponse } from 'next/server'
import { getSession, isAdmin } from '@/lib/auth'
import { cache } from '@/lib/db'

// GET /api/admin/users - List all users
export async function GET() {
  try {
    const session = await getSession()
    if (!session || !isAdmin(session.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const users = cache.getAllUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH /api/admin/users - Update user status
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || !isAdmin(session.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { userId, status } = await request.json()

    if (!userId || !['pending', 'approved', 'blocked'].includes(status)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    cache.setUserStatus(userId, status)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
