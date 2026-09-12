import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email, full_name, role, permissions, commission_percent } = await request.json();

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

    // Get masjid_id from session
    const { data: { session } } = await supabase.auth.getSession();
    let masjidId = null;

    if (session?.user?.id) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("masjid_id")
        .eq("auth_user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      masjidId = roleRow?.masjid_id || null;
    }

    if (!masjidId) {
      return NextResponse.json(
        { error: "Could not determine masjid - user has no assigned role" },
        { status: 400 }
      );
    }

    // Create user role
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        masjid_id: masjidId,
        user_id: authData.user.id,
        email: email,
        full_name: full_name || email.split('@')[0], // Use email prefix as fallback if no name provided
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
