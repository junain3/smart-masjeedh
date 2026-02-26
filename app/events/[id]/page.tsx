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
  status: "Pending" | "Received";
  family_id: string;
  families: { id: string; family_code: string; head_name: string };
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
        .select("id,status,family_id,families(id,family_code,head_name)")
        .eq("event_id", eventId)
        .eq("masjid_id", session.user.id)
        .order("created_at", { ascending: true });
      setRows((a as any) || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "event-reader",
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true
        },
        false
      );
      scanner.render(onScanSuccess, () => {});
      function onScanSuccess(decodedText: string) {
        handleScan(decodedText);
      }
      return () => {
        scanner.clear();
      };
    }
  }, [isScannerOpen, eventId]);

  async function handleScan(decodedText: string) {
    if (!supabase) return;
    if (!decodedText.startsWith("smart-masjeedh:family:")) return;
    try {
      const familyId = decodedText.split(":")[2];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data, error } = await supabase
        .from("event_attendance")
        .update({ status: "Received" })
        .eq("event_id", eventId)
        .eq("family_id", familyId)
        .eq("masjid_id", session.user.id)
        .select();
      if (error) throw error;
      if (data && data.length > 0) {
        setRows(prev =>
          prev.map(r => (r.family_id === familyId ? { ...r, status: "Received" } : r))
        );
      }
    } catch (e: any) {
      alert(e.message);
    }
  }

  const filtered = useMemo(
    () =>
      rows.filter(r =>
        `${r.families.family_code} ${r.families.head_name}`.toLowerCase().includes(search.toLowerCase())
      ),
    [rows, search]
  );

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
              <div key={r.id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-50 shadow-sm">
                <div>
                  <h4 className="text-sm font-black text-slate-800">{r.families.head_name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{r.families.family_code}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${r.status === "Received" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                  {r.status === "Received" ? t.received : t.pending}
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
