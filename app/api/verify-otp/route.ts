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
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { error: "Email and OTP are required" },
        { status: 400 }
      );
    }

    console.log("[Verify OTP] Verifying OTP for email:", email);

    // Check if OTP exists and is valid
    const { data: verificationData, error: verificationError } = await supabaseAdmin
      .from("email_verifications")
      .select("*")
      .eq("email", email)
      .eq("code", otp)
      .eq("used", false)
      .maybeSingle();

    if (verificationError) {
      console.error("[Verify OTP] Error checking OTP:", verificationError);
      console.error("[Verify OTP] Error details:", {
        message: verificationError.message,
        code: verificationError.code,
        details: verificationError.details,
        hint: verificationError.hint,
      });
      return NextResponse.json(
        { error: "Failed to verify code" },
        { status: 500 }
      );
    }

    if (!verificationData) {
      console.log("[Verify OTP] Invalid or expired OTP");
      return NextResponse.json(
        { error: "Invalid or expired verification code" },
        { status: 400 }
      );
    }

    // Check if OTP has expired
    if (verificationData.expires_at && new Date(verificationData.expires_at) < new Date()) {
      console.log("[Verify OTP] OTP expired at:", verificationData.expires_at);
      return NextResponse.json(
        { error: "Verification code has expired" },
        { status: 400 }
      );
    }

    // Mark OTP as used
    const { error: updateError } = await supabaseAdmin
      .from("email_verifications")
      .update({ used: true })
      .eq("id", verificationData.id);

    if (updateError) {
      console.error("[Verify OTP] Error marking OTP as used:", updateError);
    }

    console.log("[Verify OTP] OTP verified successfully");

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully",
    });

  } catch (error: any) {
    console.error("[Verify OTP] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify OTP" },
      { status: 500 }
    );
  }
}
