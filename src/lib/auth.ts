import { cookies } from 'next/headers'
import { sign, verify } from 'jsonwebtoken'

export interface UserSession {
  userId: string
  email: string
  name: string
  profilePicture?: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

const SESSION_COOKIE = 'session'
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production'

export async function createSession(session: UserSession): Promise<string> {
  const token = sign(session, SECRET, { expiresIn: '7d' })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return token
}

export async function getSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value

    if (!token) {
      return null
    }

    const session = verify(token, SECRET) as UserSession
    return session
  } catch (error) {
    console.error('Session verification error:', error)
    return null
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string
  expiresIn: number
} | null> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      return null
    }

    const tokens = await response.json()
    return {
      accessToken: tokens.access_token,
      expiresIn: tokens.expires_in,
    }
  } catch (error) {
    console.error('Token refresh error:', error)
    return null
  }
}
