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

    // Generate random password
    const password = crypto.randomBytes(8).toString('hex');
    
    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        role: role,
        created_by_admin: true
      }
    });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: "Failed to create user account" },
        { status: 500 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "User creation failed" },
        { status: 500 }
      );
    }

    // Get masjid_id from session or use first masjid
    const { data: { session } } = await supabase.auth.getSession();
    let masjidId = session?.user?.id;

    if (!masjidId) {
      // Fallback to first masjid
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

    // Create user role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        masjid_id: masjidId,
        user_id: authData.user.id,
        email: email,
        role: role,
        permissions: permissions || {},
        commission_percent: role === "staff" ? commission_percent || 10 : null
      });

    if (roleError) {
      console.error("Role error:", roleError);
      // Clean up auth user if role creation fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to assign user role" },
        { status: 500 }
      );
    }

    // Create commission settings for staff
    if (role === "staff") {
      await supabase
        .from("staff_commission_settings")
        .insert({
          masjid_id: masjidId,
          user_id: authData.user.id,
          commission_percent: commission_percent || 10,
          max_monthly_commission: 50000,
          active: true
        });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        password: password, // Send password to admin
        role: role
      },
      message: "User created successfully"
    });

  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
