"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface SimpleOnboardingProps {
  onComplete: () => void;
}

export default function SimpleOnboarding({ onComplete }: SimpleOnboardingProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [masjidName, setMasjidName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("DEBUG: Starting simple onboarding...");

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("No user session found");
      }

      console.log("DEBUG: Creating masjid for user:", session.user.email);

      // Step 1: Create masjid
      const { data: masjidData, error: masjidError } = await supabase
        .from("masjids")
        .insert({
          masjid_name: masjidName || `${session.user.email?.split('@')[0]}'s Masjid`,
          created_by: session.user.id
        })
        .select("id")
        .single();

      if (masjidError || !masjidData?.id) {
        throw new Error(masjidError?.message || "Failed to create masjid");
      }

      console.log("DEBUG: Masjid created:", masjidData.id);

      // Check if there's an existing deleted user_roles entry for this user
      const { data: existingRole, error: existingRoleError } = await supabase
        .from("user_roles")
        .select("*")
        .or(`user_id.eq.${session.user.id},auth_user_id.eq.${session.user.id}`)
        .maybeSingle();

      console.log("DEBUG: Existing role check:", { existingRole, existingRoleError });

      if (existingRole && existingRole.status === 'deleted') {
        // Restore the deleted entry
        console.log("DEBUG: Found deleted role, restoring it");

        // Restore the masjid if it was deleted
        const { data: existingMasjid, error: masjidCheckError } = await supabase
          .from("masjids")
          .select("*")
          .eq("id", existingRole.masjid_id)
          .maybeSingle();

        if (existingMasjid && existingMasjid.status === 'deleted') {
          console.log("DEBUG: Restoring deleted masjid");
          await supabase
            .from("masjids")
            .update({
              status: 'active',
              deleted_at: null,
              deleted_by: null,
              deleted_reason: null,
              masjid_name: masjidName || `${session.user.email?.split('@')[0]}'s Masjid`,
            })
            .eq("id", existingRole.masjid_id);
        }

        // Restore the user_roles entry
        const { error: restoreError } = await supabase
          .from("user_roles")
          .update({
            status: 'active',
            deleted_at: null,
            deleted_by: null,
            deleted_reason: null,
            role: "super_admin",
            permissions: {
              accounts: true,
              events: true,
              members: true,
              subscriptions_collect: true,
              subscriptions_approve: true,
              staff_management: true,
              reports: true,
              settings: true
            },
            verified: true,
            user_id: session.user.id,
            email: session.user.email || "",
          })
          .eq("id", existingRole.id);

        if (restoreError) {
          throw new Error(restoreError.message || "Failed to restore user role");
        }

        console.log("DEBUG: Role restored successfully");
      } else {
        // Step 2: Create user_roles
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            masjid_id: masjidData.id,
            user_id: session.user.id,
            auth_user_id: session.user.id,
            email: session.user.email || "",
            role: "super_admin",
            permissions: {
              accounts: true,
              events: true,
              members: true,
              subscriptions_collect: true,
              subscriptions_approve: true,
              staff_management: true,
              reports: true,
              settings: true
            },
            verified: true
          });

        if (roleError) {
          throw new Error(roleError.message || "Failed to create user role");
        }
      }

      console.log("DEBUG: User role created successfully");

      // Step 3: Complete onboarding and let auth provider handle redirect
      console.log("DEBUG: Onboarding completed, calling onComplete");
      onComplete();

    } catch (err) {
      console.error("DEBUG: Onboarding failed:", err);
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🕌</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Set Up Your Masjid
          </h2>
          <p className="text-gray-600">
            Create your masjid profile to get started
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Masjid Name *
            </label>
            <input
              type="text"
              value={masjidName}
              onChange={(e) => setMasjidName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter masjid name"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Masjid"}
          </button>
        </form>
      </div>
    </div>
  );
}
