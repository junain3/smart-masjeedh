"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home as HomeIcon, Users, Edit, User, CreditCard, Menu, LogOut, X, Settings, HelpCircle, Calendar, QrCode, Search, Briefcase, MoreHorizontal, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { useMockAuth } from "@/components/MockAuthProvider";

import { getTenantContext } from "@/lib/tenant";
import { useAppToast } from "@/components/ToastProvider";
import { QrScannerModal } from "@/components/QrScannerModal";

type MasjidProfile = {
  name: string;
  logo_url: string;
  tagline: string;
};

export default function DashboardPage() {
  const { toast } = useAppToast();
  const { user, loading: authLoading, tenantContext, signOut } = useMockAuth();
  const router = useRouter();

  const [time, setTime] = useState(new Date());
  const [familyCount, setFamilyCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [masjid, setMasjid] = useState<MasjidProfile | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lang, setLang] = useState<Language>("en");
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [memberResults, setMemberResults] = useState<any[]>([]);
  const [familyResults, setFamilyResults] = useState<any[]>([]);
  const [resultType, setResultType] = useState<"none" | "members" | "families" | "mixed">("none");
  const searchRequestSeq = useRef(0);

  // Auth guard effect
  useEffect(() => {
    console.log("DEBUG Dashboard - Auth guard:", { authLoading, user: user?.email, tenantContext: !!tenantContext });
    
    // Only redirect if auth is complete and no user exists
    if (!authLoading && !user) {
      console.log("DEBUG Dashboard - Redirecting to login (no user)");
      router.push('/login');
      return;
    }
    
    // DO NOT redirect if user exists but tenant context is loading
    // Let the tenant context load naturally
    if (!authLoading && user && !tenantContext) {
      console.log("DEBUG Dashboard - User exists, waiting for tenant context...");
      // Don't redirect - let tenant context load
      return;
    }
  }, [user, authLoading, tenantContext, router]);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load language from localStorage
  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  // Search query effect
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchError("");
      setMemberResults([]);
      setFamilyResults([]);
      setResultType("none");
      return;
    }

    const tmr = setTimeout(() => {
      runSearch(searchQuery);
    }, 350);

    return () => clearTimeout(tmr);
  }, [searchQuery]);

  // Services modal effect
  useEffect(() => {
    if (isServicesModalOpen) {
      fetchActiveServices();
    }
  }, [isServicesModalOpen]);

  // Fetch data effect
  useEffect(() => {
    if (!user) return;
    
    async function fetchData() {
      try {
        if (!supabase) return;

        // Get tenant context - don't fail if it doesn't exist yet
        const ctx = tenantContext || await getTenantContext();
        
        if (!ctx) {
          // Don't redirect - just show empty state
          setLoading(false);
          return;
        }

        // Load masjid profile
        try {
          const { data: masjidData, error: masjidErr } = await supabase
            .from("masjids")
            .select("id, masjid_name, tagline, logo_url")
            .eq("id", ctx.masjidId)
            .maybeSingle();

          if (masjidErr) throw masjidErr;

          if (masjidData) {
            setMasjid({
              name: (masjidData as any).masjid_name || "MJM",
              logo_url: (masjidData as any).logo_url || "",
              tagline: (masjidData as any).tagline || "Mubeen Jummah Masjid",
            });
          } else {
            // Default Fallback
            setMasjid({
              name: "MJM",
              logo_url: "",
              tagline: "Mubeen Jummah Masjid",
            });
          }
        } catch (e: any) {
          const msg = e?.message || "";
          if (msg.includes("schema cache") || msg.includes("column") || msg.includes("Could not find")) {
            // ignore - allow dashboard to render
            setMasjid({
              name: "MJM",
              logo_url: "",
              tagline: "Mubeen Jummah Masjid",
            });
          } else {
            throw e;
          }
        }

        // Fetch family count
        const { count, error: countError } = await supabase
          .from("families")
          .select("id", { count: "exact", head: true })
          .eq("masjid_id", ctx.masjidId);
        
        if (countError) throw countError;
        setFamilyCount(count || 0);

        // Fetch member count
        const { count: mCount, error: mError } = await supabase
          .from("members")
          .select("*", { count: "exact", head: true })
          .eq("masjid_id", ctx.masjidId);
        
        if (!mError) setMemberCount(mCount || 0);

      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading state if user exists but tenant context is still loading
  if (user && !tenantContext) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your masjid...</p>
          <p className="text-gray-500 text-sm mt-2">This should only take a moment</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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

  const runSearch = async (query: string) => {
    if (!supabase) return;
    const q = query.trim();

    if (q.length < 2) {
      setSearchError("");
      setMemberResults([]);
      setFamilyResults([]);
      setResultType("none");
      return;
    }

    const requestId = ++searchRequestSeq.current;
    setSearchLoading(true);
    setSearchError("");
    setMemberResults([]);
    setFamilyResults([]);
    setResultType("none");
    try {
      const ctx = await getTenantContext();
      if (!ctx) {
        if (requestId !== searchRequestSeq.current) return;
        setSearchError(lang === "tm" ? "லாகின் தேவை" : "Login required");
        return;
      }
      const p = parseQuery(q);
      if (p.kind === "widows") {
        const { data, error } = await supabase
          .from("families")
          .select("id,family_code,head_name,is_widow_head")
          .eq("masjid_id", ctx.masjidId)
          .eq("is_widow_head", true)
          .order("family_code", { ascending: true });
        if (error) throw error;
        if (requestId !== searchRequestSeq.current) return;
        setFamilyResults(data || []);
        setResultType("families");
        return;
      }
      if (p.kind === "ageExact") {
        let q = supabase
          .from("members")
          .select("id,family_id,full_name,age,gender")
          .eq("masjid_id", ctx.masjidId)
          .eq("age", p.age);
        if (p.gender) q = q.eq("gender", p.gender);
        const { data, error } = await q;
        if (error) throw error;
        if (requestId !== searchRequestSeq.current) return;
        setMemberResults(data || []);
        setResultType("members");
        return;
      }
      if (p.kind === "ageRange") {
        let q = supabase
          .from("members")
          .select("id,family_id,full_name,age,gender")
          .eq("masjid_id", ctx.masjidId)
          .gte("age", p.minAge)
          .lte("age", p.maxAge);
        if (p.gender) q = q.eq("gender", p.gender);
        const { data, error } = await q;
        if (error) throw error;
        if (requestId !== searchRequestSeq.current) return;
        setMemberResults(data || []);
        setResultType("members");
        return;
      }
      if (p.kind === "free") {
        const text = p.text.toLowerCase();
        const [famRes, memRes] = await Promise.all([
          supabase
            .from("families")
            .select("id,family_code,head_name,is_widow_head")
            .eq("masjid_id", ctx.masjidId)
            .or(
              `head_name.ilike.%${text}%,family_code.ilike.%${text}%,phone.ilike.%${text}%,address.ilike.%${text}%`
            )
            .order("family_code", { ascending: true }),
          supabase
            .from("members")
            .select("id,family_id,full_name,age,gender")
            .eq("masjid_id", ctx.masjidId)
            .or(
              `full_name.ilike.%${text}%,phone.ilike.%${text}%,nic.ilike.%${text}%,member_code.ilike.%${text}%`
            )
            .order("full_name", { ascending: true }),
        ]);

        if (famRes.error) throw famRes.error;
        if (memRes.error) throw memRes.error;

        if (requestId !== searchRequestSeq.current) return;

        const famData = (famRes.data || []) as any[];
        const memData = (memRes.data || []) as any[];

        setFamilyResults(famData);
        setMemberResults(memData);

        if (famData.length > 0 && memData.length > 0) {
          setResultType("mixed");
        } else if (memData.length > 0) {
          setResultType("members");
        } else {
          setResultType("families");
        }
        return;
      }
    } catch (e: any) {
      if (requestId !== searchRequestSeq.current) return;
      setSearchError(e.message || "Search failed");
    } finally {
      if (requestId !== searchRequestSeq.current) return;
      setSearchLoading(false);
    }
  };

  const handleSearch = async () => {
    await runSearch(searchQuery);
  };

  const fetchActiveServices = async () => {
    if (!supabase) return;
    const ctx = tenantContext || await getTenantContext();
    if (!ctx) return;

    const { data } = await supabase
      .from("service_distributions")
      .select("name")
      .eq("masjid_id", ctx.masjidId)
      .eq("status", "Pending");
    
    if (data) {
      // Get unique names
      const uniqueNames = Array.from(new Set(data.map(s => s.name))).map(name => ({ name }));
      setActiveServices(uniqueNames);
    }
  };

  const handleServiceScan = async (decodedTextRaw: string) => {
    if (!supabase || !selectedScanService) return;

    const decodedText = decodedTextRaw || "";
    
    try {
      if (decodedText.startsWith("smart-masjeedh:family:")) {
        const familyId = decodedText.split(":")[2];
        const ctx = tenantContext || await getTenantContext();
        if (!ctx) return;

        const { data, error } = await supabase
          .from("service_distributions")
          .update({ status: 'Received' })
          .eq("family_id", familyId)
          .eq("name", selectedScanService)
          .eq("masjid_id", ctx.masjidId)
          .select();

        if (error) throw error;
        
        if (data && data.length > 0) {
          setScanStatus({ type: 'success', message: "Service marked as received" });
          setIsScannerOpen(false);
          // Reset message after 2 seconds
          setTimeout(() => setScanStatus({ type: 'idle', message: '' }), 2000);
        } else {
          setScanStatus({ type: 'error', message: "No service record found" });
          setTimeout(() => setScanStatus({ type: 'idle', message: '' }), 3000);
        }
      }
    } catch (err: any) {
      setScanStatus({ type: 'error', message: err.message });
      setTimeout(() => setScanStatus({ type: 'idle', message: '' }), 3000);
    }
  };

  const createServiceDistribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSubmittingService(true);
    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;

      // 1. Fetch all families for this masjid
      const { data: families } = await supabase
        .from("families")
        .select("id")
        .eq("masjid_id", ctx.masjidId);
      
      if (!families || families.length === 0) {
        toast({ kind: "info", title: "No data", message: "No families found to distribute to." });
        return;
      }

      // 2. Create distribution records for each family
      const distributions = families.map(f => ({
        family_id: f.id,
        masjid_id: ctx.masjidId,
        name: serviceName,
        date: serviceDate,
        status: 'Pending'
      }));

      const { error } = await supabase.from("service_distributions").insert(distributions);
      if (error) throw error;

      toast({ kind: "success", title: "Created", message: "Service distribution created for all families!" });
      setIsServicesModalOpen(false);
      setServiceName("");
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed" });
    } finally {
      setSubmittingService(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Format date: "25 February 2026 at 6:43"
  const formatDate = (date: Date) => {
    const d = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    return `${d} at ${t}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 text-neutral-900 font-sans pb-24 relative overflow-x-hidden">
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
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors">
              <X className="w-6 h-6 text-neutral-600" />
            </button>
          </div>

          <div className="flex-1 space-y-2">
            <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-700 rounded-3xl font-bold transition-all">
              <HomeIcon className="w-5 h-5" />
              <span>{t.dashboard}</span>
            </Link>
            <Link href="/families" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Users className="w-5 h-5" />
              <span>{t.families}</span>
            </Link>
            <Link href="/accounts" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <CreditCard className="w-5 h-5" />
              <span>{t.accounts}</span>
            </Link>
            <Link href="/staff" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              <span>{t.staff_management || t.staff}</span>
            </Link>
          <Link href="/settings" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
            <Settings className="w-5 h-5" />
            <span>{t.settings}</span>
          </Link>
          <Link 
            href="/events"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all"
          >
            <Calendar className="w-5 h-5 text-amber-500" />
            <span>{t.events || "Events"}</span>
          </Link>
          <div className="flex items-center gap-4 p-4 opacity-40 text-neutral-600 rounded-3xl font-bold cursor-not-allowed">
              <HelpCircle className="w-5 h-5" />
              <span>Help & Support</span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="mt-auto flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 rounded-3xl font-bold transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="p-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-20 border-b border-neutral-200">
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-neutral-600 hover:bg-neutral-50 rounded-3xl transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-black tracking-tight">{t.home}</h1>
        <Link href="/scan" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-3xl transition-colors">
          <QrCode className="w-6 h-6" />
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-6 w-full">
        {/* Date Display */}
        <div className="text-center">
          <p className="text-lg font-bold text-neutral-900">
            {formatDate(time)}
          </p>
        </div>

        {/* Circular Mosque Logo */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-200 flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L4 7v11h16V7l-8-5z"></path>
              <path d="M12 22v-4"></path>
              <path d="M8 18v4"></path>
              <path d="M16 18v4"></path>
              <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>
            </svg>
          </div>
        </div>

        {/* Masjid Name Bar */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-3xl p-6 text-center shadow-xl">
          <h1 className="text-2xl font-black text-white tracking-wide">
            MUBEEN JUMMAH MASJID
          </h1>
          <p className="text-sm text-emerald-100 mt-1">
            Mubeen Jummah Masjid
          </p>
        </div>

        {/* Quick Stats Cards - Below Masjid Name Bar */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 text-center shadow-lg">
            <Users className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">TOTAL FAMILIES</p>
            <p className="text-3xl font-black text-emerald-800">{familyCount || 0}</p>
          </div>
          <div className="bg-white border-2 border-emerald-200 rounded-2xl p-4 text-center shadow-lg">
            <User className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">TOTAL MEMBERS</p>
            <p className="text-3xl font-black text-emerald-800">{memberCount || 0}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 group-focus-within:text-emerald-600 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === "tm" ? "எதை வேண்டுமானாலும் தேடுக..." : "Search anything..."}
            className="app-input pl-12 font-bold"
          />
        </div>

        {/* Menu Grid - 4 Column Circular Icons */}
        <div className="grid grid-cols-4 gap-4 justify-items-center">
          <Link href="/families" className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors">
            <Users className="w-6 h-6 text-emerald-700" />
          </Link>
          <Link href="/accounts" className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors">
            <CreditCard className="w-6 h-6 text-emerald-700" />
          </Link>
          <Link href="/collections" className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors">
            <FileText className="w-6 h-6 text-emerald-700" />
          </Link>
          <Link href="/events" className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors">
            <Calendar className="w-6 h-6 text-emerald-700" />
          </Link>
          <Link href="/staff" className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors">
            <Briefcase className="w-6 h-6 text-emerald-700" />
          </Link>
          <Link href="/accounts" className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors">
            <Settings className="w-6 h-6 text-emerald-700" />
          </Link>
          <Link href="/settings" className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center hover:bg-emerald-100 transition-colors">
            <Settings className="w-6 h-6 text-emerald-700" />
          </Link>
          <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
            <MoreHorizontal className="w-6 h-6 text-emerald-700" />
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="grid grid-cols-4 h-16">
          <Link href="/" className="flex flex-col items-center justify-center gap-1 text-emerald-600">
            <HomeIcon className="w-5 h-5" />
            <span className="text-xs font-medium">HOME</span>
          </Link>
          <Link href="/families" className="flex flex-col items-center justify-center gap-1 text-gray-600">
            <Users className="w-5 h-5" />
            <span className="text-xs font-medium">FAMILIES</span>
          </Link>
          <Link href="/accounts" className="flex flex-col items-center justify-center gap-1 text-gray-600">
            <CreditCard className="w-5 h-5" />
            <span className="text-xs font-medium">ACCOUNTS</span>
          </Link>
          <Link href="/staff" className="flex flex-col items-center justify-center gap-1 text-gray-600">
            <Briefcase className="w-5 h-5" />
            <span className="text-xs font-medium">STAFF</span>
          </Link>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
