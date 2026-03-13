"use client";

import { useMinimalAuth } from "@/components/MinimalAuthProvider";
import { translations, Language } from "@/lib/i18n/translations";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SimpleOnboarding from "@/components/SimpleOnboarding";

export default function HomePage() {
  const { user, loading, requiresOnboarding, refreshTenantContext, authError } = useMinimalAuth();
  const router = useRouter();
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

  // Show error state if there's an auth error
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-red-800 text-lg font-semibold mb-2">Authentication Error</h2>
            <p className="text-red-600 text-sm">{authError}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // If user is authenticated and has tenant context, they should already be redirected to dashboard
  // This page should only show for unauthenticated users or users needing onboarding
  if (user && !requiresOnboarding) {
    // User has tenant context, should be redirected by auth provider
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // If user is authenticated but needs onboarding (truly new user), show setup
  if (user && requiresOnboarding) {
    console.log("DEBUG: Showing onboarding for new user");
    return <SimpleOnboarding onComplete={refreshTenantContext} />;
  }

  // If no user, show landing page
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Smart Masjeedh
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Complete Masjid Management System
          </p>
          
          <div className="space-y-4">
            <Link
              href="/login"
              className="inline-block bg-emerald-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Sign In
            </Link>
            
            <div className="text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 font-semibold">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
