"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home as HomeIcon, Users, Edit, User, CreditCard, Menu, LogOut, X, Settings, HelpCircle, Calendar, QrCode, Search } from "lucide-react";
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
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [masjid, setMasjid] = useState<MasjidProfile | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState<Language>("en");
  const router = useRouter();

  const t = translations[lang];

  const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
  const [activeServiceTab, setActiveServiceTab] = useState<"create" | "scan">("create");
  const [serviceName, setServiceName] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingService, setSubmittingService] = useState(false);
  
  const [activeServices, setActiveServices] = useState<{name: string}[]>([]);
  const [selectedScanService, setSelectedScanService] = useState("");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<{type: 'success' | 'error' | 'idle', message: string}>({type: 'idle', message: ''});

  type MemberRes = { id: string; family_id: string; full_name: string; age: number; gender: string };
  type FamilyRes = { id: string; family_code: string; head_name: string; is_widow_head?: boolean };
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [memberResults, setMemberResults] = useState<MemberRes[]>([]);
  const [familyResults, setFamilyResults] = useState<FamilyRes[]>([]);
  const [resultType, setResultType] = useState<"none" | "members" | "families">("none");

  const parseQuery = (q: string) => {
    const s = q.trim().toLowerCase();
    const hasWidow = /(விதவை|விதவைகள்|widow)/.test(s);
    if (hasWidow) {
      return { kind: "widows" as const };
    }
    const male = /(ஆண்|ஆண்கள்|male)/.test(s) ? "Male" : /(பெண்|பெண்கள்|female)/.test(s) ? "Female" : undefined;
    const range1 = s.match(/(\d{1,3})\s*[-–]\s*(\d{1,3})/);
    const range2 = s.match(/(\d{1,3})\s*(?:to|முதல்)\s*(\d{1,3})/);
    if (range1 || range2) {
      const m = range1 || range2;
      const a = parseInt(m![1], 10);
      const b = parseInt(m![2], 10);
      const minAge = Math.min(a, b);
      const maxAge = Math.max(a, b);
      return { kind: "ageRange" as const, minAge, maxAge, gender: male };
    }
    const exactAgeMatch = s.match(/(\d{1,3})\s*(?:வயது|years?|yr|age)?/);
    if (exactAgeMatch && exactAgeMatch[1]) {
      const age = parseInt(exactAgeMatch[1], 10);
      return { kind: "ageExact" as const, age, gender: male };
    }
    return { kind: "free" as const, text: q.trim() };
  };

  const handleSearch = async () => {
    if (!supabase) return;
    setSearchLoading(true);
    setSearchError("");
    setMemberResults([]);
    setFamilyResults([]);
    setResultType("none");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSearchError(lang === "tm" ? "லாகின் தேவை" : "Login required");
        return;
      }
      const p = parseQuery(searchQuery);
      if (p.kind === "widows") {
        const { data, error } = await supabase
          .from("families")
          .select("id,family_code,head_name,is_widow_head")
          .eq("masjid_id", session.user.id)
          .eq("is_widow_head", true)
          .order("family_code", { ascending: true });
        if (error) throw error;
        setFamilyResults(data || []);
        setResultType("families");
        return;
      }
      if (p.kind === "ageExact") {
        let q = supabase
          .from("members")
          .select("id,family_id,full_name,age,gender")
          .eq("masjid_id", session.user.id)
          .eq("age", p.age);
        if (p.gender) q = q.eq("gender", p.gender);
        const { data, error } = await q;
        if (error) throw error;
        setMemberResults(data || []);
        setResultType("members");
        return;
      }
      if (p.kind === "ageRange") {
        let q = supabase
          .from("members")
          .select("id,family_id,full_name,age,gender")
          .eq("masjid_id", session.user.id)
          .gte("age", p.minAge)
          .lte("age", p.maxAge);
        if (p.gender) q = q.eq("gender", p.gender);
        const { data, error } = await q;
        if (error) throw error;
        setMemberResults(data || []);
        setResultType("members");
        return;
      }
      if (p.kind === "free") {
        const text = p.text.toLowerCase();
        const { data, error } = await supabase
          .from("families")
          .select("id,family_code,head_name,is_widow_head")
          .eq("masjid_id", session.user.id)
          .or(`head_name.ilike.%${text}%,family_code.ilike.%${text}%`)
          .order("family_code", { ascending: true });
        if (error) throw error;
        setFamilyResults(data || []);
        setResultType("families");
        return;
      }
    } catch (e: any) {
      setSearchError(e.message || "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchActiveServices = async () => {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("service_distributions")
      .select("name")
      .eq("masjid_id", session.user.id)
      .eq("status", "Pending");
    
    if (data) {
      // Get unique names
      const uniqueNames = Array.from(new Set(data.map(s => s.name))).map(name => ({ name }));
      setActiveServices(uniqueNames);
    }
  };

  useEffect(() => {
    if (isServicesModalOpen) {
      fetchActiveServices();
    }
  }, [isServicesModalOpen]);

  const handleServiceScan = async (decodedText: string) => {
    if (!supabase || !selectedScanService) return;
    
    try {
      if (decodedText.startsWith("smart-masjeedh:family:")) {
        const familyId = decodedText.split(":")[2];
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from("service_distributions")
          .update({ status: 'Received' })
          .eq("family_id", familyId)
          .eq("name", selectedScanService)
          .eq("masjid_id", session.user.id)
          .select();

        if (error) throw error;
        
        if (data && data.length > 0) {
          setScanStatus({ type: 'success', message: "சேவை வழங்கப்பட்டது! (Service Marked as Received)" });
          // Reset message after 2 seconds
          setTimeout(() => setScanStatus({ type: 'idle', message: '' }), 2000);
        } else {
          setScanStatus({ type: 'error', message: "இந்தக் குடும்பத்திற்கு இந்தப் பதிவு இல்லை. (No record for this family)" });
          setTimeout(() => setScanStatus({ type: 'idle', message: '' }), 3000);
        }
      }
    } catch (err: any) {
      setScanStatus({ type: 'error', message: err.message });
      setTimeout(() => setScanStatus({ type: 'idle', message: '' }), 3000);
    }
  };

  useEffect(() => {
    let scanner: any = null;
    if (isScannerOpen) {
      import("html5-qrcode").then((lib) => {
        scanner = new lib.Html5QrcodeScanner(
          "service-reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scanner.render(onScanSuccess, (err: any) => {});

        function onScanSuccess(decodedText: string) {
          handleServiceScan(decodedText);
        }
      });
    }
    return () => {
      if (scanner) scanner.clear().catch(console.error);
    };
  }, [isScannerOpen, selectedScanService]);

  const createServiceDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSubmittingService(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch all families for this masjid
      const { data: families } = await supabase
        .from("families")
        .select("id")
        .eq("masjid_id", session.user.id);
      
      if (!families || families.length === 0) {
        alert("No families found to distribute to.");
        return;
      }

      // 2. Create distribution records for each family
      const distributions = families.map(f => ({
        family_id: f.id,
        masjid_id: session.user.id,
        name: serviceName,
        date: serviceDate,
        status: 'Pending'
      }));

      const { error } = await supabase.from("service_distributions").insert(distributions);
      if (error) throw error;

      alert("Service distribution created for all families!");
      setIsServicesModalOpen(false);
      setServiceName("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingService(false);
    }
  };

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

        // Fetch member count
        const { count: mCount, error: mError } = await supabase
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("masjid_id", session.user.id);
        
        if (!mError) setMemberCount(mCount || 0);

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
            <Link href="/accounts" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-slate-50 text-slate-600 rounded-2xl font-bold transition-all">
              <CreditCard className="w-5 h-5" />
              <span>{t.accounts}</span>
            </Link>
          <Link href="/settings" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-slate-50 text-slate-600 rounded-2xl font-bold transition-all">
            <Settings className="w-5 h-5" />
            <span>{t.settings}</span>
          </Link>
          <button 
            onClick={() => {
              setIsSidebarOpen(false);
              setIsServicesModalOpen(true);
            }} 
            className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 text-slate-600 rounded-2xl font-bold transition-all text-left"
          >
            <Calendar className="w-5 h-5 text-amber-500" />
            <span>{t.services_received}</span>
          </button>
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

        <div className="space-y-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === "tm" ? "எதை வேண்டுமானாலும் தேடுக..." : "Search anything..."}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {searchLoading ? (lang === "tm" ? "தேடப்படுகிறது..." : "Searching...") : (lang === "tm" ? "தேடுக" : "Search")}
          </button>
          {searchError && (
            <div className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-2xl text-[10px] font-bold">
              {searchError}
            </div>
          )}
        </div>

        {resultType !== "none" && (
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
              {resultType === "members" ? (lang === "tm" ? "உறுப்பினர் முடிவுகள்" : "Member Results") : (lang === "tm" ? "குடும்ப முடிவுகள்" : "Family Results")}
            </h3>
            {resultType === "members" ? (
              memberResults.length === 0 ? (
                <div className="py-10 text-center bg-white rounded-[2rem] border border-slate-50">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                    <User className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                    {lang === "tm" ? "பொருத்தங்கள் இல்லை" : "No matches"}
                  </p>
                </div>
              ) : (
                memberResults.map(m => (
                  <Link key={m.id} href={`/families/${m.family_id}`} className="block bg-white rounded-2xl p-4 border border-slate-50 shadow-sm group hover:border-emerald-100 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <User className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-black text-slate-800 truncate">{m.full_name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{m.gender} • {m.age}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )
            ) : familyResults.length === 0 ? (
              <div className="py-10 text-center bg-white rounded-[2rem] border border-slate-50">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                  <Users className="w-8 h-8" />
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                  {lang === "tm" ? "பொருத்தங்கள் இல்லை" : "No matches"}
                </p>
              </div>
            ) : (
              familyResults.map(f => (
                <Link key={f.id} href={`/families/${f.id}`} className="block bg-white rounded-2xl p-4 border border-slate-50 shadow-sm group hover:border-emerald-100 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-800 truncate">{f.head_name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{f.family_code}</p>
                    </div>
                    {f.is_widow_head && (
                      <span className="px-2 py-1 bg-rose-50 text-rose-500 text-[9px] font-black uppercase rounded-full border border-rose-100">Widow</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.total_families}</span>
            <span className="text-3xl font-black text-emerald-600">
              {loading ? "..." : familyCount}
            </span>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.total_members}</span>
            <span className="text-3xl font-black text-[#003d5b]">
              {loading ? "..." : memberCount}
            </span>
          </div>
        </div>

        {/* Custom Bottom Grid Navigation */}
        <div className="grid grid-cols-3 gap-3 pt-4">
          <Link href="/families" className="flex flex-col items-center justify-center gap-1 p-4 bg-[#f0fdf4] rounded-2xl border border-[#dcfce7]">
            <Users className="w-6 h-6 text-[#00c853]" />
            <span className="text-[10px] font-bold text-[#00c853]">{t.families}</span>
          </Link>
          
          <Link href="/accounts" className="flex flex-col items-center justify-center gap-1 p-4 bg-[#f0fdf4] rounded-2xl border border-[#dcfce7]">
            <Edit className="w-6 h-6 text-[#00c853]" />
            <span className="text-[10px] font-bold text-[#00c853]">{t.accounts}</span>
          </Link>

          <div className="flex flex-col items-center justify-center gap-1 p-4 bg-[#f0fdf4] rounded-2xl border border-[#dcfce7] opacity-80">
            <User className="w-6 h-6 text-[#00c853]" />
            <span className="text-[10px] font-bold text-[#00c853]">{t.staff}</span>
          </div>
        </div>
      </main>

      {/* Services Distribution Modal */}
      {isServicesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-900">{t.services_received}</h2>
              <button onClick={() => {
                setIsServicesModalOpen(false);
                setIsScannerOpen(false);
              }} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
              <button 
                onClick={() => {
                  setActiveServiceTab("create");
                  setIsScannerOpen(false);
                }}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeServiceTab === "create" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"
                }`}
              >
                {lang === 'tm' ? 'புதிய சேவை உருவாக்கு' : 'Create New'}
              </button>
              <button 
                onClick={() => setActiveServiceTab("scan")}
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeServiceTab === "scan" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
                }`}
              >
                {lang === 'tm' ? 'QR ஸ்கேன் செய்' : 'QR Scan Distribution'}
              </button>
            </div>

            {activeServiceTab === "create" ? (
              <form onSubmit={createServiceDistribution} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.name}</label>
                  <input 
                    required
                    type="text"
                    value={serviceName}
                    onChange={e => setServiceName(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                    placeholder="E.g. Ramadan Dates"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.date}</label>
                  <input 
                    required
                    type="date"
                    value={serviceDate}
                    onChange={e => setServiceDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                  />
                </div>

                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-6">
                  <p className="text-[10px] text-emerald-700 font-bold leading-relaxed uppercase tracking-tight">
                    This will create a pending service record for ALL families in your masjid.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submittingService}
                  className="w-full py-5 rounded-3xl font-black text-white bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
                >
                  {submittingService ? "CREATING..." : "DISTRIBUTE TO ALL FAMILIES"}
                </button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{lang === 'tm' ? 'சேவையைத் தேர்ந்தெடுக்கவும்' : 'Select Service'}</label>
                  <select 
                    value={selectedScanService}
                    onChange={e => setSelectedScanService(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-blue-500/10 outline-none appearance-none"
                  >
                    <option value="">-- {lang === 'tm' ? 'தேர்ந்தெடுக்கவும்' : 'Select'} --</option>
                    {activeServices.map(s => (
                      <option key={s.name} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {!isScannerOpen ? (
                  <button
                    onClick={() => {
                      if (!selectedScanService) {
                        alert(lang === 'tm' ? 'தயவுசெய்து ஒரு சேவையைத் தேர்ந்தெடுக்கவும்' : 'Please select a service first');
                        return;
                      }
                      setIsScannerOpen(true);
                    }}
                    className="w-full py-8 rounded-3xl border-4 border-dashed border-slate-200 text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all flex flex-col items-center gap-3"
                  >
                    <QrCode className="w-12 h-12" />
                    <span className="font-black text-xs uppercase tracking-widest">{t.scan_qr}</span>
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div id="service-reader" className="w-full overflow-hidden rounded-[2rem] border-4 border-blue-500 shadow-lg shadow-blue-500/10"></div>
                    
                    {scanStatus.type !== 'idle' && (
                      <div className={`p-4 rounded-2xl font-bold text-center text-xs animate-in zoom-in duration-300 ${
                        scanStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {scanStatus.message}
                      </div>
                    )}

                    <button
                      onClick={() => setIsScannerOpen(false)}
                      className="w-full py-4 rounded-2xl bg-slate-100 text-slate-500 font-bold text-xs uppercase tracking-widest"
                    >
                      {lang === 'tm' ? 'ஸ்கேனரை நிறுத்து' : 'Stop Scanner'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
