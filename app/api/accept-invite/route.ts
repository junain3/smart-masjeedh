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
    const { token, password, email, role } = await request.json();

    if (!token || !password || !email || !role) {
      return NextResponse.json(
        { error: "Token, password, email, and role are required" },
        { status: 400 }
      );
    }

    console.log("[Accept Invite] Processing invitation for:", email);

    // Step 1: Validate invitation from database
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("email", email)
      .eq("status", "pending")
      .single();

    if (inviteError || !invitation) {
      console.error("[Accept Invite] Invalid invitation:", inviteError);
      return NextResponse.json(
        { error: "Invalid or expired invitation" },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 400 }
      );
    }

    // Step 2: Create user in Supabase Auth with password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since they're setting password via invite
      user_metadata: {
        invited_via: 'invitation',
        invitation_token: token,
      },
    });

    if (authError) {
      console.error("[Accept Invite] Auth user creation error:", authError);
      return NextResponse.json(
        { error: `Failed to create user: ${authError.message}` },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    console.log("[Accept Invite] Auth user created:", authData.user.id);

    // Step 3: Create user_roles entry with invitation data
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        masjid_id: invitation.masjid_id,
        user_id: authData.user.id,
        auth_user_id: authData.user.id,
        email: email,
        role: invitation.role, // Use role from invitation
        permissions: invitation.permissions || getDefaultPermissions(invitation.role), // Use permissions from invitation or fallback
        is_active: true,
        verified: true,
      });

    if (roleError) {
      console.error("[Accept Invite] User role creation error:", roleError);
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Failed to create user role: ${roleError.message}` },
        { status: 500 }
      );
    }

    console.log("[Accept Invite] User role created successfully");

    // Step 4: Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .from("invitations")
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    if (updateError) {
      console.error("[Accept Invite] Warning: Failed to update invitation status:", updateError);
      // Don't fail the request, just log it
    }

    console.log("[Accept Invite] Invitation accepted successfully");

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      userId: authData.user.id,
    });

  } catch (error: any) {
    console.error("[Accept Invite] Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function getDefaultPermissions(role: string): any {
  const basePermissions = {
    accounts: false,
    events: false,
    members: false,
    subscriptions_collect: false,
    subscriptions_approve: false,
    staff_management: false,
    reports: false,
    settings: false,
  };

  switch (role) {
    case 'super_admin':
      return {
        accounts: true,
        events: true,
        members: true,
        subscriptions_collect: true,
        subscriptions_approve: true,
        staff_management: true,
        reports: true,
        settings: true,
      };
    case 'admin':
      return {
        accounts: true,
        events: true,
        members: true,
        subscriptions_collect: true,
        subscriptions_approve: true,
        staff_management: true,
        reports: true,
        settings: false,
      };
    case 'staff':
      return {
        accounts: false,
        events: true,
        members: true,
        subscriptions_collect: true,
        subscriptions_approve: false,
        staff_management: false,
        reports: true,
        settings: false,
      };
    default:
      return basePermissions;
  }
}
