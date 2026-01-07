import { NextRequest, NextResponse } from 'next/server'
import { createSession, isAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'
import { cache } from '@/lib/db'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/?error=${error}`)
  }

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/?error=no_code`)
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info')
    }

    const userInfo = await userInfoResponse.json()
    const { id, email, name, picture } = userInfo

    // Upsert user in database and check status
    const user = cache.upsertUser({ id, email, name, profilePicture: picture })
    const userIsAdmin = isAdmin(email)

    // If user is blocked, deny access
    if (user.status === 'blocked') {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/blocked`)
    }

    // If user is pending and not admin, redirect to pending page
    if (user.status === 'pending' && !userIsAdmin) {
      // Still create session so they can see their pending status
    }

    // Create session (stored in HTTP-only cookie)
    const expiresAt = Date.now() + expires_in * 1000
    await createSession({
      userId: id,
      email,
      name,
      profilePicture: picture,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
    })

    // Set provider token cookies for client (localStorage transfer)
    const cookieStore = await cookies()
    cookieStore.set('youtube_access_token', access_token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expires_in,
      path: '/',
    })

    if (refresh_token) {
      cookieStore.set('youtube_refresh_token', refresh_token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/`)
  } catch (error) {
    console.error('OAuth callback error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/?error=auth_failed`)
  }
}
