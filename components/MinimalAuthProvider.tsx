"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
  requiresOnboarding: boolean;
  refreshTenantContext: () => Promise<void>;
  authError: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function MinimalAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Load tenant context
  const loadTenantContext = useCallback(async (userId: string): Promise<TenantContext | null> => {
    try {
      console.log("DEBUG: Loading tenant context for user:", userId);
      
      // First try with auth_user_id column
      let roleData, roleError;
      
      try {
        const result = await supabase
          .from("user_roles")
          .select("masjid_id, role, permissions")
          .eq("auth_user_id", userId)
          .single();
        
        roleData = result.data;
        roleError = result.error;
        
        console.log("DEBUG: Tenant context with auth_user_id:", { data: roleData, error: roleError?.message });
      } catch (err) {
        console.log("DEBUG: auth_user_id query failed, trying user_id");
        roleError = err;
      }

      // If auth_user_id failed, try user_id
      if (roleError || !roleData) {
        try {
          const result = await supabase
            .from("user_roles")
            .select("masjid_id, role, permissions")
            .eq("user_id", userId)
            .single();
          
          roleData = result.data;
          roleError = result.error;
          
          console.log("DEBUG: Tenant context with user_id:", { data: roleData, error: roleError?.message });
        } catch (err) {
          console.log("DEBUG: user_id query also failed");
          roleError = err;
        }
      }

      // If both queries failed, this is a system error
      if (roleError) {
        console.error("DEBUG: Both tenant context queries failed:", roleError);
        throw new Error(`Database query failed: ${roleError.message}`);
      }

      if (!roleData) {
        console.log("DEBUG: No user_roles found");
        return null;
      }

      const context = {
        masjidId: roleData.masjid_id,
        userId,
        email: (await supabase.auth.getUser()).data.user?.email,
        role: roleData.role || "staff",
        permissions: roleData.permissions || {}
      };

      console.log("DEBUG: Tenant context loaded:", context);
      return context;

    } catch (error) {
      console.error("DEBUG: Error loading tenant context:", error);
      // Re-throw to let caller handle as system error
      throw error;
    }
  }, []);

  // Refresh tenant context (for after onboarding)
  const refreshTenantContext = useCallback(async () => {
    if (user) {
      console.log("DEBUG: Refreshing tenant context");
      const context = await loadTenantContext(user.id);
      if (context) {
        setTenantContext(context);
        setRequiresOnboarding(false);
      }
    }
  }, [user, loadTenantContext]);

  // Sign out
  const signOut = useCallback(async () => {
    console.log("DEBUG: Signing out");
    await supabase.auth.signOut();
    setUser(null);
    setTenantContext(null);
    setRequiresOnboarding(false);
    setAuthError(null);
  }, []);

  // Initialize auth
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("DEBUG: Initializing auth...");
        
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("DEBUG: Session error:", error);
          setAuthError(error.message);
          setLoading(false);
          return;
        }

        if (!session) {
          console.log("DEBUG: No session found");
          setLoading(false);
          return;
        }

        console.log("DEBUG: Session found:", session.user.email);
        setUser(session.user);

        // Load tenant context
        try {
          const context = await loadTenantContext(session.user.id);
          if (context) {
            setTenantContext(context);
            setRequiresOnboarding(false);
            console.log("DEBUG: Tenant context loaded successfully");
          } else {
            console.log("DEBUG: No tenant context found");
            setRequiresOnboarding(true);
          }
        } catch (error) {
          console.error("DEBUG: Error loading tenant context:", error);
          setAuthError(error instanceof Error ? error.message : "Failed to load tenant context");
        }

      // Handle errors in auth initialization
        } catch (error) {
          console.error("DEBUG: Auth initialization error:", error);
          setAuthError(error instanceof Error ? error.message : "Authentication failed");
        } finally {
          setLoading(false);
        }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("DEBUG: Auth state changed:", event, session?.user?.email);
        
        if (event === "SIGNED_IN" && session) {
          setUser(session.user);
          
          // Only load tenant context if not already loaded
          if (!tenantContext) {
            console.log("DEBUG: Loading tenant context on sign in");
            try {
              const context = await loadTenantContext(session.user.id);
              if (context) {
                setTenantContext(context);
                setRequiresOnboarding(false);
                console.log("DEBUG: Tenant context loaded on sign in");
              } else {
                console.log("DEBUG: No tenant context found on sign in");
                setRequiresOnboarding(true);
              }
            } catch (error) {
              console.error("DEBUG: Error loading tenant context on sign in:", error);
              setAuthError(error instanceof Error ? error.message : "Failed to load tenant context");
            }
          } else {
            console.log("DEBUG: Tenant context already loaded, skipping");
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setTenantContext(null);
          setRequiresOnboarding(false);
          setAuthError(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadTenantContext]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        tenantContext,
        signOut,
        requiresOnboarding,
        refreshTenantContext,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useMinimalAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useMinimalAuth must be used within a MinimalAuthProvider");
  }
  return context;
};
