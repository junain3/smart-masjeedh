"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Home, Users, CreditCard, UserCheck, Plus, Clock, LayoutDashboard } from "lucide-react";
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
        // Fallback to dummy count if fetch fails
        setFamilyCount(1); 
      } finally {
        setLoading(false);
      }
    }
    fetchCount();
  }, []);

  // Format date: "24 February 2026 at 15:45"
  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    };
    const formatted = new Intl.DateTimeFormat('en-GB', options).format(date);
    // Add "at" between date and time
    const parts = formatted.split(', ');
    return `${parts[0]} at ${parts[1]}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black font-sans pb-24">
      {/* Header */}
      <header className="p-4 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-10">
        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <h1 className="text-xl font-bold">Home</h1>
        <div className="w-10"></div> {/* Spacer */}
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-8 max-w-md mx-auto w-full">
        {/* Date Display */}
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-800">
            {formatDate(time)}
          </p>
        </div>

        {/* MJM Logo Placeholder */}
        <div className="flex justify-center py-4">
          <div className="relative w-64 h-64 bg-emerald-50 rounded-full flex flex-col items-center justify-center p-8 border-4 border-emerald-100 shadow-xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/50 to-transparent pointer-events-none"></div>
            
            {/* Simple Mosque Icon representation */}
            <div className="mb-4 text-emerald-600 group-hover:scale-110 transition-transform duration-500">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L4 7v11h16V7l-8-5z"></path>
                <path d="M12 22v-4"></path>
                <path d="M8 18v4"></path>
                <path d="M16 18v4"></path>
                <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
              </svg>
            </div>
            
            <div className="text-center z-10">
              <h2 className="text-4xl font-black text-emerald-800 tracking-tighter leading-none mb-1">MJM</h2>
              <p className="text-xs font-bold text-emerald-600/80 uppercase tracking-widest">Mubeen Jummah Masjid</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Link 
          href="/families"
          className="w-full bg-[#00c853] hover:bg-[#00b24a] text-white py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-lg shadow-lg shadow-green-200 transition-all active:scale-95 group"
        >
          <div className="p-1.5 bg-white/20 rounded-lg group-hover:rotate-12 transition-transform">
            <Home className="w-5 h-5 fill-white/20" />
          </div>
          Add New Family
        </Link>

        {/* Stats Section */}
        <div className="space-y-3 pt-4">
          <h3 className="text-2xl font-bold text-gray-900">Total Families</h3>
          <div className="w-full bg-white border-2 border-gray-100 rounded-2xl p-6 shadow-sm flex items-center justify-between">
            <span className="text-4xl font-black text-gray-800">
              {loading ? "..." : familyCount}
            </span>
            <div className="p-3 bg-emerald-50 rounded-2xl">
              <Users className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex items-center justify-around py-4 px-6 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] z-50">
        <Link href="/families" className="flex flex-col items-center gap-1 group">
          <div className="p-3 bg-emerald-50 rounded-2xl group-hover:bg-emerald-100 transition-colors">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Families</span>
        </Link>
        
        <div className="flex flex-col items-center gap-1 group opacity-40 cursor-not-allowed">
          <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-gray-100 transition-colors">
            <CreditCard className="w-6 h-6 text-gray-400" />
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Accounts</span>
        </div>

        <div className="flex flex-col items-center gap-1 group opacity-40 cursor-not-allowed">
          <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-gray-100 transition-colors">
            <UserCheck className="w-6 h-6 text-gray-400" />
          </div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Staff</span>
        </div>
      </nav>
    </div>
  );
}
