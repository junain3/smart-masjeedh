"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Home as HomeIcon, Users, Edit, User, CreditCard, Menu } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const [time, setTime] = useState(new Date());
  const [familyCount, setFamilyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch family count from Supabase
  useEffect(() => {
    async function fetchCount() {
      try {
        if (!supabase) return;
        const { count, error } = await supabase
          .from("families")
          .select("*", { count: "exact", head: true });
        
        if (error) throw error;
        setFamilyCount(count || 0);
      } catch (err) {
        console.error("Error fetching family count:", err);
        setFamilyCount(1); 
      } finally {
        setLoading(false);
      }
    }
    fetchCount();
  }, []);

  // Format date: "25 February 2026 at 6:43"
  const formatDate = (date: Date) => {
    const d = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    return `${d} at ${t}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black font-sans pb-24">
      {/* Header */}
      <header className="p-4 flex items-center justify-between sticky top-0 bg-white z-20">
        <button className="p-2 text-gray-600">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold">Home</h1>
        <div className="w-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-6 w-full">
        {/* Date Display */}
        <div className="text-center">
          <p className="text-xl font-medium text-black">
            {formatDate(time)}
          </p>
        </div>

        {/* MJM Logo */}
        <div className="flex justify-center py-2">
          <div className="relative w-72 h-72 flex flex-col items-center justify-center p-4">
            {/* Simple Mosque Illustration */}
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
               <svg viewBox="0 0 200 200" className="w-full h-full fill-emerald-600">
                 <path d="M100 20 C60 20 30 60 30 100 L30 180 L170 180 L170 100 C170 60 140 20 100 20 Z" />
               </svg>
            </div>
            
            <div className="text-center z-10 space-y-0">
              <div className="mb-2 text-[#00a859]">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L4 7v11h16V7l-8-5z"></path>
                  <path d="M12 22v-4"></path>
                  <path d="M8 18v4"></path>
                  <path d="M16 18v4"></path>
                  <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                </svg>
              </div>
              <h2 className="text-6xl font-bold text-[#003d5b] tracking-tighter leading-none">MJM</h2>
              <p className="text-xs font-bold text-[#c6893f] uppercase tracking-wider">Mubeen Jummah Masjid</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Link 
          href="/families"
          className="w-full bg-[#00c853] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-sm active:scale-[0.98] transition-all"
        >
          <HomeIcon className="w-5 h-5" />
          Add New Family
        </Link>

        {/* Stats Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-2xl font-bold text-black">Total Families</h3>
          <div className="w-full bg-white border border-gray-200 rounded-2xl p-5 flex items-center h-16">
            <span className="text-2xl font-medium text-black">
              {loading ? "..." : familyCount}
            </span>
          </div>
        </div>

        {/* Custom Bottom Grid Navigation */}
        <div className="grid grid-cols-3 gap-3 pt-4">
          <Link href="/families" className="flex flex-col items-center justify-center gap-1 p-4 bg-[#f0fdf4] rounded-2xl border border-[#dcfce7]">
            <Users className="w-6 h-6 text-[#00c853]" />
            <span className="text-[10px] font-bold text-[#00c853]">Families</span>
          </Link>
          
          <div className="flex flex-col items-center justify-center gap-1 p-4 bg-[#f0fdf4] rounded-2xl border border-[#dcfce7] opacity-80">
            <Edit className="w-6 h-6 text-[#00c853]" />
            <span className="text-[10px] font-bold text-[#00c853]">Accounts</span>
          </div>

          <div className="flex flex-col items-center justify-center gap-1 p-4 bg-[#f0fdf4] rounded-2xl border border-[#dcfce7] opacity-80">
            <User className="w-6 h-6 text-[#00c853]" />
            <span className="text-[10px] font-bold text-[#00c853]">Staff</span>
          </div>
        </div>
      </main>
    </div>
  );
}
