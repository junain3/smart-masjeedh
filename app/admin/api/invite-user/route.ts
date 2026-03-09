import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, role, permissions, commission_percent } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Generate OTP and invitation token
    const otp = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-character OTP
    const invitationToken = crypto.randomBytes(32).toString('hex');
    
    // Get masjid_id from session
    const { data: { session } } = await supabase.auth.getSession();
    let masjidId = session?.user?.id;

    if (!masjidId) {
      const { data: masjidData } = await supabase
        .from("masjids")
        .select("id")
        .limit(1)
        .single();
      masjidId = masjidData?.id;
    }

    if (!masjidId) {
      return NextResponse.json(
        { error: "Could not determine masjid" },
        { status: 500 }
      );
    }

    // Store invitation in database
    const { error: inviteError } = await supabase
      .from("user_invitations")
      .insert({
        masjid_id: masjidId,
        email: email,
        role: role,
        permissions: permissions || {},
        commission_percent: role === "staff" ? commission_percent || 10 : null,
        otp: otp,
        token: invitationToken,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        created_by: session?.user?.id
      });

    if (inviteError) {
      console.error("Invitation error:", inviteError);
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 }
      );
    }

    // Send OTP email (you'll need to implement email service)
    // For now, return OTP for testing
    const emailContent = `
      You have been invited to join Smart Masjeedh Management System!
      
      Your OTP: ${otp}
      Role: ${role}
      
      Please use this OTP to complete your registration.
      This invitation expires in 24 hours.
      
      Click here to register: ${process.env.NEXT_PUBLIC_APP_URL}/register?token=${invitationToken}
    `;

    // TODO: Implement actual email sending
    console.log("Email content:", emailContent);
    console.log("OTP for testing:", otp);

    return NextResponse.json({
      success: true,
      message: "Invitation sent successfully",
      otp: otp, // Remove this in production
      invitationToken: invitationToken
    });

  } catch (error) {
    console.error("Invite user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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
      .from("user_invitations")
      .select("*")
      .eq("token", token)
      .eq("used", false)
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
