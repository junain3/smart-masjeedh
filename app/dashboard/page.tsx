"use client";

import { useMinimalAuth } from "@/components/MinimalAuthProvider";
import { AppShell } from "@/components/AppShell";
import { translations, Language } from "@/lib/i18n/translations";
import { useEffect, useState } from "react";
import { Calendar, Users, FileText, Settings, Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { user, loading, tenantContext } = useMinimalAuth();
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !tenantContext) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to continue</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell title={t.dashboard}>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back, {user.email?.split('@')[0]}!
          </h1>
          <p className="text-gray-600">
            You are logged in as <span className="font-semibold">{tenantContext.role}</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/events"
            className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 text-emerald-600" />
              <span className="text-sm text-gray-500">Manage</span>
            </div>
            <h3 className="font-semibold text-gray-900">{t.events}</h3>
            <p className="text-sm text-gray-600 mt-1">Create and manage events</p>
          </Link>

          <Link
            href="/families"
            className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-600" />
              <span className="text-sm text-gray-500">Manage</span>
            </div>
            <h3 className="font-semibold text-gray-900">{t.families}</h3>
            <p className="text-sm text-gray-600 mt-1">Manage family records</p>
          </Link>

          <Link
            href="/members"
            className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-purple-600" />
              <span className="text-sm text-gray-500">Manage</span>
            </div>
            <h3 className="font-semibold text-gray-900">{t.members}</h3>
            <p className="text-sm text-gray-600 mt-1">Manage member records</p>
          </Link>

          <Link
            href="/settings"
            className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <Settings className="w-8 h-8 text-gray-600" />
              <span className="text-sm text-gray-500">Manage</span>
            </div>
            <h3 className="font-semibold text-gray-900">{t.settings}</h3>
            <p className="text-sm text-gray-600 mt-1">System settings</p>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No recent activity</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
