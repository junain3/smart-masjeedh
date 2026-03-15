"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log("🔐 AUTH GUARD: Checking session...");
        
        // Check session first
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        console.log("🔐 AUTH GUARD - Session Data:", {
          session: sessionData.session,
          error: sessionError,
          hasSession: !!sessionData.session
        });

        if (sessionError) {
          console.error("🔐 AUTH GUARD - Session Error:", sessionError);
          throw sessionError;
        }

        if (!sessionData.session) {
          console.log("🔐 AUTH GUARD: No session found, redirecting to login");
          router.push("/login");
          return;
        }

        // Get user details
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        console.log("🔐 AUTH GUARD - User Data:", {
          user: userData.user,
          error: userError,
          hasUser: !!userData.user
        });

        if (userError) {
          console.error("🔐 AUTH GUARD - User Error:", userError);
          throw userError;
        }

        if (!userData.user) {
          console.log("🔐 AUTH GUARD: No user found, redirecting to login");
          router.push("/login");
          return;
        }

        console.log("🔐 AUTH GUARD: User authenticated successfully", {
          userId: userData.user.id,
          email: userData.user.email
        });

        setAuthenticated(true);
      } catch (error) {
        console.error("🔐 AUTH GUARD: Authentication check failed:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("🔐 AUTH GUARD: Auth state changed", {
          event,
          hasSession: !!session,
          userId: session?.user?.id
        });

        if (event === 'SIGNED_OUT' || !session) {
          console.log("🔐 AUTH GUARD: User signed out, redirecting to login");
          router.push("/login");
        } else if (event === 'SIGNED_IN' && session) {
          console.log("🔐 AUTH GUARD: User signed in");
          setAuthenticated(true);
          setLoading(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
