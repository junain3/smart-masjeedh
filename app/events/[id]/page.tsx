"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, CheckCircle, Clock, QrCode, FileText, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { useMockAuth } from "@/components/MockAuthProvider";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useAppToast } from "@/components/ToastProvider";

type Ev = { id: string; title: string; event_date: string };
type Att = {
  id: string;
  status?: "Pending" | "Received";
  family_id: string;
  families: { id: string; family_code: string; head_name: string; phone?: string; address?: string };
};

export default function EventDetailPage() {
  const router = useRouter();
  const { toast } = useAppToast();
  const params = useParams();
  const eventId = params?.id as string;
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];
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
  const { tenantContext } = useMockAuth();

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchData();
  }, [eventId]);

  async function fetchData() {
    if (!supabase) return;
    setLoading(true);
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
      setRows((a2 as any) || []);
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
    
    // If marking as received (turn ON), proceed immediately
    try {
      // Use tenantContext from auth provider instead of getTenantContext
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "" });
        return;
      }
      const { error } = await supabase
        .from("event_attendance")
        .update({ status: toReceived ? "Received" : "Pending" })
        .eq("event_id", eventId)
        .eq("family_id", familyId)
        .eq("masjid_id", ctx.masjidId);
      if (error) throw error;
      setRows(prev => prev.map(r => r.family_id === familyId ? { ...r, status: toReceived ? "Received" : "Pending" } : r));
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
      toast({ kind: "error", title: "Error", message: e.message || "Failed" });
    }
  }

  async function confirmUnmarkFamily() {
    if (!confirmUnmark || !supabase) return;
    
    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "" });
        return;
      }
      
      const { error } = await supabase
        .from("event_attendance")
        .update({ status: "Pending" })
        .eq("event_id", eventId)
        .eq("family_id", confirmUnmark.familyId)
        .eq("masjid_id", ctx.masjidId);
      if (error) throw error;
      
      setRows(prev => prev.map(r => r.family_id === confirmUnmark.familyId ? { ...r, status: "Pending" } : r));
      setConfirmUnmark(null);
      toast({ kind: "success", title: "Success", message: "Marked as not received" });
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed" });
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

  const generatePDF = () => {
    try {
      console.log('Event Detail: Starting print generation...');
      
      // Check client-side
      if (typeof window === 'undefined') {
        console.error('Print generation not available in server-side rendering');
        return;
      }
      
      // Create printable HTML
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        alert('Please allow popups for this website to print PDF');
        return;
      }
      
      // Generate HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Event Attendance Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 18px; font-weight: bold; }
            h2 { text-align: center; margin-bottom: 20px; font-size: 14px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; font-size: 11px; }
            td { font-size: 10px; word-wrap: break-word; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
            @media print { body { margin: 10px; } th, td { border: 1px solid #000; padding: 6px; font-size: 9px; } }
          </style>
        </head>
        <body>
          <h1>Event Attendance Report</h1>
          <h2>${ev?.title || ''} (${ev?.event_date || ''})</h2>
          <table>
            <thead>
              <tr>
                <th>Family Code</th>
                <th>Head Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      // Add data rows
      rows.forEach(r => {
        htmlContent += '<tr>';
        htmlContent += `<td>${r.families.family_code || ''}</td>`;
        htmlContent += `<td>${r.families.head_name || ''}</td>`;
        htmlContent += `<td>${r.status || ''}</td>`;
        htmlContent += '</tr>';
      });
      
      htmlContent += `
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px;">
              🖨️ Print / Save as PDF
            </button>
          </div>
        </body>
        </html>
      `;
      
      // Write content to new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      console.log('Event Detail: Print window opened successfully');
      
    } catch (error) {
      console.error('Event Detail: Print generation error:', error);
      alert('Print generation failed: ' + (error as Error).message);
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
            onClick={generatePDF}
            className="p-3 bg-slate-50 text-blue-600 rounded-2xl hover:bg-blue-50 transition-all active:scale-95"
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
          <button onClick={() => setFilter("all")} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter==="all" ? "bg-emerald-50 text-emerald-600" : "bg-white border border-slate-100 text-slate-500"}`}>{t.filter_all}</button>
          <button onClick={() => setFilter("received")} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter==="received" ? "bg-emerald-50 text-emerald-600" : "bg-white border border-slate-100 text-slate-500"}`}>{t.filter_received}</button>
          <button onClick={() => setFilter("pending")} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${filter==="pending" ? "bg-emerald-50 text-emerald-600" : "bg-white border border-slate-100 text-slate-500"}`}>{t.filter_pending}</button>
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

        {/* Last scanned highlight */}
        {lastScanned && (() => {
          const r = rows.find(x => x.family_id === lastScanned);
          if (!r) return null;
          return (
            <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm animate-in zoom-in duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Scanned</p>
                  <h4 className="text-sm font-black text-slate-800">{r.families.head_name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{r.families.family_code} • {r.families.phone || ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.status === "Received"}
                      onChange={() => markStatus(r.family_id, r.status !== "Received", false)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>
          );
        })()}

        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-[2rem] border border-slate-50">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t.no_matches}</p>
            </div>
          ) : (
            filtered.map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-4 border border-slate-50 shadow-sm">
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
