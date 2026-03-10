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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  console.log("DEBUG getTenantContext - session:", session?.user?.email);

  if (!session) {
    console.log("DEBUG getTenantContext - No session found");
    return null;
  }

  const userId = session.user.id;

  // Try to get user role with auth_user_id (for verified users)
  const { data, error } = await supabase
    .from("user_roles")
    .select("masjid_id, role, permissions")
    .eq("auth_user_id", userId)
    .maybeSingle();

  console.log("DEBUG getTenantContext - user_roles query:", { data, error });

  if (data?.masjid_id) {
    console.log("DEBUG getTenantContext - Found user role:", data.role);
    return {
      masjidId: (data as any).masjid_id,
      userId,
      email: session.user.email || null,
      role: ((data as any).role || "staff") as any,
      permissions: (((data as any).permissions || {}) as any) || {},
    };
  }

  // Fallback for super admin (create masjid if needed)
  console.log("DEBUG getTenantContext - Checking masjids table for user:", userId);
  
  const { data: masjidData, error: masjidError } = await supabase
    .from("masjids")
    .select("id")
    .eq("created_by", userId)
    .maybeSingle();

  console.log("DEBUG getTenantContext - Masjid query result:", { data: masjidData, error: masjidError?.message });

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

  // Create new masjid for first-time super admin
  console.log("DEBUG getTenantContext - Creating new masjid for user:", session.user.email);
  
  const { data: newMasjid, error: createError } = await supabase
    .from("masjids")
    .insert({
      name: `${session.user.email}'s Masjid`,
      created_by: userId
    })
    .select("id")
    .single();

  console.log("DEBUG getTenantContext - Masjid creation result:", { data: newMasjid, error: createError?.message });

  if (newMasjid?.id) {
    // Create super admin role
    await supabase
      .from("user_roles")
      .insert({
        masjid_id: newMasjid.id,
        user_id: crypto.randomUUID(),
        auth_user_id: userId,
        email: session.user.email || "",
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
      });

    return {
      masjidId: newMasjid.id,
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

  return null;
}
