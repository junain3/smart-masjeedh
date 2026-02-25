"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home as HomeIcon, Users, Edit, User, CreditCard, Menu, LogOut, X, Settings, HelpCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";

type MasjidProfile = {
  name: string;
  logo_url: string;
  tagline: string;
};

export default function DashboardPage() {
  const [time, setTime] = useState(new Date());
  const [familyCount, setFamilyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [masjid, setMasjid] = useState<MasjidProfile | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState<Language>("en");
  const router = useRouter();

  const t = translations[lang];

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch data and auth check
  useEffect(() => {
    async function fetchData() {
      try {
        if (!supabase) return;

        // Load language from localStorage
        const savedLang = localStorage.getItem("app_lang") as Language;
        if (savedLang) setLang(savedLang);

        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
          return;
        }

        // Fetch family count
        const { count, error: countError } = await supabase
          .from("families")
          .select("*", { count: "exact", head: true })
          .eq("masjid_id", session.user.id); // Filter by masjid ID
        
        if (countError) throw countError;
        setFamilyCount(count || 0);

        // Fetch dynamic masjid profile (Optional table - fallback to MJM if not exists)
        try {
          if (!supabase) return;
          const { data: masjidData } = await supabase
            .from("masjids")
            .select("*")
            .eq("id", session.user.id)
            .single();
          
          if (masjidData) {
            setMasjid(masjidData);
          } else {
            // Default Fallback
            setMasjid({
              name: "MJM",
              logo_url: "",
              tagline: "Mubeen Jummah Masjid"
            });
          }
        } catch (e) {
          // If table masjids doesn't exist yet
          setMasjid({
            name: "MJM",
            logo_url: "",
            tagline: "Mubeen Jummah Masjid"
          });
        }

      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [router]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Format date: "25 February 2026 at 6:43"
  const formatDate = (date: Date) => {
    const d = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    return `${d} at ${t}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-black font-sans pb-24 relative overflow-x-hidden">
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-black text-emerald-600 uppercase tracking-tighter">Menu</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <X className="w-6 h-6 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 space-y-2">
            <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold transition-all">
              <HomeIcon className="w-5 h-5" />
              <span>{t.dashboard}</span>
            </Link>
            <Link href="/families" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-slate-50 text-slate-600 rounded-2xl font-bold transition-all">
              <Users className="w-5 h-5" />
              <span>{t.families}</span>
            </Link>
            <div className="flex items-center gap-4 p-4 opacity-40 text-slate-600 rounded-2xl font-bold cursor-not-allowed">
              <CreditCard className="w-5 h-5" />
              <span>{t.accounts}</span>
            </div>
            <Link href="/settings" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-slate-50 text-slate-600 rounded-2xl font-bold transition-all">
              <Settings className="w-5 h-5" />
              <span>{t.settings}</span>
            </Link>
            <div className="flex items-center gap-4 p-4 opacity-40 text-slate-600 rounded-2xl font-bold cursor-not-allowed">
              <HelpCircle className="w-5 h-5" />
              <span>Help & Support</span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="mt-auto flex items-center gap-4 p-4 text-red-500 hover:bg-red-50 rounded-2xl font-bold transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="p-4 flex items-center justify-between sticky top-0 bg-white z-20">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-gray-600 hover:bg-slate-50 rounded-xl transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-semibold">{t.home}</h1>
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

        {/* Dynamic Masjid Logo & Branding */}
        <div className="flex justify-center py-2">
          <div className="relative w-72 h-72 flex flex-col items-center justify-center p-4">
            <div className="absolute inset-0 flex items-center justify-center opacity-5">
               <svg viewBox="0 0 200 200" className="w-full h-full fill-emerald-600">
                 <path d="M100 20 C60 20 30 60 30 100 L30 180 L170 180 L170 100 C170 60 140 20 100 20 Z" />
               </svg>
            </div>
            
            <div className="text-center z-10 space-y-0">
              {masjid?.logo_url ? (
                <img src={masjid.logo_url} alt="Logo" className="w-32 h-32 object-contain mb-2 mx-auto" />
              ) : (
                <div className="mb-2 text-[#00a859]">
                  <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L4 7v11h16V7l-8-5z"></path>
                    <path d="M12 22v-4"></path>
                    <path d="M8 18v4"></path>
                    <path d="M16 18v4"></path>
                    <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
                  </svg>
                </div>
              )}
              <h2 className="text-5xl font-black text-[#003d5b] tracking-tighter leading-none uppercase">
                {masjid?.name || "MJM"}
              </h2>
              <p className="text-xs font-bold text-[#c6893f] uppercase tracking-wider mt-1">
                {masjid?.tagline || "Mubeen Jummah Masjid"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Link 
          href="/families"
          className="w-full bg-[#00c853] text-white py-4 rounded-xl flex items-center justify-center gap-2 font-bold text-lg shadow-sm active:scale-[0.98] transition-all"
        >
          <HomeIcon className="w-5 h-5" />
          {t.add_new_family}
        </Link>

        {/* Stats Section */}
        <div className="space-y-4 pt-2">
          <h3 className="text-2xl font-bold text-black">{t.total_families}</h3>
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
            <span className="text-[10px] font-bold text-[#00c853]">{t.families}</span>
          </Link>
          
          <div className="flex flex-col items-center justify-center gap-1 p-4 bg-[#f0fdf4] rounded-2xl border border-[#dcfce7] opacity-80">
            <Edit className="w-6 h-6 text-[#00c853]" />
            <span className="text-[10px] font-bold text-[#00c853]">{t.accounts}</span>
          </div>

          <div className="flex flex-col items-center justify-center gap-1 p-4 bg-[#f0fdf4] rounded-2xl border border-[#dcfce7] opacity-80">
            <User className="w-6 h-6 text-[#00c853]" />
            <span className="text-[10px] font-bold text-[#00c853]">{t.staff}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
