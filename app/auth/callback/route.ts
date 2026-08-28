import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next");

  // If there's no code, redirect to login
  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    // Create a Supabase client with cookie handling for server-side
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            request.cookies.set({
              name,
              value: "",
              ...options,
            });
          },
        },
      }
    );

    // Exchange the code for a session for all auth types including recovery
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(new URL("/login?error=auth_failed", request.url));
    }

    // Successfully authenticated
    if (type === "recovery" || type === "email") {
      // For password recovery, redirect to update-password page
      // Session is already established, no need to pass code
      return NextResponse.redirect(new URL("/update-password", request.url));
    }

    // For other auth types (magic link, signup), redirect to next param or dashboard
    const redirectPath = next || "/dashboard";
    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error("Auth callback error:", error);
    return NextResponse.redirect(new URL("/login?error=server_error", request.url));
  }
}
