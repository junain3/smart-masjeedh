"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const router = useRouter();
  const { user, tenantContext, loading: authLoading } = useSupabaseAuth();
  
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
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
          <p className="text-gray-600 mb-6">
            Configure your masjid settings and preferences.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">General Settings</h3>
              <p className="text-sm text-gray-600">Basic masjid information and configuration</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">User Settings</h3>
              <p className="text-sm text-gray-600">Manage user permissions and roles</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Notification Settings</h3>
              <p className="text-sm text-gray-600">Configure notifications and alerts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
