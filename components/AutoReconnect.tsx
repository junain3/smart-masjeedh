"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { App } from "@capacitor/app";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Recovery lock to prevent multiple simultaneous recovery attempts
let recoveryLock = false;
let lastRecoveryTime = 0;
const RECOVERY_DEBOUNCE_MS = 2000; // Minimum 2 seconds between recovery attempts

export function AutoReconnect() {
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const attemptRecovery = async (source: string) => {
      const now = Date.now();
      
      // Debounce: Don't recover if we just recovered recently
      if (now - lastRecoveryTime < RECOVERY_DEBOUNCE_MS) {
        console.log(`[AutoReconnect] Skipped recovery from ${source} - too soon since last recovery`);
        return;
      }

      // Lock: Prevent multiple simultaneous recovery attempts
      if (recoveryLock) {
        console.log(`[AutoReconnect] Skipped recovery from ${source} - recovery already in progress`);
        return;
      }

      recoveryLock = true;
      lastRecoveryTime = now;
      
      console.log(`[AutoReconnect] Starting recovery from ${source}`);

      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        
        // Check current session first
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Session exists, try to refresh it
          const { error } = await supabase.auth.refreshSession();
          if (error) {
            console.error(`[AutoReconnect] Session refresh failed from ${source}:`, error);
          } else {
            console.log(`[AutoReconnect] Session refreshed successfully from ${source}`);
          }
        } else {
          console.log(`[AutoReconnect] No active session from ${source}`);
        }
      } catch (error) {
        console.error(`[AutoReconnect] Recovery failed from ${source}:`, error);
      } finally {
        // Release lock after a delay to prevent rapid retries
        if (recoveryTimeoutRef.current) {
          clearTimeout(recoveryTimeoutRef.current);
        }
        recoveryTimeoutRef.current = setTimeout(() => {
          recoveryLock = false;
          recoveryTimeoutRef.current = null;
        }, RECOVERY_DEBOUNCE_MS);
      }
    };

    // Visibility change handler (app comes to foreground)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        attemptRecovery("visibilitychange");
      }
    };

    // Network online handler
    const handleOnline = () => {
      attemptRecovery("online");
    };

    // Window focus handler (browser tab focus)
    const handleFocus = () => {
      attemptRecovery("focus");
    };

    // Capacitor App state change handler
    const handleAppStateChange = (state: { isActive: boolean }) => {
      if (state.isActive) {
        attemptRecovery("capacitor-app-state");
      }
    };

    // Add event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);

    // Add Capacitor listener (only available in Capacitor environment)
    App.addListener("appStateChange", handleAppStateChange).catch((err) => {
      // Capacitor not available (running in web browser)
      console.log("[AutoReconnect] Capacitor App listener not available (web mode):", err.message);
    });

    // Cleanup function
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
      
      // Remove Capacitor listener
      App.removeAllListeners().catch((err) => {
        console.log("[AutoReconnect] Error removing Capacitor listeners:", err);
      });

      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, []);

  return null;
}
