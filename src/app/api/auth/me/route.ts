import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { kvService } from '@/lib/kv'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Verify JWT
    const decoded = verify(sessionToken, process.env.SESSION_SECRET!) as {
      userId: string
      email: string
    }

    // Get session from KV
    const session = await kvService.getSession(decoded.userId)

    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    // Check if access token is expired
    if (session.expiresAt < Date.now()) {
      // Token expired, try to refresh
      if (session.refreshToken) {
        try {
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: session.refreshToken,
              grant_type: 'refresh_token',
            }),
          })

          if (refreshResponse.ok) {
            const tokens = await refreshResponse.json()
            const { access_token, expires_in } = tokens

            // Update session with new token
            session.accessToken = access_token
            session.expiresAt = Date.now() + expires_in * 1000
            await kvService.setSession(decoded.userId, session)

            // Update cookie
            cookieStore.set('youtube_access_token', access_token, {
              httpOnly: false,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: expires_in,
              path: '/',
            })
          }
        } catch (error) {
          console.error('Token refresh error:', error)
        }
      }
    }

    return NextResponse.json({
      user: {
        name: session.name,
        email: session.email,
        profilePicture: session.profilePicture,
      },
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
