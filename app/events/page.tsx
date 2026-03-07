"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Plus, ArrowLeft, FileText, QrCode, Edit2, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { AppShell } from "@/components/AppShell";
import { useAppToast } from "@/components/ToastProvider";

type EventRow = { id: string; name: string; date: string };
type Family = { id: string; family_code: string; head_name: string; phone?: string | null; address?: string | null };

export default function EventsPage() {
  const router = useRouter();
  const { toast, confirm } = useAppToast();
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [familyQuery, setFamilyQuery] = useState("");
  const [familyOffset, setFamilyOffset] = useState(0);
  const [familyHasMore, setFamilyHasMore] = useState(true);
  const [loadingFamilies, setLoadingFamilies] = useState(false);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchEvents();
  }, []);

  async function fetchEvents() {
    if (!supabase) return;
    setLoading(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) {
        router.push("/login");
        return;
      }

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      setAllowed(canEvents);
      if (!canEvents) {
        setEvents([]);
        return;
      }

      const { data } = await supabase
        .from("events")
        .select("id,name,date")
        .eq("masjid_id", ctx.masjidId)
        .order("date", { ascending: false });
      setEvents(data || []);
    } finally {
      setLoading(false);
    }
  }

  async function openNewEvent() {
    setIsOpen(true);
    setFamilyQuery("");
    setFamilies([]);
    setFamilyOffset(0);
    setFamilyHasMore(true);
    await fetchFamiliesPage(0, "");
  }

  const pageSize = 24;
  async function fetchFamiliesPage(nextOffset: number, query: string) {
    if (!supabase) return;
    if (loadingFamilies) return;
    setLoadingFamilies(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) return;

      let qb = supabase
        .from("families")
        .select("id,family_code,head_name,phone,address")
        .eq("masjid_id", ctx.masjidId);

      const trimmed = query.trim();
      if (trimmed.length > 0) {
        const pattern = `%${trimmed}%`;
        qb = qb.or(
          [
            `family_code.ilike.${pattern}`,
            `head_name.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
            `address.ilike.${pattern}`,
          ].join(",")
        );
      }

      const { data, error } = await qb
        .order("family_code", { ascending: true })
        .range(nextOffset, nextOffset + pageSize - 1);
      if (error) throw error;

      const rows = (data || []) as any as Family[];
      setFamilies((prev) => (nextOffset === 0 ? rows : [...prev, ...rows]));
      setFamilyOffset(nextOffset + rows.length);
      setFamilyHasMore(rows.length === pageSize);
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed to load families" });
      setFamilyHasMore(false);
    } finally {
      setLoadingFamilies(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const handle = setTimeout(() => {
      setFamilies([]);
      setFamilyOffset(0);
      setFamilyHasMore(true);
      fetchFamiliesPage(0, familyQuery);
    }, 250);
    return () => clearTimeout(handle);
  }, [familyQuery, isOpen]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "" });
        return;
      }

      const { data: ev, error: evErr } = await supabase
        .from("events")
        .insert([{ name, date, masjid_id: ctx.masjidId }])
        .select()
        .single();
      if (evErr) throw evErr;
      const { data: famData } = await supabase
        .from("families")
        .select("id,family_code,head_name")
        .eq("masjid_id", ctx.masjidId)
        .order("family_code", { ascending: true });

      const famRows = (famData || families || []) as Family[];
      if (famRows.length > 0) {
        const rows = famRows.map((f) => ({
          event_id: ev.id,
          family_id: f.id,
          masjid_id: ctx.masjidId,
          status: "Pending",
        }));

        // Insert in chunks to avoid request size/row limits
        const chunkSize = 400;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error: atErr } = await supabase.from("event_attendance").insert(chunk);
          if (atErr) {
            toast({
              kind: "error",
              title: "Attendance linking failed",
              message: atErr.message || "Failed to attach all families",
            });
            break;
          }
        }
      }
      setIsOpen(false);
      setName("");
      setFamilyQuery("");
      fetchEvents();
      router.push(`/events/${ev.id}`);
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(ev: EventRow) {
    setEditingId(ev.id);
    setName(ev.name);
    setDate(ev.date);
    setIsEditOpen(true);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (!editingId) return;
    setSubmitting(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "" });
        return;
      }

      const { error } = await supabase
        .from("events")
        .update({ name, date })
        .eq("id", editingId)
        .eq("masjid_id", ctx.masjidId);
      if (error) throw error;

      setIsEditOpen(false);
      setEditingId(null);
      setName("");
      fetchEvents();
      toast({ kind: "success", title: "Updated", message: "" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteEvent(ev: EventRow) {
    if (!supabase) return;
    const ok = await confirm({
      title: "Delete event?",
      message: `This will remove '${ev.name}'.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "" });
        return;
      }

      const { error } = await supabase.from("events").delete().eq("id", ev.id).eq("masjid_id", ctx.masjidId);
      if (error) throw error;

      toast({ kind: "success", title: "Deleted", message: "" });
      fetchEvents();
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed" });
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

  if (!allowed) {
    return (
      <AppShell title={t.events}>
        <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">
          Access denied.
        </div>
      </AppShell>
    );
  }

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
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        openEdit(ev);
                      }}
                      className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        deleteEvent(ev);
                      }}
                      className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all active:scale-95"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                      <QrCode className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
      </div>

      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-900">Edit Event</h2>
              <button
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingId(null);
                  setName("");
                }}
                className="p-2 hover:bg-slate-50 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.event_name}</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.event_date}</label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 rounded-3xl font-black text-white bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {submitting ? "SAVING..." : t.save}
              </button>
            </form>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
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
              <div className="relative group">
                <input
                  type="text"
                  value={familyQuery}
                  onChange={(e) => setFamilyQuery(e.target.value)}
                  placeholder={t.search}
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                />
              </div>
              <div className="max-h-44 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-3">
                {families.length === 0 && !loadingFamilies ? (
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t.no_matches}</p>
                ) : (
                  families.map(f => (
                    <div key={f.id} className="flex items-center justify-between py-2 px-3">
                      <span className="text-sm font-bold text-slate-700">{f.family_code} • {f.head_name}</span>
                    </div>
                  ))
                )}
                {loadingFamilies && (
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest pt-3">{t.loading}</p>
                )}
                {familyHasMore && !loadingFamilies && (
                  <button
                    type="button"
                    onClick={() => fetchFamiliesPage(familyOffset, familyQuery)}
                    className="w-full mt-2 py-2 rounded-2xl bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 border border-slate-100"
                  >
                    Load more
                  </button>
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
