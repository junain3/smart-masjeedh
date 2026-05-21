import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CONFIRMATION_TEXT = "DELETE SUPERADMIN";

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { targetUserId, masjidId, confirmationText } = await req.json();

    if (!targetUserId || !masjidId || confirmationText !== CONFIRMATION_TEXT) {
      return NextResponse.json(
        { error: "Invalid deletion request." },
        { status: 400 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: requesterRole, error: requesterError } = await supabaseAdmin
      .from("user_roles")
      .select("role, masjid_id")
      .eq("user_id", user.id)
      .eq("masjid_id", masjidId)
      .maybeSingle();

    if (requesterError) throw requesterError;

    if (requesterRole?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can delete super admin accounts." },
        { status: 403 }
      );
    }

    const { data: targetRole, error: targetError } = await supabaseAdmin
      .from("user_roles")
      .select("role, email, masjid_id")
      .eq("user_id", targetUserId)
      .eq("masjid_id", masjidId)
      .maybeSingle();

    if (targetError) throw targetError;

    if (!targetRole) {
      return NextResponse.json(
        { error: "Target user was not found in this tenant." },
        { status: 404 }
      );
    }

    if (targetRole.role === "super_admin") {
      await deleteTenantData(masjidId);
    } else {
      const { error: roleDeleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("masjid_id", masjidId);

      if (roleDeleteError) throw roleDeleteError;
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (authDeleteError) throw authDeleteError;

    return NextResponse.json({
      success: true,
      message:
        targetRole.role === "super_admin"
          ? "Super admin account and tenant data deleted successfully."
          : "User login access deleted successfully.",
    });
  } catch (error: any) {
    console.error("Delete super admin error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete super admin account." },
      { status: 500 }
    );
  }
}

async function deleteTenantData(masjidId: string) {
  const tenantTables = [
    "subscription_collections",
    "collector_commission_payments",
    "family_subscriptions",
    "subscriptions",
    "event_attendance",
    "events",
    "reports",
    "members",
    "families",
    "employees",
    "user_roles",
  ];

  for (const table of tenantTables) {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("masjid_id", masjidId);

    if (error) throw error;
  }

  const { error: masjidError } = await supabaseAdmin
    .from("masjids")
    .delete()
    .eq("id", masjidId);

  if (masjidError) throw masjidError;
}
