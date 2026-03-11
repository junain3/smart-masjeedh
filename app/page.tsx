"use client";

import { useCleanAuth } from "@/components/CleanAuthProvider";
import { translations, Language } from "@/lib/i18n/translations";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MasjidSetup from "@/components/MasjidSetup";

export default function HomePage() {
  const { user, loading, requiresOnboarding } = useCleanAuth();
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

  // If user is authenticated and has tenant context, redirect to dashboard
  if (user && !requiresOnboarding) {
    router.push("/dashboard");
    return null;
  }

  // If user is authenticated but needs onboarding, show setup
  if (user && requiresOnboarding) {
    return <MasjidSetup onComplete={() => router.push("/dashboard")} />;
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
              Don't have an account?{" "}
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
