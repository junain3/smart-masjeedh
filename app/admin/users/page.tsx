"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Edit, Search, Loader2, User, Mail, Shield, Check, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useAppToast } from "@/components/ToastProvider";
import { AppShell } from "@/components/AppShell";
import RouteGuard from "@/components/RouteGuard";

export const dynamic = 'force-dynamic';

type UserRole = {
  id: string;
  user_id?: string;
  auth_user_id?: string;
  email: string;
  full_name?: string;
  role: string;
  permissions: Record<string, boolean>;
  onboarding_completed?: boolean;
  created_at: string;
};

export default function UserManagementPage() {
  const { user, tenantContext } = useSupabaseAuth();
  const { toast } = useAppToast();
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<UserRole | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = async () => {
    if (!tenantContext?.masjidId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*")
        .eq("masjid_id", tenantContext.masjidId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
      toast({
        kind: "error",
        title: "Error",
        message: "Failed to load users",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [tenantContext?.masjidId]);

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleEdit = (user: UserRole) => {
    setEditingUser(user);
    setEditFullName(user.full_name || "");
  };

  const handleSave = async () => {
    if (!editingUser) return;

    setIsSaving(true);
    try {
      const userId = editingUser.user_id || editingUser.auth_user_id;
      if (!userId) {
        throw new Error("User ID not found");
      }

      // Get the actual session token from supabase auth
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/admin/api/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          full_name: editFullName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      toast({
        kind: "success",
        title: "Success",
        message: "User profile updated successfully",
      });

      setEditingUser(null);
      setEditFullName("");
      loadUsers();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        kind: "error",
        title: "Error",
        message: error.message || "Failed to update profile",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditFullName("");
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "co_admin":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "editor":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <RouteGuard>
      <AppShell title="User Management" backHref="/admin">
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Users List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-12 text-center">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchQuery ? "No users found matching your search" : "No users found"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((userRole) => (
                <div
                  key={userRole.id}
                  className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-4 hover:shadow-md transition-shadow"
                >
                  {editingUser?.id === userRole.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          placeholder="Enter full name"
                          autoFocus
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={isSaving || !editFullName.trim()}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              Save
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <User className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900 truncate">
                              {userRole.full_name || "No name set"}
                            </p>
                            {!userRole.onboarding_completed && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-200">
                                New
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Mail className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{userRole.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRoleBadgeColor(
                            userRole.role
                          )}`}
                        >
                          {userRole.role.replace("_", " ")}
                        </span>
                        <button
                          onClick={() => handleEdit(userRole)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                          title="Edit profile"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900 mb-1">Profile Management</p>
                <p className="text-sm text-blue-800">
                  Edit user profiles to update names and ensure accurate accountability in transaction
                  logs. Historical records showing "Previous Admin" can be updated with real names
                  here.
                </p>
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </RouteGuard>
  );
}
