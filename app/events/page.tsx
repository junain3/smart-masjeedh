"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Plus, ArrowLeft, FileText, QrCode, Edit2, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { useMockAuth } from "@/components/MockAuthProvider";
import { getTenantContext } from "@/lib/tenant";
import { AppShell } from "@/components/AppShell";

export const dynamic = 'force-dynamic';
import { useAppToast } from "@/components/ToastProvider";

type EventRow = { id: string; name: string; date: string };
type Family = { id: string; family_code: string; head_name: string };

export default function EventsPage() {
  const router = useRouter();
  const { toast, confirm } = useAppToast();
  const { user, loading: authLoading, tenantContext } = useMockAuth();
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

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchEvents();
  }, []);

  async function fetchEvents() {
    if (!supabase) return;
    setLoading(true);
    try {
      // Use mock tenant context instead of database call
      const ctx = tenantContext;
      if (!ctx) {
        router.push("/login");
        return;
      }

      // Mock events data for now
      const mockEvents: EventRow[] = [
        { id: "1", name: "Friday Prayer", date: new Date().toISOString().split("T")[0] },
        { id: "2", name: "Eid Celebration", date: new Date(Date.now() + 86400000).toISOString().split("T")[0] },
        { id: "3", name: "Ramadan Iftar", date: new Date(Date.now() + 172800000).toISOString().split("T")[0] }
      ];
      
      setEvents(mockEvents);
      
    } catch (err: any) {
      console.error("Fetch error:", err.message);
      toast({ kind: "error", title: "Error", message: "Failed to fetch events" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);

    try {
      // Use mock tenant context instead of database call
      const ctx = tenantContext;
      if (!ctx) return;

      // Mock event creation
      const newEvent: EventRow = {
        id: Date.now().toString(),
        name,
        date
      };

      if (editingId) {
        // Mock update
        setEvents(prev => prev.map(event => 
          event.id === editingId ? { ...event, name, date } : event
        ));
      } else {
        // Mock create
        setEvents(prev => [...prev, newEvent]);
      }

      setIsOpen(false);
      setIsEditOpen(false);
      resetForm();
      fetchEvents();
      toast({ kind: "success", title: "Success", message: "Event saved successfully" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to save event" });
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setName("");
    setDate(new Date().toISOString().split("T")[0]);
    setEditingId(null);
  }

  async function deleteEvent(id: string) {
    const ok = await confirm({
      title: t.confirm_delete,
      message: "Are you sure you want to delete this event?",
      confirmText: t.remove || "Remove",
      cancelText: t.cancel || "Cancel",
    });
    if (!ok) return;

    try {
      // Mock delete
      setEvents(prev => prev.filter(event => event.id !== id));
      fetchEvents();
      toast({ kind: "success", title: "Success", message: "Event deleted successfully" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to delete event" });
    }
  }

  function editEvent(event: EventRow) {
    setEditingId(event.id);
    setName(event.name);
    setDate(event.date);
    setIsEditOpen(true);
  }

  if (authLoading || loading) {
    return (
      <AppShell title={t.events}>
        <div className="app-card p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-600">{t.loading}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t.events}
      actions={
        <button
          onClick={() => {
            resetForm();
            setIsOpen(true);
          }}
          className="p-3 bg-emerald-600 text-white rounded-3xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
          title={t.new_event}
        >
          <Plus className="w-6 h-6" />
        </button>
      }
    >
      <div className="space-y-6">
        {/* Events List */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-neutral-600 uppercase tracking-widest ml-1">{t.events}</h3>
          {events.length === 0 ? (
            <div className="app-glass-card p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
              <h3 className="font-semibold text-neutral-900 mb-2">No events yet</h3>
              <p className="text-sm text-neutral-600 mb-4">Create your first event to get started</p>
              <button
                onClick={() => {
                  resetForm();
                  setIsOpen(true);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                {t.new_event}
              </button>
            </div>
          ) : (
            events.map((event, idx) => (
              <div
                key={event.id}
                className={`app-glass-card ${idx % 2 === 0 ? "bg-white/65" : "bg-emerald-50/20"} p-5 flex items-center justify-between group hover:border-emerald-200 transition-all`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-3xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-neutral-900">{event.name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-neutral-600 uppercase">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => editEvent(event)}
                    className="p-2 text-neutral-600 hover:bg-neutral-50 rounded-3xl transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="p-2 text-rose-700 hover:bg-rose-50 rounded-3xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Event Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-neutral-900">{t.new_event}</h2>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="app-field">
                <label className="app-label">{t.event_name}</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="app-input text-lg font-black"
                  placeholder={t.event_name}
                />
              </div>

              <div className="app-field">
                <label className="app-label">{t.date}</label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="app-input font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all"
              >
                {submitting ? t.loading : t.create_event}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-neutral-900">Edit Event</h2>
              <button onClick={() => setIsEditOpen(false)} className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="app-field">
                <label className="app-label">{t.event_name}</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="app-input text-lg font-black"
                  placeholder={t.event_name}
                />
              </div>

              <div className="app-field">
                <label className="app-label">{t.date}</label>
                <input
                  required
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="app-input font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all"
              >
                {submitting ? t.loading : "Update Event"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
