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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setTenantContext(null);
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
          
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Tenant context timeout')), 10000);
          });
          
          const ctx = await Promise.race([
            getTenantContext(),
            timeoutPromise
          ]);
          
          console.log("DEBUG: Tenant context result:", ctx);
          setTenantContext(ctx);
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
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Tenant context timeout')), 10000);
            });
            
            const ctx = await Promise.race([
              getTenantContext(),
              timeoutPromise
            ]);
            
            console.log("DEBUG: Tenant context result:", ctx);
            setTenantContext(ctx);
          } catch (error) {
            console.error("Error getting tenant context:", error);
            setTenantContext(null);
          }
        } else {
          console.log("DEBUG: User logged out");
          setTenantContext(null);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, tenantContext, setTenantContext, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
