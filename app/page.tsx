"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMinimalAuth } from "@/components/MinimalAuthProvider";

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useMinimalAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard');
      } else {
        // User is not logged in, redirect to login
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
