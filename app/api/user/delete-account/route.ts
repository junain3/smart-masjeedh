import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { confirmationText } = await req.json();

    if (confirmationText !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        { error: "Invalid confirmation text. Please type exactly: DELETE MY ACCOUNT" },
        { status: 400 }
      );
    }

    // Get user from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication failed." },
        { status: 401 }
      );
    }

    // Get user's role and masjid_id
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("masjid_id, role, created_at")
      .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .eq("status", "active")
      .limit(1);

    const userRole = userRoles?.[0];

    if (!userRole) {
      return NextResponse.json(
        { error: "No active user role found." },
        { status: 404 }
      );
    }

    if (userRole.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can delete their account." },
        { status: 403 }
      );
    }

    // Check if this is the oldest super admin of the masjid
    const { data: allSuperAdmins } = await supabaseAdmin
      .from("user_roles")
      .select("auth_user_id, user_id, created_at")
      .eq("masjid_id", userRole.masjid_id)
      .eq("role", "super_admin")
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (!allSuperAdmins || allSuperAdmins.length === 0) {
      return NextResponse.json(
        { error: "No super admins found for this masjid." },
        { status: 404 }
      );
    }

    const oldestSuperAdmin = allSuperAdmins[0];
    const isOldest = oldestSuperAdmin.auth_user_id === user.id || oldestSuperAdmin.user_id === user.id;

    if (!isOldest) {
      return NextResponse.json(
        { error: "Only the oldest super admin can delete the account. Please contact the oldest super admin." },
        { status: 403 }
      );
    }

    // Soft delete: Update masjid status to deleted
    await supabaseAdmin
      .from("masjids")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", userRole.masjid_id);

    // Soft delete: Update user_roles status to deleted
    await supabaseAdmin
      .from("user_roles")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("masjid_id", userRole.masjid_id);

    // Note: Auth user is NOT deleted to allow restoration within 3 months
    // The user will be unable to login due to deleted status check in auth flow

    return NextResponse.json({
      success: true,
      message: "Your account and masjid have been soft-deleted. Data will be permanently removed after 3 months. Contact support for restoration.",
    });
  } catch (error: any) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete account." },
      { status: 500 }
    );
  }
}
