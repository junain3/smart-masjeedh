import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export type TenantContext = {
  masjidId: string;
  userId: string;
  email: string | null;
  role: "super_admin" | "co_admin" | "staff" | "editor";
  permissions: {
    accounts?: boolean;
    events?: boolean;
    members?: boolean;
    subscriptions_collect?: boolean;
    subscriptions_approve?: boolean;
    staff_management?: boolean;
    reports?: boolean;
    settings?: boolean;
  };
};

export async function getTenantContext(): Promise<TenantContext | null> {
  if (!supabase) return null;

  try {
    console.log("DEBUG getTenantContext - Starting tenant context retrieval...");
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    console.log("DEBUG getTenantContext - session:", session?.user?.email);

    if (!session) {
      console.log("DEBUG getTenantContext - No session found");
      return null;
    }

    const userId = session.user.id;

    // Step 1: Check user_roles table first (priority)
    console.log("DEBUG getTenantContext - Checking user_roles table for user:", userId);
    
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("masjid_id, role, permissions")
      .eq("auth_user_id", userId)
      .maybeSingle();

    console.log("DEBUG getTenantContext - user_roles query:", { data: roleData, error: roleError });

    if (roleData?.masjid_id) {
      console.log("DEBUG getTenantContext - Found user role:", roleData.role);
      return {
        masjidId: roleData.masjid_id,
        userId,
        email: session.user.email || null,
        role: (roleData.role || "staff") as any,
        permissions: (roleData.permissions || {}) as any,
      };
    }

    // Step 2: If no user_roles, check masjids table (fallback for super admin)
    console.log("DEBUG getTenantContext - No user role found, checking masjids table for user:", userId);
    
    const { data: masjidData, error: masjidError } = await supabase
      .from("masjids")
      .select("id")
      .eq("created_by", userId)
      .maybeSingle();

    console.log("DEBUG getTenantContext - Masjid query result:", { data: masjidData, error: masjidError?.message });

    if (masjidError) {
      console.error("DEBUG getTenantContext - Masjid query error:", masjidError);
      return null;
    }

    if (masjidData?.id) {
      console.log("DEBUG getTenantContext - Found existing masjid:", masjidData.id);
      return {
        masjidId: masjidData.id,
        userId,
        email: session.user.email || null,
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
      };
    }

    // Step 3: No existing data found
    console.log("DEBUG getTenantContext - No user role or masjid found, returning null");
    return null;
    
  } catch (error) {
    console.error("DEBUG getTenantContext - Unexpected error:", error);
    return null;
  }
}
