"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      try {
        console.log("🔐 SESSION HOOK: Getting session...");
        
        // Get session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        console.log("🔐 SESSION HOOK - Session Data:", {
          session: sessionData.session,
          error: sessionError,
          hasSession: !!sessionData.session
        });

        if (sessionError) {
          console.error("🔐 SESSION HOOK - Session Error:", sessionError);
          throw sessionError;
        }

        setSession(sessionData.session);

        if (sessionData.session) {
          // Get user details
          const { data: userData, error: userError } = await supabase.auth.getUser();
          
          console.log("🔐 SESSION HOOK - User Data:", {
            user: userData.user,
            error: userError,
            hasUser: !!userData.user
          });

          if (userError) {
            console.error("🔐 SESSION HOOK - User Error:", userError);
            throw userError;
          }

          setUser(userData.user);
        }
      } catch (err) {
        console.error("🔐 SESSION HOOK: Error getting session:", err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("🔐 SESSION HOOK: Auth state changed", {
          event,
          hasSession: !!session,
          userId: session?.user?.id
        });

        setSession(session);
        setUser(session?.user || null);
        setError(null);
        setLoading(false);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user,
    loading,
    error,
    isAuthenticated: !!user,
    signOut: async () => {
      await supabase.auth.signOut();
    }
  };
}
