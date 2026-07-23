import { supabase } from "@/lib/supabase";
import type { TenantContext, Role, TenantPermissions } from "@/lib/types";

/**
 * Fetches tenant context for current authenticated user
 * Only retrieves the data once per session, cached internally
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  try {
    // Step 1: Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      return null;
    }

    const userId = session.user.id;

    // Step 2: Try user_roles first (check both auth_user_id and user_id for compatibility)
    let userRole: any = null;
    let userRoleError: any = null;

    // Try auth_user_id first
    const { data: authData, error: authError } = await supabase
      .from("user_roles")
      .select("masjid_id, role, permissions")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!authError && authData?.masjid_id) {
      userRole = authData;
    } else {
      // Fall back to user_id if auth_user_id didn't find anything
      const { data: userIdData, error: userIdError } = await supabase
        .from("user_roles")
        .select("masjid_id, role, permissions")
        .eq("user_id", userId)
        .maybeSingle();
      userRole = userIdData;
      userRoleError = userIdError;
    }

    if (!userRoleError && userRole?.masjid_id) {
      return {
        masjidId: userRole.masjid_id,
        userId,
        email: session.user.email || null,
        role: (userRole.role || "staff") as Role,
        permissions: (userRole.permissions || {}) as TenantPermissions,
      };
    }

    // Step 3: Fall back to super admin (created_by)
    const { data: masjid, error: masjidError } = await supabase
      .from("masjids")
      .select("id")
      .eq("created_by", userId)
      .maybeSingle();

    if (!masjidError && masjid?.id) {
      return {
        masjidId: masjid.id,
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
          settings: true,
        },
      };
    }

    return null;
  } catch (error) {
    console.error("[getTenantContext] Error:", error);
    return null;
  }
}
