"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAppToast } from "@/components/ToastProvider";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { translations, Language } from "@/lib/i18n/translations";
import { CheckCircle, Clock } from "lucide-react";

type CollectionRow = {
  id: string;
  masjid_id: string;
  family_id: string;
  collected_by_user_id: string;
  collector_employee_id?: string | null;
  amount: number;
  commission_percent?: number | null;
  commission_amount?: number | null;
  notes?: string | null;
  date: string;
  status: "pending" | "accepted" | "rejected";
  created_at?: string;
};

type FamilyRow = {
  id: string;
  family_code: string;
  head_name: string;
  phone?: string | null;
};

type EmployeeRow = { id: string; name: string };

export default function SubscriptionPendingPage() {
  const { toast } = useAppToast();

  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [allowed, setAllowed] = useState(true);
  const [loading, setLoading] = useState(true);

  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [families, setFamilies] = useState<Record<string, FamilyRow>>({});
  const [employees, setEmployees] = useState<Record<string, EmployeeRow>>({});

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canApprove = isAdmin || ctx.permissions?.subscriptions_approve === true;
      setAllowed(canApprove);
      if (!canApprove) {
        setRows([]);
        return;
      }

      const { data, error } = await supabase
        .from("subscription_collections")
        .select("id,masjid_id,family_id,collected_by_user_id,collector_employee_id,amount,commission_percent,commission_amount,notes,date,status,created_at")
        .eq("masjid_id", ctx.masjidId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      const list = ((data as any) || []) as CollectionRow[];
      setRows(list);

      const famIds = Array.from(new Set(list.map((r) => r.family_id)));
      if (famIds.length > 0) {
        const { data: famData, error: famErr } = await supabase
          .from("families")
          .select("id,family_code,head_name,phone")
          .eq("masjid_id", ctx.masjidId)
          .in("id", famIds);
        if (!famErr) {
          const map: Record<string, FamilyRow> = {};
          ((famData as any) || []).forEach((f: any) => {
            map[f.id] = f as any;
          });
          setFamilies(map);
        }
      }

      const empIds = Array.from(
        new Set(list.map((r) => r.collector_employee_id).filter(Boolean) as string[])
      );
      if (empIds.length > 0) {
        const { data: empData, error: empErr } = await supabase
          .from("employees")
          .select("id,name")
          .eq("masjid_id", ctx.masjidId)
          .in("id", empIds);
        if (!empErr) {
          const map: Record<string, EmployeeRow> = {};
          ((empData as any) || []).forEach((e: any) => {
            map[e.id] = e as any;
          });
          setEmployees(map);
        }
      }
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPending = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0), [rows]);

  async function accept(row: CollectionRow) {
    if (!supabase) return;
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canApprove = isAdmin || ctx.permissions?.subscriptions_approve === true;
      if (!canApprove) {
        toast({ kind: "error", title: "Access denied", message: "" });
        return;
      }

      const fam = families[row.family_id];
      const desc = `${(t as any).subscription || "Subscription"} - ${fam?.family_code || ""}`.trim();

      const { data: txInserted, error: txErr } = await supabase
        .from("transactions")
        .insert([
          {
            masjid_id: ctx.masjidId,
            family_id: row.family_id,
            amount: row.amount,
            description: desc,
            type: "income",
            category: (t as any).subscription || "Subscription",
            date: row.date,
          } as any,
        ])
        .select("id")
        .single();

      if (txErr) throw txErr;

      const { error: upErr } = await supabase
        .from("subscription_collections")
        .update({
          status: "accepted",
          accepted_by_user_id: ctx.userId,
          accepted_at: new Date().toISOString(),
          main_transaction_id: (txInserted as any)?.id || null,
        } as any)
        .eq("id", row.id)
        .eq("masjid_id", ctx.masjidId);

      if (upErr) throw upErr;

      toast({ kind: "success", title: "Accepted", message: "Added to main accounts" });
      await load();
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed" });
    }
  }

  if (!allowed) {
    return (
      <AppShell title="Pending Subscriptions">
        <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">Access denied.</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Pending Subscriptions">
      <div className="space-y-4 max-w-md mx-auto">
        <div className="app-card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-slate-900">Pending approvals</span>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Rs. {totalPending.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">{t.loading}</div>
        ) : rows.length === 0 ? (
          <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">{t.no_matches}</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const fam = families[r.family_id];
              const emp = r.collector_employee_id ? employees[r.collector_employee_id] : null;
              return (
                <div key={r.id} className="app-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.date}</p>
                      <p className="text-sm font-black text-slate-900 truncate">{fam?.head_name || "—"}</p>
                      <p className="text-[11px] font-bold text-slate-500 truncate">
                        {fam?.family_code || ""} • {fam?.phone || ""}
                      </p>
                      {emp?.name ? (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          Collector: {emp.name}
                        </p>
                      ) : null}
                      {typeof r.commission_amount === "number" && r.commission_amount > 0 ? (
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mt-1">
                          Commission: Rs. {Number(r.commission_amount).toLocaleString()} ({r.commission_percent || 0}%)
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-amber-600">Rs. {Number(r.amount).toLocaleString()}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => accept(r)}
                    className="w-full py-4 rounded-3xl font-black text-white bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Accept
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
