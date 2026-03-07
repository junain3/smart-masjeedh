"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAppToast } from "@/components/ToastProvider";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { translations, Language } from "@/lib/i18n/translations";
import { CheckCircle, Clock } from "lucide-react";

type BatchRow = {
  id: string;
  masjid_id: string;
  collected_by_user_id: string;
  collector_employee_id?: string | null;
  status: "open" | "accepted" | "rejected";
  created_at?: string;
};

type CollectionRow = {
  id: string;
  masjid_id: string;
  batch_id?: string | null;
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

  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [collectionsByBatch, setCollectionsByBatch] = useState<Record<string, CollectionRow[]>>({});
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
        setBatches([]);
        setCollectionsByBatch({});
        return;
      }

      const { data: batchData, error: batchErr } = await supabase
        .from("subscription_collection_batches")
        .select("id,masjid_id,collected_by_user_id,collector_employee_id,status,created_at")
        .eq("masjid_id", ctx.masjidId)
        .eq("status", "open")
        .order("created_at", { ascending: true });

      if (batchErr) throw batchErr;

      const batchList = ((batchData as any) || []) as BatchRow[];
      setBatches(batchList);

      const batchIds = batchList.map((b) => b.id);
      if (batchIds.length === 0) {
        setCollectionsByBatch({});
        setFamilies({});
        setEmployees({});
        return;
      }

      const { data: colData, error: colErr } = await supabase
        .from("subscription_collections")
        .select(
          "id,masjid_id,batch_id,family_id,collected_by_user_id,collector_employee_id,amount,commission_percent,commission_amount,notes,date,status,created_at"
        )
        .eq("masjid_id", ctx.masjidId)
        .eq("status", "pending")
        .in("batch_id", batchIds)
        .order("created_at", { ascending: true });

      if (colErr) throw colErr;
      const list = ((colData as any) || []) as CollectionRow[];

      const byBatch: Record<string, CollectionRow[]> = {};
      for (const r of list) {
        const id = (r.batch_id || "") as string;
        if (!id) continue;
        byBatch[id] = byBatch[id] || [];
        byBatch[id].push(r);
      }
      setCollectionsByBatch(byBatch);

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
        new Set(batchList.map((b) => b.collector_employee_id).filter(Boolean) as string[])
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

  const totalPending = useMemo(() => {
    return batches.reduce((sum, b) => {
      const list = collectionsByBatch[b.id] || [];
      return sum + list.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    }, 0);
  }, [batches, collectionsByBatch]);

  async function acceptBatch(batch: BatchRow) {
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

      const items = collectionsByBatch[batch.id] || [];
      if (items.length === 0) {
        toast({ kind: "error", title: "Nothing to accept", message: "" });
        return;
      }

      const acceptDate = new Date().toISOString().split("T")[0];
      const totalAmount = items.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const totalCommission = items.reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0);

      const desc = `${(t as any).subscription || "Subscription"} (Batch)`;

      const { data: txInserted, error: txErr } = await supabase
        .from("transactions")
        .insert([
          {
            masjid_id: ctx.masjidId,
            amount: totalAmount,
            description: desc,
            type: "income",
            category: (t as any).subscription || "Subscription",
            date: acceptDate,
          } as any,
        ])
        .select("id")
        .single();

      if (txErr) throw txErr;

      const txId = (txInserted as any)?.id || null;

      const { error: batchUpErr } = await supabase
        .from("subscription_collection_batches")
        .update({
          status: "accepted",
          accepted_by_user_id: ctx.userId,
          accepted_at: new Date().toISOString(),
          accept_date: acceptDate,
          main_transaction_id: txId,
        } as any)
        .eq("id", batch.id)
        .eq("masjid_id", ctx.masjidId);
      if (batchUpErr) throw batchUpErr;

      const { error: colsUpErr } = await supabase
        .from("subscription_collections")
        .update({
          status: "accepted",
          accepted_by_user_id: ctx.userId,
          accepted_at: new Date().toISOString(),
          main_transaction_id: txId,
        } as any)
        .eq("masjid_id", ctx.masjidId)
        .eq("batch_id", batch.id)
        .eq("status", "pending");
      if (colsUpErr) throw colsUpErr;

      if (batch.collector_employee_id && totalCommission > 0) {
        const commissionRows = items
          .filter((r) => (r.commission_amount || 0) > 0)
          .map((r) => ({
            masjid_id: ctx.masjidId,
            employee_id: batch.collector_employee_id,
            collection_id: r.id,
            amount: Number(r.commission_amount || 0),
          }));

        if (commissionRows.length > 0) {
          const { error: comErr } = await supabase.from("employee_commissions").upsert(commissionRows as any, {
            onConflict: "collection_id",
          });
          if (comErr) throw comErr;
        }
      }

      toast({
        kind: "success",
        title: "Accepted",
        message: totalCommission > 0 ? `Added to main accounts • Commission Rs. ${totalCommission.toLocaleString()}` : "Added to main accounts",
      });
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
        ) : batches.length === 0 ? (
          <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">{t.no_matches}</div>
        ) : (
          <div className="space-y-3">
            {batches.map((b) => {
              const items = collectionsByBatch[b.id] || [];
              const totalAmount = items.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              const totalCommission = items.reduce((sum, r) => sum + (Number(r.commission_amount) || 0), 0);
              const emp = b.collector_employee_id ? employees[b.collector_employee_id] : null;

              return (
                <div key={b.id} className="app-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {items.length} collections
                      </p>
                      <p className="text-sm font-black text-slate-900 truncate">{emp?.name || "Collector"}</p>
                      {emp?.name ? (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          Collector: {emp.name}
                        </p>
                      ) : null}
                      {totalCommission > 0 ? (
                        <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mt-1">
                          Commission total: Rs. {Number(totalCommission).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-amber-600">Rs. {Number(totalAmount).toLocaleString()}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => acceptBatch(b)}
                    className="w-full py-4 rounded-3xl font-black text-white bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Accept Total
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
