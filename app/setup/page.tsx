"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMockAuth } from "@/components/MockAuthProvider";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Check } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const { user } = useMockAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [masjidName, setMasjidName] = useState("");
  const [masjidAddress, setMasjidAddress] = useState("");
  const [masjidPhone, setMasjidPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create masjid record
      const { data: masjidData, error: masjidError } = await supabase
        .from("masjids")
        .insert([
          {
            name: masjidName,
            address: masjidAddress,
            phone: masjidPhone,
            created_by: user?.id,
          }
        ])
        .select()
        .single();

      if (masjidError) throw masjidError;

      // Update user profile with masjid_id
      const { error: profileError } = await supabase
        .from("user_profiles")
        .update({
          masjid_id: masjidData.id,
          role: "super_admin",
        })
        .eq("auth_user_id", user?.id);

      if (profileError) throw profileError;

      setStep(2);
    } catch (error) {
      console.error("Setup error:", error);
      alert("Setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    router.push("/dashboard");
  };

  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete!</h1>
            <p className="text-gray-600 mb-6">Your masjid has been successfully set up.</p>
            <button
              onClick={goToDashboard}
              className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Masjid Setup</h1>
          <p className="text-gray-600">Let's set up your masjid profile</p>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="masjidName" className="block text-sm font-medium text-gray-700">
                Masjid Name
              </label>
              <input
                id="masjidName"
                name="masjidName"
                type="text"
                required
                value={masjidName}
                onChange={(e) => setMasjidName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter masjid name"
              />
            </div>

            <div>
              <label htmlFor="masjidAddress" className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <textarea
                id="masjidAddress"
                name="masjidAddress"
                required
                value={masjidAddress}
                onChange={(e) => setMasjidAddress(e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter masjid address"
              />
            </div>

            <div>
              <label htmlFor="masjidPhone" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                id="masjidPhone"
                name="masjidPhone"
                type="tel"
                required
                value={masjidPhone}
                onChange={(e) => setMasjidPhone(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
              >
                {loading ? "Setting up..." : "Complete Setup"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
