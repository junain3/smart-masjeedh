import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: NextRequest) {
  try {
    const { userId, email, masjidName, tagline } = await request.json();

    if (!userId || !email || !masjidName) {
      return NextResponse.json(
        { error: "userId, email, and masjidName are required" },
        { status: 400 }
      );
    }

    console.log("[Complete Signup] Creating masjid and user_roles for user:", userId);

    // Step 1: Check if there's an existing deleted user_roles entry for this user
    const { data: existingRole, error: existingRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("*")
      .or(`user_id.eq.${userId},auth_user_id.eq.${userId}`)
      .maybeSingle();

    console.log("[Complete Signup] Existing role check:", { existingRole, existingRoleError });

    let masjidId: string;

    if (existingRole && existingRole.status === 'deleted') {
      // Restore the deleted entry
      console.log("[Complete Signup] Found deleted role, restoring it");

      // Restore the masjid if it was deleted
      const { data: existingMasjid, error: masjidCheckError } = await supabaseAdmin
        .from("masjids")
        .select("*")
        .eq("id", existingRole.masjid_id)
        .maybeSingle();

      if (existingMasjid && existingMasjid.status === 'deleted') {
        console.log("[Complete Signup] Restoring deleted masjid");
        await supabaseAdmin
          .from("masjids")
          .update({
            status: 'active',
            deleted_at: null,
            deleted_by: null,
            deleted_reason: null,
            masjid_name: masjidName,
            tagline: tagline || null,
          })
          .eq("id", existingRole.masjid_id);
      }

      // Restore the user_roles entry
      const { error: restoreError } = await supabaseAdmin
        .from("user_roles")
        .update({
          status: 'active',
          deleted_at: null,
          deleted_by: null,
          deleted_reason: null,
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
          verified: true,
        })
        .eq("id", existingRole.id);

      if (restoreError) {
        console.error("[Complete Signup] Role restoration failed:", restoreError);
        return NextResponse.json(
          { error: `Role restoration failed: ${restoreError.message}` },
          { status: 500 }
        );
      }

      masjidId = existingRole.masjid_id;
      console.log("[Complete Signup] Role restored successfully");
    } else {
      // Step 2: Create masjid record using service role to bypass RLS
      const { data: masjidData, error: masjidError } = await supabaseAdmin
        .from("masjids")
        .insert({
          masjid_name: masjidName,
          tagline: tagline || null,
          created_by: userId,
        })
        .select("id")
        .single();

      if (masjidError) {
        console.error("[Complete Signup] Masjid creation failed:", masjidError);
        return NextResponse.json(
          { error: `Masjid creation failed: ${masjidError.message}` },
          { status: 500 }
        );
      }

      if (!masjidData?.id) {
        return NextResponse.json(
          { error: "Failed to create masjid" },
          { status: 500 }
        );
      }

      console.log("[Complete Signup] Masjid created successfully:", masjidData.id);
      masjidId = masjidData.id;

      // Step 3: Create user_roles record using service role to bypass RLS
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          masjid_id: masjidId,
          user_id: userId,
          auth_user_id: userId,
          email: email,
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
          verified: true,
        });

      if (roleError) {
        console.error("[Complete Signup] Role creation failed:", roleError);
        return NextResponse.json(
          { error: `Role creation failed: ${roleError.message}` },
          { status: 500 }
        );
      }
    }

    console.log("[Complete Signup] User role created successfully");

    return NextResponse.json({
      success: true,
      masjidId,
    });

  } catch (error: any) {
    console.error("[Complete Signup] Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
