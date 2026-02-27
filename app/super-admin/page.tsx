"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, Mail } from "lucide-react";

type MasjidRow = {
  id: string;
  name: string;
  tagline: string | null;
  status?: "pending" | "approved" | "deactivated" | null;
  subscription_status?: "pending" | "paid" | "expired" | null;
  created_at?: string;
  admin_email?: string | null;
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [rows, setRows] = useState<MasjidRow[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }
        const superEmail = process.env.NEXT_PUBLIC_SUPERADMIN_EMAIL;
        if (!superEmail || session.user.email?.toLowerCase() !== superEmail.toLowerCase()) {
          setAllowed(false);
          setError("Access restricted to platform Super‑Admin.");
          setLoading(false);
          return;
        }
        setAllowed(true);

        const { data, error } = await supabase
          .from("masjids")
          .select("id,name,tagline,status,subscription_status,created_at,admin_email");
        if (error) throw error;
        setRows((data as any) || []);
      } catch (e: any) {
        setError(e.message || "Failed to load masjids");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const updateStatus = async (id: string, status: "approved" | "deactivated") => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from("masjids")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch (e: any) {
      alert(e.message || "Failed to update status");
    }
  };

  return (
    <AppShell title="Super Admin – Masjids">
      <div className="space-y-6">
        <div className="app-card p-5 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-emerald-600" />
          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-900">
              Platform Super‑Admin Console
            </span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Approve or deactivate masjid tenants
            </span>
          </div>
        </div>

        {error && (
          <div className="app-card p-4 border-amber-200 bg-amber-50/60 text-amber-800 text-[11px] font-bold">
            {error}
          </div>
        )}

        {loading ? (
          <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">
            Loading...
          </div>
        ) : !allowed ? null : (
          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">
                No masjids registered yet.
              </div>
            ) : (
              rows.map(m => (
                <div
                  key={m.id}
                  className="app-card px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs">
                      🕌
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">
                        {m.name}
                      </span>
                      {m.tagline && (
                        <span className="text-[11px] font-bold text-slate-400">
                          {m.tagline}
                        </span>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                        <span className={`px-2 py-0.5 rounded-full ${
                          m.status === "approved"
                            ? "bg-emerald-50 text-emerald-600"
                            : m.status === "deactivated"
                            ? "bg-rose-50 text-rose-600"
                            : "bg-amber-50 text-amber-600"
                        }`}>
                          {m.status || "pending"}
                        </span>
                        {m.subscription_status && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">
                            {m.subscription_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {m.admin_email && (
                      <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-slate-300" />
                        <span className="break-all">{m.admin_email}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(m.id, "approved")}
                        className="px-3 py-1.5 rounded-2xl bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => updateStatus(m.id, "deactivated")}
                        className="px-3 py-1.5 rounded-2xl bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-widest hover:bg-rose-100"
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

