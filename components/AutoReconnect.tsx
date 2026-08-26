"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { App } from "@capacitor/app";

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
        // Force immediate session check using shared client
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error(`[AutoReconnect] Session check failed from ${source}:`, sessionError);
        }
        
        if (session) {
          console.log(`[AutoReconnect] Session found for user:`, session.user.email);
          
          // Refresh the session to ensure it's valid
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error(`[AutoReconnect] Session refresh failed from ${source}:`, refreshError);
          } else {
            console.log(`[AutoReconnect] Session refreshed successfully from ${source}`);
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
