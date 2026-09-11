import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function buildRedirectResponse(
  request: NextRequest,
  location: string,
  cookieSource: NextResponse
): NextResponse {
  const redirectResp = NextResponse.redirect(new URL(location, request.url), {
    status: 307,
  });
  cookieSource.cookies.getAll().forEach((c) => {
    redirectResp.cookies.set(c.name, c.value, {
      ...(c as any),
    });
  });
  return redirectResp;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const token = requestUrl.searchParams.get("token");
  const type = (requestUrl.searchParams.get("type") as string) || "signup";
  const next = requestUrl.searchParams.get("next");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Propagate auth errors immediately
  if (error) {
    const loginUrl = new URL("/login", request.url);
    if (error) loginUrl.searchParams.set("error", error);
    if (errorDescription) loginUrl.searchParams.set("error_description", errorDescription);
    return NextResponse.redirect(loginUrl);
  }

  // Prepare SSR client with CORRECT cookie sync pattern (setAll + forward to response)
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options ?? {});
          });
        },
      },
    }
  );

  try {
    let establishedSession = false;

    // MODE A: PKCE flow (code exchange) - magiclink signup/invitations etc.
    if (code) {
      const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeErr) {
        console.error("Auth callback: exchangeCodeForSession failed:", exchangeErr);
      } else {
        establishedSession = true;
      }
    }

    // MODE B: Token-based flow (default password recovery / email confirm / signup)
    // Supabase reset password emails typically include ?token=...&type=recovery
    if (!establishedSession && token) {
      const verifyType =
        type === "invite"
          ? "invite"
          : type === "email" || type === "email_change"
          ? "email"
          : type === "recovery" || type === "signup" || type === "magiclink"
          ? type
          : ("magiclink" as any);
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: verifyType as any,
      });
      if (verifyErr) {
        console.error("Auth callback: verifyOtp failed:", verifyErr);
      } else {
        establishedSession = true;
      }
    }

    // If neither mode worked and we have no session, go to login with explicit error
    if (!establishedSession) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "auth_failed");
        if (!code && !token) loginUrl.searchParams.set("reason", "no_token_or_code");
        return NextResponse.redirect(loginUrl);
      }
    }

    // Session established - route based on auth type
    if (type === "recovery") {
      return buildRedirectResponse(request, "/update-password", response);
    }
    if (type === "email_change") {
      return buildRedirectResponse(request, next || "/settings/users", response);
    }
    if (type === "signup" || type === "invite" || type === "email" || type === "magiclink") {
      const redirectPath = next || "/dashboard";
      return buildRedirectResponse(request, redirectPath, response);
    }

    const redirectPath = next || "/dashboard";
    return buildRedirectResponse(request, redirectPath, response);
  } catch (runtimeErr) {
    console.error("Auth callback: unhandled exception:", runtimeErr);
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "server_error");
    return NextResponse.redirect(loginUrl);
  }
}
