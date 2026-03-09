import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

// TEMPORARY BYPASS FOR DEBUGGING - Always allow all requests
// This bypasses all authentication and redirect logic temporarily
export function middleware(req: NextRequest) { 
  console.log('DEBUG: Middleware bypassed for debugging');
  return NextResponse.next(); 
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)"
  ]
};
