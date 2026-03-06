import { supabase } from "@/lib/supabase";

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
  };
};

export async function getTenantContext(): Promise<TenantContext | null> {
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const userId = session.user.id;

  const { data } = await supabase
    .from("user_roles")
    .select("masjid_id, role, permissions")
    .eq("user_id", userId)
    .maybeSingle();

  if (data?.masjid_id) {
    return {
      masjidId: (data as any).masjid_id,
      userId,
      email: session.user.email || null,
      role: ((data as any).role || "staff") as any,
      permissions: (((data as any).permissions || {}) as any) || {},
    };
  }

  return {
    masjidId: userId,
    userId,
    email: session.user.email || null,
    role: "super_admin",
    permissions: {},
  };
}
