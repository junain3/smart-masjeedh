import { NextResponse, NextRequest } from 'next/server'
import { updateSession } from './utils/supabase/middleware'

export async function middleware(req: NextRequest) {
  console.log('DEBUG: Supabase SSR middleware active')
  
  // Update session using Supabase SSR
  return await updateSession(req)
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
