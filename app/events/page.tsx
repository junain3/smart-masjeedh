"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Plus, ArrowLeft, FileText, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { AppShell } from "@/components/AppShell";

type EventRow = { id: string; name: string; date: string };
type Family = { id: string; family_code: string; head_name: string };

export default function EventsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchEvents();
  }, []);

  async function fetchEvents() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const { data } = await supabase
        .from("events")
        .select("id,name,date")
        .eq("masjid_id", session.user.id)
        .order("date", { ascending: false });
      setEvents(data || []);
    } finally {
      setLoading(false);
    }
  }

  async function openNewEvent() {
    setIsOpen(true);
    await preloadFamilies();
  }

  async function preloadFamilies() {
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from("families")
      .select("id,family_code,head_name")
      .eq("masjid_id", session.user.id)
      .order("family_code", { ascending: true });
    setFamilies(data || []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .insert([{ name, date, masjid_id: session.user.id }])
        .select()
        .single();
      if (evErr) throw evErr;
      if (families.length > 0) {
        const rows = families.map(f => ({
          event_id: ev.id,
          family_id: f.id,
          masjid_id: session.user.id,
          status: "Pending"
        }));
        const { error: atErr } = await supabase.from("event_attendance").insert(rows);
        if (atErr) throw atErr;
      }
      setIsOpen(false);
      setName("");
      fetchEvents();
      router.push(`/events/${ev.id}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text("Events List", 14, 15);
    const table = events.map(e => [e.date, e.name, e.id]);
    // @ts-ignore
    doc.autoTable({ startY: 20, head: [["Date", "Name", "ID"]], body: table });
    doc.save("events.pdf");
  };

  if (loading) return <div className="p-8 text-center">{t.loading}</div>;

  return (
    <AppShell
      title={t.events}
      actions={
        <>
          <button
            onClick={generatePDF}
            className="p-3 bg-slate-50 text-blue-600 rounded-3xl hover:bg-blue-50 transition-all active:scale-95"
            title={t.download_pdf}
          >
            <FileText className="w-6 h-6" />
          </button>
          <button
            onClick={openNewEvent}
            className="p-3 bg-emerald-500 text-white rounded-3xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            title={t.new_event}
          >
            <Plus className="w-6 h-6" />
          </button>
        </>
      }
    >
      <div className="space-y-3">
          {events.length === 0 ? (
            <div className="py-16 text-center app-card">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <Calendar className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t.no_matches}</p>
            </div>
          ) : (
            events.map(ev => (
              <Link
                key={ev.id}
                href={`/events/${ev.id}`}
                className="block app-card p-4 group hover:border-emerald-200 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{ev.date}</p>
                    <h3 className="text-sm font-black text-slate-800">{ev.name}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <QrCode className="w-6 h-6" />
                  </div>
                </div>
              </Link>
            ))
          )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-900">{t.new_event}</h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-300 rotate-180" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.event_name}</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.event_date}</label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                />
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t.attendance} • {t.all_families || "All Families"}</p>
              <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-3">
                {families.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t.no_matches}</p>
                ) : (
                  families.map(f => (
                    <div key={f.id} className="flex items-center justify-between py-2 px-3">
                      <span className="text-sm font-bold text-slate-700">{f.family_code} • {f.head_name}</span>
                    </div>
                  ))
                )}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 rounded-3xl font-black text-white bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {submitting ? "CREATING..." : t.save}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
