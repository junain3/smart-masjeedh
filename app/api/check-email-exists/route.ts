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

    console.log("[Check Email Exists] Checking email:", email);

    // Check auth.users
    const { data: authUsers, error: authCheckError } = await supabaseAdmin.auth.admin.listUsers();
    if (!authCheckError && (authUsers as any)?.users) {
      const existingAuthUser = (authUsers as any).users.find((u: any) => u.email === email);
      if (existingAuthUser) {
        console.log("[Check Email Exists] Email exists in auth.users:", email);
        return NextResponse.json({ exists: true });
      }
    }

    // Check user_roles table
    const { data: existingRole, error: roleCheckError } = await supabaseAdmin
      .from("user_roles")
      .select("email")
      .eq("email", email)
      .maybeSingle();

    if (!roleCheckError && existingRole) {
      console.log("[Check Email Exists] Email exists in user_roles:", email);
      return NextResponse.json({ exists: true });
    }

    console.log("[Check Email Exists] Email does not exist:", email);
    return NextResponse.json({ exists: false });

  } catch (error: any) {
    console.error("[Check Email Exists] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
