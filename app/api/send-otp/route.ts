import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
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
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    console.log("[Send OTP] Sending OTP to email:", email);

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in email_verifications table with expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes expiry
    
    const { error: insertError } = await supabaseAdmin
      .from("email_verifications")
      .insert({
        email: email,
        code: otp,
        used: false,
        expires_at: expiresAt,
      });

    if (insertError) {
      console.error("[Send OTP] Error storing OTP:", insertError);
      console.error("[Send OTP] Error details:", {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      return NextResponse.json(
        { error: insertError.message || "Failed to generate verification code", details: insertError },
        { status: 500 }
      );
    }

    console.log("[Send OTP] OTP generated and stored:", otp);

    // Create Nodemailer transporter with error handling
    let transporter;
    try {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });
      
      // Verify transporter configuration
      await transporter.verify();
      console.log("[Send OTP] SMTP transporter verified successfully");
    } catch (transportError: any) {
      console.error("[Send OTP] SMTP transporter error:", transportError);
      return NextResponse.json(
        { error: `SMTP configuration error: ${transportError.message}`, details: transportError },
        { status: 500 }
      );
    }

    // Send email
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Your Smart Masjid Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">Smart Masjid Verification</h2>
          <p>Your verification code is:</p>
          <div style="background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${otp}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    let info;
    try {
      info = await transporter.sendMail(mailOptions);
      console.log("[Send OTP] Email sent:", info.messageId);
    } catch (mailError: any) {
      console.error("[Send OTP] Email sending error:", mailError);
      return NextResponse.json(
        { error: `Failed to send email: ${mailError.message}`, details: mailError },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Verification code sent successfully",
    });

  } catch (error: any) {
    console.error("[Send OTP] Error:", error);
    console.error("[Send OTP] Error details:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: error.message || "Failed to send verification code", details: error },
      { status: 500 }
    );
  }
}
