import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import nodemailer from "nodemailer";

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

    // Delete any existing pending invitations for this email to avoid unique constraint violations
    console.log("[Invite User] Checking for existing invitations for email:", email);
    const { error: deleteError } = await supabaseAdmin
      .from("invitations")
      .delete()
      .eq("email", email)
      .eq("status", "pending");

    if (deleteError) {
      console.error("[Invite User] Warning: Failed to delete existing invitations:", deleteError);
      // Don't fail the request if deletion fails, just log it
    } else {
      console.log("[Invite User] Existing pending invitations deleted successfully");
    }

    // Store invitation in database with permissions
    const { error: inviteError } = await supabaseAdmin
      .from("invitations")
      .insert({
        masjid_id: masjidId,
        email: email,
        role: role,
        permissions: permissions || {}, // Store the selected permissions
        token: invitationToken,
        status: "pending",
        created_by: authUser?.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });

    if (inviteError) {
      console.error("[Invite User] Invitation insert error:", inviteError);
      console.error("[Invite User] Error details:", {
        message: inviteError.message,
        details: inviteError.details,
        hint: inviteError.hint,
        code: inviteError.code
      });
      return NextResponse.json(
        { 
          error: inviteError.message || "Failed to create invitation",
          details: inviteError.details,
          code: inviteError.code
        },
        { status: 500 }
      );
    }

    // Fetch masjid name for email
    const { data: masjidData } = await supabaseAdmin
      .from("masjids")
      .select("masjid_name")
      .eq("id", masjidId)
      .single();

    const masjidName = masjidData?.masjid_name || "Masjid";

    // Send invitation email via Gmail SMTP
    try {
      // Log SMTP configuration for debugging (without exposing password)
      console.log("[Invite User] SMTP Configuration:", {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        user: process.env.SMTP_USER ? '***' + process.env.SMTP_USER.slice(-4) : 'NOT_SET',
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        hasPassword: !!process.env.SMTP_PASSWORD
      });

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite-accept?token=${invitationToken}`;

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: `Invitation to join ${masjidName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
              <p style="color: #374151; font-size: 16px; margin-bottom: 20px;">
                You have been invited to join <strong>${masjidName}</strong> as a <strong>${role.replace('_', ' ').toUpperCase()}</strong>.
              </p>
              <p style="color: #6b7280; font-size: 14px; margin-bottom: 30px;">
                Click the button below to accept the invitation and set your password.
              </p>
              <div style="text-align: center;">
                <a href="${inviteLink}" 
                   style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                  Accept Invitation & Set Password
                </a>
              </div>
              <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; text-align: center;">
                This invitation will expire in 24 hours.<br>
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log("[Invite User] Email sent successfully to:", email);

    } catch (emailError: any) {
      console.error("[Invite User] Email sending error - Full details:");
      console.error("[Invite User] Error name:", emailError.name);
      console.error("[Invite User] Error message:", emailError.message);
      console.error("[Invite User] Error code:", emailError.code);
      console.error("[Invite User] Error stack:", emailError.stack);
      console.error("[Invite User] SMTP Config Check:", {
        hasSMTP_HOST: !!process.env.SMTP_HOST,
        hasSMTP_PORT: !!process.env.SMTP_PORT,
        hasSMTP_USER: !!process.env.SMTP_USER,
        hasSMTP_PASSWORD: !!process.env.SMTP_PASSWORD,
        hasSMTP_FROM: !!process.env.SMTP_FROM,
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_FROM: process.env.SMTP_FROM
      });
      
      // Don't fail the request if email fails, just log it
      // The invitation is already stored in database
      return NextResponse.json({
        success: true,
        message: "Invitation created successfully (email delivery failed, but link is available)",
        invite_link: `/invite-accept?token=${invitationToken}`,
        invitationToken: invitationToken,
        warning: "Email could not be sent. Please share the link manually.",
        error_details: {
          message: emailError.message,
          code: emailError.code
        }
      });
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: "Invitation sent successfully",
      invite_link: `/invite-accept?token=${invitationToken}`,
      invitationToken: invitationToken
    });

  } catch (error) {
    console.error("[Invite User] API Error:", error);
    console.error("[Invite User] Error stack:", error instanceof Error ? error.stack : 'No stack available');
    console.error("[Invite User] Error type:", typeof error);
    
    if (error instanceof Error) {
      console.error("[Invite User] Error message:", error.message);
      console.error("[Invite User] Error name:", error.name);
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Internal server error"
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
