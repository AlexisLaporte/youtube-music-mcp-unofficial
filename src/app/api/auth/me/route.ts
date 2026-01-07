import { NextResponse } from 'next/server'
import { getSession, refreshGoogleToken, createSession, isAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'
import { cache } from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Check if access token is expired
    if (session.expiresAt < Date.now()) {
      // Token expired, try to refresh
      if (session.refreshToken) {
        const refreshed = await refreshGoogleToken(session.refreshToken)

        if (refreshed) {
          // Update session with new token
          session.accessToken = refreshed.accessToken
          session.expiresAt = Date.now() + refreshed.expiresIn * 1000
          await createSession(session)

          // Update cookie for client
          const cookieStore = await cookies()
          cookieStore.set('youtube_access_token', refreshed.accessToken, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: refreshed.expiresIn,
            path: '/',
          })
        } else {
          // Refresh failed, session invalid
          return NextResponse.json({ user: null }, { status: 401 })
        }
      } else {
        // No refresh token, session invalid
        return NextResponse.json({ user: null }, { status: 401 })
      }
    }

    // Get user status from database
    const dbUser = cache.getUser(session.userId)
    const userIsAdmin = isAdmin(session.email)

    return NextResponse.json({
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        profilePicture: session.profilePicture,
        status: dbUser?.status || 'pending',
        isAdmin: userIsAdmin,
      },
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
