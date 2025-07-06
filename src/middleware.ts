import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
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
  
  if (code) {
    console.log('OAuth callback detected, exchanging code for session...')
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Session exchange error:', error)
        const redirectUrl = new URL('/?error=auth_callback_error', url.origin)
        return NextResponse.redirect(redirectUrl)
      }
      
      console.log('Session exchange successful:', data.session?.user?.email)
      
      // Rediriger vers la page d'accueil sans le code
      const redirectUrl = new URL('/', url.origin)
      return NextResponse.redirect(redirectUrl)
    } catch (error) {
      console.error('Error exchanging code for session:', error)
      // Rediriger vers la page d'accueil avec une erreur
      const redirectUrl = new URL('/?error=auth_callback_error', url.origin)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Rafraîchir la session si nécessaire
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      console.log('User session active:', user.email)
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