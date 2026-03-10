"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface MasjidSetupProps {
  onSetupComplete: () => void;
}

export default function MasjidSetup({ onSetupComplete }: MasjidSetupProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    tagline: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      console.log("DEBUG MasjidSetup - Starting masjid creation...");

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("No user session found");
      }

      // Create masjid
      const { data: masjidData, error: masjidError } = await supabase
        .from("masjids")
        .insert({
          masjid_name: formData.name || `${session.user.email?.split('@')[0]}'s Masjid`,
          tagline: formData.tagline || "Smart Masjid Management",
          created_by: session.user.id
        })
        .select("id")
        .single();

      console.log("DEBUG MasjidSetup - Masjid creation result:", { data: masjidData, error: masjidError?.message });

      if (masjidError) {
        throw new Error(masjidError.message);
      }

      if (!masjidData?.id) {
        throw new Error("Failed to create masjid");
      }

      // Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          masjid_id: masjidData.id,
          user_id: crypto.randomUUID(),
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

      console.log("DEBUG MasjidSetup - Role creation result:", { error: roleError?.message });

      if (roleError) {
        throw new Error(roleError.message);
      }

      console.log("DEBUG MasjidSetup - Setup completed successfully");
      
      // Trigger parent component to refresh tenant context
      onSetupComplete();

    } catch (err) {
      console.error("DEBUG MasjidSetup - Setup failed:", err);
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-3xl">🕌</span>
      </div>
      
      <h2 className="text-2xl font-bold text-slate-900 mb-4 text-center">
        Set Up Your Masjid
      </h2>
      
      <p className="text-slate-600 mb-6 text-center">
        Create your masjid profile to get started with smart management
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Masjid Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter masjid name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tagline
          </label>
          <input
            type="text"
            value={formData.tagline}
            onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter masjid tagline (optional)"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Creating Masjid...
            </div>
          ) : (
            "Create Masjid"
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={() => router.push('/register')}
          className="text-slate-600 hover:text-slate-800 text-sm"
        >
          Want to register a different masjid instead?
        </button>
      </div>
    </div>
  );
}
