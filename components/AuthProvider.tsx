"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";

type AuthContextType = {
  user: any;
  loading: boolean;
  tenantContext: any;
  setTenantContext: (context: any) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tenantContext, setTenantContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [tenantPromise, setTenantPromise] = useState<any>(null);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTenantContext(null);
    setTenantPromise(null);
  };

  // Cached tenant context fetcher
  const fetchTenantContext = async () => {
    // Return existing promise if already loading
    if (tenantPromise) {
      return tenantPromise;
    }

    // Return cached context if available
    if (tenantContext) {
      return tenantContext;
    }

    // Create new promise
    const promise = (async () => {
      setTenantLoading(true);
      try {
        console.log("DEBUG: Fetching tenant context...");
        const ctx = await getTenantContext();
        console.log("DEBUG: Tenant context result:", ctx);
        setTenantContext(ctx);
        return ctx;
      } catch (error) {
        console.error("Error fetching tenant context:", error);
        setTenantContext(null);
        return null;
      } finally {
        setTenantLoading(false);
        setTenantPromise(null);
      }
    })();

    setTenantPromise(promise);
    return promise;
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log("DEBUG: Getting initial session...");
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log("DEBUG: Initial session result:", { 
          hasSession: !!session, 
          userEmail: session?.user?.email,
          error: error?.message 
        });
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log("DEBUG: User found, getting tenant context...");
          await fetchTenantContext();
        } else {
          console.log("DEBUG: No user session found");
          setTenantContext(null);
        }
      } catch (error) {
        console.error("Error getting initial session:", error);
        setUser(null);
        setTenantContext(null);
      } finally {
        console.log("DEBUG: Setting loading to false");
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("DEBUG: Auth state changed:", event, session?.user?.email);
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          try {
            console.log("DEBUG: User logged in, getting tenant context...");
            await fetchTenantContext();
          } catch (error) {
            console.error("Error getting tenant context:", error);
            setTenantContext(null);
          }
        } else {
          console.log("DEBUG: User logged out");
          setTenantContext(null);
          setTenantPromise(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Combined loading state
  const isLoading = loading || tenantLoading;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: isLoading,
        tenantContext,
        setTenantContext,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
