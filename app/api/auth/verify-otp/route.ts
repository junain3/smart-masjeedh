import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { email, otp, authUserId } = await request.json();

    if (!email || !otp || !authUserId) {
      return NextResponse.json(
        { error: "Email, OTP, and auth user ID are required" },
        { status: 400 }
      );
    }

    // Verify OTP and link auth user
    const { data, error } = await supabase
      .rpc('verify_user_otp', {
        p_email: email,
        p_otp: otp,
        p_auth_user_id: authUserId
      });

    if (error) {
      console.error("OTP verification error:", error);
      return NextResponse.json(
        { error: "OTP verification failed" },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Invalid verification result" },
        { status: 400 }
      );
    }

    const result = data[0];

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || "OTP verification failed" },
        { status: 400 }
      );
    }

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.setSession({
      access_token: request.headers.get('authorization')?.replace('Bearer ', '') || '',
      refresh_token: ''
    });

    if (sessionError) {
      return NextResponse.json(
        { error: "Session setup failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
      user: {
        masjid_id: result.masjid_id,
        role: result.role,
        permissions: result.permissions,
        email: email
      }
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
