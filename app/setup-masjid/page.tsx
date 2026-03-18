"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMockAuth } from "@/components/MockAuthProvider";

export default function SetupMasjidPage() {
  const router = useRouter();
  const { user, signIn } = useMockAuth();
  const [loading, setLoading] = useState(false);
  const [masjidName, setMasjidName] = useState("");
  const [masjidAddress, setMasjidAddress] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate masjid setup - in real app, this would create masjid record
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // After setup, redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("Setup error:", error);
      alert("Setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup Your Masjid</h1>
          <p className="text-gray-600">Welcome! Let's configure your masjid information.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Masjid Name
            </label>
            <input
              type="text"
              required
              value={masjidName}
              onChange={(e) => setMasjidName(e.target.value)}
              className="w-full border p-3 rounded"
              placeholder="Enter masjid name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Masjid Address
            </label>
            <textarea
              required
              value={masjidAddress}
              onChange={(e) => setMasjidAddress(e.target.value)}
              className="w-full border p-3 rounded"
              placeholder="Enter masjid address"
              rows={3}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded font-semibold disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
