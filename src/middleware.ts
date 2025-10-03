import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  console.log('🔧 Middleware triggered for:', request.nextUrl.pathname);
  
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          // Only update response if not already set
          if (!response) {
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
          }
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: Record<string, unknown>) {
          // Only update response if not already set
          if (!response) {
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
          }
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Traiter le callback OAuth si code présent dans l'URL
  const url = request.nextUrl
  const code = url.searchParams.get('code')

  console.log('🔍 Checking for OAuth callback code:', {
    hasCode: !!code,
    codeLength: code?.length,
    fullUrl: url.toString(),
    searchParams: url.searchParams.toString()
  });

  if (code) {
    console.log('🔄 OAuth callback detected, exchanging code for session...')
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('❌ Session exchange error:', error)
        const redirectUrl = new URL('/?error=auth_callback_error', url.origin)
        return NextResponse.redirect(redirectUrl)
      }

      console.log('✅ Session exchange successful:', {
        userEmail: data.session?.user?.email,
        hasProviderToken: !!data.session?.provider_token,
        hasProviderRefreshToken: !!data.session?.provider_refresh_token,
        tokenLength: data.session?.provider_token?.length
      });

      // Create redirect response with tokens in cookies
      const redirectUrl = new URL('/', url.origin)
      console.log('🔀 Redirecting to:', redirectUrl.toString());
      const redirectResponse = NextResponse.redirect(redirectUrl)

      // Copy ALL cookies from the original response (including Supabase session cookies)
      response.cookies.getAll().forEach((cookie) => {
        console.log('📦 Copying cookie to redirect:', cookie.name);
        redirectResponse.cookies.set(cookie.name, cookie.value, {
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite as 'strict' | 'lax' | 'none' | undefined,
          path: cookie.path,
          maxAge: cookie.maxAge
        })
      })

      // Store provider tokens in response cookies for client to pick up
      if (data.session?.provider_token) {
        console.log('🍪 Setting provider_token cookie, length:', data.session.provider_token.length);
        redirectResponse.cookies.set('provider_token', data.session.provider_token, {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        })
        if (data.session.provider_refresh_token) {
          console.log('🍪 Setting provider_refresh_token cookie');
          redirectResponse.cookies.set('provider_refresh_token', data.session.provider_refresh_token, {
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30 // 30 days
          })
        }
      }

      return redirectResponse
    } catch (error) {
      console.error('❌ Error exchanging code for session:', error)
      // Rediriger vers la page d'accueil avec une erreur
      const redirectUrl = new URL('/?error=auth_callback_error', url.origin)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Get user and session, set provider token cookies on every request
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (user && !userError) {
      console.log('User session active:', user.email)

      // Get session for provider tokens
      const { data: { session } } = await supabase.auth.getSession()

      // Always set provider token cookies if available
      if (session?.provider_token) {
        response.cookies.set('provider_token', session.provider_token, {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        })
        if (session.provider_refresh_token) {
          response.cookies.set('provider_refresh_token', session.provider_refresh_token, {
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30 // 30 days
          })
        }
      }
    }
  } catch (error) {
    console.error('Error getting user:', error)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}