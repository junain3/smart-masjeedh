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
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    console.log("[Check Email] Checking if email exists:", normalizedEmail);

    // Check if email exists in auth.users using admin client
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("[Check Email] Error listing users:", listError);
      return NextResponse.json(
        { error: "Failed to check email" },
        { status: 500 }
      );
    }

    const emailExists = users?.some(user => 
      user.email?.trim().toLowerCase() === normalizedEmail
    );

    console.log("[Check Email] Email exists:", emailExists);

    return NextResponse.json({
      exists: emailExists,
      email: normalizedEmail
    });

  } catch (error: any) {
    console.error("[Check Email] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
