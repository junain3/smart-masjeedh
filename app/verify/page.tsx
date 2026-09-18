"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function VerifyPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [resending, setResending] = useState(false);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
      
      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.getElementById(`code-${index + 1}`) as HTMLInputElement;
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`) as HTMLInputElement;
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, 6);
    
    const newCode = [...code];
    for (let i = 0; i < 6; i++) {
      newCode[i] = digits[i] || "";
    }
    setCode(newCode);
  };

  const verifyCode = async () => {
    const verificationCode = code.join("");
    if (verificationCode.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setLoading(true);
    setError("");

    try {
      console.log("[Verify] Verifying OTP for email:", email);

      // Call custom verify-otp endpoint
      const verifyResponse = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp: verificationCode,
        }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || "Invalid verification code");
      }

      console.log("[Verify] OTP verified successfully");

      // Get stored signup data
      const masjidName = localStorage.getItem('signup_masjid_name');
      const tagline = localStorage.getItem('signup_tagline');
      const password = localStorage.getItem('signup_password');

      if (!masjidName || !password) {
        throw new Error("Signup data not found. Please sign up again.");
      }

      // Call API to create user, masjid and user_roles
      console.log("[Verify] Calling complete-signup API");
      const response = await fetch('/api/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          masjidName,
          tagline,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to complete signup");
      }

      console.log("[Verify] Masjid and user_roles created successfully");

      // Clear localStorage
      localStorage.removeItem('signup_masjid_name');
      localStorage.removeItem('signup_tagline');
      localStorage.removeItem('signup_password');

      setSuccess(true);

    } catch (err: any) {
      console.error("[Verify] Error:", err);
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setResending(true);
    setError("");

    try {
      console.log("[Verify] Resending OTP to:", email);

      // Call custom send-otp endpoint
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend code");
      }

      console.log("[Verify] OTP resent successfully");

    } catch (err: any) {
      console.error("[Verify] Resend error:", err);
      setError(err.message || "Failed to resend code");
    } finally {
      setResending(false);
    }
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
              Your account has been created successfully. You can now sign in to access your dashboard.
            </p>
            <button
              onClick={() => router.push("/login")}
              className="inline-block bg-emerald-600 text-white py-3 px-6 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Verify Your Email</h1>
          <p className="text-slate-600">
            We&apos;ve sent a 6-digit code to {email}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-4">
            Enter Verification Code
          </label>
          <div className="flex gap-2 justify-center">
            {code.map((digit, index) => (
              <input
                key={index}
                id={`code-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="w-12 h-12 text-center text-xl font-bold border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                autoFocus={index === 0}
              />
            ))}
          </div>
        </div>

        <button
          onClick={verifyCode}
          disabled={loading || code.join("").length !== 6}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Verifying...
            </div>
          ) : (
            "Verify Email"
          )}
        </button>

        <div className="text-center">
          <p className="text-slate-600 text-sm mb-2">
            Didn&apos;t receive the code?
          </p>
          <button
            onClick={resendCode}
            disabled={resending}
            className="text-emerald-600 hover:text-emerald-700 font-medium text-sm disabled:opacity-50"
          >
            {resending ? "Resending..." : "Resend Code"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <VerifyPageContent />
    </Suspense>
  );
}
