"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    masjidName: "",
    tagline: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate form
      if (formData.password !== formData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (formData.password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      console.log("DEBUG: Starting signup process...");

      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      console.log("DEBUG: User created successfully:", authData.user.id);

      // Step 2: Create masjid record
      const { data: masjidData, error: masjidError } = await supabase
        .from("masjids")
        .insert({
          masjid_name: formData.masjidName,
          tagline: formData.tagline,
          created_by: authData.user.id,
        })
        .select("id")
        .single();

      if (masjidError) {
        throw new Error(`Masjid creation failed: ${masjidError.message}`);
      }

      if (!masjidData?.id) {
        throw new Error("Failed to create masjid");
      }

      console.log("DEBUG: Masjid created successfully:", masjidData.id);

      // Step 3: Create user_roles record
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          masjid_id: masjidData.id,
          user_id: authData.user.id,
          auth_user_id: authData.user.id,
          email: formData.email,
          role: "super_admin",
          permissions: {
            accounts: true,
            events: true,
            members: true,
            subscriptions_collect: true,
            subscriptions_approve: true,
            staff_management: true,
            reports: true,
            settings: true,
          },
          verified: true,
        });

      if (roleError) {
        throw new Error(`Role creation failed: ${roleError.message}`);
      }

      console.log("DEBUG: User role created successfully");

      // Step 4: Auto-login the user
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (loginError) {
        console.log("DEBUG: Auto-login failed, but signup succeeded");
        // Don't throw error, just redirect to login
        setSuccess(true);
        return;
      }

      console.log("DEBUG: Auto-login successful");

      // Step 5: Redirect to dashboard
      router.push("/");

    } catch (err: any) {
      console.error("DEBUG: Signup error:", err);
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Account Created!</h2>
            <p className="text-slate-600 mb-6">
              Your masjid has been set up successfully. Please check your email and then sign in to access your dashboard.
            </p>
            <Link
              href="/login"
              className="inline-block bg-emerald-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Your Masjid</h1>
          <p className="text-slate-600">Set up your masjid management system</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Masjid Name *
            </label>
            <input
              type="text"
              name="masjidName"
              value={formData.masjidName}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter masjid name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tagline
            </label>
            <input
              type="text"
              name="tagline"
              value={formData.tagline}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter masjid tagline (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Create a password (min 6 characters)"
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Confirm your password"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating Your Masjid...
              </div>
            ) : (
              "Create Masjid Account"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
