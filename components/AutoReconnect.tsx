"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { App } from "@capacitor/app";

// Recovery lock to prevent multiple simultaneous recovery attempts
let recoveryLock = false;
let lastRecoveryTime = 0;
const RECOVERY_DEBOUNCE_MS = 2000; // Minimum 2 seconds between recovery attempts
const RECOVERY_TIMEOUT_MS = 10000; // Maximum 10 seconds for recovery operation

export function AutoReconnect() {
  const recoveryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lockReleaseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      // Safety timeout to ensure lock is released even if operation hangs
      lockReleaseTimeoutRef.current = setTimeout(() => {
        console.warn(`[AutoReconnect] Recovery timeout from ${source} - forcing lock release`);
        recoveryLock = false;
        lockReleaseTimeoutRef.current = null;
      }, RECOVERY_TIMEOUT_MS);

      try {
        // Timeout protection for session check
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Session check timeout")), RECOVERY_TIMEOUT_MS)
        );
        
        const { data: { session }, error: sessionError } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as any;
        
        if (sessionError) {
          console.error(`[AutoReconnect] Session check failed from ${source}:`, sessionError);
        }
        
        if (session) {
          console.log(`[AutoReconnect] Session found for user:`, session.user.email);
          
          // Refresh the session to ensure it's valid (with timeout protection)
          try {
            const refreshPromise = supabase.auth.refreshSession();
            const refreshTimeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error("Session refresh timeout")), RECOVERY_TIMEOUT_MS)
            );
            
            const { error: refreshError } = await Promise.race([
              refreshPromise,
              refreshTimeoutPromise
            ]) as any;
            
            if (refreshError) {
              console.error(`[AutoReconnect] Session refresh failed from ${source}:`, refreshError);
            } else {
              console.log(`[AutoReconnect] Session refreshed successfully from ${source}`);
            }
          } catch (refreshError) {
            console.error(`[AutoReconnect] Session refresh error from ${source}:`, refreshError);
          }
          
          // Force re-establish realtime connection
          try {
            // Close existing channels to prevent duplicates
            const channels = supabase.getChannels();
            channels.forEach(channel => {
              console.log(`[AutoReconnect] Closing channel:`, channel.topic);
              supabase.removeChannel(channel);
            });
            
            // Reconnect realtime
            console.log(`[AutoReconnect] Reconnecting realtime from ${source}`);
            // The realtime connection will be automatically re-established when channels are subscribed
          } catch (realtimeError) {
            console.error(`[AutoReconnect] Realtime reconnection failed from ${source}:`, realtimeError);
          }
        } else {
          console.log(`[AutoReconnect] No active session from ${source} - user may need to login`);
        }
      } catch (error) {
        console.error(`[AutoReconnect] Recovery failed from ${source}:`, error);
      } finally {
        // Clear safety timeout
        if (lockReleaseTimeoutRef.current) {
          clearTimeout(lockReleaseTimeoutRef.current);
          lockReleaseTimeoutRef.current = null;
        }
        
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

      // Clear all timeouts
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
      if (lockReleaseTimeoutRef.current) {
        clearTimeout(lockReleaseTimeoutRef.current);
      }
      
      // Release lock on unmount
      recoveryLock = false;
    };
  }, []);

  return null;
}
