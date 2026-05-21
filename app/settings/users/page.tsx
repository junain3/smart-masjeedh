"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Shield, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useAppToast } from "@/components/ToastProvider";

export const dynamic = 'force-dynamic';

type SuperAdminRole = {
  id: string;
  user_id: string;
  email: string | null;
  role: string;
  permissions: Record<string, boolean> | null;
  created_at: string | null;
};

export default function UserSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, tenantContext } = useSupabaseAuth();
  const toast = useAppToast();
  const [loading, setLoading] = useState(true);
  const [superAdmins, setSuperAdmins] = useState<SuperAdminRole[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SuperAdminRole | null>(null);
  const [deleteStep, setDeleteStep] = useState(1);
  const [confirmationText, setConfirmationText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const canAccessPage = tenantContext?.permissions?.settings || tenantContext?.role === 'super_admin';

  useEffect(() => {
    async function loadSuperAdmins() {
      if (authLoading || !user || !tenantContext?.masjidId) return;

      if (!canAccessPage) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("id, user_id, email, role, permissions, created_at")
          .eq("masjid_id", tenantContext.masjidId)
          .eq("role", "super_admin")
          .order("created_at", { ascending: true });

        if (error) throw error;
        setSuperAdmins(data || []);
      } catch (error: any) {
        toast({
          kind: "error",
          title: "Error",
          message: error.message || "Failed to load super admins",
        });
      } finally {
        setLoading(false);
      }
    }

    loadSuperAdmins();
  }, [authLoading, user, tenantContext?.masjidId, canAccessPage, toast]);

  const openDeleteModal = (admin: SuperAdminRole) => {
    setDeleteTarget(admin);
    setDeleteStep(1);
    setConfirmationText("");
    setDeleting(false);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteStep(1);
    setConfirmationText("");
    setDeleting(false);
  };

  const deleteSuperAdmin = async () => {
    if (!deleteTarget || !tenantContext?.masjidId) return;

    setDeleting(true);

    try {
      const response = await fetch("/api/admin/delete-super-admin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetUserId: deleteTarget.user_id,
          masjidId: tenantContext.masjidId,
          confirmationText,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete super admin");
      }

      toast({
        kind: "success",
        title: "Deleted",
        message: result.message || "Super admin account deleted",
      });

      closeDeleteModal();
      router.push("/login");
    } catch (error: any) {
      toast({
        kind: "error",
        title: "Delete Failed",
        message: error.message || "Failed to delete super admin",
      });
      setDeleting(false);
    }
  };

  if (!authLoading && !user) return null;
  if (authLoading) return <div>Loading...</div>;
  if (!canAccessPage) return <div>No access</div>;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">User Settings</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="p-6 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <Crown className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Manage Super Admins</h2>
                <p className="text-sm text-gray-600">Delete super admin accounts for the current tenant with confirmation safeguards</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {superAdmins.length === 0 ? (
              <div className="text-center py-10">
                <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No super admins found for this tenant</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Created At</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {superAdmins.map((admin) => {
                      const actionBlockedReason = tenantContext?.role !== "super_admin"
                        ? "Only super admins can delete super admin accounts"
                        : null;

                      return (
                        <tr key={admin.id} className="hover:bg-neutral-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">
                            {admin.email || "No email"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                              {admin.role.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                            {admin.created_at ? new Date(admin.created_at).toLocaleString() : "Unknown"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {actionBlockedReason ? (
                              <button
                                type="button"
                                disabled
                                title={actionBlockedReason}
                                className="text-neutral-300 cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openDeleteModal(admin)}
                                title="Delete super admin account"
                                className="text-red-600 hover:text-red-900"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-neutral-900">Delete Super Admin</h2>
                <p className="text-sm text-neutral-600 break-all mt-1">{deleteTarget.email}</p>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                className="p-2 hover:bg-neutral-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteStep === 1 && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  You are about to delete a super admin account. This is irreversible.
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="flex-1 py-3 rounded-3xl bg-neutral-100 text-neutral-700 font-bold hover:bg-neutral-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(2)}
                    className="flex-1 py-3 rounded-3xl bg-red-600 text-white font-bold hover:bg-red-700"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Type DELETE SUPERADMIN to confirm
                  </label>
                  <input
                    value={confirmationText}
                    onChange={(event) => setConfirmationText(event.target.value)}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="DELETE SUPERADMIN"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="flex-1 py-3 rounded-3xl bg-neutral-100 text-neutral-700 font-bold hover:bg-neutral-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteStep(3)}
                    disabled={confirmationText !== "DELETE SUPERADMIN"}
                    className="flex-1 py-3 rounded-3xl bg-red-600 text-white font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Review
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 3 && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                  Final confirmation. This will delete tenant data and the Supabase Auth user for this super admin.
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-3xl bg-neutral-100 text-neutral-700 font-bold hover:bg-neutral-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={deleteSuperAdmin}
                    disabled={deleting}
                    className="flex-1 py-3 rounded-3xl bg-red-700 text-white font-black hover:bg-red-800 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
