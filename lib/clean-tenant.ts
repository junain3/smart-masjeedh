import { supabase } from "@/lib/supabase";

export type TenantContext = {
  masjidId: string;
  userId: string;
  email: string | null;
  role: "super_admin" | "co_admin" | "staff" | "editor";
  permissions: Record<string, boolean>;
};

export async function getCleanTenantContext(): Promise<TenantContext | null> {
  if (!supabase) return null;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const userId = session.user.id;

    // Check user_roles first
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("masjid_id, role, permissions")
      .eq("auth_user_id", userId)
      .single();

    if (roleError) {
      console.log("No user_roles found");
      return null;
    }

    return {
      masjidId: roleData.masjid_id,
      userId,
      email: session.user.email,
      role: roleData.role || "staff",
      permissions: roleData.permissions || {}
    };

  } catch (error) {
    console.error("Error getting tenant context:", error);
    return null;
  }
}
