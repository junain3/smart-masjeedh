import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { email, role, permissions, commission_percent, masjid_id } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Resolve masjid_id
const { data: { session } } = await supabase.auth.getSession();

let masjidId = masjid_id;

if (!masjidId && session?.user?.id) {
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("masjid_id")
    .eq("user_id", session.user.id)
    .limit(1)
    .maybeSingle();

  masjidId = roleRow?.masjid_id || null;
}

if (!masjidId) {
  return NextResponse.json(
    { error: "Could not determine masjid" },
    { status: 400 }
  );
}

    // Generate OTP and invitation token
    const otp = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-character OTP
    const invitationToken = crypto.randomBytes(32).toString('hex');
    
    console.log("DEBUG: Creating invitation with values:", {
      masjidId,
      email,
      role,
      invitationToken,
      created_by: session?.user?.id
    });

    // Console logs before insert
    console.log("DEBUG: Inserting invitation with values:", {
      masjid_id: masjidId,
      email: email,
      role: role,
      permissions: permissions || {},
      commission_percent: commission_percent ?? null,
      token: invitationToken,
      status: "pending",
      created_by: session?.user?.id,
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
      const { error: inviteError } = await supabase
        .from("invitations")
        .insert({
          masjid_id: masjidId,
          email: email,
          role: role,
          permissions: permissions || {},
          commission_percent: commission_percent ?? null,
          token: invitationToken,
          status: "pending",
          created_by: session?.user?.id,
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

    // Send invitation email using Resend (non-blocking)
    let emailWarning = null;
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@smartmasjeedh.com',
        to: [email],
        subject: 'Invitation to Smart Masjeedh Management System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
            <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #333333; margin-bottom: 20px;">Welcome to Smart Masjeedh Management System!</h2>
              <p style="color: #666666; font-size: 16px; line-height: 1.5;">You have been invited to join our team as <strong>${role}</strong>.</p>
              <p style="color: #666666; font-size: 16px; line-height: 1.5;">Click the button below to complete your registration:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL}/invite-register?token=${invitationToken}" 
                   style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
                  Complete Registration
                </a>
              </div>
              <p style="color: #999999; font-size: 14px; margin-top: 20px;">This invitation expires in 24 hours.</p>
            </div>
          </div>
        `,
      });

      if (error) {
        console.error("Resend error:", error);
        emailWarning = "Email sending failed, but invitation was created successfully";
      } else {
        console.log("Email sent successfully via Resend:", data);
      }
      
    } catch (emailError: any) {
      console.error("Email sending error:", emailError);
      emailWarning = "Email sending failed, but invitation was created successfully";
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
    const { data: invitation, error } = await supabase
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
        role: invitation.role,
        permissions: invitation.permissions,
        commission_percent: invitation.commission_percent
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
