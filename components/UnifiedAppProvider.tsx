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

  // --- Resume Tick for Session Recovery ---
  const [resumeTick, setResumeTick] = useState(0);

  // --- Combined Loading State ---
  const loading = authLoading || tenantLoading;

  // --- Timeout Wrapper Helper ---
  const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  }, []);

  // --- Core Methods ---

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
    try {
      // Load ALL matching rows from user_roles for current user (multi-masjid support)
      // Check both auth_user_id and user_id for compatibility with different table structures
      let roleData: any[] | null = null;
      let roleError: any = null;

      // Try auth_user_id first
      const { data: authData, error: authError } = await supabase
        .from("user_roles")
        .select("masjid_id, role, permissions")
        .eq("auth_user_id", userId);

      if (!authError && authData && authData.length > 0) {
        roleData = authData;
      } else {
        // Fall back to user_id if auth_user_id didn't find anything
        const { data: userIdData, error: userIdError } = await supabase
          .from("user_roles")
          .select("masjid_id, role, permissions")
          .eq("user_id", userId);
        roleData = userIdData;
        roleError = userIdError;
      }

      if (roleError && roleError.code !== "PGRST116") {
        console.error("Error loading tenant context:", roleError);
        return;
      }

      if (roleData && roleData.length > 0) {
        // Set available masjids for future multi-masjid support
        setAvailableMasjids(roleData);

        // Keep tenantContext set to first row for backward compatibility
        const firstRole = roleData[0];
        const { data: userData } = await supabase.auth.getUser();
        const newTenantContext: TenantContext = {
          masjidId: firstRole.masjid_id,
          userId,
          email: userData.user?.email || null,
          role: (firstRole.role || "staff") as any,
          permissions: firstRole.permissions || {},
        };
        setTenantContext(newTenantContext);
        setRequiresOnboarding(false);
      } else {
        // No roles found
        setAvailableMasjids([]);
        setTenantContext(null);
        setRequiresOnboarding(true);
      }
    } catch (error) {
      console.error("[loadTenantContext] Error loading tenant context:", error);
      setAvailableMasjids([]);
      setTenantContext(null);
      setRequiresOnboarding(true);
    }
  }, []);

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
      const { data: { session: recoveredSession } } = await withTimeout(
        supabase.auth.getSession(),
        15000,
        "supabase.auth.getSession() in recoverSession"
      );

      if (recoveredSession?.user) {
        console.log("Recovering session...");
        setUser(recoveredSession.user);
        await withTimeout(
          loadTenantContext(recoveredSession.user.id),
          15000,
          "loadTenantContext() in recoverSession"
        );
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
  }, [loadTenantContext, withTimeout]);

  // --- Auth Effect ---
  useEffect(() => {
    // Prevent duplicate initializations (fixes Strict Mode double-run)
    if (initializationLockRef.current) return;
    initializationLockRef.current = true;

    let mounted = true;

    const initializeAuth = async () => {
      setAuthLoading(true);
      try {
        const { data: { session: initialSession }, error } = await withTimeout(
          supabase.auth.getSession(),
          15000,
          "supabase.auth.getSession()"
        );

        if (!mounted) return;

        if (error) {
          console.error("[UnifiedAppProvider] Initial session error:", error);
          setSession(null);
          setUser(null);
          setAuthError(error.message);
          return;
        }

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await withTimeout(
            loadTenantContext(initialSession.user.id),
            15000,
            "loadTenantContext() in initializeAuth"
          );
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT" || !newSession) {
          setSession(null);
          setUser(null);
          setTenantContext(null);
          setAvailableMasjids([]);
          setRequiresOnboarding(false);
          tenantPromiseRef.current = null;
          lastFetchedMasjidIdRef.current = null;
          return;
        }

        setSession(newSession);
        setUser(newSession.user);
        
        if (event === "SIGNED_IN") {
          await withTimeout(
            loadTenantContext(newSession.user.id),
            15000,
            "loadTenantContext() in onAuthStateChange"
          );
        }
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadTenantContext, withTimeout]);

  // --- Recovery Session on Focus/Visibility ---
  useEffect(() => {
    const handleFocus = () => {
      void recoverSession();
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      void recoverSession();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [recoverSession]);

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
