import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { kvService } from '@/lib/kv'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (sessionToken) {
      try {
        const decoded = verify(sessionToken, process.env.SESSION_SECRET!) as {
          userId: string
        }
        // Delete session from KV
        await kvService.deleteSession(decoded.userId)
      } catch (error) {
        // Session invalid, just delete cookies
        console.error('Logout session decode error:', error)
      }
    }

    // Delete all auth cookies
    cookieStore.delete('session')
    cookieStore.delete('youtube_access_token')
    cookieStore.delete('youtube_refresh_token')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 })
  }
}
