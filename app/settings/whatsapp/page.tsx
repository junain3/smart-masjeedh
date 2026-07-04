"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";

export const dynamic = "force-dynamic";

export default function WhatsAppSettingsPage() {
  const { user, tenantContext, loading: authLoading } = useSupabaseAuth();

  const [apiKey, setApiKey] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const masjidId = tenantContext?.masjidId;

  useEffect(() => {
    async function loadConfig() {
      if (!masjidId) {
        setLoading(false);
        setError("Masjid context not found.");
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from("whatsapp_configs")
          .select("id, masjid_id, api_key, phone_number_id")
          .eq("masjid_id", masjidId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setApiKey(data.api_key || "");
          setPhoneNumberId(data.phone_number_id || "");
        }
      } catch (err: any) {
        console.error("Failed to load WhatsApp settings:", err);
        setError(err.message || "Failed to load WhatsApp settings.");
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadConfig();
    }
  }, [masjidId, authLoading]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();

    if (!masjidId) {
      setError("Masjid context is missing.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const { error } = await supabase
        .from("whatsapp_configs")
        .upsert(
          {
            masjid_id: masjidId,
            api_key: apiKey.trim() || null,
            phone_number_id: phoneNumberId.trim() || null,
          },
          { onConflict: "masjid_id" }
        );

      if (error) throw error;

      setMessage("WhatsApp settings saved successfully.");
    } catch (err: any) {
      console.error("Failed to save WhatsApp settings:", err);
      setError(err.message || "Failed to save WhatsApp settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!authLoading && !user) return null;
  if (authLoading) return <div className="p-6">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/settings" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Settings
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">WhatsApp Settings</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">WhatsApp API Configuration</h2>
          <p className="mt-2 text-sm text-gray-600">
            Configure the WhatsApp Cloud API credentials for this masjid.
          </p>

          <form onSubmit={handleSaveSettings} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter WhatsApp API Key"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone Number ID</label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="Enter WhatsApp Phone Number ID"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>

          {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
