import { NextResponse } from 'next/server'
import { deleteSession } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    // Delete session cookie
    await deleteSession()

    // Delete all auth cookies
    const cookieStore = await cookies()
    cookieStore.delete('youtube_access_token')
    cookieStore.delete('youtube_refresh_token')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
