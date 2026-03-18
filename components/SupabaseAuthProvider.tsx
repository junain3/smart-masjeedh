"use client";

import { createContext, useContext, useState, useEffect } from "react";
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
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadTenantContext = async (userId: string) => {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("masjid_id, role, permissions")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (roleError && roleError.code !== "PGRST116") {
        console.error("Error loading tenant context:", roleError);
        return;
      }

      if (roleData) {
        const { data: userData } = await supabase.auth.getUser();
        const newTenantContext: TenantContext = {
          masjidId: roleData.masjid_id,
          userId,
          email: userData.user?.email || null,
          role: roleData.role || "staff",
          permissions: roleData.permissions || {},
        };
        setTenantContext(newTenantContext);
        setRequiresOnboarding(false);
      } else {
        setTenantContext(null);
        setRequiresOnboarding(true);
      }
    } catch (error) {
      console.error("Error loading tenant context:", error);
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
        await loadTenantContext(data.user.id);
      }

      setLoading(false);
    } catch (error: any) {
      console.error("Sign in error:", error);
      setAuthError(error.message || "Login failed");
      setLoading(false);
      throw error;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting session:", error);
          setLoading(false);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await loadTenantContext(session.user.id);
        } else {
          setUser(null);
          setTenantContext(null);
          setRequiresOnboarding(false);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await loadTenantContext(session.user.id);
        } else {
          setUser(null);
          setTenantContext(null);
          setRequiresOnboarding(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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
