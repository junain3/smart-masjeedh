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

    const authUserExists = users?.some(user =>
      user.email?.trim().toLowerCase() === normalizedEmail
    );

    // Also check if email exists in user_roles (for synchronization check)
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("email, masjid_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    const userRoleExists = !roleError && !!userRole;

    console.log("[Check Email] Auth user exists:", authUserExists, "User role exists:", userRoleExists);

    return NextResponse.json({
      exists: authUserExists,
      email: normalizedEmail,
      hasUserRole: userRoleExists,
      needsAccountSetup: userRoleExists && !authUserExists
    });

  } catch (error: any) {
    console.error("[Check Email] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
