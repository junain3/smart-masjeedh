"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { User, Session } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export function useAuthSession() {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    loading: true,
    error: null,
    isAuthenticated: false,
  });

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const getSession = async () => {
      try {
        console.log("🔐 SESSION HOOK: Getting session...");
        
        // Set timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          if (mounted && state.loading) {
            console.log("🔐 SESSION HOOK: Timeout reached, setting loading to false");
            setState(prev => ({ ...prev, loading: false, error: "Session timeout" }));
          }
        }, 5000); // 5 second timeout
        
        // Get session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        console.log("🔐 SESSION HOOK - Session Data:", {
          session: sessionData.session,
          error: sessionError,
          hasSession: !!sessionData.session
        });

        if (!mounted) return;

        if (sessionError) {
          console.error("🔐 SESSION HOOK - Session Error:", sessionError);
          setState(prev => ({
            ...prev,
            loading: false,
            error: sessionError.message,
            session: null,
            user: null,
            isAuthenticated: false,
          }));
          return;
        }

        setState(prev => ({
          ...prev,
          session: sessionData.session,
        }));

        if (sessionData.session) {
          // Get user details
          const { data: userData, error: userError } = await supabase.auth.getUser();
          
          console.log("🔐 SESSION HOOK - User Data:", {
            user: userData.user,
            error: userError,
            hasUser: !!userData.user
          });

          if (!mounted) return;

          if (userError) {
            console.error("🔐 SESSION HOOK - User Error:", userError);
            setState(prev => ({
              ...prev,
              loading: false,
              error: userError.message,
              user: null,
              isAuthenticated: false,
            }));
            return;
          }

          setState(prev => ({
            ...prev,
            user: userData.user,
            loading: false,
            error: null,
            isAuthenticated: !!userData.user,
          }));
        } else {
          setState(prev => ({
            ...prev,
            loading: false,
            user: null,
            isAuthenticated: false,
          }));
        }
      } catch (error) {
        console.error("🔐 SESSION HOOK: Error getting session:", error);
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : "Unknown error",
            session: null,
            user: null,
            isAuthenticated: false,
          }));
        }
      } finally {
        if (mounted) {
          clearTimeout(timeoutId);
        }
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

        if (!mounted) return;

        if (event === 'SIGNED_OUT' || !session) {
          console.log("🔐 SESSION HOOK: User signed out");
          setState({
            session: null,
            user: null,
            loading: false,
            error: null,
            isAuthenticated: false,
          });
        } else if (event === 'SIGNED_IN' && session) {
          console.log("🔐 SESSION HOOK: User signed in");
          setState({
            session: session,
            user: session.user,
            loading: false,
            error: null,
            isAuthenticated: true,
          });
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Add signOut function
  const signOut = async () => {
    try {
      console.log("🔐 SESSION HOOK: Signing out...");
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("🔐 SESSION HOOK: Sign out error:", error);
        throw error;
      }
      console.log("🔐 SESSION HOOK: Signed out successfully");
    } catch (error) {
      console.error("🔐 SESSION HOOK: Error signing out:", error);
      throw error;
    }
  };

  return {
    ...state,
    signOut,
  };
}
