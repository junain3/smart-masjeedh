import { NextResponse, NextRequest } from 'next/server'

// TEMPORARY BYPASS - Middleware disabled to fix 500 errors
// Will be re-enabled once Supabase environment issues are resolved

export async function middleware(req: NextRequest) {
  console.log('DEBUG: Middleware bypassed - allowing access')
  
  // Temporary bypass - allow all access
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
