import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  try {
    const { userId, masjidId, role, permissions, commissionPercent } = await request.json();

    if (!userId || !masjidId || !role) {
      return NextResponse.json(
        { error: "userId, masjidId, and role are required" },
        { status: 400 }
      );
    }

    // Verify the requesting user is authenticated and authorized
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    // Check if the requesting user is a super_admin or co_admin for this masjid
    const { data: requesterRole, error: requesterRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .eq("masjid_id", masjidId)
      .maybeSingle();

    if (requesterRoleError) {
      console.error("[update-user-access] Error checking requester role:", requesterRoleError);
      return NextResponse.json(
        { error: "Failed to verify permissions" },
        { status: 500 }
      );
    }

    if (!requesterRole || (requesterRole.role !== "super_admin" && requesterRole.role !== "co_admin")) {
      return NextResponse.json(
        { error: "Only Super Admins and Co Admins can update user access" },
        { status: 403 }
      );
    }

    // Update user_roles with role and permissions
    console.log("[update-user-access] Updating user_roles for userId:", userId, "masjidId:", masjidId);
    const { error: updateError } = await supabaseAdmin
      .from("user_roles")
      .update({ role, permissions })
      .or(`auth_user_id.eq.${userId},user_id.eq.${userId}`)
      .eq("masjid_id", masjidId);

    if (updateError) {
      console.error("[update-user-access] Error updating user_roles:", updateError);
      return NextResponse.json(
        { error: `Failed to update user role: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Handle subscription collector profile if subscriptions_collect permission is enabled
    if (permissions?.subscriptions_collect && commissionPercent !== undefined) {
      const commission = Number(commissionPercent);
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return NextResponse.json(
          { error: "Commission percent must be between 0 and 100" },
          { status: 400 }
        );
      }

      console.log("[update-user-access] Upserting subscription_collector_profile for userId:", userId);
      const { error: profileError } = await supabaseAdmin
        .from("subscription_collector_profiles")
        .upsert(
          {
            masjid_id: masjidId,
            user_id: userId,
            default_commission_percent: commission,
          },
          { onConflict: "masjid_id,user_id" }
        );

      if (profileError) {
        console.error("[update-user-access] Error upserting collector profile:", profileError);
        return NextResponse.json(
          { error: `Failed to update collector profile: ${profileError.message}` },
          { status: 500 }
        );
      }
    }

    console.log("[update-user-access] Access updated successfully");
    return NextResponse.json({
      success: true,
      message: "User access updated successfully",
    });
  } catch (error: any) {
    console.error("[update-user-access] Unexpected error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
