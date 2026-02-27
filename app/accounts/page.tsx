"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, TrendingUp, TrendingDown, Wallet, Calendar, Tag, MoreVertical, X, Edit, Trash2, FileText, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { AppShell } from "@/components/AppShell";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type Transaction = {
  id: string;
  amount: number;
  description: string;
  type: "income" | "expense" | "subscription";
  category: string;
  date: string;
  masjid_id: string;
  family_id?: string;
};

type Family = {
  id: string;
  family_code: string;
  head_name: string;
};

export default function AccountsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Form states
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense" | "subscription">("income");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const t = translations[lang];

  const isNonZeroAmount = (amount: unknown) => {
    if (typeof amount !== "number") return false;
    if (!Number.isFinite(amount)) return false;
    return Math.abs(amount) > 0.000001;
  };

  const isEventInfoRow = (tx: Transaction) => {
    const desc = (tx.description || "").trim().toLowerCase();
    const cat = (tx.category || "").trim().toLowerCase();
    return /^event\s*[:\-]/i.test(desc) || /^event\s*[:\-]/i.test(cat);
  };

  const getFinancialKind = (tx: Transaction): "income" | "expense" => {
    // Treat legacy/UX "subscription" as "income" for display + summaries
    return tx.type === "expense" ? "expense" : "income";
  };

  const financialTransactions = transactions.filter((tx) => {
    const isIncomeOrExpense =
      tx.type === "income" || tx.type === "expense" || tx.type === "subscription";

    if (!isIncomeOrExpense) return false;
    if (!isNonZeroAmount(tx.amount)) return false; // hide Rs. 0 / informational rows

    return true;
  });

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchData();
  }, []);

  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "accounts-reader",
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
      scanner.render(onScanSuccess, onScanFailure);
      function onScanSuccess(decodedText: string) {
        if (decodedText.startsWith("smart-masjeedh:family:")) {
          const familyId = decodedText.split(":")[2];
          setSelectedFamilyId(familyId);
          setType("subscription");
          setIsModalOpen(true);
          scanner.clear();
          setIsScannerOpen(false);
        }
      }
      function onScanFailure(_err: any) {}
      return () => {
        scanner.clear();
      };
    }
  }, [isScannerOpen]);

  useEffect(() => {
    if (editingTransaction) {
      setAmount(editingTransaction.amount.toString());
      setDescription(editingTransaction.description);
      setType(editingTransaction.type === "income" && editingTransaction.family_id ? "subscription" : editingTransaction.type as any);
      setCategory(editingTransaction.category);
      setDate(editingTransaction.date);
      setSelectedFamilyId(editingTransaction.family_id || "");
      setIsModalOpen(true);
    }
  }, [editingTransaction]);

  async function fetchData() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("masjid_id", session.user.id)
        .order("date", { ascending: false });

      if (txError) {
        if (!txError.message.includes('table')) throw txError;
      } else if (txData) {
        setTransactions(txData);
      }

      // Fetch families for subscription selection
      const { data: famData } = await supabase
        .from("families")
        .select("id, family_code, head_name")
        .eq("masjid_id", session.user.id)
        .order("family_code", { ascending: true });
      
      if (famData) setFamilies(famData);

    } catch (err: any) {
      console.error("Fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const finalType = type === "subscription" ? "income" : type;
      const finalCategory = type === "subscription" ? t.subscription : category;
      const finalDescription = type === "subscription" 
        ? `${t.subscription} - ${families.find(f => f.id === selectedFamilyId)?.family_code}`
        : description;

      if (editingTransaction) {
        const { error } = await supabase
          .from("transactions")
          .update({
            amount: parseFloat(amount),
            description: finalDescription,
            type: finalType,
            category: finalCategory,
            date,
            family_id: type === "subscription" ? selectedFamilyId : null
          })
          .eq("id", editingTransaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert([
          {
            amount: parseFloat(amount),
            description: finalDescription,
            type: finalType,
            category: finalCategory,
            date,
            masjid_id: session.user.id,
            family_id: type === "subscription" ? selectedFamilyId : null
          }
        ]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setCategory("");
    setSelectedFamilyId("");
    setType("income");
    setEditingTransaction(null);
  };

  async function deleteTransaction(id: string) {
    if (!supabase || !confirm(t.confirm_delete)) return;
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text("Masjid Transactions Report", 14, 15);
    
    const tableData = filteredTransactions.map(tx => [
      // normalize type for reporting
      tx.date,
      tx.description,
      tx.category,
      getFinancialKind(tx).toUpperCase(),
      `Rs. ${tx.amount.toLocaleString()}`
    ]);

    doc.autoTable({
      startY: 20,
      head: [["Date", "Description", "Category", "Type", "Amount"]],
      body: tableData,
    });

    doc.save("transactions_report.pdf");
  };

  const totalIncome = financialTransactions
    .filter(tx => getFinancialKind(tx) === "income")
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpense = financialTransactions
    .filter(tx => getFinancialKind(tx) === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
    
  const balance = totalIncome - totalExpense;

  const filteredTransactions = financialTransactions.filter(tx => 
    (tx.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <AppShell
      title={t.accounts}
      actions={
        <>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="p-3 bg-slate-50 text-slate-600 rounded-3xl hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
            title={t.scan_qr}
          >
            <QrCode className="w-6 h-6" />
          </button>
          <button
            onClick={generatePDF}
            className="p-3 bg-slate-50 text-blue-600 rounded-3xl hover:bg-blue-50 transition-all active:scale-95"
            title={t.download_pdf}
          >
            <FileText className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="p-3 bg-emerald-500 text-white rounded-3xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            title={t.add_transaction}
          >
            <Plus className="w-6 h-6" />
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Balance Card */}
        <div className="rounded-3xl p-8 text-white shadow-xl relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet className="w-24 h-24" />
          </div>
          <div className="relative z-10 space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">{t.balance}</p>
            <h2 className="text-4xl font-black">Rs. {balance.toLocaleString()}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t.income}</span>
              </div>
              <p className="font-bold">Rs. {totalIncome.toLocaleString()}</p>
            </div>
            <div className="space-y-1 border-l border-white/10 pl-4">
              <div className="flex items-center gap-1.5 text-rose-400">
                <TrendingDown className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t.expense}</span>
              </div>
              <p className="font-bold">Rs. {totalExpense.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
          />
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">{t.transactions}</h3>
          {filteredTransactions.length === 0 ? (
            <div className="py-20 text-center app-card">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <Wallet className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No transactions yet</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const kind = getFinancialKind(tx);
              return (
                <div
                  key={tx.id}
                  className="app-card p-4 flex items-center justify-between group hover:border-emerald-200 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        kind === "income"
                          ? "bg-emerald-50 text-emerald-500"
                          : "bg-rose-50 text-rose-500"
                      }`}
                    >
                      {kind === "income" ? (
                        <TrendingUp className="w-6 h-6" />
                      ) : (
                        <TrendingDown className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">
                        {tx.description}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {tx.category}
                        </span>
                        <span className="text-slate-200">•</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {tx.date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="text-right mr-2">
                      <p
                        className={`font-black text-sm ${
                          kind === "income"
                            ? "text-emerald-500"
                            : "text-rose-500"
                        }`}
                      >
                        {kind === "income" ? "+" : "-"} Rs.{" "}
                        {tx.amount.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingTransaction(tx)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {isScannerOpen && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <header className="p-6 flex items-center justify-between text-white">
            <h2 className="text-xl font-black uppercase tracking-widest">{t.scan_qr}</h2>
            <button onClick={() => setIsScannerOpen(false)} className="p-3 bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div id="accounts-reader" className="w-full max-w-sm rounded-[2.5rem] overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20"></div>
            <p className="mt-8 text-white/60 text-sm font-bold uppercase tracking-widest text-center">
              Align QR Code within the frame to scan
            </p>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-900">{t.add_transaction}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Type Toggle */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-50 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    type === "income" ? "bg-white text-emerald-500 shadow-sm" : "text-slate-400"
                  }`}
                >
                  {t.income}
                </button>
                <button
                  type="button"
                  onClick={() => setType("subscription")}
                  className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    type === "subscription" ? "bg-white text-blue-500 shadow-sm" : "text-slate-400"
                  }`}
                >
                  {t.subscription}
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    type === "expense" ? "bg-white text-rose-500 shadow-sm" : "text-slate-400"
                  }`}
                >
                  {t.expense}
                </button>
              </div>

              {type === "subscription" && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.select_family}</label>
                  <select
                    required
                    value={selectedFamilyId}
                    onChange={e => setSelectedFamilyId(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none appearance-none"
                  >
                    <option value="">{t.select_family}</option>
                    {families.map(f => (
                      <option key={f.id} value={f.id}>{f.family_code} - {f.head_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.amount}</label>
                <input 
                  required
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-lg font-black focus:ring-4 ring-emerald-500/10 outline-none"
                  placeholder="0.00"
                />
              </div>

              {type !== "subscription" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.description}</label>
                  <input 
                    required
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                    placeholder="E.g. Friday Donation"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {type !== "subscription" && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.category}</label>
                    <input 
                      required
                      type="text"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                      placeholder="E.g. Charity"
                    />
                  </div>
                )}
                <div className={`space-y-2 ${type === "subscription" ? "col-span-2" : ""}`}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.date}</label>
                  <input 
                    required
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-5 rounded-3xl font-black text-white shadow-xl transition-all active:scale-[0.97] disabled:opacity-50 ${
                  type === "income" ? "bg-emerald-500 shadow-emerald-500/20" : 
                  type === "subscription" ? "bg-blue-500 shadow-blue-500/20" :
                  "bg-rose-500 shadow-rose-500/20"
                }`}
              >
                {submitting ? "PROCESSING..." : t.save}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
