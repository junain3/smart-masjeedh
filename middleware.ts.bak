import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const pathname = req.nextUrl.pathname;

  // If user is not authenticated and trying to access protected routes
  if (!session && !pathname.startsWith("/login") && !pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // If user is authenticated and trying to access login/register
  if (session && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Check user role and permissions for staff users
  if (session && pathname !== "/login" && pathname !== "/register") {
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role, permissions")
      .eq("masjid_id", session.user.id)
      .eq("user_id", session.user.id)
      .single();

    if (userRole) {
      const role = userRole.role;
      const permissions = userRole.permissions as any || {};
      
      // For staff users with only collection permissions, restrict access
      if (role === "staff") {
        const canAccounts = permissions.accounts !== false;
        const canEvents = permissions.events !== false;
        const canMembers = permissions.members !== false;
        const canCollect = permissions.subscriptions_collect !== false;

        // If staff user only has collection permissions and tries to access other pages
        if (canCollect && !canAccounts && !canEvents && !canMembers) {
          const allowedPaths = ["/", "/collections", "/settings"];
          if (!allowedPaths.some(path => pathname === path || pathname.startsWith(path + "/"))) {
            return NextResponse.redirect(new URL("/collections", req.url));
          }
        }
      }
    }
  }

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
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
