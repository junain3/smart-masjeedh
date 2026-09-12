import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

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
    const { email, role, permissions, commission_percent, masjid_id } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Get authenticated user from Authorization header or session
    let authUser = null;
    const authHeader = request.headers.get("authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      if (token) {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error) {
          console.error("[Invite User] getUser(token) failed:", error);
        }
        if (user) {
          authUser = user;
        }
      }
    }

    // Fallback to session-based auth
    if (!authUser) {
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log("[Invite User] Session retrieval:", { session, sessionError });
      authUser = session?.user;
    }

    if (!authUser) {
      console.error("[Invite User] Authentication failed");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    console.log("[Invite User] Authenticated user:", authUser.id, authUser.email);

    let masjidId = masjid_id;

    if (!masjidId && authUser.id) {
      // Try auth_user_id first (new schema)
      const { data: roleRow, error: authError } = await supabaseAdmin
        .from("user_roles")
        .select("masjid_id")
        .eq("auth_user_id", authUser.id)
        .limit(1)
        .maybeSingle();

      console.log("[Invite User] auth_user_id query:", { roleRow, authError });

      if (roleRow?.masjid_id) {
        masjidId = roleRow.masjid_id;
      } else {
        // Fallback to user_id (old schema)
        const { data: oldRoleRow, error: oldError } = await supabaseAdmin
          .from("user_roles")
          .select("masjid_id")
          .eq("user_id", authUser.id)
          .limit(1)
          .maybeSingle();

        console.log("[Invite User] user_id fallback query:", { oldRoleRow, oldError });
        masjidId = oldRoleRow?.masjid_id || null;
      }
    }

    if (!masjidId) {
      console.error("[Invite User] Could not determine masjid_id for user:", authUser.id);
      return NextResponse.json(
        { error: "Could not determine masjid - user has no assigned role" },
        { status: 403 }
      );
    }

    // Generate OTP and invitation token
    const invitationToken = crypto.randomBytes(32).toString('hex');
    
    console.log("DEBUG: Creating invitation with values:", {
      masjidId,
      email,
      role,
      invitationToken,
      created_by: authUser?.id
    });

    // Console logs before insert
    console.log("DEBUG: Inserting invitation with values:", {
      masjid_id: masjidId,
      email: email,
      role: role,
      token: invitationToken,
      status: "pending",
      created_by: authUser?.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });

    // Check if any required field is undefined
    if (!masjidId || !email || !role) {
      console.error("ERROR: Required field missing:", { masjidId, email, role });
      return NextResponse.json(
        { error: "Required fields missing: masjid_id, email, or role" },
        { status: 400 }
      );
    }

    // Store invitation in database with try/catch
    try {
      const { error: inviteError } = await supabaseAdmin
        .from("invitations")
        .insert({
          masjid_id: masjidId,
          email: email,
          role: role,
          token: invitationToken,
          status: "pending",
          created_by: authUser?.id,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        });

      if (inviteError) {
        console.error("Invitation insert error:", inviteError);
        console.error("Error details:", {
          message: inviteError.message,
          details: inviteError.details,
          hint: inviteError.hint,
          code: inviteError.code
        });
        return NextResponse.json(
          { 
            error: "Failed to create invitation",
            details: inviteError.message,
            code: inviteError.code
          },
          { status: 500 }
        );
      }
    } catch (error: any) {
      console.error("ERROR: Invitation insert failed with exception:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Send invitation email using Supabase Auth Admin API
    let emailWarning = null;
    try {
      console.log("[Invite User] Sending invitation email via Supabase Auth to:", email);

      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/invite-register?token=${invitationToken}`,
        data: {
          role: role,
          masjid_id: masjidId,
          invitation_token: invitationToken
        }
      });

      if (inviteError) {
        console.error("[Invite User] Supabase invite error:", inviteError);
        emailWarning = `Email sending failed: ${inviteError.message}. Invitation was created in database.`;
      } else {
        console.log("[Invite User] Invitation email sent successfully via Supabase:", inviteData);
      }

    } catch (emailError: any) {
      console.error("[Invite User] Email sending exception:", emailError);
      emailWarning = `Email sending failed: ${emailError.message}. Invitation was created in database.`;
    }

    // Return success with invitation link (even if email failed)
    return NextResponse.json({
      success: true,
      message: emailWarning ? "Invitation created successfully (email warning)" : "Invitation sent successfully",
      invite_link: `/invite-register?token=${invitationToken}`,
      invitationToken: invitationToken,
      warning: emailWarning
    });

  } catch (error) {
    console.error("Invite user error:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : 'No stack available');
    console.error("Error type:", typeof error);
    
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error name:", error.name);
    }
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : 'Unknown error',
        type: typeof error
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: "Invitation token is required" },
        { status: 400 }
      );
    }

    // Get invitation details
    const { data: invitation, error } = await supabaseAdmin
      .from("invitations")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !invitation) {
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

    return NextResponse.json({
      success: true,
      invitation: {
        email: invitation.email,
        role: invitation.role
      }
    });

  } catch (error) {
    console.error("Get invitation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
