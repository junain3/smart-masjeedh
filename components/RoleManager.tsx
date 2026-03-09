"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { X } from "lucide-react";

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
  const [ctx, setCtx] = useState<any>(null);

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
    // Get tenant context properly
    const initializeData = async () => {
      try {
        const tenantContext = await getTenantContext();
        setCtx(tenantContext);
        setMasjidId(tenantContext.masjidId);
        await loadData(tenantContext.masjidId);
      } catch (error) {
        console.error("Error initializing RoleManager:", error);
        setLoading(false);
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
      if (!ctx) {
        alert("System not ready. Please try again.");
        return;
      }

      // Get permissions for the role
      const permissions = getDefaultPermissions(newRole);
      
      // Send invitation via OTP
      const response = await fetch('/admin/api/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          role: newRole,
          permissions: permissions,
          commission_percent: newRole === "staff" ? parseFloat(newCommission) : null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation');
      }

      // Show success message with OTP
      const successMessage = `
        Invitation sent successfully!
        
        Email: ${newEmail}
        Role: ${newRole}
        OTP: ${result.otp} (for testing)
        
        Registration link: ${window.location.origin}/invite-register?token=${result.invitationToken}
        
        Please share the registration link with the user.
        They will receive OTP in their email to complete registration.
      `;
      
      alert(successMessage);

      // Reset form
      setNewEmail("");
      setNewRole("staff");
      setNewCommission("10");
      setShowAddModal(false);

      // Reload data
      await loadData(ctx.masjidId);
      
    } catch (error) {
      console.error("Error adding role:", error);
      alert("Failed to send invitation: " + (error as Error).message);
    }
  };

  const handleUpdatePermissions = async (userId: string, permissions: Record<string, boolean>) => {
    try {
      if (!ctx) return;
      
      const { error } = await supabase
        .from("user_roles")
        .update({ permissions })
        .eq("user_id", userId)
        .eq("masjid_id", ctx.masjidId);

      if (error) throw error;
      await loadData(ctx.masjidId);
    } catch (error) {
      console.error("Error updating permissions:", error);
      alert("Failed to update permissions");
    }
  };

  const handleUpdateCommission = async (userId: string, commissionPercent: number) => {
    try {
      if (!ctx) return;
      
      // Update user_roles
      await supabase
        .from("user_roles")
        .update({ commission_percent: commissionPercent })
        .eq("user_id", userId)
        .eq("masjid_id", ctx.masjidId);

      // Update commission settings
      await supabase
        .from("staff_commission_settings")
        .update({ commission_percent: commissionPercent })
        .eq("user_id", userId)
        .eq("masjid_id", ctx.masjidId);

      await loadData(ctx.masjidId);
    } catch (error) {
      console.error("Error updating commission:", error);
      alert("Failed to update commission");
    }
  };

  const handleDeleteRole = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this user's role?")) return;

    try {
      if (!ctx) return;
      
      await Promise.all([
        supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("masjid_id", ctx.masjidId),
        supabase
          .from("staff_commission_settings")
          .delete()
          .eq("user_id", userId)
          .eq("masjid_id", ctx.masjidId)
      ]);

      await loadData(ctx.masjidId);
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Create New User</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>Note:</strong> This will send an OTP invitation to the user's email. 
                  They will receive a registration link to complete their account setup.
                </p>
              </div>
              
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full p-3 border rounded-lg"
                  placeholder="user@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="staff">Staff</option>
                  <option value="co_admin">Co-Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              
              {newRole === "staff" && (
                <div>
                  <label className="block text-sm font-medium mb-2">Commission %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={newCommission}
                    onChange={(e) => setNewCommission(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
              )}
              
              {/* Generate Button */}
              <button
                onClick={handleAddRole}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all"
              >
                � Send OTP Invitation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
