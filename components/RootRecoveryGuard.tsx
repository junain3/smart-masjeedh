"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * RootRecoveryGuard
 *
 * Smallest safe client-side guard at the "/" entry point that detects
 * Supabase password recovery information carried either in the
 * URL hash (#...) OR in query string (?...), establishes the
 * recovery session via supabase.auth.setSession({...}), and then
 * performs an IMMEDIATE window.location.replace("/update-password")
 * BEFORE the normal homepage authentication flow / dashboard loading
 * can run.
 *
 * When no recovery data is detected, we render children (the existing
 * homepage) and nothing is changed.
 *
 * Security:
 *  - NEVER log access_token / refresh_token.
 *  - Let Supabase Auth persist the session (we call setSession only).
 *  - Clean URL via history.replaceState before navigation so the
 *    tokens never stay in the visible address bar.
 */
export default function RootRecoveryGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const redirectStarted = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Guard: "/" (and any other page) but we only use on "/" — still safe
    if (redirectStarted.current) return;

    // ---- Detect recovery parameters from BOTH hash AND query string ----
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const getParam = (k: string) =>
      (queryParams.get(k) || hashParams.get(k) || "").trim();

    const type = getParam("type");
    const accessToken = getParam("access_token");
    const refreshToken = getParam("refresh_token");

    // Minimum: type === "recovery"
    const isRecoveryFlow = type === "recovery";

    // Also support other Supabase flow types (signup/invite/magiclink) — but
    // they have their own handlers. Here we ONLY short-circuit recovery.
    if (!isRecoveryFlow) {
      // No recovery — fall through to normal homepage / dashboard rendering
      return;
    }

    // ---- Recovery detected ----
    redirectStarted.current = true;
    console.log("[RecoveryGuard] Password recovery detected");

    const handleRecovery = async () => {
      try {
        // If access_token+refresh_token are available (hash flow), establish
        // the session BEFORE redirecting so /update-password has a session
        if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setErr) {
            console.error("[RecoveryGuard] setSession error:", setErr);
            // Continue redirect anyway - UnifiedAppProvider PASSWORD_RECOVERY
            // event will still fire and /update-password has its own fallback
          } else {
            console.log("[RecoveryGuard] Recovery session established");
          }
        } else {
          // Type=recovery but no explicit tokens — could be a Site URL
          // redirect with tokens only in the Supabase internal URL parser
          // (detectSessionInUrl: true already handles it). Let's still try
          // getSession() to flush URL processing:
          try {
            await supabase.auth.getSession();
          } catch (_e) {
            // ignore
          }
        }
      } catch (err) {
        console.error("[RecoveryGuard] Recovery session setup exception:", err);
      } finally {
        // Always clean the URL so tokens never linger in address bar.
        // Preserve the same origin + path, remove ALL search/hash params.
        try {
          const cleaned = `${window.location.origin}${window.location.pathname}`;
          window.history.replaceState({}, document.title, cleaned);
        } catch (_e) {
          // ignore
        }

        console.log("[RecoveryGuard] Redirecting to /update-password");
        window.location.replace("/update-password");
      }
    };

    // Kick off immediately (no setTimeout, no waiting on other flows)
    handleRecovery();
  }, []);

  // If recovery detected, the effect will call replace() and navigate
  // synchronously-ish. Until then render nothing (prevents the homepage
  // auth flow / dashboard loading from racing with us).
  if (typeof window !== "undefined" && redirectStarted.current) {
    return null;
  }

  // Normal non-recovery visit: render existing homepage unchanged
  return <>{children}</>;
}
