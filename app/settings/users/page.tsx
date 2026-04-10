"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { getTenantContext } from "@/lib/tenant";
import { useAppToast } from "@/components/ToastProvider";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";

export const dynamic = 'force-dynamic';

export default function UserSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading, tenantContext } = useSupabaseAuth();
  const [lang, setLang] = useState<Language>("en");
  const t = getTranslation(lang);

  // Login redirect effect
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  // Return null if redirecting
  if (!authLoading && !user) return null;

  // Page-level access control (after all hooks)
  if (authLoading) return <div>Loading...</div>;
  if (!tenantContext?.permissions?.settings && tenantContext?.role !== 'super_admin') {
    return <div>No access</div>;
  }

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">User Settings</h2>
          <p className="text-sm text-gray-600">Manage user permissions and roles</p>
        </div>
      </div>
    </div>
  );
}
