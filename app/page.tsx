"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, RefreshCw, QrCode, X, ArrowLeft, CreditCard, Edit, Trash2, FileText, Download, HomeIcon, User, Calendar, Briefcase, Settings, LogOut, MoreHorizontal, Shield, Wallet, HelpCircle, Menu, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useMockAuth } from "@/components/MockAuthProvider";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import RouteGuard from "@/components/RouteGuard";
import { AppShell } from "@/components/AppShell";
import { parsePermissions, hasModulePermission, isSuperAdmin } from "@/lib/permissions-utils";
import { useAppToast } from "@/components/ToastProvider";

type Member = {
  id: string;
  family_id: string;
  full_name: string;
  age?: number;
  gender?: string;
  phone?: string;
  nic?: string;
  member_code?: string;
};

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  is_widow_head?: boolean;
};

type SearchParams = 
  | { kind: "familyCode"; code: string }
  | { kind: "ageMin"; minAge: number; gender?: string }
  | { kind: "ageMax"; maxAge: number; gender?: string }
  | { kind: "ageExact"; age: number; gender?: string }
  | { kind: "ageRange"; minAge: number; maxAge: number; gender?: string }
  | { kind: "free"; text: string };

const dummyMembers: Member[] = [
  {
    id: "1",
    family_id: "1",
    full_name: "உதாரண உறுப்புர் 1",
    age: 35,
    gender: "Male"
  },
  {
    id: "2",
    family_id: "1",
    full_name: "உதாரண உறுப்புர் 2",
    age: 32,
    gender: "Female"
  }
];

const dummyFamilies: Family[] = [
  {
    id: "1",
    family_code: "FAM-001",
    head_name: "உதாரண குடும்பம் 1",
    is_widow_head: false
  },
  {
    id: "2",
    family_code: "FAM-002",
    head_name: "உதாரண குடும்பம் 2",
    is_widow_head: true
  }
];

