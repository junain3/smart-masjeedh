"use client";

import { createContext, useContext, useState } from "react";

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

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [tenantContext, setTenantContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const signOut = async () => {
    setUser(null);
    setTenantContext(null);
    setRequiresOnboarding(false);
    setAuthError(null);
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    
    // Simulate login process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Set mock user and tenant context
    const mockUser = {
      id: "a0d80f9e-11ba-436b-9825-1aca3830a7fc",
      email: email || "mohammedjunain@gmail.com",
      created_at: new Date().toISOString(),
      masjid_id: "176b1412-2eae-46f4-8cd5-4cb5ad4f285f"
    };
    
    const mockTenantContext = {
      masjidId: "176b1412-2eae-46f4-8cd5-4cb5ad4f285f",
      userId: "a0d80f9e-11ba-436b-9825-1aca3830a7fc",
      email: email || "mohammedjunain@gmail.com",
      role: "super_admin" as const,
      permissions: {
        manage_users: true,
        manage_events: true,
        manage_families: true,
        manage_members: true,
        manage_finances: true,
        manage_settings: true,
      }
    };
    
    setUser(mockUser);
    setTenantContext(mockTenantContext);
    setRequiresOnboarding(false);
    setAuthError(null);
    setLoading(false);
  };

  const refreshTenantContext = async () => {
    // Mock refresh - no actual change
  };

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

export const useMockAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useMockAuth must be used within a MockAuthProvider");
  }
  return context;
};
