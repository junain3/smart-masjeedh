"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface StaffSalaryFormProps {
  masjidId: string;
  onStaffAdded: () => void;
}

export default function StaffSalaryForm({ masjidId, onStaffAdded }: StaffSalaryFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "staff" as "super_admin" | "co_admin" | "staff" | "editor",
    salary: "",
    salary_type: "monthly" as "monthly" | "weekly" | "daily" | "hourly",
    bank_name: "",
    bank_account: "",
    bank_ifsc: "",
    joining_date: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate salary details
      if (!formData.salary || parseFloat(formData.salary) <= 0) {
        setError("Salary amount is required and must be greater than 0");
        return;
      }

      if (!formData.bank_name || !formData.bank_account || !formData.bank_ifsc) {
        setError("Bank details are required for salary processing");
        return;
      }

      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: "tempPassword123!", // You might want to generate a random password
      });

      if (authError) {
        setError("Failed to create user account: " + authError.message);
        return;
      }

      if (!authData.user) {
        setError("Failed to create user account");
        return;
      }

      // Create staff record with salary details
      const { error: staffError } = await supabase.from("staff").insert({
        masjid_id: masjidId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        salary: parseFloat(formData.salary),
        salary_type: formData.salary_type,
        bank_name: formData.bank_name,
        bank_account: formData.bank_account,
        bank_ifsc: formData.bank_ifsc,
        joining_date: formData.joining_date,
        status: "active",
      });

      if (staffError) {
        setError("Failed to create staff record: " + staffError.message);
        return;
      }

      // Create user role
      const { error: roleError } = await supabase.from("user_roles").insert({
        auth_user_id: authData.user.id,
        masjid_id: masjidId,
        role: formData.role,
        permissions: getRolePermissions(formData.role),
      });

      if (roleError) {
        setError("Failed to assign user role: " + roleError.message);
        return;
      }

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        role: "staff",
        salary: "",
        salary_type: "monthly",
        bank_name: "",
        bank_account: "",
        bank_ifsc: "",
        joining_date: new Date().toISOString().split("T")[0],
      });

      onStaffAdded();

    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getRolePermissions = (role: string) => {
    switch (role) {
      case "super_admin":
        return {
          manage_users: true,
          manage_events: true,
          manage_families: true,
          manage_members: true,
          manage_finances: true,
          manage_settings: true,
        };
      case "co_admin":
        return {
          manage_events: true,
          manage_families: true,
          manage_members: true,
          manage_finances: true,
        };
      case "staff":
        return {
          manage_events: true,
          manage_members: true,
        };
      case "editor":
        return {
          manage_events: true,
        };
      default:
        return {};
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Add Staff Member</h3>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="staff">Staff</option>
              <option value="editor">Editor</option>
              <option value="co_admin">Co-Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Salary Amount *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.salary}
              onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Salary Type *
            </label>
            <select
              required
              value={formData.salary_type}
              onChange={(e) => setFormData({ ...formData, salary_type: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Name *
            </label>
            <input
              type="text"
              required
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank Account Number *
            </label>
            <input
              type="text"
              required
              value={formData.bank_account}
              onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bank IFSC Code *
            </label>
            <input
              type="text"
              required
              value={formData.bank_ifsc}
              onChange={(e) => setFormData({ ...formData, bank_ifsc: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Joining Date *
            </label>
            <input
              type="date"
              required
              value={formData.joining_date}
              onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 text-white px-6 py-2 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            {loading ? "Adding Staff..." : "Add Staff Member"}
          </button>
        </div>
      </form>
    </div>
  );
}
