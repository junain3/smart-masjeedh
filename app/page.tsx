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
    const d = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    return `${d} at ${t}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f8fafc] text-slate-900 font-sans pb-24">
      {/* Header */}
      <header className="p-4 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-slate-100">
        <button className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
        <h1 className="text-xl font-black tracking-tight text-slate-900">Home</h1>
        <div className="w-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 space-y-8 max-w-md mx-auto w-full">
        {/* Date Display */}
        <div className="text-center space-y-1">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Current Status</p>
          <p className="text-lg font-black text-slate-900">
            {formatDate(time)}
          </p>
        </div>

        {/* MJM Logo */}
        <div className="flex justify-center py-4">
          <div className="relative w-72 h-72 bg-white rounded-full flex flex-col items-center justify-center p-10 shadow-[0_20px_50px_rgba(16,185,129,0.1)] border border-emerald-50 overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent pointer-events-none"></div>
            
            <div className="mb-4 text-emerald-500 group-hover:scale-110 transition-transform duration-700 ease-out">
              <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L4 7v11h16V7l-8-5z"></path>
                <path d="M12 22v-4"></path>
                <path d="M8 18v4"></path>
                <path d="M16 18v4"></path>
                <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
              </svg>
            </div>
            
            <div className="text-center z-10 space-y-1">
              <h2 className="text-5xl font-black text-emerald-600 tracking-tighter leading-none">MJM</h2>
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em]">Mubeen Jummah Masjid</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Link 
          href="/families"
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black text-lg shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] group"
        >
          <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
            <Home className="w-5 h-5" />
          </div>
          Add New Family
        </Link>

        {/* Stats Section */}
        <div className="space-y-4 pt-4">
          <h3 className="text-2xl font-black text-slate-900 px-1">Total Families</h3>
          <div className="w-full bg-white professional-card rounded-[2.5rem] p-8 flex items-center justify-between group hover:border-emerald-200 transition-colors">
            <div className="space-y-1">
              <span className="text-5xl font-black text-slate-900">
                {loading ? "..." : familyCount}
              </span>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registered</p>
            </div>
            <div className="p-5 bg-emerald-50 rounded-[1.5rem] group-hover:bg-emerald-100 transition-colors">
              <Users className="w-10 h-10 text-emerald-600" />
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around py-4 px-6 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] z-50">
        <Link href="/" className="flex flex-col items-center gap-1 group">
          <div className="p-3 bg-emerald-50 rounded-2xl transition-all">
            <Home className="w-6 h-6 text-emerald-600" />
          </div>
          <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Home</span>
        </Link>
        
        <Link href="/families" className="flex flex-col items-center gap-1 group">
          <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-all">
            <Users className="w-6 h-6 text-slate-400 group-hover:text-slate-600" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Families</span>
        </Link>
        
        <div className="flex flex-col items-center gap-1 group opacity-30 cursor-not-allowed">
          <div className="p-3 bg-slate-50 rounded-2xl">
            <CreditCard className="w-6 h-6 text-slate-400" />
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accounts</span>
        </div>
      </nav>
    </div>
  );
}
