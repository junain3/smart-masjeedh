"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type TenantContext = {
  masjidId: string;
  userId: string;
  email: string | null;
  role: "super_admin" | "co_admin" | "staff" | "editor";
  permissions: Record<string, boolean>;
};

type AuthContextType = {
  user: any;
  loading: boolean;
  tenantContext: TenantContext | null;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  requiresOnboarding: boolean;
  refreshTenantContext: () => Promise<void>;
  authError: string | null;
  availableMasjids: Array<{
    masjid_id: string;
    role: string;
    permissions: Record<string, boolean>;
  }>;
  resumeTick: number;
  authDebug: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authDebug, setAuthDebug] = useState("");
  const [availableMasjids, setAvailableMasjids] = useState<Array<{
    masjid_id: string;
    role: string;
    permissions: Record<string, boolean>;
  }>>([]);
  const recoveryLockRef = useRef(false);
  const [resumeTick, setResumeTick] = useState(0);

  const loadTenantContext = async (userId: string) => {
    try {
      // Load ALL matching rows from user_roles for current user (multi-masjid support)
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("masjid_id, role, permissions")
        .eq("user_id", userId);

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
          role: firstRole.role || "staff",
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
      console.error("Error loading tenant context:", error);
      setAvailableMasjids([]);
      setTenantContext(null);
      setRequiresOnboarding(true);
    }
  };

  const refreshTenantContext = async () => {
    if (user?.id) {
      await loadTenantContext(user.id);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setTenantContext(null);
      setAvailableMasjids([]);
      setRequiresOnboarding(false);
      setAuthError(null);
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthError(error.message);
        setLoading(false);
        throw error;
      }

      if (data.user) {
        setUser(data.user);
        // Wait for loadTenantContext to complete before setting loading to false
        await loadTenantContext(data.user.id);
      }

      setLoading(false);
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Login failed");
      setLoading(false);
      setAuthDebug(prev => prev + `\nsignIn error: ${error.message}`);
      throw error;
    }
  };

  // Timeout wrapper helper
  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
      ),
    ]);
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setAuthDebug(prev => prev + "\ninitializeAuth start");
        
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          "supabase.auth.getSession()"
        );
        
        setAuthDebug(prev => prev + "\ngot session");
        
        if (error) {
          console.error("Error getting session:", error);
          setAuthDebug(prev => prev + `\nsession error: ${error.message}`);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          setAuthDebug(prev => prev + "\nloading tenant context...");
          // Wait for loadTenantContext to complete before setting loading to false
          await withTimeout(
            loadTenantContext(session.user.id),
            5000,
            "loadTenantContext()"
          );
          setAuthDebug(prev => prev + "\ntenant context loaded");
          setLoading(false);
        } else {
          setUser(null);
          setTenantContext(null);
          setAvailableMasjids([]);
          setRequiresOnboarding(false);
          setLoading(false);
        }
      } catch (error: any) {
        console.error("Initialize auth error:", error);
        setAuthDebug(prev => prev + `\ninitializeAuth error: ${error.message}`);
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAuthDebug(prev => prev + "\nonAuthStateChange start");
        if (session?.user) {
          setUser(session.user);
          // Wait for loadTenantContext to complete before setting loading to false
          await loadTenantContext(session.user.id);
          setLoading(false);
          setAuthDebug(prev => prev + "\nonAuthStateChange success");
        } else {
          setUser(null);
          setTenantContext(null);
          setAvailableMasjids([]);
          setRequiresOnboarding(false);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Recovery: Detect when app regains focus or becomes visible after idle session
  const recoverSession = async () => {
    if (recoveryLockRef.current) return;
    recoveryLockRef.current = true;

    try {
      setAuthDebug(prev => prev + "\nrecoverSession start");
      
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        5000,
        "supabase.auth.getSession() in recoverSession"
      );
      
      setAuthDebug(prev => prev + "\nrecoverSession got session");

        if (session?.user) {
          console.log("Recovering session...");
          setUser(session.user);
          setAuthDebug(prev => prev + "\nrecoverSession loading tenant context...");
          await withTimeout(
            loadTenantContext(session.user.id),
            5000,
            "loadTenantContext() in recoverSession"
          );
          setAuthDebug(prev => prev + "\nrecoverSession tenant context loaded");
          setLoading(false);
          setResumeTick(prev => prev + 1);
        } else {
          setUser(null);
          setTenantContext(null);
          setAvailableMasjids([]);
          setRequiresOnboarding(false);
          setLoading(false);
        }
    } catch (error: any) {
      console.error("Recover session error:", error);
      setAuthDebug(prev => prev + `\nrecoverSession error: ${error.message}`);
      setLoading(false);
    } finally {
      recoveryLockRef.current = false;
    }
  };

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
  }, []);


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        tenantContext,
        signOut,
        signIn,
        requiresOnboarding,
        refreshTenantContext,
        authError,
        availableMasjids,
        resumeTick,
        authDebug,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useSupabaseAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useSupabaseAuth must be used within a SupabaseAuthProvider");
  }
  return context;
};
