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

    // Get current admin's masjid_id from session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Admin authentication required" },
        { status: 401 }
      );
    }

    // Get admin's masjid_id from user_roles
    const { data: adminRole, error: adminError } = await supabase
      .from("user_roles")
      .select("masjid_id")
      .eq("user_id", session.user.id)
      .eq("role", "super_admin")
      .single();

    if (adminError || !adminRole) {
      return NextResponse.json(
        { error: "Admin masjid not found" },
        { status: 403 }
      );
    }

    const masjidId = adminRole.masjid_id;

    // Check if user already exists in this masjid
    const { data: existingUser, error: existingError } = await supabase
      .from("user_roles")
      .select("*")
      .eq("masjid_id", masjidId)
      .eq("email", email)
      .single();

    if (existingUser && !existingError) {
      return NextResponse.json(
        { error: "User already exists in this masjid" },
        { status: 409 }
      );
    }

    // Generate OTP
    const otp = crypto.randomBytes(3).toString('hex').toUpperCase();
    
    // Store user with OTP (no auth account yet)
    const { error: insertError } = await supabase
      .from("user_roles")
      .insert({
        masjid_id: masjidId,
        user_id: crypto.randomUUID(), // Temporary ID, will be updated on OTP verification
        email: email,
        role: role,
        permissions: permissions || {},
        commission_percent: role === "staff" ? commission_percent || 10 : null,
        otp: otp,
        otp_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
        verified: false
      });

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to add user" },
        { status: 500 }
      );
    }

    // Send OTP email (for now, return for testing)
    const emailContent = `
      You have been added to Smart Masjeedh Management System!
      
      Your OTP: ${otp}
      Role: ${role}
      
      Please use this OTP to verify your email and complete setup.
      This OTP expires in 15 minutes.
      
      Login to: ${process.env.NEXT_PUBLIC_APP_URL}/login
    `;

    // TODO: Implement actual email sending
    console.log("Email content:", emailContent);
    console.log("OTP for testing:", otp);

    return NextResponse.json({
      success: true,
      message: "User added successfully. OTP sent for verification.",
      otp: otp, // Remove this in production
      email: email,
      role: role,
      masjid_id: masjidId
    });

  } catch (error) {
    console.error("Add user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
