"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useAppToast } from "@/components/ToastProvider";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { Search, QrCode, Wallet } from "lucide-react";

type FamilyRow = {
  id: string;
  family_code: string;
  head_name: string;
  phone?: string | null;
  address?: string | null;
};

type EmployeeRow = {
  id: string;
  name: string;
  default_subscription_commission_percent?: number | null;
};

type CollectorProfileRow = {
  masjid_id: string;
  user_id: string;
  collector_employee_id: string | null;
  default_commission_percent: number;
};

export default function SubscriptionCollectPage() {
  const { toast } = useAppToast();

  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [allowed, setAllowed] = useState(true);

  const [q, setQ] = useState("");
  const qRef = useRef("");
  const reqId = useRef(0);

  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [results, setResults] = useState<FamilyRow[]>([]);
  const [selected, setSelected] = useState<FamilyRow | null>(null);

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");

  const [amount, setAmount] = useState("");
  const [defaultPercent, setDefaultPercent] = useState("0");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const ctx = await getTenantContext();
      if (!ctx) return;
      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canCollect = isAdmin || ctx.permissions?.subscriptions_collect === true;
      setAllowed(canCollect);

      if (!canCollect) return;

      const { data, error } = await supabase
        .from("employees")
        .select("id,name,default_subscription_commission_percent")
        .eq("masjid_id", ctx.masjidId)
        .order("name", { ascending: true });

      if (!error) setEmployees(((data as any) || []) as EmployeeRow[]);

      const { data: prof } = await supabase
        .from("subscription_collector_profiles")
        .select("masjid_id,user_id,collector_employee_id,default_commission_percent")
        .eq("masjid_id", ctx.masjidId)
        .eq("user_id", ctx.userId)
        .maybeSingle();

      if (prof) {
        const p = prof as any as CollectorProfileRow;
        if (p.collector_employee_id) setEmployeeId(p.collector_employee_id);
        setDefaultPercent(String(p.default_commission_percent ?? 0));
      } else {
        setDefaultPercent("0");
      }
      setProfileLoaded(true);
    })();
  }, []);

  useEffect(() => {
    qRef.current = q;
    const trimmed = q.trim();

    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      if (!supabase) return;
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canCollect = isAdmin || ctx.permissions?.subscriptions_collect === true;
      if (!canCollect) return;

      const query = qRef.current.trim();
      const pattern = `%${query}%`;

      const { data, error } = await supabase
        .from("families")
        .select("id,family_code,head_name,phone,address")
        .eq("masjid_id", ctx.masjidId)
        .or(
          [
            `family_code.ilike.${pattern}`,
            `head_name.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
            `address.ilike.${pattern}`,
          ].join(",")
        )
        .order("family_code", { ascending: true })
        .limit(8);

      if (id !== reqId.current) return;
      if (error) {
        toast({ kind: "error", title: "Error", message: error.message || "Search failed" });
        return;
      }
      setResults(((data as any) || []) as FamilyRow[]);
    }, 350);

    return () => clearTimeout(handle);
  }, [q, toast]);

  const commissionAmount = useMemo(() => {
    const a = parseFloat(amount);
    const p = parseFloat(defaultPercent);
    if (!Number.isFinite(a) || a <= 0) return 0;
    if (!Number.isFinite(p) || p <= 0) return 0;
    return Math.round((a * p) / 100);
  }, [amount, defaultPercent]);

  async function upsertProfile(next: { collector_employee_id?: string | null; default_commission_percent?: number }) {
    if (!supabase) return;
    const ctx = await getTenantContext();
    if (!ctx) return;

    const payload: any = {
      masjid_id: ctx.masjidId,
      user_id: ctx.userId,
      updated_at: new Date().toISOString(),
    };
    if (typeof next.collector_employee_id !== "undefined") payload.collector_employee_id = next.collector_employee_id;
    if (typeof next.default_commission_percent !== "undefined") payload.default_commission_percent = next.default_commission_percent;

    const { error } = await supabase.from("subscription_collector_profiles").upsert([payload], {
      onConflict: "masjid_id,user_id",
    });
    if (error) {
      toast({ kind: "error", title: "Error", message: error.message || "Failed" });
    }
  }

  async function handleScan(decodedText: string) {
    if (!supabase) return;
    if (!decodedText.startsWith("smart-masjeedh:family:")) return;
    const familyId = decodedText.split(":")[2];
    setIsScannerOpen(false);

    const ctx = await getTenantContext();
    if (!ctx) return;

    const { data, error } = await supabase
      .from("families")
      .select("id,family_code,head_name,phone,address")
      .eq("id", familyId)
      .eq("masjid_id", ctx.masjidId)
      .maybeSingle();

    if (error || !data) {
      toast({ kind: "error", title: "Not found", message: "Family not found for this masjid" });
      return;
    }

    setSelected(data as any);
    setResults([]);
    setQ("");
  }

  async function savePendingCollection() {
    if (!supabase) return;
    if (!selected) {
      toast({ kind: "error", title: "Select family", message: "" });
      return;
    }

    const a = parseFloat(amount);
    if (!Number.isFinite(a) || a <= 0) {
      toast({ kind: "error", title: "Invalid amount", message: "" });
      return;
    }

    const p = parseFloat(defaultPercent);
    if (!Number.isFinite(p) || p < 0) {
      toast({ kind: "error", title: "Invalid %", message: "" });
      return;
    }

    setSubmitting(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canCollect = isAdmin || ctx.permissions?.subscriptions_collect === true;
      if (!canCollect) {
        toast({ kind: "error", title: "Access denied", message: "" });
        return;
      }

      const commissionPct = p;
      const commissionAmt = commissionPct > 0 ? Math.round((a * commissionPct) / 100) : null;

      const { data: existingBatch, error: batchSelErr } = await supabase
        .from("subscription_collection_batches")
        .select("id")
        .eq("masjid_id", ctx.masjidId)
        .eq("collected_by_user_id", ctx.userId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (batchSelErr) throw batchSelErr;

      let batchId = (existingBatch as any)?.id as string | undefined;
      if (!batchId) {
        const { data: createdBatch, error: batchInsErr } = await supabase
          .from("subscription_collection_batches")
          .insert([
            {
              masjid_id: ctx.masjidId,
              collected_by_user_id: ctx.userId,
              collector_employee_id: employeeId || null,
              status: "open",
            } as any,
          ])
          .select("id")
          .single();
        if (batchInsErr) throw batchInsErr;
        batchId = (createdBatch as any)?.id;
      }

      const { error: insErr } = await supabase.from("subscription_collections").insert([
        {
          masjid_id: ctx.masjidId,
          batch_id: batchId,
          family_id: selected.id,
          collected_by_user_id: ctx.userId,
          collector_employee_id: employeeId || null,
          amount: a,
          commission_percent: commissionPct,
          commission_amount: commissionAmt,
          notes: notes.trim() || null,
          date,
          status: "pending",
        } as any,
      ]);

      if (insErr) throw insErr;

      toast({ kind: "success", title: "Saved", message: "Added to your pending batch" });
      setSelected(null);
      setAmount("");
      setNotes("");
      setDate(new Date().toISOString().split("T")[0]);
    } catch (e: any) {
      toast({ kind: "error", title: "Error", message: e.message || "Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  if (!allowed) {
    return (
      <AppShell title={(t as any).subscription || "Subscription"}>
        <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">Access denied.</div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={(t as any).subscription || "Subscription"}
      actions={
        <button
          onClick={() => setIsScannerOpen(true)}
          className="p-3 bg-slate-50 text-slate-600 rounded-3xl hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
          title={t.scan_qr}
        >
          <QrCode className="w-6 h-6" />
        </button>
      }
    >
      <div className="space-y-4 max-w-md mx-auto">
        <div className="app-card p-5 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Wallet className="w-6 h-6" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-black text-slate-900">Collect Subscription</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pending approval</span>
          </div>
        </div>

        {!selected && (
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder={t.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
            />
            {results.length > 0 && (
              <div className="absolute z-20 mt-2 w-full bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden">
                {results.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSelected(r);
                      setResults([]);
                      setQ("");
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <p className="text-sm font-black text-slate-800">{r.head_name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {r.family_code} • {r.phone || ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {selected && (
          <div className="app-card p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Family</p>
                <p className="text-sm font-black text-slate-900 truncate">{selected.head_name}</p>
                <p className="text-[11px] font-bold text-slate-500 truncate">
                  {selected.family_code} • {selected.phone || ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-3 py-2 rounded-2xl bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100"
              >
                Change
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Collector employee</label>
              <select
                value={employeeId}
                onChange={async (e) => {
                  const v = e.target.value;
                  setEmployeeId(v);
                  if (profileLoaded) await upsertProfile({ collector_employee_id: v || null });
                }}
                className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
              >
                <option value="">No employee</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.amount}</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Default Commission %</label>
                <input
                  type="number"
                  value={defaultPercent}
                  onChange={(e) => setDefaultPercent(e.target.value)}
                  onBlur={async () => {
                    const p = parseFloat(defaultPercent);
                    if (!Number.isFinite(p) || p < 0) return;
                    if (profileLoaded) await upsertProfile({ default_commission_percent: p });
                  }}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>Commission amount</span>
              <span className="text-emerald-700 font-black">Rs. {commissionAmount.toLocaleString()}</span>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.date}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.notes}</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                placeholder=""
              />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={savePendingCollection}
              className="w-full py-5 rounded-3xl font-black text-white bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
            >
              {submitting ? "SAVING..." : "Save (Pending)"}
            </button>
          </div>
        )}
      </div>

      <QrScannerModal
        open={isScannerOpen}
        title={t.scan_qr}
        containerId="subscription-collect"
        onClose={() => setIsScannerOpen(false)}
        onDecodedText={handleScan}
        helperText={(t as any).subscription || "Subscription"}
      />
    </AppShell>
  );
}
