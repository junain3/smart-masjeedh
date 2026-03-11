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
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SimpleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const router = useRouter();

  // Simple tenant context fetch
  const fetchTenantContext = useCallback(async (userId: string): Promise<TenantContext | null> => {
    try {
      console.log("DEBUG: Fetching tenant context for user:", userId);
      
      // Simple query: check if user has user_roles
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("masjid_id, role, permissions")
        .eq("auth_user_id", userId)
        .single();

      console.log("DEBUG: user_roles query:", { data: roleData, error: roleError?.message });

      if (roleError || !roleData) {
        console.log("DEBUG: No user_roles found - new user");
        return null;
      }

      // User has user_roles - return context
      console.log("DEBUG: Found user_roles - returning context");
      return {
        masjidId: roleData.masjid_id,
        userId,
        email: (await supabase.auth.getUser()).data.user?.email,
        role: roleData.role || "staff",
        permissions: roleData.permissions || {}
      };

    } catch (error) {
      console.error("DEBUG: Error fetching tenant context:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log("DEBUG: No session found");
          setLoading(false);
          return;
        }

        console.log("DEBUG: User authenticated:", session.user.email);
        setUser(session.user);

        // Fetch tenant context
        const context = await fetchTenantContext(session.user.id);
        
        if (context) {
          console.log("DEBUG: Tenant context found - redirect to dashboard");
          setTenantContext(context);
          setRequiresOnboarding(false);
          router.push("/dashboard");
        } else {
          console.log("DEBUG: No tenant context - show onboarding");
          setRequiresOnboarding(true);
        }

      } catch (error) {
        console.error("DEBUG: Auth initialization error:", error);
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
          const context = await fetchTenantContext(session.user.id);
          
          if (context) {
            setTenantContext(context);
            setRequiresOnboarding(false);
            router.push("/dashboard");
          } else {
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
  }, [router, fetchTenantContext]);

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useSimpleAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useSimpleAuth must be used within a SimpleAuthProvider");
  }
  return context;
};
