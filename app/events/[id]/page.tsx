"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, CheckCircle, Clock, QrCode, FileText, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";

type Ev = { id: string; name: string; date: string };
type Att = {
  id: string;
  status?: "Pending" | "Received";
  received?: boolean;
  family_id: string;
  families: { id: string; family_code: string; head_name: string; phone?: string; address?: string };
};

export default function EventDetailPage() {
  const router = useRouter();
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

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchData();
  }, [eventId]);

  async function fetchData() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const { data: e } = await supabase
        .from("events")
        .select("id,name,date")
        .eq("id", eventId)
        .eq("masjid_id", session.user.id)
        .single();
      setEv(e || null);
      const { data: a } = await supabase
        .from("event_attendance")
        .select("id,received,status,family_id,families(id,family_code,head_name,phone,address)")
        .eq("event_id", eventId)
        .eq("masjid_id", session.user.id)
        .order("created_at", { ascending: true });
      setRows((a as any) || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let html5QrCode: any = null;
    if (isScannerOpen) {
      import("html5-qrcode").then((lib: any) => {
        html5QrCode = new lib.Html5Qrcode("event-reader");
        const config = { fps: 12, qrbox: { width: 260, height: 260 } };
        html5QrCode
          .start({ facingMode: "environment" }, config,
            (decodedText: string) => handleScan(decodedText),
            (_err: any) => {})
          .catch((_e: any) => {});
      });
    }
    return () => {
      if (html5QrCode && html5QrCode.stop) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
      }
    };
  }, [isScannerOpen, eventId]);

  async function handleScan(decodedText: string) {
    if (!supabase) return;
    if (!decodedText.startsWith("smart-masjeedh:family:")) return;
    // Do NOT auto-mark received; just highlight scanned family
    const familyId = decodedText.split(":")[2];
    setLastScanned(familyId);
  }

  async function markStatus(
    familyId: string,
    toReceived: boolean,
    familyCode?: string | false
  ) {
    if (!supabase) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { error } = await supabase
        .from("event_attendance")
        .update({ received: toReceived, status: toReceived ? "Received" : "Pending" })
        .eq("event_id", eventId)
        .eq("family_id", familyId)
        .eq("masjid_id", session.user.id);
      if (error) throw error;
      setRows(prev => prev.map(r => r.family_id === familyId ? { ...r, received: toReceived, status: toReceived ? "Received" : "Pending" } : r));
      // Log to accounts as zero-amount info row when marking Received
      if (toReceived && ev) {
        await supabase.from("transactions").insert([{
          masjid_id: session.user.id,
          family_id: familyId,
          amount: 0,
          description: `Event: ${ev.name} (${familyCode === false ? "" : (familyCode || "")})`,
          type: "income",
          category: `Event: ${ev.name}`,
          date: ev.date || new Date().toISOString().split("T")[0]
        }]);
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(r => {
      const blob = `${r.families.family_code} ${r.families.head_name} ${r.families.phone || ""} ${r.families.address || ""}`.toLowerCase();
      const matchesSearch = blob.includes(q);
      const isReceived = (r as any).received ?? r.status === "Received";
      const matchesFilter = filter === "all" ? true : isReceived === (filter === "received");
      return matchesSearch && matchesFilter;
    });
  }, [rows, search, filter]);

  const total = rows.length;
  const receivedCount = rows.filter(r => (r as any).received ?? r.status === "Received").length;
  const remainingCount = total - receivedCount;

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text(`${t.attendance_report}: ${ev?.name || ""} (${ev?.date || ""})`, 14, 15);
    const table = rows.map(r => [
      r.families.family_code,
      r.families.head_name,
      r.status
    ]);
    // @ts-ignore
    doc.autoTable({ startY: 20, head: [[ "Code", "Head", t.status ]], body: table });
    doc.save("event_attendance.pdf");
  };

  if (loading) return <div className="p-8 text-center">{t.loading}</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans pb-10">
      <header className="bg-white px-4 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/events" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-emerald-600" />
          </Link>
          <div>
            <h1 className="text-xl font-black">{ev?.name}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{ev?.date}</p>
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
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
          />
        </div>

        {/* Last scanned highlight */}
        {lastScanned && (() => {
          const r = rows.find(x => x.family_id === lastScanned);
          if (!r) return null;
          return (
            <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Scanned</p>
                  <h4 className="text-sm font-black text-slate-800">{r.families.head_name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{r.families.family_code} • {r.families.phone || ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {((r as any).received ?? r.status === "Received") === false ? (
                    <button
                      onClick={() => markStatus(r.family_id, true, false)}
                      className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest"
                    >
                      {t.mark_received}
                    </button>
                  ) : (
                    <button
                      onClick={() => markStatus(r.family_id, false, false)}
                      className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest"
                    >
                      {t.unmark_received}
                    </button>
                  )}
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
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${((r as any).received ?? r.status === "Received") ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                    {((r as any).received ?? r.status === "Received") ? t.received : t.pending}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                  {((r as any).received ?? r.status === "Received") === false ? (
                    <button onClick={() => markStatus(r.family_id, true, r.families.family_code)} className="px-3 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest">{t.mark_received}</button>
                  ) : (
                    <button onClick={() => markStatus(r.family_id, false, r.families.family_code)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest">{t.unmark_received}</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {isScannerOpen && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <header className="p-6 flex items-center justify-between text-white">
            <h2 className="text-xl font-black uppercase tracking-widest">{t.scan_qr}</h2>
            <button onClick={() => setIsScannerOpen(false)} className="p-3 bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6 rotate-180" />
            </button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div id="event-reader" className="w-full max-w-sm rounded-[2.5rem] overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20"></div>
            <p className="mt-8 text-white/60 text-sm font-bold uppercase tracking-widest text-center">
              {t.attendance}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
