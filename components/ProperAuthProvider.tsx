"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
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
  requiresOnboarding: boolean;
  refreshTenantContext: () => Promise<void>;
  authError: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function ProperAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  // Check if user has existing masjid setup
  const checkUserMasjidSetup = useCallback(async (userId: string): Promise<boolean> => {
    try {
      console.log("DEBUG: Checking masjid setup for user:", userId);
      
      // First try with auth_user_id column
      let roleData, roleError;
      
      try {
        const result = await supabase
          .from("user_roles")
          .select("masjid_id")
          .eq("auth_user_id", userId)
          .single();
        
        roleData = result.data;
        roleError = result.error;
        
        console.log("DEBUG: User roles check with auth_user_id:", { data: roleData, error: roleError?.message });
      } catch (err) {
        console.log("DEBUG: auth_user_id query failed, trying user_id");
        roleError = err;
      }

      // If auth_user_id failed, try user_id
      if (roleError || !roleData) {
        try {
          const result = await supabase
            .from("user_roles")
            .select("masjid_id")
            .eq("user_id", userId)
            .single();
          
          roleData = result.data;
          roleError = result.error;
          
          console.log("DEBUG: User roles check with user_id:", { data: roleData, error: roleError?.message });
        } catch (err) {
          console.log("DEBUG: user_id query also failed");
          roleError = err;
        }
      }

      // If both queries failed, this is a system error
      if (roleError) {
        console.error("DEBUG: Both user_roles queries failed:", roleError);
        throw new Error(`Database query failed: ${roleError.message}`);
      }

      if (!roleData) {
        console.log("DEBUG: No user_roles found - user needs onboarding");
        return false;
      }

      // Check if masjid exists
      const { data: masjidData, error: masjidError } = await supabase
        .from("masjids")
        .select("id")
        .eq("id", roleData.masjid_id)
        .single();

      console.log("DEBUG: Masjid check:", { data: masjidData, error: masjidError?.message });

      if (masjidError || !masjidData) {
        console.log("DEBUG: Masjid not found - user needs onboarding");
        return false;
      }

      console.log("DEBUG: User has complete masjid setup");
      return true;

    } catch (error) {
      console.error("DEBUG: Error checking masjid setup:", error);
      // Re-throw to let caller handle as system error
      throw error;
    }
  }, []);

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
        console.log("DEBUG: Tenant context refreshed, going to dashboard");
        router.push("/dashboard");
      }
    }
  }, [user, loadTenantContext, router]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("DEBUG: Initializing auth...");
        
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("DEBUG: No session found");
          setLoading(false);
          return;
        }

        console.log("DEBUG: User authenticated:", session.user.email);
        setUser(session.user);

        // Check if user has complete masjid setup
        const hasSetup = await checkUserMasjidSetup(session.user.id);
        
        if (hasSetup) {
          console.log("DEBUG: User has setup - loading tenant context");
          const context = await loadTenantContext(session.user.id);
          if (context) {
            setTenantContext(context);
            setRequiresOnboarding(false);
            console.log("DEBUG: Going to dashboard");
            router.push("/dashboard");
          }
        } else {
          console.log("DEBUG: User needs onboarding");
          setRequiresOnboarding(true);
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
          
          // Check if user has complete setup
          const hasSetup = await checkUserMasjidSetup(session.user.id);
          
          if (hasSetup) {
            console.log("DEBUG: User has setup - loading context");
            const context = await loadTenantContext(session.user.id);
            if (context) {
              setTenantContext(context);
              setRequiresOnboarding(false);
              console.log("DEBUG: Going to dashboard");
              router.push("/dashboard");
            }
          } else {
            console.log("DEBUG: User needs onboarding");
            setRequiresOnboarding(true);
          }
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setTenantContext(null);
          setRequiresOnboarding(false);
          router.push("/");
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [router, checkUserMasjidSetup, loadTenantContext]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTenantContext(null);
    setRequiresOnboarding(false);
    router.push("/");
  };

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

export const useProperAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useProperAuth must be used within a ProperAuthProvider");
  }
  return context;
};
