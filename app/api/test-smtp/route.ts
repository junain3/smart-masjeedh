import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required for test" },
        { status: 400 }
      );
    }

    console.log("[Test SMTP] Starting SMTP configuration test");
    console.log("[Test SMTP] Environment variables check:", {
      hasSMTP_HOST: !!process.env.SMTP_HOST,
      hasSMTP_PORT: !!process.env.SMTP_PORT,
      hasSMTP_USER: !!process.env.SMTP_USER,
      hasSMTP_PASSWORD: !!process.env.SMTP_PASSWORD,
      hasSMTP_FROM: !!process.env.SMTP_FROM,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER ? process.env.SMTP_USER.substring(0, 3) + '***' : 'NOT_SET',
      SMTP_FROM: process.env.SMTP_FROM,
    });

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    console.log("[Test SMTP] Transporter created, verifying configuration...");

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log("[Test SMTP] ✓ SMTP transporter verified successfully");
    } catch (verifyError: any) {
      console.error("[Test SMTP] ✗ SMTP transporter verification failed:", verifyError);
      return NextResponse.json(
        {
          error: "SMTP configuration verification failed",
          stage: "verification",
          details: {
            message: verifyError.message,
            code: verifyError.code,
            name: verifyError.name,
          }
        },
        { status: 500 }
      );
    }

    // Send test email
    console.log("[Test SMTP] Sending test email to:", email);

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Smart Masjid - SMTP Test Email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #10b981;">SMTP Configuration Test</h2>
          <p>This is a test email to verify your Gmail SMTP configuration is working correctly.</p>
          <p style="color: #6b7280; font-size: 14px;">
            If you received this email, your SMTP settings are properly configured.
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px;">
            Configuration details:<br>
            Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}<br>
            Port: ${process.env.SMTP_PORT || '587'}<br>
            From: ${process.env.SMTP_FROM || process.env.SMTP_USER}
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("[Test SMTP] ✓ Test email sent successfully");
    console.log("[Test SMTP] Message ID:", info.messageId);
    console.log("[Test SMTP] Response:", info.response);

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully",
      details: {
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
      }
    });

  } catch (error: any) {
    console.error("[Test SMTP] ✗ Error:", error);
    console.error("[Test SMTP] Error name:", error.name);
    console.error("[Test SMTP] Error message:", error.message);
    console.error("[Test SMTP] Error code:", error.code);
    console.error("[Test SMTP] Error stack:", error.stack);

    return NextResponse.json(
      {
        error: "SMTP test failed",
        details: {
          message: error.message,
          code: error.code,
          name: error.name,
          stack: error.stack,
        }
      },
      { status: 500 }
    );
  }
}
