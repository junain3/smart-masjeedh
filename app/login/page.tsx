"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMockAuth } from "@/components/MockAuthProvider";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, requiresOnboarding, user } = useMockAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success" | "">("");

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
        redirectTo: `${window.location.origin}/login`,
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
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setMessage("");
              setMessageType("");
            }}
            className="w-full border p-3 rounded"
            placeholder="Enter password"
          />
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