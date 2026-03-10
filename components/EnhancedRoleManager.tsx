"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { X, User, Mail, Phone, Briefcase, DollarSign, Shield, Users } from "lucide-react";

type UserRole = {
  id: string;
  user_id: string;
  email: string;
  role: "super_admin" | "co_admin" | "staff";
  permissions: Record<string, boolean>;
  commission_percent?: number;
  employee_id?: string;
  full_name?: string;
  phone_number?: string;
  designation?: string;
  verified: boolean;
  created_at: string;
};

type Employee = {
  id: string;
  masjid_id: string;
  email: string;
  full_name: string;
  phone_number: string;
  designation: string;
  salary_type: "monthly" | "weekly" | "daily";
  salary_amount: number;
  commission_percent: number;
  status: "active" | "inactive" | "terminated";
  hire_date: string;
};

export function EnhancedRoleManager() {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ctx, setCtx] = useState<any>(null);

  // Form states
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"super_admin" | "co_admin" | "staff">("staff");
  const [newCommission, setNewCommission] = useState("10");
  const [newFullName, setNewFullName] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newSalaryType, setNewSalaryType] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [newSalaryAmount, setNewSalaryAmount] = useState("");

  // Permission definitions
  const permissionOptions = [
    { key: "accounts", label: "Accounts Management", description: "View and manage financial transactions", icon: DollarSign },
    { key: "events", label: "Events Management", description: "Create and manage events", icon: Users },
    { key: "members", label: "Members Management", description: "Manage member records and profiles", icon: User },
    { key: "subscriptions_collect", label: "Collections", description: "Collect subscriptions and manage payments", icon: DollarSign },
    { key: "subscriptions_approve", label: "Approve Collections", description: "Approve collected subscriptions", icon: Shield },
    { key: "staff_management", label: "Staff Management", description: "Manage staff and employees", icon: Users },
    { key: "reports", label: "Reports", description: "View and generate reports", icon: DollarSign },
    { key: "settings", label: "Settings", description: "Manage system settings", icon: Shield }
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
      case "staff":
        return {
          subscriptions_collect: true
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
        console.error("Error initializing RoleManager:", error);
        setLoading(false);
      }
    };
    initializeData();
  }, []);

  const loadData = async (currentMasjidId: string) => {
    try {
      const [rolesRes, employeesRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*")
          .eq("masjid_id", currentMasjidId)
          .order("created_at", { ascending: false }),
        supabase
          .from("employees")
          .select("*")
          .eq("masjid_id", currentMasjidId)
          .order("hire_date", { ascending: false })
      ]);

      setRoles(rolesRes.data || []);
      setEmployees(employeesRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    try {
      if (!ctx) {
        alert("System not ready. Please try again.");
        return;
      }

      // Validate collection permissions require salary
      const permissions = getDefaultPermissions(newRole);
      if (permissions.subscriptions_collect && !newSalaryAmount) {
        alert("Salary details are required for collection permissions.");
        return;
      }

      // Add staff with enhanced details
      const response = await fetch('/admin/api/add-staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          role: newRole,
          permissions: permissions,
          commission_percent: newRole === "staff" ? parseFloat(newCommission) : null,
          full_name: newFullName,
          phone_number: newPhoneNumber,
          designation: newDesignation,
          salary_type: newSalaryType,
          salary_amount: parseFloat(newSalaryAmount) || null
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add staff');
      }

      // Show success message
      const successMessage = `
        Staff member added successfully to your masjid!
        
        Email: ${newEmail}
        Full Name: ${newFullName}
        Role: ${newRole.replace('_', ' ').toUpperCase()}
        Designation: ${newDesignation}
        OTP: ${result.otp} (for testing)
        
        Employee Record: ${result.employee_created ? 'Created' : 'Not Required'}
        ${result.employee_created ? `Salary: ${newSalaryType} - ₹${newSalaryAmount}` : ''}
        
        Instructions:
        1. Staff member will receive OTP in their email
        2. They need to login with their email
        3. Enter OTP to verify their identity
        4. They will get access to assigned sections only
        
        Note: This staff member is specific to your masjid only.
        Other masjids cannot see or access this staff member.
      `;
      
      alert(successMessage);

      // Reset form
      setNewEmail("");
      setNewRole("staff");
      setNewCommission("10");
      setNewFullName("");
      setNewPhoneNumber("");
      setNewDesignation("");
      setNewSalaryType("monthly");
      setNewSalaryAmount("");
      setShowAddModal(false);

      // Reload data
      await loadData(ctx.masjidId);
      
    } catch (error) {
      console.error("Error adding staff:", error);
      alert("Failed to add staff: " + (error as Error).message);
    }
  };

  if (loading) return <div>Loading staff management...</div>;

  return (
    <div className="space-y-6">
      {/* Staff Management Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Staff & User Management</h2>
          <p className="text-gray-600 mt-1">Manage your masjid staff and their permissions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Users className="w-4 h-4" />
          Add Staff Member
        </button>
      </div>

      {/* Active Staff Members */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-6 border-b">
          <h3 className="font-semibold text-lg">Active Staff Members</h3>
        </div>
        <div className="p-6">
          {roles.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No staff members added yet</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 text-blue-600 hover:text-blue-700 font-medium"
              >
                Add your first staff member
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {roles.map((role) => (
                <div key={role.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">{role.full_name || role.email}</h4>
                          <p className="text-sm text-gray-600">{role.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 mb-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                          {role.role.replace('_', ' ').toUpperCase()}
                        </span>
                        {role.designation && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {role.designation}
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          role.verified 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {role.verified ? 'Verified' : 'Pending OTP'}
                        </span>
                      </div>

                      {/* Permission Tags */}
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(role.permissions)
                          .filter(([_, enabled]) => enabled)
                          .map(([key]) => {
                            const permission = permissionOptions.find(p => p.key === key);
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
                      {role.commission_percent && (
                        <div className="text-sm">
                          <span className="text-gray-500">Commission:</span>
                          <span className="font-medium ml-1">{role.commission_percent}%</span>
                        </div>
                      )}
                      {role.phone_number && (
                        <div className="text-sm text-gray-600 mt-1">
                          <Phone className="w-3 h-3 inline mr-1" />
                          {role.phone_number}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Add Staff Member</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 <strong>Note:</strong> This will add a staff member to your masjid with OTP verification. 
                  They will receive an OTP to verify their email identity before accessing the system.
                </p>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border rounded-lg"
                      placeholder="Enter full name"
                      required
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
                      placeholder="staff@example.com"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="tel"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 border rounded-lg"
                      placeholder="+91 98765 43210"
                    />
                  </div>
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
                      placeholder="e.g., Office Staff, Imam"
                    />
                  </div>
                </div>
              </div>

              {/* Role and Permissions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Role *</label>
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
              </div>

              {/* Salary Details (Required for Collection Permissions) */}
              {newRole === "staff" && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-3">Salary Details (Required for Collections)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Salary Type *</label>
                      <select
                        value={newSalaryType}
                        onChange={(e) => setNewSalaryType(e.target.value as any)}
                        className="w-full p-3 border rounded-lg"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="daily">Daily</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Salary Amount (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newSalaryAmount}
                        onChange={(e) => setNewSalaryAmount(e.target.value)}
                        className="w-full p-3 border rounded-lg"
                        placeholder="15000"
                        required
                      />
                    </div>
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    ⚠️ Staff members with collection permissions must have salary details configured for commission tracking.
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleAddStaff}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />
                Add Staff Member to Masjid
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
