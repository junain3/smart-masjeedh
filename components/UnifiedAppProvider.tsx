"use client";

import { createContext, useContext, useEffect, useState, useMemo, useRef, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import type { AuthState, TenantState, TenantContext } from "@/lib/types";

// --- Extended Context Type (Full Backward Compatibility with Original SupabaseAuthProvider!) ---
type UnifiedAppContextType = AuthState &
  TenantState & {
    // Original Auth Provider Fields (for backward compatibility)
    loading: boolean; // combined auth + tenant loading
    requiresOnboarding: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    authError: string | null;
    availableMasjids: Array<{
      masjid_id: string;
      role: string;
      permissions: Record<string, boolean>;
    }>;
    resumeTick: number;

    // New/Existing Fields
    signOut: () => Promise<void>;
    refreshTenantContext: () => Promise<void>;
    isReady: boolean; // True when both auth and tenant are resolved
  };

const UnifiedAppContext = createContext<UnifiedAppContextType | undefined>(
  undefined
);

// --- Provider Implementation ---
export function UnifiedAppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // --- Auth State ---
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // --- Tenant State ---
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantError, setTenantError] = useState<string | null>(null);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const [isUserDeleted, setIsUserDeleted] = useState(false);
  const [availableMasjids, setAvailableMasjids] = useState<Array<{
    masjid_id: string;
    role: string;
    permissions: Record<string, boolean>;
  }>>([]);

  // --- Refs for Safety ---
  const tenantPromiseRef = useRef<Promise<TenantContext | null> | null>(null);
  const lastFetchedMasjidIdRef = useRef<string | null>(null);
  const initializationLockRef = useRef(false);
  const recoveryLockRef = useRef(false);
  const forceLogoutInProgressRef = useRef(false);
  const accessCheckInProgressRef = useRef(false);

  // --- Resume Tick for Session Recovery ---
  const [resumeTick, setResumeTick] = useState(0);

  // --- Combined Loading State ---
  const loading = authLoading || tenantLoading;

  // --- Safety Fallback: Force-release loading state after 15 seconds ---
  // This is a last-resort fallback if operations hang indefinitely.
  // Normal operations should complete much faster:
  // - getSession: typically < 1 second
  // - loadTenantContext: has 10-second timeout
  // - This 15-second fallback ensures we don't hang forever
  useEffect(() => {
    let safetyTimeout: NodeJS.Timeout;

    if (authLoading) {
      console.log("[UnifiedAppProvider] authLoading is true, starting 15s safety fallback timer");
      safetyTimeout = setTimeout(() => {
        console.warn("[UnifiedAppProvider] Loading state timeout (15s) - forcing release to prevent indefinite hang");
        setAuthLoading(false);
      }, 15000);
    }

    return () => {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
      }
    };
  }, [authLoading]);


  // --- Core Methods ---

  const forceLogout = useCallback(async (
    reason: string = 'deleted',
    metadata?: { deleted_by?: string; deleted_reason?: string; deleted_at?: string }
  ) => {
    // Prevent multiple concurrent force logouts
    if (forceLogoutInProgressRef.current) {
      console.log('[UnifiedAppProvider] Force logout already in progress, skipping');
      return;
    }

    forceLogoutInProgressRef.current = true;
    console.log('[UnifiedAppProvider] Force logout initiated:', reason, metadata);

    try {
      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear all local state
      setSession(null);
      setUser(null);
      setTenantContext(null);
      setAvailableMasjids([]);
      setRequiresOnboarding(false);
      setIsUserDeleted(true);
      setTenantError(reason === 'deleted'
        ? "Your account has been deleted. Your data is retained for a 3-month grace period. Contact support for restoration."
        : "Your access has been revoked. Please contact support."
      );

      // Redirect to login page with reason and metadata
      if (typeof window !== 'undefined') {
        const loginUrl = new URL('/login', window.location.origin);
        loginUrl.searchParams.set('reason', reason);
        if (metadata?.deleted_by) loginUrl.searchParams.set('deleted_by', metadata.deleted_by);
        if (metadata?.deleted_reason) loginUrl.searchParams.set('deleted_reason', metadata.deleted_reason);
        if (metadata?.deleted_at) loginUrl.searchParams.set('deleted_at', metadata.deleted_at);
        window.location.href = loginUrl.toString();
      }
    } catch (error) {
      console.error('[UnifiedAppProvider] Force logout error:', error);
    } finally {
      forceLogoutInProgressRef.current = false;
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message);
        setAuthLoading(false);
        throw error;
      }

      if (data.user) {
        setUser(data.user);
      }

      setAuthLoading(false);
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Login failed");
      setAuthLoading(false);
      throw error;
    }
  }, []);

  // --- Load Tenant Context with Full Features ---
  const loadTenantContext = useCallback(async (userId: string) => {
    // Prevent loading if force logout is in progress
    if (forceLogoutInProgressRef.current) {
      console.log("[loadTenantContext] Force logout in progress, skipping tenant context load");
      return;
    }

    if (tenantLoading) {
      console.log("[loadTenantContext] Already loading, skipping");
      return;
    }

    if (isUserDeleted) {
      console.log("[loadTenantContext] User is deleted, skipping tenant context load");
      return;
    }

    console.log("[loadTenantContext] Loading for userId:", userId);
    setTenantLoading(true);
    setTenantError(null);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tenant context loading timeout")), 15000)
      );

      const loadPromise = (async () => {
        // Try the RPC function first which bypasses RLS
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_current_user_roles');

        console.log("[loadTenantContext] RPC result:", { rpcData, rpcError });
        let roleData = rpcData;

        // If RPC didn't work, try direct query with auth_user_id
        if (rpcError || !roleData || roleData.length === 0) {
          console.log("[loadTenantContext] RPC failed, trying direct query with auth_user_id:", rpcError);
          const { data: authData, error: authError } = await supabase
            .from("user_roles")
            .select("masjid_id, role, permissions, status, deleted_by, deleted_reason, deleted_at")
            .eq("auth_user_id", userId);

          console.log("[loadTenantContext] Direct query (auth_user_id) result:", { authData, authError });
          if (!authError && authData && authData.length > 0) {
            // Check if user role is deleted (only if status column exists)
            if (authData[0].status === 'deleted') {
              console.error("[UnifiedAppProvider] User role is deleted:", userId);
              await forceLogout('deleted', {
                deleted_by: authData[0].deleted_by,
                deleted_reason: authData[0].deleted_reason,
                deleted_at: authData[0].deleted_at
              });
              return;
            }
            roleData = authData;
          } else {
            // Fall back to user_id for backwards compatibility
            console.log("[loadTenantContext] auth_user_id query failed, trying user_id fallback");
            const { data: userIdData, error: userIdError } = await supabase
              .from("user_roles")
              .select("masjid_id, role, permissions, status, deleted_by, deleted_reason, deleted_at")
              .eq("user_id", userId);

            console.log("[loadTenantContext] Direct query (user_id) result:", { userIdData, userIdError });
            if (!userIdError && userIdData && userIdData.length > 0) {
              // Check if user role is deleted (only if status column exists)
              if (userIdData[0].status === 'deleted') {
                console.error("[UnifiedAppProvider] User role is deleted:", userId);
                await forceLogout('deleted', {
                  deleted_by: userIdData[0].deleted_by,
                  deleted_reason: userIdData[0].deleted_reason,
                  deleted_at: userIdData[0].deleted_at
                });
                return;
              }
              roleData = userIdData;
            }
          }
        }

        console.log("[loadTenantContext] Final roleData:", roleData);
        if (roleData && roleData.length > 0) {
          setAvailableMasjids(roleData);

          const firstRole = roleData[0];

          // Check if masjid is deleted (only if status column exists)
          try {
            const { data: masjidData, error: masjidError } = await supabase
              .from("masjids")
              .select("status, deleted_by, deleted_reason, deleted_at")
              .eq("id", firstRole.masjid_id)
              .single();

            // Only block if status column exists and is 'deleted'
            // If column doesn't exist (migration not run yet), allow access
            if (!masjidError && masjidData && masjidData.status === 'deleted') {
              console.error("[UnifiedAppProvider] Masjid is deleted:", firstRole.masjid_id);
              await forceLogout('masjid_deleted', {
                deleted_by: masjidData.deleted_by,
                deleted_reason: masjidData.deleted_reason,
                deleted_at: masjidData.deleted_at
              });
              return;
            }
          } catch (e) {
            // If status column doesn't exist, ignore and continue
            console.log("[UnifiedAppProvider] Status column check failed (migration not run yet), continuing...");
          }

          const { data: userData } = await supabase.auth.getUser();
          const newTenantContext: TenantContext = {
            masjidId: firstRole.masjid_id,
            userId,
            email: userData.user?.email || null,
            role: (firstRole.role || "staff") as any,
            permissions: firstRole.permissions || {},
          };
          setTenantContext(newTenantContext);

          console.log("[UnifiedAppProvider] Tenant context loaded:", {
            userId,
            role: newTenantContext.role,
            masjidId: newTenantContext.masjidId,
            permissions: newTenantContext.permissions,
          });

          const isSuperAdmin = firstRole.role === "super_admin";
          const hasCompletedOnboarding = firstRole.onboarding_completed === true;
          setRequiresOnboarding(!isSuperAdmin && !hasCompletedOnboarding);
        } else {
          console.error("[UnifiedAppProvider] No user_roles found for user:", userId);
          await forceLogout('no_role');
        }
      })();

      await Promise.race([loadPromise, timeoutPromise]);
    } catch (error) {
      console.error("[loadTenantContext] Error loading tenant context:", error);
      setAvailableMasjids([]);
      setTenantContext(null);
      setRequiresOnboarding(true);
      setTenantError(error instanceof Error ? error.message : "Failed to load tenant context");
    } finally {
      setTenantLoading(false);
      console.log("[loadTenantContext] tenantLoading set to false");
    }
  }, [forceLogout, isUserDeleted, tenantLoading]);

  // --- Reactively load tenant context when user exists but tenantContext is null ---
  // This handles the case where the component remounts after login redirect
  useEffect(() => {
    if (user && !tenantContext && !tenantLoading && !isUserDeleted) {
      console.log("[UnifiedAppProvider] User exists but no tenantContext, loading tenant context reactively");
      loadTenantContext(user.id);
    }
  }, [user, tenantContext, tenantLoading, isUserDeleted, loadTenantContext]);

  const fetchTenantContext = useCallback(async (options?: { force?: boolean }): Promise<TenantContext | null> => {
    if (!options?.force && tenantPromiseRef.current) {
      return tenantPromiseRef.current;
    }

    const promise = (async (): Promise<TenantContext | null> => {
      setTenantLoading(true);
      setTenantError(null);
      try {
        const ctx = await getTenantContext();

        // Extra safety: only update if the masjidId is actually different!
        if (ctx && ctx.masjidId !== lastFetchedMasjidIdRef.current) {
          lastFetchedMasjidIdRef.current = ctx.masjidId;
          setTenantContext(ctx);
        } else if (!ctx && lastFetchedMasjidIdRef.current) {
          lastFetchedMasjidIdRef.current = null;
          setTenantContext(null);
        }
        
        return ctx;
      } catch (err) {
        console.error("[UnifiedAppProvider] Tenant fetch error:", err);
        setTenantError(err instanceof Error ? err.message : "Unknown error");
        setTenantContext(null);
        lastFetchedMasjidIdRef.current = null;
        return null;
      } finally {
        setTenantLoading(false);
        tenantPromiseRef.current = null;
      }
    })();

    tenantPromiseRef.current = promise;
    return promise;
  }, []);

  const refreshTenantContext = useCallback(async () => {
    tenantPromiseRef.current = null;
    if (user?.id) {
      await loadTenantContext(user.id);
    }
  }, [loadTenantContext, user]);

  // --- Recovery Session ---
  const recoverSession = useCallback(async () => {
    if (recoveryLockRef.current) return;
    recoveryLockRef.current = true;

    try {
      // Timeout protection for session check (10 seconds)
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Session check timeout")), 10000)
      );
      
      const { data: { session: recoveredSession } } = await Promise.race([
        sessionPromise,
        timeoutPromise
      ]) as any;

      if (recoveredSession?.user) {
        console.log("Recovering session...");
        setUser(recoveredSession.user);
        try {
          await loadTenantContext(recoveredSession.user.id);
        } catch (tenantError) {
          console.error("Recover session: Failed to load tenant context:", tenantError);
          // Don't let tenant loading failure block session recovery
        }
        setAuthLoading(false);
        setResumeTick(prev => prev + 1);
      } else {
        setUser(null);
        setTenantContext(null);
        setAvailableMasjids([]);
        setRequiresOnboarding(false);
        setAuthLoading(false);
      }
    } catch (error: any) {
      console.error("Recover session error:", error);
      setAuthLoading(false);
    } finally {
      recoveryLockRef.current = false;
    }
  }, [loadTenantContext]);

  // --- Auth Effect ---
  useEffect(() => {
    // Prevent duplicate initializations (fixes Strict Mode double-run)
    if (initializationLockRef.current) return;
    initializationLockRef.current = true;

    let mounted = true;

    const initializeAuth = async () => {
      console.log("[UnifiedAppProvider] initializeAuth started");
      setAuthLoading(true);
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (!mounted) {
          // Component unmounted during session fetch, still release authLoading
          setAuthLoading(false);
          console.log("[UnifiedAppProvider] initializeAuth: authLoading set to false (unmounted)");
          return;
        }

        if (error) {
          console.error("[UnifiedAppProvider] Initial session error:", error);
          setSession(null);
          setUser(null);
          setAuthError(error.message);
          setAuthLoading(false);
          console.log("[UnifiedAppProvider] initializeAuth: authLoading set to false (error path)");
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        console.log("[UnifiedAppProvider] initializeAuth: user set to", initialSession?.user?.email || "null");

        // Release authLoading immediately after session is resolved
        // Tenant loading happens in parallel and has its own loading state
        setAuthLoading(false);
        console.log("[UnifiedAppProvider] initializeAuth: authLoading set to false (session resolved)");

        if (initialSession?.user) {
          await loadTenantContext(initialSession.user.id);
        }
      } catch (error) {
        console.error("[UnifiedAppProvider] initializeAuth unexpected error:", error);
        // Always release authLoading on error, even if unmounted
        setAuthLoading(false);
        console.log("[UnifiedAppProvider] initializeAuth: authLoading set to false (catch path)");
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("[UnifiedAppProvider] Auth event received:", event, "session:", !!newSession);
        if (!mounted) return;

        if (event === "SIGNED_OUT" || !newSession) {
          console.log("[UnifiedAppProvider] SIGNED_OUT or no session - clearing state");
          setSession(null);
          setUser(null);
          setTenantContext(null);
          setAvailableMasjids([]);
          setRequiresOnboarding(false);
          tenantPromiseRef.current = null;
          lastFetchedMasjidIdRef.current = null;
          return;
        }

        // Explicitly handle TOKEN_REFRESHED to ensure React state is synchronized
        // after AutoReconnect refreshes the session
        if (event === "TOKEN_REFRESHED") {
          console.log("[UnifiedAppProvider] TOKEN_REFRESHED received, syncing auth state");
          setSession(newSession);
          setUser(newSession.user);
          // Release authLoading immediately on successful token refresh
          setAuthLoading(false);
          console.log("[UnifiedAppProvider] TOKEN_REFRESHED: authLoading set to false");
          return;
        }

        setSession(newSession);
        setUser(newSession.user);
        console.log("[UnifiedAppProvider] User set to:", newSession.user?.email || "null");

        if (event === "SIGNED_IN") {
          await loadTenantContext(newSession.user.id);
          // Release authLoading after successful sign-in and tenant context load
          setAuthLoading(false);
          console.log("[UnifiedAppProvider] SIGNED_IN: authLoading set to false");
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadTenantContext]);

  // --- Memoize Context Value ---
  const contextValue = useMemo<UnifiedAppContextType>(() => {
    return {
      // Original Auth Provider Fields (backward compatibility)
      loading,
      requiresOnboarding,
      signIn,
      authError,
      availableMasjids,
      resumeTick,

      // New/Existing Fields
      session,
      user,
      authLoading,
      isAuthenticated: !!user,
      
      tenantContext,
      tenantLoading,
      tenantError,
      signOut,
      refreshTenantContext,
      isReady: !authLoading && !tenantLoading,
    };
  }, [
    loading,
    requiresOnboarding,
    signIn,
    authError,
    availableMasjids,
    resumeTick,
    session,
    user,
    authLoading,
    tenantContext,
    tenantLoading,
    tenantError,
    signOut,
    refreshTenantContext,
  ]);

  return (
    <UnifiedAppContext.Provider value={contextValue}>
      {children}
    </UnifiedAppContext.Provider>
  );
}

// --- Custom Hooks ---
export function useUnifiedApp() {
  const context = useContext(UnifiedAppContext);
  if (!context) {
    throw new Error("useUnifiedApp must be used within a UnifiedAppProvider");
  }
  return context;
}

// Convenience hooks for granular usage
export function useAuth() {
  const { session, user, authLoading, isAuthenticated, signOut, signIn, authError, loading, requiresOnboarding } = useUnifiedApp();
  return { session, user, authLoading, isAuthenticated, signOut, signIn, authError, loading, requiresOnboarding };
}

export function useTenant() {
  const { tenantContext, tenantLoading, tenantError, refreshTenantContext, isReady, availableMasjids, resumeTick } = useUnifiedApp();
  return {
    tenantContext,
    masjidId: tenantContext?.masjidId ?? null,
    userId: tenantContext?.userId ?? null,
    email: tenantContext?.email ?? null,
    role: tenantContext?.role ?? null,
    permissions: tenantContext?.permissions ?? null,
    tenantLoading,
    tenantError,
    refreshTenantContext,
    isReady,
    availableMasjids,
    resumeTick,
  };
}

// Legacy aliases for backward compatibility (keep all of them!)
export const useSupabaseAuth = useUnifiedApp;
export const useMockAuth = useUnifiedApp;

// Also export the provider as aliases for full backward compatibility!
export { UnifiedAppProvider as SupabaseAuthProvider };
export { UnifiedAppProvider as MockAuthProvider };
