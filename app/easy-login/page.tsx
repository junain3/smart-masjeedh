"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function EasyLoginPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  const handleEasyLogin = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("DEBUG: Easy login for email:", email);

      // Check if user exists and is verified
      const { data: userData, error: userError } = await supabase
        .from("user_roles")
        .select("auth_user_id, masjid_id, role")
        .eq("email", email)
        .single();

      console.log("DEBUG: User check:", { data: userData, error: userError });

      if (userError || !userData) {
        throw new Error("Email not found. Please sign up first.");
      }

      // Generate new 6-digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store verification code
      const { error: codeError } = await supabase
        .from("email_verifications")
        .upsert({
          email: email,
          code: verificationCode,
          temp_password: "verified",
          used: false,
        }, {
          onConflict: 'email'
        });

      if (codeError) {
        throw new Error("Failed to generate login code");
      }

      console.log("DEBUG: Login code generated:", verificationCode);
      
      // TODO: Send actual email
      alert(`Your login code is: ${verificationCode}`);

      // Redirect to verification page
      router.push(`/verify?email=${encodeURIComponent(email)}`);

    } catch (err: any) {
      console.error("DEBUG: Easy login error:", err);
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Easy Login</h1>
          <p className="text-slate-600">
            Enter your email to receive a login code
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your email"
              required
            />
          </div>

          <button
            onClick={handleEasyLogin}
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Sending Login Code...
              </div>
            ) : (
              "Send Login Code"
            )}
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-slate-600 text-sm">
            Don&apos;t have an account?{" "}
            <button
              onClick={() => router.push("/signup")}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Sign Up
            </button>
          </p>
          <p className="text-slate-600 text-sm mt-2">
            Prefer password login?{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Traditional Login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
