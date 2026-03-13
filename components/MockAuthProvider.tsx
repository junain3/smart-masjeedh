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
  requiresOnboarding: boolean;
  refreshTenantContext: () => Promise<void>;
  authError: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>({
    id: "a0d80f9e-11ba-436b-9825-1aca3830a7fc",
    email: "mohammedjunain@gmail.com",
    created_at: new Date().toISOString()
  });
  
  const [tenantContext, setTenantContext] = useState<TenantContext>({
    masjidId: "176b1412-2eae-46f4-8cd5-4cb5ad4f285f",
    userId: "a0d80f9e-11ba-436b-9825-1aca3830a7fc",
    email: "mohammedjunain@gmail.com",
    role: "super_admin",
    permissions: {
      manage_users: true,
      manage_events: true,
      manage_families: true,
      manage_members: true,
      manage_finances: true,
      manage_settings: true,
    }
  });
  
  const [loading, setLoading] = useState(false);
  const [requiresOnboarding, setRequiresOnboarding] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const signOut = async () => {
    console.log("DEBUG: Mock sign out");
    setUser(null);
    setTenantContext(null);
    setRequiresOnboarding(false);
    setAuthError(null);
  };

  const refreshTenantContext = async () => {
    console.log("DEBUG: Mock refresh tenant context");
    // Mock refresh - no actual change
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

export const useMockAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useMockAuth must be used within a MockAuthProvider");
  }
  return context;
};
