import { NextResponse } from 'next/server'

// Middleware is no longer needed since OAuth is handled by API routes
// Keeping minimal middleware for potential future use
export async function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