export default function HomePage() {
  const router = useRouter();
  const { user, tenantContext, loading: authLoading, resumeTick } = useSupabaseAuth();
  const { toast } = useAppToast();

  // Parse permissions and check access
  const parsedPermissions = parsePermissions(JSON.stringify(tenantContext?.permissions || {}));
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);

  // ALL HOOKS AT TOP - STRICT ORDER
  const [lang, setLang] = useState<Language>("en");
  const t = getTranslation(lang || "en");
  const [time, setTime] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [familyResults, setFamilyResults] = useState<Family[]>([]);
  const [resultType, setResultType] = useState<"members" | "families" | "mixed">("members");
  const [isLive, setIsLive] = useState(false);
  const [familyCount, setFamilyCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [masjid, setMasjid] = useState<{ name: string; logo_url: string; tagline: string } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedScanService, setSelectedScanService] = useState("");
  const [scanStatus, setScanStatus] = useState<{ type: 'idle' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [activeServices, setActiveServices] = useState<{ name: string }[]>([]);
  const [isServicesModalOpen, setIsServicesModalOpen] = useState(false);
  const [serviceName, setServiceName] = useState("");
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingService, setSubmittingService] = useState(false);
  const searchRequestSeq = useRef(0);

  // Smart Filter state
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    gender: [] as string[],
    ageRange: { min: '', max: '' },
    birthYear: { min: '', max: '' },
    civilStatus: [] as string[],
    isMoulavi: false,
    isNewMuslim: false,
    isForeignResident: false,
    hasSpecialNeeds: false,
    hasHealthIssue: false,
    familyIsWidowHead: false,
  });
  const [filterSearchResults, setFilterSearchResults] = useState<any[]>([]);
  const [filterSearchCount, setFilterSearchCount] = useState(0);
  const [filterSearchLoading, setFilterSearchLoading] = useState(false);

  // Format date: "25 February 2026 at 6:43"
  const formatDate = useMemo(() => (date: Date) => {
    const d = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    const t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    return `${d} at ${t}`;
  }, []);

  // Debug log to verify safe translation object
  console.log("LANG DEBUG", { lang, tKeys: Object.keys(t), hasHome: !!t.home });

  // Authentication flow: redirect to login if no session, home if session exists
  useEffect(() => {
    if (authLoading) return; // Don't redirect while loading
    
    if (!user) {
      // No session - redirect to login
      router.replace('/login');
      return;
    }
    
    // Session exists - check if should be on login page
    if (window.location.pathname === '/login') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  // Load language preference on mount
  useEffect(() => {
    const savedLang = (typeof window !== "undefined" && localStorage.getItem("preferred_language")) as Language;
    if (savedLang && ["en", "ta", "si"].includes(savedLang)) {
      setLang(savedLang);
    }
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live/demo status
  useEffect(() => {
    const fetchLiveStatus = async () => {
      if (!supabase) return;
      if (!tenantContext?.masjidId) return;

      // Check if we have real data
      const { data: familiesData } = await supabase
        .from("families")
        .select("id")
        .eq("masjid_id", tenantContext.masjidId)
        .limit(1);
      
      const { data: membersData } = await supabase
        .from("members")
        .select("id")
        .eq("masjid_id", tenantContext.masjidId)
        .limit(1);

      const hasRealData = (familiesData && familiesData.length > 0) || (membersData && membersData.length > 0);
      setIsLive(hasRealData);
    };

    fetchLiveStatus();
  }, [tenantContext, resumeTick]);

  // Fetch family and member counts
  useEffect(() => {
    const fetchCounts = async () => {
      if (!supabase) return;
      if (!tenantContext?.masjidId) return;

      const { data: familiesData } = await supabase
        .from("families")
        .select("id")
        .eq("masjid_id", tenantContext.masjidId);

      const { data: membersData } = await supabase
        .from("members")
        .select("id")
        .eq("masjid_id", tenantContext.masjidId);

      setFamilyCount(familiesData?.length || 0);
      setMemberCount(membersData?.length || 0);
    };

    fetchCounts();
  }, [tenantContext, resumeTick]);

  // Fetch masjid data
  useEffect(() => {
    const fetchMasjidData = async () => {
      if (!supabase) return;
      if (!tenantContext?.masjidId) return;

      try {
        const { data: masjidData } = await supabase
          .from("masjids")
          .select("masjid_name, logo_url, tagline, preferred_language")
          .eq("id", tenantContext.masjidId)
          .single();

        if (masjidData) {
          setMasjid({
            name: (masjidData as any).masjid_name || "MJM",
            logo_url: (masjidData as any).logo_url || "",
            tagline: (masjidData as any).tagline || "Mubeen Jummah Masjid",
          });
          // Set language from masjid data if available
          if ((masjidData as any).preferred_language && ["en", "ta", "si"].includes((masjidData as any).preferred_language)) {
            setLang((masjidData as any).preferred_language);
          }
        }
      } catch (error) {
        // Safe fallback: set default masjid if anything fails
        setMasjid({
          name: "MJM",
          logo_url: "",
          tagline: "Mubeen Jummah Masjid",
        });
      }
    };

    fetchMasjidData();
  }, [tenantContext, resumeTick]);

  // Authentication flow: redirect to login if no session, home if session exists
  useEffect(() => {
    if (authLoading) return; // Don't redirect while loading
    
    if (!user) {
      // No session - redirect to login
      router.replace('/login');
      return;
    }
    
    // Session exists - check if should be on login page
    if (window.location.pathname === '/login') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  // ONLY ONE conditional render allowed: authLoading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>

        </div>
      </div>
    );
  }

  // ALWAYS render component after this point (even if user is null)
  // Redirect will happen via useEffect

  // Search function
  const runSearch = async (query: string) => {
    if (!supabase || !query) return;
    const requestId = ++searchRequestSeq.current;
    setSearchLoading(true);
    setSearchError("");
    setMemberResults([]);
    setFamilyResults([]);
    setResultType("members");

    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;

      // Parse search query
      const trimmed = query.trim();
      
      // Check for specific patterns
      if (trimmed.startsWith("age:")) {
        const ageStr = trimmed.substring(4).trim();
        if (ageStr.includes(">")) {
          const minAge = parseInt(ageStr.split(">")[1]);
          if (isNaN(minAge)) return;
          const p = { kind: "ageRange" as const, minAge, maxAge: 999 };
          if (trimmed.includes("male")) (p as any).gender = "Male";
          if (trimmed.includes("female")) (p as any).gender = "Female";
          await executeSearch(p, requestId);
          return;
        }
        if (ageStr.includes("<")) {
          const maxAge = parseInt(ageStr.split("<")[1]);
          if (isNaN(maxAge)) return;
          const p = { kind: "ageRange" as const, minAge: 0, maxAge } as SearchParams;
          if (trimmed.includes("male")) (p as any).gender = "Male";
          if (trimmed.includes("female")) (p as any).gender = "Female";
          await executeSearch(p, requestId);
          return;
        }
        if (ageStr.includes("-")) {
          const [minAgeStr, maxAgeStr] = ageStr.split("-");
          const minAge = parseInt(minAgeStr);
          const maxAge = parseInt(maxAgeStr);
          if (isNaN(minAge) || isNaN(maxAge)) return;
          const p = { kind: "ageRange" as const, minAge, maxAge } as SearchParams;
          if (trimmed.includes("male")) (p as any).gender = "Male";
          if (trimmed.includes("female")) (p as any).gender = "Female";
          await executeSearch(p, requestId);
          return;
        }
        const age = parseInt(ageStr);
        if (isNaN(age)) return;
        const p = { kind: "ageExact" as const, age } as SearchParams;
        if (trimmed.includes("male")) (p as any).gender = "Male";
        if (trimmed.includes("female")) (p as any).gender = "Female";
        await executeSearch(p, requestId);
        return;
      }

      // Family code search
      if (trimmed.startsWith("FAM-")) {
        const p = { kind: "familyCode" as const, code: trimmed } as SearchParams;
        await executeSearch(p, requestId);
        return;
      }

      // Free text search
      const p = { kind: "free" as const, text: trimmed } as SearchParams;
      await executeSearch(p, requestId);
    } catch (e: any) {
      if (requestId !== searchRequestSeq.current) return;
      setSearchError(e.message || "Search failed");
    } finally {
      if (requestId !== searchRequestSeq.current) return;
      setSearchLoading(false);
    }
  };

  // Execute search based on parsed parameters
  const executeSearch = async (p: SearchParams, requestId: number) => {
    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;

      if (p.kind === "familyCode") {
        const { data, error } = await supabase
          .from("families")
          .select("id,family_code,head_name,is_widow_head")
          .eq("masjid_id", ctx.masjidId)
          .eq("family_code", p.code)
          .order("family_code", { ascending: true });
        if (error) throw error;
        if (requestId !== searchRequestSeq.current) return;
        setFamilyResults(data || []);
        setResultType("families");
        return;
      }
      if (p.kind === "ageMin") {
        let q = supabase
          .from("members")
          .select("id,family_id,full_name,age,gender")
          .eq("masjid_id", ctx.masjidId)
          .gte("age", p.minAge);
        if (p.gender) q = q.eq("gender", p.gender);
        const { data, error } = await q;
        if (error) throw error;
        if (requestId !== searchRequestSeq.current) return;
        setMemberResults(data || []);
        setResultType("members");
        return;
      }
      if (p.kind === "ageMax") {
        let q = supabase
          .from("members")
          .select("id,family_id,full_name,age,gender")
          .eq("masjid_id", ctx.masjidId)
          .lte("age", p.maxAge);
        if (p.gender) q = q.eq("gender", p.gender);
        const { data, error } = await q;
        if (error) throw error;
        if (requestId !== searchRequestSeq.current) return;
        setMemberResults(data || []);
        setResultType("members");
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

  // Smart Filter functions
  const handleFilterSearch = async () => {
    if (!supabase || !tenantContext?.masjidId) return;
    
    setFilterSearchLoading(true);
    try {
      const filters: any = {};
      
      // Build filters object from state
      if (searchFilters.gender.length > 0) {
        filters.gender = searchFilters.gender;
      }
      if (searchFilters.ageRange.min || searchFilters.ageRange.max) {
        filters.ageRange = searchFilters.ageRange;
      }
      if (searchFilters.birthYear.min || searchFilters.birthYear.max) {
        filters.birthYear = searchFilters.birthYear;
      }
      if (searchFilters.civilStatus.length > 0) {
        filters.civilStatus = searchFilters.civilStatus;
      }
      if (searchFilters.isMoulavi) filters.isMoulavi = true;
      if (searchFilters.isNewMuslim) filters.isNewMuslim = true;
      if (searchFilters.isForeignResident) filters.isForeignResident = true;
      if (searchFilters.hasSpecialNeeds) filters.hasSpecialNeeds = true;
      if (searchFilters.hasHealthIssue) filters.hasHealthIssue = true;
      if (searchFilters.familyIsWidowHead) filters.familyIsWidowHead = true;

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters,
          page: 1,
          limit: 10
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Search failed');
      }

      setFilterSearchResults(result.members || []);
      setFilterSearchCount(result.count || 0);
    } catch (error: any) {
      console.error('Filter search error:', error);
      toast({ kind: "error", title: "Search Error", message: error.message || "Failed to search members" });
    } finally {
      setFilterSearchLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchFilters({
      gender: [],
      ageRange: { min: '', max: '' },
      birthYear: { min: '', max: '' },
      civilStatus: [],
      isMoulavi: false,
      isNewMuslim: false,
      isForeignResident: false,
      hasSpecialNeeds: false,
      hasHealthIssue: false,
      familyIsWidowHead: false,
    });
    setFilterSearchResults([]);
    setFilterSearchCount(0);
  };

  const updateFilter = (key: string, value: any) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
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
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login'); // Still redirect even if sign out fails
    }
  };

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-48 mx-auto mb-6"></div>
      <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-6"></div>
      <div className="bg-gradient-to-r from-gray-200 to-gray-300 rounded-3xl p-6 text-center shadow-xl mb-6">
        <div className="h-8 bg-gray-300 rounded w-32 mx-auto mb-2"></div>
        <div className="h-4 bg-gray-300 rounded w-48 mx-auto"></div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 text-center shadow-lg">
          <div className="w-8 h-8 bg-gray-200 rounded-full mx-auto mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-24 mx-auto mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-12 mx-auto"></div>
        </div>
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 text-center shadow-lg">
          <div className="w-8 h-8 bg-gray-200 rounded-full mx-auto mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-24 mx-auto mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-12 mx-auto"></div>
        </div>
      </div>
      <div className="h-12 bg-gray-200 rounded-full mb-6"></div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4 justify-items-center">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="w-14 h-14 bg-gray-200 rounded-full"></div>
        ))}
      </div>
    </div>
  );

  // Check if initial data is still loading
  const isInitialLoading = !masjid || familyCount === null || memberCount === null;

  return (
  <AppShell 
    title={t.home}
    headerRight={
      <Link href="/scan" className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-3xl transition-colors">
        <QrCode className="w-6 h-6" />
      </Link>
    }
  >
    <main className="flex-1 p-4 space-y-6 w-full">
      {isInitialLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {/* Date Display */}
          <div className="text-center">
            <p className="text-lg font-bold text-neutral-900">
              {formatDate(time)}
            </p>
          </div>

          {/* Circular Mosque Logo */}
          <div className="flex justify-center">
            <div className="w-24 h-24 rounded-full bg-emerald-100 border-4 border-emerald-200 flex items-center justify-center">
              {masjid?.logo_url ? (
                <img 
                  src={masjid.logo_url} 
                  alt="Masjid Logo" 
                  className="w-20 h-20 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L4 7v11h16V7l-8-5z"></path>
                  <path d="M12 22v-4"></path>
                  <path d="M8 18v4"></path>
                  <path d="M16 18v4"></path>
                  <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 6z"></path>
                </svg>
              )}
            </div>
          </div>

          {/* Masjid Name Bar */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 rounded-3xl p-6 text-center shadow-xl">
            <h1 className="text-2xl font-black text-white tracking-wide">
              {masjid?.name || "MJM"}
            </h1>
            <p className="text-sm text-emerald-100 mt-1">
              {masjid?.tagline || "Mubeen Jummah Masjid"}
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
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 group-focus-within:text-emerald-600 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFilterSheetOpen(true)}
              placeholder={t.search_placeholder}
              className="app-input pl-12 pr-12 font-bold text-sm md:text-base"
            />
            <button
              onClick={() => setIsFilterSheetOpen(true)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-neutral-400 hover:text-emerald-600 transition-colors"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>

          {/* Menu Grid - Responsive Circular Icons */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4 justify-items-center">
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

          {/* Filter Sheet */}
          {isFilterSheetOpen && (
            <div className="fixed inset-0 z-50 flex flex-col bg-black/50 backdrop-blur-sm">
              {/* Overlay */}
              <div 
                className="flex-1"
                onClick={() => setIsFilterSheetOpen(false)}
              />
              
              {/* Bottom Sheet */}
              <div className="bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-lg font-black text-neutral-900">Smart Filters</h3>
                  <button
                    onClick={() => setIsFilterSheetOpen(false)}
                    className="p-2 text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Filter Content */}
                <div className="p-6 space-y-6">
                  {/* Gender Filters */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Gender</h4>
                    <div className="flex flex-wrap gap-3">
                      {['Male', 'Female'].map(gender => (
                        <label key={gender} className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-full cursor-pointer hover:bg-emerald-50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={searchFilters.gender.includes(gender)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateFilter('gender', [...searchFilters.gender, gender]);
                              } else {
                                updateFilter('gender', searchFilters.gender.filter((g: string) => g !== gender));
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm text-neutral-700">{gender}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Age Range */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Age Range</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="number" 
                        placeholder="Min Age" 
                        value={searchFilters.ageRange.min}
                        onChange={(e) => updateFilter('ageRange', { ...searchFilters.ageRange, min: e.target.value })}
                        className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" 
                      />
                      <input 
                        type="number" 
                        placeholder="Max Age" 
                        value={searchFilters.ageRange.max}
                        onChange={(e) => updateFilter('ageRange', { ...searchFilters.ageRange, max: e.target.value })}
                        className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" 
                      />
                    </div>
                  </div>

                  {/* Birth Year */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Birth Year</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="number" 
                        placeholder="From Year" 
                        value={searchFilters.birthYear.min}
                        onChange={(e) => updateFilter('birthYear', { ...searchFilters.birthYear, min: e.target.value })}
                        className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" 
                      />
                      <input 
                        type="number" 
                        placeholder="To Year" 
                        value={searchFilters.birthYear.max}
                        onChange={(e) => updateFilter('birthYear', { ...searchFilters.birthYear, max: e.target.value })}
                        className="px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none" 
                      />
                    </div>
                  </div>

                  {/* Civil Status */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Civil Status</h4>
                    <div className="flex flex-wrap gap-3">
                      {['Single', 'Married', 'Divorced', 'Widowed', 'Other'].map(status => (
                        <label key={status} className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-full cursor-pointer hover:bg-emerald-50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={searchFilters.civilStatus.includes(status)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                updateFilter('civilStatus', [...searchFilters.civilStatus, status]);
                              } else {
                                updateFilter('civilStatus', searchFilters.civilStatus.filter((s: string) => s !== status));
                              }
                            }}
                            className="sr-only"
                          />
                          <span className="text-sm text-neutral-700">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Special Categories */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Special Categories</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'isMoulavi', label: 'Moulavi' },
                        { id: 'isNewMuslim', label: 'New Muslim' },
                        { id: 'isForeignResident', label: 'Foreign Resident' },
                        { id: 'hasSpecialNeeds', label: 'Special Needs' },
                        { id: 'hasHealthIssue', label: 'Health Issue' },
                        { id: 'familyIsWidowHead', label: 'Widow Family' }
                      ].map(filter => (
                        <label key={filter.id} className="flex items-center gap-2 px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-full cursor-pointer hover:bg-emerald-50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={searchFilters[filter.id as keyof typeof searchFilters] as boolean}
                            onChange={(e) => updateFilter(filter.id, e.target.checked)}
                            className="sr-only"
                          />
                          <span className="text-sm text-neutral-700">{filter.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-neutral-200">
                    <button 
                      onClick={clearFilters}
                      className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-600 rounded-full text-sm font-bold hover:bg-neutral-200 transition-colors"
                    >
                      Clear Filters
                    </button>
                    <button 
                      onClick={handleFilterSearch}
                      disabled={filterSearchLoading}
                      className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-full text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors"
                    >
                      {filterSearchLoading ? 'Searching...' : 'Apply Filters'}
                    </button>
                  </div>

                  {/* Search Results */}
                  {filterSearchResults.length > 0 && (
                    <div className="border-t border-neutral-200 pt-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-sm text-neutral-600">
                          Found <span className="font-black text-neutral-900">{filterSearchCount}</span> members
                        </div>
                      </div>
                      
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {filterSearchResults.map((member: any) => (
                          <div key={member.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg hover:bg-white transition-colors">
                            <div className="flex-1">
                              <p className="font-black text-neutral-900 text-sm">{member.name}</p>
                              <p className="text-xs text-neutral-600">{member.family_code} • {member.gender} • {member.civil_status || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-neutral-600">
                                {member.dob ? new Date().getFullYear() - new Date(member.dob).getFullYear() : '-'} years
                              </p>
                              <p className="text-xs text-neutral-500">{member.phone || 'No phone'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  </AppShell>
);
}
