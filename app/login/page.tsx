"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMockAuth } from "@/components/MockAuthProvider";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, requiresOnboarding, user } = useMockAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");

  // Get deletion info from URL params
  const deletionReason = searchParams.get('reason');
  const deletedBy = searchParams.get('deleted_by');
  const deletedReason = searchParams.get('deleted_reason');
  const deletedAt = searchParams.get('deleted_at');

  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setMessage("");
  setMessageType("");

  if (!email.trim() || !password) {
    setMessage("Please enter your email and password");
    setMessageType("error");
    return;
  }

  setLoading(true);

  try {
    console.log("LOGIN STEP 1: submit started");

    await signIn(email, password);

    console.log("LOGIN STEP 2: signIn finished");

    // Check if user account is deleted before redirecting
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("status, deleted_by, deleted_reason, deleted_at")
        .eq("auth_user_id", user.id)
        .single();

      if (!roleError && roleData && roleData.status === 'deleted') {
        console.log("DEBUG: User account is deleted, signing out");
        await supabase.auth.signOut();
        const loginUrl = new URL('/login', window.location.origin);
        loginUrl.searchParams.set('reason', 'deleted');
        if (roleData.deleted_by) loginUrl.searchParams.set('deleted_by', roleData.deleted_by);
        if (roleData.deleted_reason) loginUrl.searchParams.set('deleted_reason', roleData.deleted_reason);
        if (roleData.deleted_at) loginUrl.searchParams.set('deleted_at', roleData.deleted_at);
        window.location.href = loginUrl.toString();
        return;
      }
    }

    const next = new URLSearchParams(window.location.search).get("next");
    console.log("LOGIN STEP 3: redirecting to", next || "/");

    router.replace(next || "/");
  } catch (error: any) {
    console.error("LOGIN STEP ERROR:", error);
    setMessage("Invalid email or password");
    setMessageType("error");
    setLoading(false);
  }
};

  const handlePasswordRecovery = async () => {
    setMessage("");
    setMessageType("");

    if (!email.trim()) {
      setMessage("Enter your email address to receive a password recovery link.");
      setMessageType("error");
      return;
    }

    setRecovering(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setMessage("If this email exists, a password recovery link has been sent.");
      setMessageType("success");
    } catch (error: any) {
      console.error("PASSWORD RECOVERY ERROR:", error);
      setMessage("Unable to send recovery email. Please try again.");
      setMessageType("error");
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-xl shadow-md w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">Login</h1>

        {message && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              messageType === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-red-50 text-red-700 border border-red-100"
            }`}
            role="alert"
          >
            {message}
          </div>
        )}

        {deletionReason && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-800">
                  {deletionReason === 'deleted' ? 'Account Deleted' : deletionReason === 'masjid_deleted' ? 'Masjid Deleted' : 'Access Revoked'}
                </h3>
                <div className="mt-1 text-sm text-red-700">
                  <p>Your account has been deleted. Your data is retained for a 3-month grace period. Contact support for restoration.</p>
                  {deletedReason && (
                    <p className="mt-1"><strong>Reason:</strong> {deletedReason}</p>
                  )}
                  {deletedBy && (
                    <p className="mt-1"><strong>Deleted by:</strong> {deletedBy}</p>
                  )}
                  {deletedAt && (
                    <p className="mt-1"><strong>Deleted on:</strong> {new Date(deletedAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setMessage("");
              setMessageType("");
            }}
            className="w-full border p-3 rounded"
            placeholder="Enter email"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setMessage("");
                setMessageType("");
              }}
              className="w-full border p-3 rounded pr-10"
              placeholder="Enter password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePasswordRecovery}
          disabled={recovering}
          className="w-full text-sm text-emerald-700 font-semibold disabled:opacity-50"
        >
          {recovering ? "Sending recovery link..." : "Forgot Password / Recovery"}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 text-white py-3 rounded font-semibold disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <Link
          href="/signup"
          className="block text-center text-sm text-emerald-700"
        >
          Create account
        </Link>
      </form>
    </div>
  );
}