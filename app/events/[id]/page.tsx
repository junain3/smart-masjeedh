"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, CheckCircle, Clock, QrCode, FileText, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTranslation, translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { getPdfMasjidName } from "@/lib/pdf-utils";
import { useMockAuth } from "@/components/MockAuthProvider";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useAppToast } from "@/components/ToastProvider";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Ev = { id: string; title: string; event_date: string };
type Att = {
  id: string;
  status?: "Pending" | "Received";
  family_id: string;
  families: { id: string; family_code: string; head_name: string; phone?: string; address?: string };
};
type PdfFilter = "all" | "received" | "pending";

export default function EventDetailPage() {
  const router = useRouter();
  const { toast } = useAppToast();
  const params = useParams();
  const eventId = params?.id as string;
  const [lang, setLang] = useState<Language>("en");
  const t = getTranslation(lang);
  const [ev, setEv] = useState<Ev | null>(null);
  const [rows, setRows] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all"|"received"|"pending">("all");
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [confirmUnmark, setConfirmUnmark] = useState<{familyId: string, familyCode: string} | null>(null);
  const [isPdfFilterOpen, setIsPdfFilterOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfCols, setPdfCols] = useState<{serialTick: boolean; family_code: boolean; head_name: boolean; members: boolean; address: boolean; phone: boolean; signature: boolean}>({serialTick: false, family_code: true, head_name: true, members: false, address: false, phone: false, signature: false});
  const { tenantContext } = useMockAuth();

  const sortByFamilyCode = (a: Att, b: Att) => {
    const getNumericPart = (code: string) => {
      const match = code.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const numA = getNumericPart(a.families.family_code || "");
    const numB = getNumericPart(b.families.family_code || "");
    
    return numA - numB;
  };

  const getCacheKey = (id: string) => `event_attendance_cache_${id}`;

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    
    // 1. Load stale data from localStorage first for instant UI load
    const cachedRows = localStorage.getItem(getCacheKey(eventId));
    if (cachedRows) {
      const parsed = JSON.parse(cachedRows);
      const sorted = parsed.sort(sortByFamilyCode);
      setRows(sorted);
      setLoading(false);
    }
    
    // 2. Revalidate in background
    fetchData();
  }, [eventId]);

  async function fetchData() {
    if (!supabase) return;
    try {
      // Use tenantContext from auth provider instead of getTenantContext
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) {
        router.push("/login");
        return;
      }

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      setAllowed(canEvents);
      if (!canEvents) {
        setEv(null);
        setRows([]);
        return;
      }
      const { data: e } = await supabase
        .from("events")
        .select("id,title,event_date")
        .eq("id", eventId)
        .eq("masjid_id", ctx.masjidId)
        .single();
      setEv(e || null);

      const [{ data: famData, error: famErr }, { data: a, error: attErr }] = await Promise.all([
        supabase
          .from("families")
          .select("id,family_code,head_name,phone,address")
          .eq("masjid_id", ctx.masjidId),
        supabase
          .from("event_attendance")
          .select("id,status,family_id,families(id,family_code,head_name,phone,address)")
          .eq("event_id", eventId)
          .eq("masjid_id", ctx.masjidId)
          .order("created_at", { ascending: true }),
      ]);
      if (famErr) {
        console.log('EVENT DETAIL famData error:', famErr);
        throw famErr;
      }
      if (attErr) throw attErr;

      const existing = new Set(((a as any) || []).map((r: any) => r.family_id));
      const missing = (famData || []).filter((f: any) => !existing.has(f.id));
      if (missing.length > 0) {
        const missingRows = missing.map((f: any) => ({
          event_id: eventId,
          family_id: f.id,
          masjid_id: ctx.masjidId,
          status: "Pending",
        }));

        const chunkSize = 400;
        for (let i = 0; i < missingRows.length; i += chunkSize) {
          const chunk = missingRows.slice(i, i + chunkSize);
          const { error: insErr } = await supabase
            .from("event_attendance")
            .upsert(chunk as any, { onConflict: "event_id,family_id" });
          if (insErr) throw insErr;
        }
      }

      const { data: a2, error: attErr2 } = await supabase
        .from("event_attendance")
        .select("id,status,family_id,families(id,family_code,head_name,phone,address)")
        .eq("event_id", eventId)
        .eq("masjid_id", ctx.masjidId)
        .order("created_at", { ascending: true });
      if (attErr2) throw attErr2;
      const sortedRows = ((a2 as any) || []).sort(sortByFamilyCode);
      
      // 3. Update localStorage and state silently
      localStorage.setItem(getCacheKey(eventId), JSON.stringify(sortedRows));
      setRows(sortedRows);
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed" });
    } finally {
      setLoading(false);
    }
  }

  async function handleScan(decodedText: string) {
    if (!supabase) return;
    if (!decodedText.startsWith("smart-masjeedh:family:")) return;
    const familyId = decodedText.split(":")[2];
    setLastScanned(familyId);
    setIsScannerOpen(false);
    setShowSuggestions(false);
  }

  function openBalloonForFamily(familyId: string) {
    setLastScanned(familyId);
    setSearch("");
    setShowSuggestions(false);
  }

  async function markStatus(
    familyId: string,
    toReceived: boolean,
    familyCode?: string | false
  ) {
    if (!supabase) return;
    
    // If trying to unmark (turn OFF), show confirmation
    if (!toReceived) {
      setConfirmUnmark({ familyId, familyCode: familyCode || "" });
      return;
    }
    
    const originalRow = rows.find(r => r.family_id === familyId);
    const originalStatus = originalRow?.status || "Pending";
    const nextStatus = "Received";
    
    // 1. Optimistic Update: Immediate visual feedback
    const optimisticRows = rows.map(r => r.family_id === familyId ? { ...r, status: nextStatus } : r);
    setRows(optimisticRows);
    localStorage.setItem(getCacheKey(eventId), JSON.stringify(optimisticRows));
    
    try {
      // Use tenantContext from auth provider instead of getTenantContext
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;
      const serviceName = ev ? `Event: ${ev.title}` : "Event Service";
      const serviceDate = ev?.event_date || new Date().toISOString().split("T")[0];

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "" });
        // Rollback on access denied
        const rollbackRows = rows.map(r => r.family_id === familyId ? { ...r, status: originalStatus } : r);
        setRows(rollbackRows);
        localStorage.setItem(getCacheKey(eventId), JSON.stringify(rollbackRows));
        return;
      }
      
      // Update event attendance in background
      const { error: attendanceError } = await supabase
        .from("event_attendance")
        .update({ status: nextStatus })
        .eq("event_id", eventId)
        .eq("family_id", familyId)
        .eq("masjid_id", ctx.masjidId);
      
      if (attendanceError) throw attendanceError;

      // Update service distribution in background
      const { data: existingService } = await supabase
        .from("service_distributions")
        .select("id")
        .eq("family_id", familyId)
        .eq("masjid_id", ctx.masjidId)
        .eq("name", serviceName)
        .eq("date", serviceDate)
        .limit(1)
        .maybeSingle();

      if (existingService?.id) {
        await supabase
          .from("service_distributions")
          .update({ status: nextStatus })
          .eq("id", existingService.id)
          .eq("masjid_id", ctx.masjidId);
      } else if (toReceived) {
        await supabase
          .from("service_distributions")
          .insert({
            family_id: familyId,
            masjid_id: ctx.masjidId,
            name: serviceName,
            date: serviceDate,
            status: nextStatus,
          });
      }

      // Log to accounts as zero-amount info row when marking Received
      if (toReceived && ev) {
        await supabase.from("transactions").insert([{
          masjid_id: ctx.masjidId,
          family_id: familyId,
          amount: 0,
          description: `Event: ${ev.title} (${familyCode === false ? "" : (familyCode || "")})`,
          type: "income",
          category: `Event: ${ev.title}`,
          date: ev.event_date || new Date().toISOString().split("T")[0]
        }]);
      }
    } catch (e: any) {
      // 3. Error Rollback
      toast({ kind: "error", title: "Error", message: e.message || "Failed" });
      const rollbackRows = rows.map(r => r.family_id === familyId ? { ...r, status: originalStatus } : r);
      setRows(rollbackRows);
      localStorage.setItem(getCacheKey(eventId), JSON.stringify(rollbackRows));
    }
  }

  async function confirmUnmarkFamily() {
    if (!confirmUnmark || !supabase) return;
    
    const originalRow = rows.find(r => r.family_id === confirmUnmark.familyId);
    const originalStatus = originalRow?.status || "Received";
    const nextStatus = "Pending";
    
    // 1. Optimistic Update: Immediate visual feedback
    const optimisticRows = rows.map(r => r.family_id === confirmUnmark.familyId ? { ...r, status: nextStatus } : r);
    setRows(optimisticRows);
    localStorage.setItem(getCacheKey(eventId), JSON.stringify(optimisticRows));
    setConfirmUnmark(null);
    
    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;
      const serviceName = ev ? `Event: ${ev.title}` : "Event Service";
      const serviceDate = ev?.event_date || new Date().toISOString().split("T")[0];

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "" });
        // Rollback on access denied
        const rollbackRows = rows.map(r => r.family_id === confirmUnmark.familyId ? { ...r, status: originalStatus } : r);
        setRows(rollbackRows);
        localStorage.setItem(getCacheKey(eventId), JSON.stringify(rollbackRows));
        return;
      }
      
      // Update event attendance in background
      const { error: attendanceError } = await supabase
        .from("event_attendance")
        .update({ status: nextStatus })
        .eq("event_id", eventId)
        .eq("family_id", confirmUnmark.familyId)
        .eq("masjid_id", ctx.masjidId);
      
      if (attendanceError) throw attendanceError;

      // Update service distribution in background
      await supabase
        .from("service_distributions")
        .update({ status: nextStatus })
        .eq("family_id", confirmUnmark.familyId)
        .eq("masjid_id", ctx.masjidId)
        .eq("name", serviceName)
        .eq("date", serviceDate);
      
      toast({ kind: "success", title: "Success", message: "Marked as not received" });
    } catch (e: any) {
      // 3. Error Rollback
      toast({ kind: "error", title: "Error", message: e.message || "Failed" });
      const rollbackRows = rows.map(r => r.family_id === confirmUnmark.familyId ? { ...r, status: originalStatus } : r);
      setRows(rollbackRows);
      localStorage.setItem(getCacheKey(eventId), JSON.stringify(rollbackRows));
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      const blob = `${r.families.family_code} ${r.families.head_name} ${r.families.phone || ""} ${r.families.address || ""}`.toLowerCase();
      const matchesSearch = blob.includes(q);
      const isReceived = r.status === "Received";
      const matchesFilter = filter === "all" ? true : isReceived === (filter === "received");
      return matchesSearch && matchesFilter;
    });
  }, [rows, search, filter]);

  const displayRows = useMemo(() => {
    if (lastScanned) {
      const r = rows.find((x) => x.family_id === lastScanned);
      return r ? [r] : [];
    }
    return filtered;
  }, [rows, filtered, lastScanned]);

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [] as Att[];
    const base = rows.filter((r) => {
      const blob = `${r.families.family_code} ${r.families.head_name} ${r.families.phone || ""} ${r.families.address || ""}`.toLowerCase();
      return blob.includes(q);
    });
    return base.slice(0, 6);
  }, [rows, search]);

  const total = rows.length;
  const receivedCount = rows.filter(r => r.status === "Received").length;
  const remainingCount = total - receivedCount;

  const generatePDF = async (pdfFilter: PdfFilter) => {
    try {
      if (!supabase) return;
      setIsGeneratingPdf(true);
      setIsPdfFilterOpen(false);

      const ctx = tenantContext || await getTenantContext();
      if (!ctx) {
        router.push("/login");
        return;
      }

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "You do not have permission to generate event reports." });
        return;
      }

      if (!ev) {
        toast({ kind: "error", title: "Missing Event", message: "Event details are not loaded yet." });
        return;
      }

      const printableRows = rows.filter(r => {
        if (pdfFilter === "received") return r.status === "Received";
        if (pdfFilter === "pending") return r.status !== "Received";
        return true;
      });

      const familyIds = printableRows.map((row) => row.family_id);
      let memberData: any[] = [];
      let memberError: any = null;
      
      if (familyIds.length > 0) {
        const chunkSize = 400;
        for (let i = 0; i < familyIds.length; i += chunkSize) {
          const chunk = familyIds.slice(i, i + chunkSize);
          const result = await supabase
            .from("members")
            .select("family_id,name,full_name")
            .in("family_id", chunk)
            .eq("masjid_id", ctx.masjidId);
          
          if (result.error) {
            memberError = result.error;
            break;
          }
          
          if (result.data) {
            memberData = [...memberData, ...result.data];
          }
        }
      }

      if (memberError) throw memberError;

      const membersByFamily = ((memberData as any[]) || []).reduce<Record<string, string[]>>((acc, member) => {
        const memberName = member.full_name || member.name;
        if (!member.family_id || !memberName) return acc;
        acc[member.family_id] = [...(acc[member.family_id] || []), memberName];
        return acc;
      }, {});

      const pdfTotal = printableRows.length;
      const pdfReceived = printableRows.filter(r => r.status === "Received").length;
      const pdfPending = pdfTotal - pdfReceived;
      const reportTitle = `${pdfFilter === "all" ? "All" : pdfFilter === "received" ? "Received" : "Pending"} Families`;
      const masjidName = await getPdfMasjidName(supabase, ctx.masjidId);

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header section - all center-aligned
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(6, 78, 59); // Dark green for masjid name
      doc.text(masjidName, pageWidth / 2, 14, { align: "center" });
      
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42); // Dark slate for subtitle
      doc.text("Event Attendance Sheet", pageWidth / 2, 21, { align: "center" });
      
      // Safe event name: strip any problematic characters
      let safeEventName = ev.title || "Event Attendance Report";
      // Replace any non-ASCII or problematic characters to prevent gibberish
      safeEventName = safeEventName.replace(/[^\x20-\x7E]/g, "");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // Dark slate for event name
      doc.text(safeEventName, pageWidth / 2, 28, { align: "center" });
      
      // Metadata lines - safe English/Tamil bilingual fallback
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // Slate gray for metadata
      const metaLine1 = `Event Date: ${ev.event_date} | Showing: ${reportTitle}`;
      doc.text(metaLine1, pageWidth / 2, 36, { align: "center" });
      
      // Colored metadata numbers
      doc.setFont("helvetica", "bold");
      const metaLabelX = pageWidth / 2 - 40;
      
      doc.setTextColor(15, 23, 42);
      doc.text("Total:", metaLabelX, 42);
      doc.setTextColor(6, 78, 59); // Green for total
      doc.text(String(pdfTotal), metaLabelX + 18, 42);
      
      doc.setTextColor(15, 23, 42);
      doc.text("Received:", metaLabelX + 30, 42);
      doc.setTextColor(5, 150, 105); // Emerald for received
      doc.text(String(pdfReceived), metaLabelX + 58, 42);
      
      doc.setTextColor(15, 23, 42);
      doc.text("Pending:", metaLabelX + 72, 42);
      doc.setTextColor(217, 119, 6); // Amber for pending
      doc.text(String(pdfPending), metaLabelX + 98, 42);

      // Prepare headers and body based on selected columns
      const headers: string[] = [];
      if (pdfCols.serialTick) headers.push("S.No");
      if (pdfCols.family_code) headers.push("Family Code");
      if (pdfCols.head_name) headers.push("Head Name");
      if (pdfCols.members) headers.push("Family Members");
      if (pdfCols.address) headers.push("Address");
      if (pdfCols.phone) headers.push("Phone");
      if (pdfCols.signature) headers.push("Signature");

      const tableBody = printableRows.map((row, index) => {
        const rowData: (string|number|{content: string, styles: any})[] = [];
        if (pdfCols.serialTick) rowData.push(index + 1);
        if (pdfCols.family_code) rowData.push({ content: row.families.family_code || "", styles: { fontStyle: "bold" } });
        if (pdfCols.head_name) rowData.push({ content: row.families.head_name || "", styles: { fontStyle: "bold" } });
        if (pdfCols.members) rowData.push({ content: (membersByFamily[row.family_id] || []).join(", "), styles: { fontStyle: "bold" } });
        if (pdfCols.address) rowData.push(row.families.address || "");
        if (pdfCols.phone) rowData.push(row.families.phone || "");
        if (pdfCols.signature) rowData.push("");
        return rowData;
      });

      autoTable(doc, {
        startY: 48,
        head: [headers],
        body: tableBody,
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: { 
          fillColor: [6, 78, 59], // Dark green theme
          textColor: 255, 
          fontStyle: "bold" 
        },
        theme: "grid",
      });

      const safeTitle = (ev.title || "event").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "");
      doc.save(`event-attendance-${safeTitle || eventId}-${pdfFilter}.pdf`);
      toast({ kind: "success", title: "PDF Downloaded", message: `${reportTitle} report downloaded successfully.` });
    } catch (error: any) {
      console.error("Event Detail: PDF generation error:", error);
      toast({ kind: "error", title: "PDF Failed", message: error.message || "Failed to generate PDF." });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) return <div className="p-8 text-center">{t.loading}</div>;

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans pb-10">
        <header className="bg-white px-4 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <Link href="/events" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-emerald-600" />
            </Link>
            <div>
              <h1 className="text-xl font-black">{t.events}</h1>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 max-w-md mx-auto w-full">
          <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">
            Access denied.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans pb-10">
      <header className="bg-white px-4 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/events" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-emerald-600" />
          </Link>
          <div>
            <h1 className="text-xl font-black">{ev?.title}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{ev?.event_date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
            title={t.scan_qr}
          >
            <QrCode className="w-6 h-6" />
          </button>
          <button
            onClick={() => setIsPdfFilterOpen(true)}
            disabled={isGeneratingPdf}
            className="p-3 bg-slate-50 text-blue-600 rounded-2xl hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            title={t.download_pdf}
          >
            <FileText className="w-6 h-6" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 space-y-4 max-w-md mx-auto w-full">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.total_families}</p>
            <p className="text-2xl font-black text-slate-800">{total}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.received_count}</p>
            <p className="text-2xl font-black text-emerald-600">{receivedCount}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.remaining_count}</p>
            <p className="text-2xl font-black text-amber-600">{remainingCount}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => { setFilter("all"); setLastScanned(null); }} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter==="all" ? "bg-emerald-50 text-emerald-600" : "bg-white border border-slate-100 text-slate-500"}`}>{t.filter_all}</button>
          <button onClick={() => { setFilter("received"); setLastScanned(null); }} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter==="received" ? "bg-emerald-50 text-emerald-600" : "bg-white border border-slate-100 text-slate-500"}`}>{t.filter_received}</button>
          <button onClick={() => { setFilter("pending"); setLastScanned(null); }} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter==="pending" ? "bg-emerald-50 text-emerald-600" : "bg-white border border-slate-100 text-slate-500"}`}>{t.filter_pending}</button>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            placeholder={t.search}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggestions(true);
              if (e.target.value.trim()) setLastScanned(null);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 120);
            }}
            className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
          />

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 mt-2 w-full bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
              {suggestions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => openBalloonForFamily(r.family_id)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{r.families.head_name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase truncate">
                        {r.families.family_code} • {r.families.phone || ""}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        r.status === "Received"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.status === "Received" ? t.received : t.pending}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>


        <div className="space-y-3">
          {displayRows.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-[2rem] border border-slate-50">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t.no_matches}</p>
            </div>
          ) : (
            displayRows.map(r => (
              <div
                key={r.id}
                className={`bg-white rounded-2xl p-4 shadow-sm ${
                  lastScanned && r.family_id === lastScanned
                    ? "border border-emerald-100"
                    : "border border-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{r.families.head_name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{r.families.family_code} • {r.families.phone || ""}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.status === "Received"}
                      onChange={() => markStatus(r.family_id, r.status !== "Received", r.families.family_code)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <QrScannerModal
        open={isScannerOpen}
        title={t.scan_qr}
        containerId="event-reader"
        onClose={() => setIsScannerOpen(false)}
        onDecodedText={handleScan}
        helperText={t.attendance}
      />

      {isPdfFilterOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-5 text-center">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Download Event PDF</h3>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Choose which attendance records and columns to include.
              </p>
            </div>

            <div className="space-y-2 mb-4">
              {([
                { key: "all", label: "All Families", helper: "Include received and pending families." },
                { key: "received", label: "Received Only", helper: "Include only families marked as received." },
                { key: "pending", label: "Pending Only", helper: "Include only families not yet received." },
              ] as { key: PdfFilter; label: string; helper: string }[]).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => generatePDF(option.key)}
                  disabled={isGeneratingPdf}
                  className="w-full text-left p-4 rounded-2xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="block text-sm font-black text-slate-800">
                    {isGeneratingPdf ? "Preparing PDF..." : option.label}
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-400 mt-1">{option.helper}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4 mb-4">
              <h4 className="text-sm font-bold text-slate-900 mb-3">Columns</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={pdfCols.serialTick}
                    onChange={(e) => setPdfCols(s => ({ ...s, serialTick: e.target.checked }))}
                  />
                  Serial Number Tick Box
                </label>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={pdfCols.family_code}
                    onChange={(e) => setPdfCols(s => ({ ...s, family_code: e.target.checked }))}
                  />
                  Family Code
                </label>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={pdfCols.head_name}
                    onChange={(e) => setPdfCols(s => ({ ...s, head_name: e.target.checked }))}
                  />
                  Head Name
                </label>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={pdfCols.members}
                    onChange={(e) => setPdfCols(s => ({ ...s, members: e.target.checked }))}
                  />
                  Family Members
                </label>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={pdfCols.address}
                    onChange={(e) => setPdfCols(s => ({ ...s, address: e.target.checked }))}
                  />
                  Address
                </label>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={pdfCols.phone}
                    onChange={(e) => setPdfCols(s => ({ ...s, phone: e.target.checked }))}
                  />
                  Phone
                </label>
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={pdfCols.signature}
                    onChange={(e) => setPdfCols(s => ({ ...s, signature: e.target.checked }))}
                  />
                  Signature Column
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPdfFilterOpen(false)}
              disabled={isGeneratingPdf}
              className="mt-2 w-full py-3 rounded-2xl bg-slate-100 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmUnmark && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 border border-slate-200">
            <h3 className="text-lg font-black mb-4">Confirm Unmark Family</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to mark {confirmUnmark.familyCode} as not received?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmUnmark(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnmarkFamily}
                className="px-4 py-2 bg-rose-500 text-white rounded-xl text-sm font-medium"
              >
                Confirm Unmark
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
