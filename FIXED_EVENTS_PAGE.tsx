"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Plus, ArrowLeft, FileText, QrCode, Edit2, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { AppShell } from "@/components/AppShell";
import { useAppToast } from "@/components/ToastProvider";

type EventRow = { id: string; name: string; date: string };
type Family = { id: string; family_code: string; head_name: string };

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

      // Validate masjid exists before proceeding
      const { data: masjidCheck, error: masjidError } = await supabase
        .from("masjids")
        .select("id")
        .eq("id", ctx.masjidId)
        .single();
      
      if (masjidError || !masjidCheck) {
        toast({ 
          kind: "error", 
          title: "Masjid Not Found", 
          message: "Your masjid context is invalid. Please contact administrator." 
        });
        setAllowed(false);
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
    const ctx = await getTenantContext();
    if (!ctx) {
      toast({ 
        kind: "error", 
        title: "Context Missing", 
        message: "Please login again to refresh your session." 
      });
      return;
    }

    // Validate masjid exists before opening create modal
    const { data: masjidCheck, error: masjidError } = await supabase
      .from("masjids")
      .select("id")
      .eq("id", ctx.masjidId)
      .single();
    
    if (masjidError || !masjidCheck) {
      toast({ 
        kind: "error", 
        title: "Masjid Not Found", 
        message: "Your masjid context is invalid. Please contact administrator." 
      });
      return;
    }

    setIsOpen(true);
    await preloadFamilies();
  }

  async function preloadFamilies() {
    if (!supabase) return;
    const ctx = await getTenantContext();
    if (!ctx) return;
    const { data } = await supabase
      .from("families")
      .select("id,family_code,head_name")
      .eq("masjid_id", ctx.masjidId)
      .order("family_code", { ascending: true });
    setFamilies(data || []);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) {
        toast({ 
          kind: "error", 
          title: "Context Missing", 
          message: "Please login again to refresh your session." 
        });
        return;
      }

      // Validate masjid exists before creating event
      const { data: masjidCheck, error: masjidError } = await supabase
        .from("masjids")
        .select("id")
        .eq("id", ctx.masjidId)
        .single();
      
      if (masjidError || !masjidCheck) {
        toast({ 
          kind: "error", 
          title: "Masjid Not Found", 
          message: "Cannot create event - masjid context is invalid. Please contact administrator." 
        });
        return;
      }

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canEvents = isAdmin || ctx.permissions?.events !== false;
      if (!canEvents) {
        toast({ kind: "error", title: "Access denied", message: "" });
        return;
      }

      console.log("DEBUG: Creating event with masjid_id:", ctx.masjidId);

      const { data: ev, error: evErr } = await supabase
        .from("events")
        .insert([{ name, date, masjid_id: ctx.masjidId }])
        .select()
        .single();
      
      if (evErr) {
        console.error("DEBUG: Event creation error:", evErr);
        throw evErr;
      }

      console.log("DEBUG: Event created successfully:", ev);

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
      fetchEvents();
      router.push(`/events/${ev.id}`);
    } catch (err: any) {
      console.error("DEBUG: Event creation failed:", err);
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

      // Validate masjid exists before editing event
      const { data: masjidCheck, error: masjidError } = await supabase
        .from("masjids")
        .select("id")
        .eq("id", ctx.masjidId)
        .single();
      
      if (masjidError || !masjidCheck) {
        toast({ 
          kind: "error", 
          title: "Masjid Not Found", 
          message: "Cannot edit event - masjid context is invalid." 
        });
        return;
      }

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
    try {
      console.log('Events: Starting print generation...');
      
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
          <title>Events List</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 12px;
              line-height: 1.4;
            }
            h1 { 
              text-align: center; 
              margin-bottom: 20px;
              font-size: 18px;
              font-weight: bold;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 8px; 
              text-align: left;
              vertical-align: top;
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold;
              font-size: 11px;
            }
            td { 
              font-size: 10px;
              word-wrap: break-word;
              max-width: 150px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            @media print {
              body { margin: 10px; }
              th, td { 
                border: 1px solid #000; 
                padding: 6px;
                font-size: 9px;
              }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Events List</h1>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      // Add data rows
      events.forEach(e => {
        htmlContent += '<tr>';
        htmlContent += `<td>${e.date || ''}</td>`;
        htmlContent += `<td>${e.name || ''}</td>`;
        htmlContent += `<td>${e.id || ''}</td>`;
        htmlContent += '</tr>';
      });
      
      htmlContent += `
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px;">
              🖨️ Print / Save as PDF
            </button>
            <br><br>
            <small>Use Ctrl+P or Cmd+P to print, then choose "Save as PDF"</small>
          </div>
        </body>
        </html>
      `;
      
      // Write content to new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Focus and trigger print dialog
      printWindow.focus();
      
      console.log('Events: Print window opened successfully');
      
    } catch (error) {
      console.error('Events: Print generation error:', error);
      alert('Print generation failed: ' + (error as Error).message);
    }
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
