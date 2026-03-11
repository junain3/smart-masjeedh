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

export function CleanAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const router = useRouter();

  // Fetch tenant context exactly once
  const fetchTenantContext = useCallback(async (userId: string): Promise<TenantContext | null> => {
    try {
      console.log("DEBUG: Fetching tenant context for user:", userId);
      
      // Check user_roles first - simple direct query
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("masjid_id, role, permissions")
        .eq("auth_user_id", userId)
        .single();

      if (roleError) {
        console.log("DEBUG: No user_roles found, checking if user has masjid");
        
        // Check if user created a masjid but doesn't have user_roles yet
        const { data: masjidData, error: masjidError } = await supabase
          .from("masjids")
          .select("id")
          .eq("created_by", userId)
          .single();

        if (masjidError || !masjidData) {
          console.log("DEBUG: No masjid found, truly new user - requires onboarding");
          return null;
        }

        // User has masjid but no user_roles - create missing user_roles
        console.log("DEBUG: User has masjid but no user_roles, creating user_roles");
        const { data: userData } = await supabase.auth.getUser();
        
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert({
            masjid_id: masjidData.id,
            user_id: userId,
            auth_user_id: userId,
            email: userData.user?.email,
            role: "super_admin",
            permissions: {
              accounts: true,
              events: true,
              members: true,
              subscriptions_collect: true,
              subscriptions_approve: true,
              staff_management: true,
              reports: true,
              settings: true
            },
            verified: true
          })
          .select()
          .single();

        if (insertError) {
          console.error("DEBUG: Failed to create user_roles:", insertError);
          return null;
        }

        // Return the created context
        return {
          masjidId: masjidData.id,
          userId,
          email: userData.user?.email,
          role: "super_admin",
          permissions: {
            accounts: true,
            events: true,
            members: true,
            subscriptions_collect: true,
            subscriptions_approve: true,
            staff_management: true,
            reports: true,
            settings: true
          }
        };
      }

      // User has user_roles - return existing context
      console.log("DEBUG: Found existing user_roles");
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
          console.log("DEBUG: Tenant context loaded:", context);
          setTenantContext(context);
          setRequiresOnboarding(false);
          
          // Redirect to dashboard if not already there
          if (window.location.pathname === "/") {
            router.push("/dashboard");
          }
        } else {
          console.log("DEBUG: Requires onboarding");
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

export const useCleanAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useCleanAuth must be used within a CleanAuthProvider");
  }
  return context;
};
