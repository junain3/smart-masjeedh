"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { X, User, Mail, Shield, Crown, Briefcase } from "lucide-react";

type AdminRole = {
  id: string;
  user_id: string;
  email: string;
  role: "super_admin" | "co_admin";
  permissions: Record<string, boolean>;
  full_name?: string;
  phone_number?: string;
  designation?: string;
  verified: boolean;
  created_at: string;
};

export function AdminManager() {
  const [admins, setAdmins] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ctx, setCtx] = useState<any>(null);

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"super_admin" | "co_admin">("co_admin");
  const [newFullName, setNewFullName] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newDesignation, setNewDesignation] = useState("");

  // Permission definitions for admin roles
  const adminPermissionOptions = [
    { key: "accounts", label: "Accounts Management", description: "View and manage financial transactions" },
    { key: "events", label: "Events Management", description: "Create and manage events" },
    { key: "members", label: "Members Management", description: "Manage member records and profiles" },
    { key: "subscriptions_approve", label: "Approve Collections", description: "Approve collected subscriptions" },
    { key: "staff_management", label: "Staff Management", description: "Manage staff and employees" },
    { key: "reports", label: "Reports", description: "View and generate reports" },
    { key: "settings", label: "Settings", description: "Manage system settings" }
  ];

  const getDefaultPermissions = (role: string) => {
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
          reports: true
        };
      default:
        return {};
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        const tenantContext = await getTenantContext();
        setCtx(tenantContext);
        await loadData(tenantContext.masjidId);
      } catch (error) {
        console.error("Error initializing AdminManager:", error);
        setLoading(false);
      }
    };
    initializeData();
  }, []);

  const loadData = async (currentMasjidId: string) => {
    try {
      const { data } = await supabase
        .from("user_roles")
        .select("*")
        .eq("masjid_id", currentMasjidId)
        .in("role", ["super_admin", "co_admin"])
        .order("created_at", { ascending: false });

      setAdmins(data || []);
    } catch (error) {
      console.error("Error loading admins:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    try {
      if (!ctx) {
        alert("System not ready. Please try again.");
        return;
      }

      // Validate admin role
      if (!newEmail || !newRole) {
        alert("Email and role are required.");
        return;
      }

      // Get permissions for the role
      const permissions = getDefaultPermissions(newRole);
      
      // Add admin with OTP verification
      const response = await fetch('/admin/api/add-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          role: newRole,
          permissions: permissions,
          full_name: newFullName,
          phone_number: newPhoneNumber,
          designation: newDesignation
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add admin');
      }

      // Show success message
      const successMessage = `
        Administrator added successfully to your masjid!
        
        Email: ${newEmail}
        Full Name: ${newFullName}
        Role: ${newRole.replace('_', ' ').toUpperCase()}
        Designation: ${newDesignation}
        OTP: ${result.otp} (for testing)
        
        Instructions:
        1. Administrator will receive OTP in their email
        2. They need to login with their email
        3. Enter OTP to verify their identity
        4. They will get access to assigned administrative sections
        
        Note: This administrator is specific to your masjid only.
        Other masjids cannot see or access this administrator.
      `;
      
      alert(successMessage);

      // Reset form
      setNewEmail("");
      setNewRole("co_admin");
      setNewFullName("");
      setNewPhoneNumber("");
      setNewDesignation("");
      setShowAddModal(false);

      // Reload data
      await loadData(ctx.masjidId);
      
    } catch (error) {
      console.error("Error adding admin:", error);
      alert("Failed to add administrator: " + (error as Error).message);
    }
  };

  const handleDeleteAdmin = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from administrators?`)) return;

    try {
      if (!ctx) return;
      
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("masjid_id", ctx.masjidId);

      await loadData(ctx.masjidId);
    } catch (error) {
      console.error("Error deleting admin:", error);
      alert("Failed to remove administrator");
    }
  };

  if (loading) return <div>Loading administrators...</div>;

  return (
    <div className="space-y-6">
      {/* Admin Management Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Crown className="w-5 h-5 text-purple-600" />
            Administrator Management
          </h2>
          <p className="text-gray-600 mt-1">Manage your masjid administrators and their permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <Shield className="w-4 h-4" />
          Add Administrator
        </button>
      </div>

      {/* Active Administrators */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="font-semibold text-lg">Active Administrators</h3>
        </div>
        <div className="p-6">
          {admins.length === 0 ? (
            <div className="text-center py-8">
              <Crown className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No administrators added yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 text-purple-600 hover:text-purple-700 font-medium"
              >
                Add your first administrator
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {admins.map((admin) => (
                <div key={admin.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          {admin.role === "super_admin" ? (
                            <Crown className="w-5 h-5 text-purple-600" />
                          ) : (
                            <Shield className="w-5 h-5 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium">{admin.full_name || admin.email}</h4>
                          <p className="text-sm text-gray-600">{admin.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          admin.role === "super_admin" 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {admin.role === "super_admin" ? "SUPER ADMIN" : "CO-ADMIN"}
                        </span>
                        {admin.designation && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {admin.designation}
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          admin.verified 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {admin.verified ? 'Verified' : 'Pending OTP'}
                        </span>
                      </div>

                      {/* Permission Tags */}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(admin.permissions)
                          .filter(([_, enabled]) => enabled)
                          .map(([key]) => {
                            const permission = adminPermissionOptions.find(p => p.key === key);
                            return (
                              <span
                                key={key}
                                className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded border"
                                title={permission?.description}
                              >
                                {permission?.label || key}
                              </span>
                            );
                          })}
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      {admin.phone_number && (
                        <div className="text-sm text-gray-600 mb-2">
                          <Mail className="w-3 h-3 inline mr-1" />
                          {admin.phone_number}
                        </div>
                      )}
                      {admin.role !== "super_admin" && (
                        <button
                          onClick={() => handleDeleteAdmin(admin.user_id, admin.email)}
                          className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Add Administrator</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-purple-800">
                  👑 <strong>Note:</strong> This will add an administrator to your masjid with OTP verification. 
                  They will receive administrative access to manage your masjid operations.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border rounded-lg"
                    placeholder="Enter full name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border rounded-lg"
                    placeholder="admin@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Administrative Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="co_admin">Co-Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Super Admin has full access. Co-Admin has limited administrative access.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Designation</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border rounded-lg"
                    placeholder="e.g., Masjid Manager, Operations Head"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Phone Number</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="tel"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 border rounded-lg"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <button
                onClick={handleAddAdmin}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
              >
                <Crown className="w-4 h-4" />
                Add Administrator to Masjid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
