"use client";

import { useState } from "react";
import { X, User, Loader2 } from "lucide-react";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useAppToast } from "@/components/ToastProvider";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const { user, tenantContext } = useSupabaseAuth();
  const { toast } = useAppToast();
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast({
        kind: "error",
        title: "Name Required",
        message: "Please enter your full name",
      });
      return;
    }

    if (!user?.id) {
      toast({
        kind: "error",
        title: "Error",
        message: "User not authenticated",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/admin/api/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tenantContext?.accessToken || ""}`,
        },
        body: JSON.stringify({
          userId: user.id,
          full_name: fullName.trim(),
          onboarding_completed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      toast({
        kind: "success",
        title: "Welcome!",
        message: "Your profile has been set up successfully",
      });

      onComplete();
      onClose();
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        kind: "error",
        title: "Error",
        message: error.message || "Failed to complete onboarding",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <User className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold">Welcome to Smart Masjid</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-emerald-100 text-sm">
            Please complete your profile to get started
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
              disabled={isSubmitting}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              This name will be displayed in transaction logs and collection records
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="text-sm text-emerald-800">
              <span className="font-semibold">Why we need this:</span> Your full name helps
              maintain accountability and transparency in all system records.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !fullName.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              "Complete Setup"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
