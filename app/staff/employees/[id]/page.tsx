"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, Phone, MapPin, Wallet, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";

type Employee = {
  id: string;
  masjid_id: string;
  name: string;
  role: string;
  address: string;
  phone: string;
  photo_url?: string | null;
};

type EmployeePayment = {
  id: string;
  masjid_id: string;
  employee_id: string;
  amount: number;
  date: string;
  notes?: string | null;
  transaction_id?: string | null;
  created_at?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

export default function EmployeeProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const employeeId = params.id;

  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payments, setPayments] = useState<EmployeePayment[]>([]);
  const [tab, setTab] = useState<"details" | "payments">("details");

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0), 0),
    [payments]
  );

  async function fetchEmployeeAndPayments() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: empData, error: empErr } = await supabase
        .from("employees")
        .select("id, masjid_id, name, role, address, phone, photo_url")
        .eq("id", employeeId)
        .eq("masjid_id", session.user.id)
        .single();

      if (empErr) throw empErr;
      setEmployee(empData as any);

      const { data: payData, error: payErr } = await supabase
        .from("employee_payments")
        .select("id, masjid_id, employee_id, amount, date, notes, transaction_id, created_at")
        .eq("employee_id", employeeId)
        .eq("masjid_id", session.user.id)
        .order("date", { ascending: false });

      if (payErr) {
        // optional table: allow profile view without payments
        if (!payErr.message?.includes("table")) throw payErr;
      } else {
        setPayments((payData as any) || []);
      }
    } catch (e: any) {
      alert(e.message || "Failed to load employee");
      router.push("/staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEmployeeAndPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function addPayment() {
    if (!supabase || !employee) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const amt = parseFloat(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        alert("Enter a valid amount");
        return;
      }

      // 1) Create an expense transaction in main accounts
      const txDescription =
        lang === "tm"
          ? `${t.salary_payment} - ${employee.name} (${employee.role})`
          : `${t.salary_payment} - ${employee.name} (${employee.role})`;

      const { data: txInserted, error: txErr } = await supabase
        .from("transactions")
        .insert([
          {
            amount: amt,
            description: txDescription,
            type: "expense",
            category: t.salary,
            date,
            masjid_id: session.user.id,
            employee_id: employee.id,
          } as any,
        ])
        .select("id")
        .single();

      if (txErr) throw txErr;

      // 2) Add to employee payment history
      const { error: payErr } = await supabase.from("employee_payments").insert([
        {
          masjid_id: session.user.id,
          employee_id: employee.id,
          amount: amt,
          date,
          notes: notes || null,
          transaction_id: (txInserted as any)?.id || null,
        },
      ]);

      if (payErr) throw payErr;

      setIsPayModalOpen(false);
      setAmount("");
      setNotes("");
      setDate(new Date().toISOString().split("T")[0]);
      await fetchEmployeeAndPayments();
    } catch (e: any) {
      alert(e.message || "Failed to add payment");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!employee) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-500 font-bold">Employee not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-12 font-sans">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/staff" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-emerald-600">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg font-black leading-none truncate">{t.employee_profile}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
              {employee.role}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setTab("payments");
            setIsPayModalOpen(true);
          }}
          className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          title={t.add_payment}
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-md mx-auto w-full">
        <div className="bg-white rounded-[2rem] p-6 border border-slate-50 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center text-slate-500 font-black text-lg shrink-0">
              {employee.photo_url ? (
                <img src={employee.photo_url} alt={employee.name} className="w-full h-full object-cover" />
              ) : (
                initials(employee.name)
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black text-slate-900 truncate">{employee.name}</h2>
              <div className="flex items-center gap-2 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                <span className="truncate">{employee.role}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
              <MapPin className="w-4 h-4 text-slate-300" />
              <span className="truncate">{employee.address}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
              <Phone className="w-4 h-4 text-slate-300" />
              <span className="truncate">{employee.phone}</span>
            </div>
          </div>
        </div>

        <div className="flex p-1 bg-slate-100 rounded-2xl">
          <button
            onClick={() => setTab("details")}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === "details" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"
            }`}
          >
            {t.profile}
          </button>
          <button
            onClick={() => setTab("payments")}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              tab === "payments" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
            }`}
          >
            {t.payments}
          </button>
        </div>

        {tab === "details" ? (
          <div className="bg-white rounded-[2rem] p-6 border border-slate-50 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.role}</p>
              <p className="text-sm font-black text-slate-800">{employee.role}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.payment_history}</p>
              <p className="text-sm font-black text-emerald-600">Rs. {totalPaid.toLocaleString()}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">{t.payments}</h3>
              <button
                onClick={() => setIsPayModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest"
              >
                {t.add_payment}
              </button>
            </div>

            {payments.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-[2rem] border border-slate-50">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                  <Wallet className="w-8 h-8" />
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No payments yet</p>
              </div>
            ) : (
              payments.map((p) => (
                <div
                  key={p.id}
                  className="bg-white rounded-2xl p-4 border border-slate-50 shadow-sm hover:border-emerald-100 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.date}</p>
                      <p className="text-sm font-black text-slate-800 mt-1">
                        Rs. {p.amount.toLocaleString()}
                      </p>
                      {p.notes ? (
                        <p className="text-[11px] font-bold text-slate-500 mt-2">{p.notes}</p>
                      ) : null}
                    </div>
                    {p.transaction_id ? (
                      <Link
                        href="/accounts"
                        className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest"
                        title={t.recorded_in_accounts}
                      >
                        {t.recorded_in_accounts}
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-slate-900">{t.add_payment}</h2>
              <button onClick={() => setIsPayModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.amount}</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-lg font-black focus:ring-4 ring-emerald-500/10 outline-none"
                  placeholder="0.00"
                />
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
                  placeholder={lang === "tm" ? "உதா: ஜனவரி சம்பளம்" : "E.g. January salary"}
                />
              </div>

              <button
                onClick={addPayment}
                disabled={submitting}
                className="w-full py-5 rounded-3xl font-black text-white bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {submitting ? "PROCESSING..." : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

