"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";

type UserRole = {
  id: string;
  user_id: string;
  email: string;
  role: "super_admin" | "co_admin" | "staff";
  permissions: Record<string, boolean>;
  commission_percent?: number;
  created_at: string;
};

type CommissionSettings = {
  id: string;
  user_id: string;
  commission_percent: number;
  max_monthly_commission: number;
  active: boolean;
};

export function RoleManager() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [masjidId, setMasjidId] = useState<string>("");

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"super_admin" | "co_admin" | "staff">("staff");
  const [newCommission, setNewCommission] = useState("10");

  // Permission definitions
  const permissionOptions = [
    { key: "accounts", label: "Accounts Management", description: "View and manage financial transactions" },
    { key: "events", label: "Events Management", description: "Create and manage events" },
    { key: "members", label: "Members Management", description: "View and manage family members" },
    { key: "subscriptions_collect", label: "Collect Subscriptions", description: "Collect subscription payments" },
    { key: "subscriptions_approve", label: "Approve Subscriptions", description: "Approve pending collections" },
    { key: "staff_management", label: "Staff Management", description: "Manage staff roles and permissions" },
    { key: "reports", label: "Reports", description: "View financial and operational reports" },
    { key: "settings", label: "Settings", description: "Manage system settings" }
  ];

  // Default permissions per role
  const getDefaultPermissions = (role: string): Record<string, boolean> => {
    switch (role) {
      case "super_admin":
        return {
          accounts: true,
          events: true,
          members: true,
          subscriptions_collect: true,
          subscriptions_approve: true,
          staff_management: true,
          reports: true,
          settings: true
        };
      case "co_admin":
        return {
          accounts: true,
          events: true,
          members: true,
          subscriptions_collect: true,
          subscriptions_approve: true,
          staff_management: false,
          reports: true,
          settings: false
        };
      case "staff":
        return {
          accounts: false,
          events: false,
          members: false,
          subscriptions_collect: true,
          subscriptions_approve: false,
          staff_management: false,
          reports: false,
          settings: false
        };
      default:
        return {};
    }
  };

  useEffect(() => {
    // Get masjid ID from session
    const initializeData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setMasjidId(session.user.id); // For now, use user ID as masjid ID
        await loadData(session.user.id);
      }
    };
    initializeData();
  }, []);

  const loadData = async (currentMasjidId: string) => {
    try {
      const [rolesRes, commissionRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*")
          .eq("masjid_id", currentMasjidId)
          .order("created_at", { ascending: true }),
        supabase
          .from("staff_commission_settings")
          .select("*")
          .eq("masjid_id", currentMasjidId)
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (commissionRes.error) throw commissionRes.error;

      setRoles(rolesRes.data || []);
      setCommissionSettings(commissionRes.data || []);
    } catch (error) {
      console.error("Error loading roles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    try {
      // First get user ID from email - use a different approach
      const { data: userData, error: userError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("email", newEmail)
        .single();

      if (userError || !userData) {
        alert("User not found. Please make sure the user is registered.");
        return;
      }

      // Create user role
      const permissions = getDefaultPermissions(newRole);
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          masjid_id: masjidId,
          user_id: userData.user_id,
          email: newEmail,
          role: newRole,
          permissions,
          commission_percent: newRole === "staff" ? parseFloat(newCommission) : null
        });

      if (roleError) throw roleError;

      // Create commission settings for staff
      if (newRole === "staff") {
        await supabase
          .from("staff_commission_settings")
          .insert({
            masjid_id: masjidId,
            user_id: userData.user_id,
            commission_percent: parseFloat(newCommission),
            max_monthly_commission: 50000,
            active: true
          });
      }

      // Reset form
      setNewEmail("");
      setNewRole("staff");
      setNewCommission("10");
      setShowAddModal(false);

      await loadData(masjidId);
    } catch (error) {
      console.error("Error adding role:", error);
      alert("Failed to add role: " + (error as Error).message);
    }
  };

  const handleUpdatePermissions = async (userId: string, permissions: Record<string, boolean>) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ permissions })
        .eq("user_id", userId)
        .eq("masjid_id", masjidId);

      if (error) throw error;
      await loadData(masjidId);
    } catch (error) {
      console.error("Error updating permissions:", error);
      alert("Failed to update permissions");
    }
  };

  const handleUpdateCommission = async (userId: string, commissionPercent: number) => {
    try {
      // Update user_roles
      await supabase
        .from("user_roles")
        .update({ commission_percent: commissionPercent })
        .eq("user_id", userId)
        .eq("masjid_id", masjidId);

      // Update commission settings
      await supabase
        .from("staff_commission_settings")
        .update({ commission_percent: commissionPercent })
        .eq("user_id", userId)
        .eq("masjid_id", masjidId);

      await loadData(masjidId);
    } catch (error) {
      console.error("Error updating commission:", error);
      alert("Failed to update commission");
    }
  };

  const handleDeleteRole = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this user's role?")) return;

    try {
      await Promise.all([
        supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("masjid_id", masjidId),
        supabase
          .from("staff_commission_settings")
          .delete()
          .eq("user_id", userId)
          .eq("masjid_id", masjidId)
      ]);

      await loadData(masjidId);
    } catch (error) {
      console.error("Error deleting role:", error);
      alert("Failed to delete role");
    }
  };

  if (loading) return <div>Loading roles...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Role Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Add User Role
        </button>
      </div>

      {/* Roles List */}
      <div className="space-y-4">
        {roles.map((role) => (
          <div key={role.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold">{role.email}</h3>
                <span className={`inline-block px-2 py-1 text-xs rounded ${
                  role.role === "super_admin" ? "bg-purple-100 text-purple-800" :
                  role.role === "co_admin" ? "bg-blue-100 text-blue-800" :
                  "bg-green-100 text-green-800"
                }`}>
                  {role.role.replace("_", " ").toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => handleDeleteRole(role.user_id)}
                className="text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            </div>

            {/* Permissions */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {permissionOptions.map((perm) => (
                <label key={perm.key} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={role.permissions[perm.key] || false}
                    onChange={(e) => {
                      const newPermissions = { ...role.permissions, [perm.key]: e.target.checked };
                      handleUpdatePermissions(role.user_id, newPermissions);
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{perm.label}</span>
                </label>
              ))}
            </div>

            {/* Commission Settings for Staff */}
            {role.role === "staff" && (
              <div className="border-t pt-4">
                <label className="block text-sm font-medium mb-2">Commission %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={role.commission_percent || 10}
                  onChange={(e) => handleUpdateCommission(role.user_id, parseFloat(e.target.value))}
                  className="w-24 px-2 py-1 border rounded"
                />
                <span className="ml-2 text-sm text-gray-600">
                  Max monthly: ₹50,000
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Add User Role</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="staff">Staff</option>
                  <option value="co_admin">Co-Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {newRole === "staff" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Commission %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={newCommission}
                    onChange={(e) => setNewCommission(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRole}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
