import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function middleware(req: NextRequest) {
  console.log('DEBUG: Middleware running for:', req.nextUrl.pathname);
  
  // Skip middleware for static files and API routes
  if (
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/api') ||
    req.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  try {
    // Get session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('DEBUG: Session error:', error);
      return NextResponse.next();
    }

    if (!session) {
      console.log('DEBUG: No session found');
      // If no session, allow access to login/signup pages
      if (req.nextUrl.pathname === '/' || req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup') {
        return NextResponse.next();
      }
      // Redirect to login for protected routes
      return NextResponse.redirect(new URL('/login', req.url));
    }

    console.log('DEBUG: User authenticated:', session.user.email);

    // If already on dashboard, don't redirect again
    if (req.nextUrl.pathname === '/dashboard') {
      console.log('DEBUG: Already on dashboard, allowing access');
      return NextResponse.next();
    }

    // Check if user has masjid_id
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('masjid_id')
      .eq('auth_user_id', session.user.id)
      .single();

    if (roleError) {
      console.log('DEBUG: No user_roles found or error:', roleError.message);
      // If no user_roles, redirect to setup
      if (req.nextUrl.pathname !== '/setup-masjid') {
        return NextResponse.redirect(new URL('/setup-masjid', req.url));
      }
      return NextResponse.next();
    }

    if (!userRole?.masjid_id) {
      console.log('DEBUG: No masjid_id found');
      // If no masjid_id, redirect to setup
      if (req.nextUrl.pathname !== '/setup-masjid') {
        return NextResponse.redirect(new URL('/setup-masjid', req.url));
      }
      return NextResponse.next();
    }

    console.log('DEBUG: User has masjid_id:', userRole.masjid_id);

    // If user has masjid_id and is trying to access setup, redirect to dashboard
    if (req.nextUrl.pathname === '/setup-masjid') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    // If user has masjid_id and is on login/signup/root, redirect to dashboard
    if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/signup' || req.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();

  } catch (error) {
    console.error('DEBUG: Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
