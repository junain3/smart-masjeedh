import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { confirmationText } = await req.json();

    if (confirmationText !== "DELETE MY ACCOUNT") {
      return NextResponse.json(
        { error: "Invalid confirmation text. Please type exactly: DELETE MY ACCOUNT" },
        { status: 400 }
      );
    }

    // Get user from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Authentication failed." },
        { status: 401 }
      );
    }

    // Get user's role and masjid_id
    const { data: userRoles } = await supabaseAdmin
      .from("user_roles")
      .select("masjid_id, role, created_at")
      .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`)
      .eq("status", "active")
      .limit(1);

    const userRole = userRoles?.[0];

    if (!userRole) {
      return NextResponse.json(
        { error: "No active user role found." },
        { status: 404 }
      );
    }

    // Check if user is the masjid creator (created_by matches user id)
    const { data: masjidData } = await supabaseAdmin
      .from("masjids")
      .select("created_by")
      .eq("id", userRole.masjid_id)
      .single();

    const isMasjidCreator = masjidData?.created_by === user.id;

    console.log("[Delete Account] User role:", userRole.role, "Is masjid creator:", isMasjidCreator);

    if (isMasjidCreator) {
      // ============================================
      // CASE 1: Masjid Creator / Super Admin
      // Cascade delete entire masjid and all records
      // ============================================

      if (userRole.role !== "super_admin") {
        return NextResponse.json(
          { error: "Only super admins can delete their account." },
          { status: 403 }
        );
      }

      // Check if this is the oldest super admin of the masjid
      const { data: allSuperAdmins } = await supabaseAdmin
        .from("user_roles")
        .select("auth_user_id, user_id, created_at")
        .eq("masjid_id", userRole.masjid_id)
        .eq("role", "super_admin")
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (!allSuperAdmins || allSuperAdmins.length === 0) {
        return NextResponse.json(
          { error: "No super admins found for this masjid." },
          { status: 404 }
        );
      }

      const oldestSuperAdmin = allSuperAdmins[0];
      const isOldest = oldestSuperAdmin.auth_user_id === user.id || oldestSuperAdmin.user_id === user.id;

      if (!isOldest) {
        return NextResponse.json(
          { error: "Only the oldest super admin can delete the account. Please contact the oldest super admin." },
          { status: 403 }
        );
      }

      console.log("[Delete Account] Masjid Creator Deletion - Starting archive and hard delete for masjid:", userRole.masjid_id);

      // Step 1: Fetch and archive all masjeedh data for developer reference
      console.log("[Delete Account] Step 1: Fetching and archiving masjeedh data");
      
      const backupData: any = {
        masjid_id: userRole.masjid_id,
        masjid_name: null,
        owner_email: user.email,
        owner_user_id: user.id,
        snapshot_at: new Date().toISOString(),
      };

      // Fetch masjid details
      const { data: masjidDetails } = await supabaseAdmin
        .from("masjids")
        .select("*")
        .eq("id", userRole.masjid_id)
        .single();
      
      if (masjidDetails) {
        backupData.masjid_name = masjidDetails.masjid_name;
        backupData.masjid = masjidDetails;
      }

      // Fetch all user_roles for this masjid
      const { data: allUserRoles } = await supabaseAdmin
        .from("user_roles")
        .select("*")
        .eq("masjid_id", userRole.masjid_id);
      backupData.user_roles = allUserRoles || [];

      // Fetch related data from all tables
      const tablesToBackup = [
        'members',
        'staff',
        'events',
        'subscriptions',
        'families',
        'service_distributions',
        'salary_advances',
        'staff_ledger',
        'message_logs',
        'whatsapp_configs',
      ];

      for (const tableName of tablesToBackup) {
        try {
          const { data: tableData } = await supabaseAdmin
            .from(tableName)
            .select("*")
            .eq("masjid_id", userRole.masjid_id);
          backupData[tableName] = tableData || [];
        } catch (err: any) {
          console.log(`[Delete Account] Warning: Could not backup ${tableName}:`, err.message);
          backupData[tableName] = [];
        }
      }

      // Save snapshot to deleted_masjeedhs_archive for developer reference
      const { error: archiveError } = await supabaseAdmin
        .from("deleted_masjeedhs_archive")
        .insert({
          masjid_id: userRole.masjid_id,
          masjid_name: backupData.masjid_name || "Unknown",
          owner_email: user.email,
          owner_user_id: user.id,
          backup_data: backupData,
          status: 'archived',
          expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (archiveError) {
        console.error("[Delete Account] Archive error:", archiveError);
        // Don't fail deletion if archive fails, but log it
      } else {
        console.log("[Delete Account] Data archived successfully");
      }

      // Step 2: Hard delete all user_roles for this masjid
      console.log("[Delete Account] Step 2: Deleting all user_roles for masjid:", userRole.masjid_id);
      const { error: rolesDeleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("masjid_id", userRole.masjid_id);

      if (rolesDeleteError) {
        console.error("[Delete Account] User roles delete error:", rolesDeleteError);
        return NextResponse.json(
          { error: `Failed to delete user roles: ${rolesDeleteError.message}` },
          { status: 500 }
        );
      }

      console.log("[Delete Account] User roles deleted successfully");

      // Step 3: Hard delete all related records
      console.log("[Delete Account] Step 3: Deleting all related records for masjid:", userRole.masjid_id);
      
      const tablesToDelete = [
        'members',
        'staff',
        'events',
        'subscriptions',
        'families',
        'service_distributions',
        'salary_advances',
        'staff_ledger',
        'message_logs',
        'whatsapp_configs',
      ];

      for (const tableName of tablesToDelete) {
        try {
          const { error: tableDeleteError } = await supabaseAdmin
            .from(tableName)
            .delete()
            .eq("masjid_id", userRole.masjid_id);
          
          if (tableDeleteError) {
            console.log(`[Delete Account] Warning: Failed to delete from ${tableName}:`, tableDeleteError.message);
          }
        } catch (err: any) {
          console.log(`[Delete Account] Warning: Error deleting from ${tableName}:`, err.message);
        }
      }

      console.log("[Delete Account] Related records deleted successfully");

      // Step 4: Hard delete masjid record
      console.log("[Delete Account] Step 4: Deleting masjid record:", userRole.masjid_id);
      const { error: masjidDeleteError } = await supabaseAdmin
        .from("masjids")
        .delete()
        .eq("id", userRole.masjid_id);

      if (masjidDeleteError) {
        console.error("[Delete Account] Masjid delete error:", masjidDeleteError);
        return NextResponse.json(
          { error: `Failed to delete masjid: ${masjidDeleteError.message}` },
          { status: 500 }
        );
      }

      console.log("[Delete Account] Masjid deleted successfully");

      // Step 5: Delete auth user from Supabase Auth
      console.log("[Delete Account] Step 5: Deleting auth user from Supabase Auth:", user.id);
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

      if (authDeleteError) {
        console.error("[Delete Account] Auth user delete error:", authDeleteError);
        return NextResponse.json(
          { error: `Failed to delete auth user: ${authDeleteError.message}` },
          { status: 500 }
        );
      }

      console.log("[Delete Account] Masjid Creator Deletion - All steps completed successfully");

      return NextResponse.json({
        success: true,
        message: "Your masjeedh and all associated data have been permanently deleted.",
      });

    } else {
      // ============================================
      // CASE 2: Invited Member / Staff
      // Only delete user's user_roles entry and auth user
      // ============================================

      console.log("[Delete Account] Invited Member Deletion - Starting selective deletion for user:", user.id);

      // Step 1: Delete only this user's user_roles entry
      console.log("[Delete Account] Step 1: Deleting user_roles entry for user:", user.id);
      const { error: rolesDeleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id}`);

      if (rolesDeleteError) {
        console.error("[Delete Account] Step 1 FAILED - Full error object:", JSON.stringify(rolesDeleteError, null, 2));
        console.error("[Delete Account] Step 1 FAILED - Error details:", {
          message: rolesDeleteError.message,
          code: rolesDeleteError.code,
          details: rolesDeleteError.details,
          hint: rolesDeleteError.hint,
        });
        return NextResponse.json(
          { error: `Failed to delete user role: ${rolesDeleteError.message}` },
          { status: 500 }
        );
      }

      console.log("[Delete Account] Step 1 SUCCESS: User role deleted successfully");

      // Step 2: Delete auth user from Supabase Auth
      console.log("[Delete Account] Step 2: Deleting auth user from Supabase Auth:", user.id);
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

      if (authDeleteError) {
        console.error("[Delete Account] Step 2 FAILED - Full error object:", JSON.stringify(authDeleteError, null, 2));
        console.error("[Delete Account] Step 2 FAILED - Error details:", {
          message: authDeleteError.message,
          status: authDeleteError.status,
          name: authDeleteError.name,
        });
        return NextResponse.json(
          { error: `Failed to delete auth user: ${authDeleteError.message}` },
          { status: 500 }
        );
      }

      console.log("[Delete Account] Step 2 SUCCESS: Auth user deleted successfully");
      console.log("[Delete Account] Invited Member Deletion - All steps completed successfully");

      return NextResponse.json({
        success: true,
        message: "Your account has been permanently deleted. The masjid and other members remain unaffected.",
      });
    }
  } catch (error: any) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete account." },
      { status: 500 }
    );
  }
}
