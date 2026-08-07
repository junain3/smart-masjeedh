import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const POST = async (request: NextRequest) => {
  try {
    const { userId, full_name, onboarding_completed } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify the user is authenticated
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Authorization header required" },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid authentication" },
        { status: 401 }
      );
    }

    // Users can only update their own profile unless they are super_admin
    const isSelfUpdate = user.id === userId;
    
    // Check if user is super_admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle();

    if (roleError) {
      console.error("Error checking user role:", roleError);
      return NextResponse.json(
        { error: "Failed to verify permissions" },
        { status: 500 }
      );
    }

    const isSuperAdmin = roleData?.role === "super_admin";

    if (!isSelfUpdate && !isSuperAdmin) {
      return NextResponse.json(
        { error: "You can only update your own profile" },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData: Record<string, any> = {};
    if (full_name !== undefined) {
      updateData.full_name = full_name;
    }
    if (onboarding_completed !== undefined) {
      updateData.onboarding_completed = onboarding_completed;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    // First, check if the user record exists
    console.log("[update-profile] Checking if user record exists for userId:", userId);
    const { data: existingRecord, error: checkError } = await supabaseAdmin
      .from("user_roles")
      .select("*")
      .or(`auth_user_id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle();

    if (checkError) {
      console.error("[update-profile] Error checking existing record:", checkError);
    } else if (!existingRecord) {
      console.error("[update-profile] No record found for userId:", userId);
      return NextResponse.json(
        { error: "User record not found in user_roles table" },
        { status: 404 }
      );
    } else {
      console.log("[update-profile] Found existing record:", existingRecord);
    }

    // Update user_roles table
    console.log("[update-profile] Attempting to update user_roles with:", {
      userId,
      updateData,
      query: `auth_user_id.eq.${userId},user_id.eq.${userId}`
    });

    const { data: updatedProfile, error: updateError } = await supabaseAdmin
      .from("user_roles")
      .update(updateData)
      .or(`auth_user_id.eq.${userId},user_id.eq.${userId}`)
      .select()
      .single();

    if (updateError) {
      console.error("[update-profile] Database error updating user profile:", {
        error: updateError,
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
        userId,
        updateData
      });
      return NextResponse.json(
        { error: `Failed to update profile: ${updateError.message}` },
        { status: 500 }
      );
    }

    console.log("[update-profile] Update successful:", updatedProfile);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      profile: updatedProfile,
    });
  } catch (error: any) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
};
