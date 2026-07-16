import { User, Session } from "@supabase/supabase-js";

// Core Types
export type Role = "super_admin" | "co_admin" | "staff" | "editor";

export type TenantPermissions = {
  accounts?: boolean;
  events?: boolean;
  members?: boolean;
  subscriptions_collect?: boolean;
  subscriptions_approve?: boolean;
  staff_management?: boolean;
  reports?: boolean;
  settings?: boolean;
};

export type TenantContext = {
  masjidId: string;
  userId: string;
  email: string | null;
  role: Role;
  permissions: TenantPermissions;
};

// Auth State
export type AuthState = {
  session: Session | null;
  user: User | null;
  authLoading: boolean;
  isAuthenticated: boolean;
};

// Tenant State
export type TenantState = {
  tenantContext: TenantContext | null;
  tenantLoading: boolean;
  tenantError: string | null;
};
