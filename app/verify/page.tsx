"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function VerifyPage() {
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
      console.log("DEBUG: Verifying code for email:", email);
      console.log("DEBUG: Code entered:", verificationCode);

      // Check if verification code exists and is valid
      const { data: verificationData, error: verificationError } = await supabase
        .from("email_verifications")
        .select("*")
        .eq("email", email)
        .eq("code", verificationCode)
        .eq("used", false)
        .single();

      console.log("DEBUG: Verification query:", { data: verificationData, error: verificationError });

      if (verificationError || !verificationData) {
        throw new Error("Invalid verification code");
      }

      // Check if code is expired (24 hours)
      const createdAt = new Date(verificationData.created_at);
      const now = new Date();
      const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        throw new Error("Verification code has expired");
      }

      // Mark code as used
      await supabase
        .from("email_verifications")
        .update({ used: true })
        .eq("id", verificationData.id);

      // Get user by email
      const { data: userData, error: userError } = await supabase.auth.signInWithPassword({
        email: email,
        password: verificationData.temp_password, // Use temp password for verification
      });

      if (userError) {
        console.log("DEBUG: Auto-login failed, user needs to login manually");
        setSuccess(true);
        return;
      }

      console.log("DEBUG: Verification successful, user logged in");
      router.push("/");

    } catch (err: any) {
      console.error("DEBUG: Verification error:", err);
      setError(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setResending(true);
    setError("");

    try {
      console.log("DEBUG: Resending code to:", email);

      // Generate new 6-digit code
      const newCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store verification code
      const { error: storeError } = await supabase
        .from("email_verifications")
        .insert({
          email: email,
          code: newCode,
          temp_password: "verified", // Placeholder
        });

      if (storeError) {
        throw new Error("Failed to generate verification code");
      }

      // TODO: Send actual email
      console.log("DEBUG: New verification code:", newCode);
      console.log("DEBUG: Email would be sent to:", email);

      alert(`New verification code: ${newCode} (In production, this would be emailed)`);

    } catch (err: any) {
      console.error("DEBUG: Resend error:", err);
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
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Email Verified!</h2>
            <p className="text-slate-600 mb-6">
              Your email has been verified successfully. You can now sign in to access your dashboard.
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
            We've sent a 6-digit code to {email}
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
            Didn't receive the code?
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
