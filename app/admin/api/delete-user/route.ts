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
    const { userRoleId, masjidId, deletedBy } = await request.json();

    if (!userRoleId || !masjidId) {
      return NextResponse.json(
        { error: "User role ID and masjid ID are required" },
        { status: 400 }
      );
    }

    console.log("[Delete User] === API REQUEST START ===");
    console.log("[Delete User] Received userRoleId:", userRoleId);
    console.log("[Delete User] userRoleId type:", typeof userRoleId);
    console.log("[Delete User] masjidId:", masjidId);
    console.log("[Delete User] deletedBy:", deletedBy);
    console.log("[Delete User] === API REQUEST END ===");

    // Check if userRoleId is an email (not a UUID) - handle gracefully
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(userRoleId);

    console.log("[Delete User] UUID regex test result:", isUuid, "for value:", userRoleId);
    console.log("[Delete User] Value length:", userRoleId?.length);

    // Additional check: if value contains @, it's definitely an email
    const isEmail = userRoleId?.includes('@');
    console.log("[Delete User] Contains @ (is email):", isEmail);

    if (isEmail || !isUuid) {
      console.log("[Delete User] === EMAIL DELETE PATH (detected by @ or UUID check) ===");

      // First check if user exists and is the last super_admin
      const { data: userRole, error: fetchError } = await supabaseAdmin
        .from("user_roles")
        .select("*")
        .eq("email", userRoleId)
        .eq("masjid_id", masjidId)
        .eq("status", "active")
        .maybeSingle() as { data: any, error: any };

      console.log("[Delete User] User found by email:", userRole);
      console.log("[Delete User] Fetch error:", fetchError);

      if (fetchError || !userRole) {
        console.error("[Delete User] User not found by email:", fetchError);
        return NextResponse.json(
          { error: "User not found or invalid identifier" },
          { status: 404 }
        );
      }

      // Check if the user is the last super_admin for this masjid
      if (userRole.role === 'super_admin') {
        const { data: otherAdmins, error: adminCheckError } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("masjid_id", masjidId)
          .eq("role", "super_admin")
          .neq("id", userRole.id);

        if (!adminCheckError && (!otherAdmins || otherAdmins.length === 0)) {
          return NextResponse.json(
            { error: "Cannot delete the last super admin of a masjid" },
            { status: 400 }
          );
        }
      }

      // Hard delete by email - cascade across all tables
      console.log("[Delete User] === CASCADE DELETE BY EMAIL ===");

      // 1. Delete from user_roles
      console.log("[Delete User] Step 1: Deleting from user_roles");
      const { error: userRolesError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("email", userRoleId)
        .eq("masjid_id", masjidId);

      if (userRolesError) {
        console.error("[Delete User] Error deleting from user_roles:", userRolesError);
        return NextResponse.json(
          { error: `Failed to delete user: ${userRolesError.message}` },
          { status: 500 }
        );
      }

      // 2. Delete from role_invitations (if any)
      console.log("[Delete User] Step 2: Deleting from role_invitations");
      const { error: roleInvitesError } = await supabaseAdmin
        .from("role_invitations")
        .delete()
        .eq("email", userRoleId)
        .eq("masjid_id", masjidId);

      if (roleInvitesError) {
        console.warn("[Delete User] Warning: Failed to delete from role_invitations:", roleInvitesError);
      }

      // 3. Delete from invitations (if any)
      console.log("[Delete User] Step 3: Deleting from invitations");
      const { error: invitesError1 } = await supabaseAdmin
        .from("invitations")
        .delete()
        .eq("email", userRoleId)
        .eq("masjid_id", masjidId);

      if (invitesError1) {
        console.warn("[Delete User] Warning: Failed to delete from invitations:", invitesError1);
      }

      // 4. Delete from Supabase Auth (auth.users) if user exists
      console.log("[Delete User] Step 4: Deleting from Supabase Auth");
      try {
        const { data: { users }, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers();

        if (!listUsersError && users) {
          const authUser = users.find((u: any) => u.email === userRoleId);
          if (authUser) {
            console.log("[Delete User] Found auth user:", authUser.id, "deleting from auth.users");
            const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
            if (deleteAuthError) {
              console.warn("[Delete User] Warning: Failed to delete from auth.users:", deleteAuthError);
            } else {
              console.log("[Delete User] Successfully deleted from auth.users");
            }
          } else {
            console.log("[Delete User] No auth user found for email:", userRoleId);
          }
        } else {
          console.warn("[Delete User] Warning: Failed to list auth users:", listUsersError);
        }
      } catch (authError: any) {
        console.warn("[Delete User] Warning: Exception during auth deletion:", authError);
      }

      console.log("[Delete User] User deleted successfully by email:", userRoleId);
      return NextResponse.json({
        success: true,
        message: "User removed successfully",
      });
    }

    // If input is a UUID, delete by UUID (original logic)
    console.log("[Delete User] === UUID DELETE PATH ===");

    // Get the user role to be deleted
    console.log("[Delete User] Query 1: Fetching user by UUID:", userRoleId);
    const { data: userRole, error: fetchError } = await supabaseAdmin
      .from("user_roles")
      .select("*")
      .eq("id", userRoleId)
      .eq("masjid_id", masjidId)
      .single() as { data: any, error: any };

    console.log("[Delete User] Query 1 result:", userRole);
    console.log("[Delete User] Query 1 error:", fetchError);

    if (fetchError || !userRole) {
      console.error("[Delete User] User role not found by UUID:", fetchError);
      return NextResponse.json(
        { error: "User role not found" },
        { status: 404 }
      );
    }

    // Check if the user is the last super_admin for this masjid
    if (userRole.role === 'super_admin') {
      console.log("[Delete User] Query 2: Checking for other super_admins");
      const { data: otherAdmins, error: adminCheckError } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("masjid_id", masjidId)
        .eq("role", "super_admin")
        .neq("id", userRoleId);

      console.log("[Delete User] Query 2 result:", otherAdmins);
      console.log("[Delete User] Query 2 error:", adminCheckError);

      if (!adminCheckError && (!otherAdmins || otherAdmins.length === 0)) {
        return NextResponse.json(
          { error: "Cannot delete the last super admin of a masjid" },
          { status: 400 }
        );
      }
    }

    // Hard delete the user role - cascade across all tables
    console.log("[Delete User] === CASCADE DELETE BY UUID ===");

    // 1. Delete from user_roles
    console.log("[Delete User] Step 1: Deleting from user_roles");
    const { error: userRolesError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("id", userRoleId)
      .eq("masjid_id", masjidId);

    if (userRolesError) {
      console.error("[Delete User] Error deleting from user_roles:", userRolesError);
      return NextResponse.json(
        { error: `Failed to delete user: ${userRolesError.message}` },
        { status: 500 }
      );
    }

    // 2. Delete from role_invitations (if any) - use email from userRole
    console.log("[Delete User] Step 2: Deleting from role_invitations");
    const { error: roleInvitesError } = await supabaseAdmin
      .from("role_invitations")
      .delete()
      .eq("email", userRole.email)
      .eq("masjid_id", masjidId);

    if (roleInvitesError) {
      console.warn("[Delete User] Warning: Failed to delete from role_invitations:", roleInvitesError);
    }

    // 3. Delete from invitations (if any) - use email from userRole
    console.log("[Delete User] Step 3: Deleting from invitations");
    const { error: invitesError2 } = await supabaseAdmin
      .from("invitations")
      .delete()
      .eq("email", userRole.email)
      .eq("masjid_id", masjidId);

    if (invitesError2) {
      console.warn("[Delete User] Warning: Failed to delete from invitations:", invitesError2);
    }

    // 4. Delete from Supabase Auth (auth.users) if user exists
    console.log("[Delete User] Step 4: Deleting from Supabase Auth");
    try {
      const { data: { users }, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers();

      if (!listUsersError && users) {
        const authUser = users.find((u: any) => u.email === userRole.email);
        if (authUser) {
          console.log("[Delete User] Found auth user:", authUser.id, "deleting from auth.users");
          const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
          if (deleteAuthError) {
            console.warn("[Delete User] Warning: Failed to delete from auth.users:", deleteAuthError);
          } else {
            console.log("[Delete User] Successfully deleted from auth.users");
          }
        } else {
          console.log("[Delete User] No auth user found for email:", userRole.email);
        }
      } else {
        console.warn("[Delete User] Warning: Failed to list auth users:", listUsersError);
      }
    } catch (authError: any) {
      console.warn("[Delete User] Warning: Exception during auth deletion:", authError);
    }

    console.log("[Delete User] User role deleted successfully by UUID:", userRoleId);

    return NextResponse.json({
      success: true,
      message: "User removed successfully",
    });

  } catch (error: any) {
    console.error("[Delete User] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
