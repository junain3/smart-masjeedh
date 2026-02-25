"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Search, TrendingUp, TrendingDown, Wallet, Calendar, Tag, MoreVertical, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";

type Transaction = {
  id: string;
  amount: number;
  description: string;
  type: "income" | "expense";
  category: string;
  date: string;
  masjid_id: string;
};

export default function AccountsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Form states
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense">("income");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchTransactions();
  }, []);

  async function fetchTransactions() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("masjid_id", session.user.id)
        .order("date", { ascending: false });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('table')) {
          setTransactions([]);
        } else {
          throw error;
        }
      } else if (data) {
        setTransactions(data);
      }
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

      const { error } = await supabase.from("transactions").insert([
        {
          amount: parseFloat(amount),
          description,
          type,
          category,
          date,
          masjid_id: session.user.id
        }
      ]);

      if (error) throw error;
      
      setIsModalOpen(false);
      setAmount("");
      setDescription("");
      setCategory("");
      fetchTransactions();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpense = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
    
  const balance = totalIncome - totalExpense;

  const filteredTransactions = transactions.filter(t => 
    t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans pb-10">
      <header className="bg-white px-4 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 hover:bg-slate-50 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-emerald-600" />
          </Link>
          <h1 className="text-xl font-black">{t.accounts}</h1>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </header>

      <main className="flex-1 p-6 space-y-6 max-w-md mx-auto w-full">
        {/* Balance Card */}
        <div className="bg-[#003d5b] rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
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
            <div className="py-20 text-center bg-white rounded-[2rem] border border-slate-50">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <Wallet className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No transactions yet</p>
            </div>
          ) : (
            filteredTransactions.map(tx => (
              <div key={tx.id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-50 shadow-sm group hover:border-emerald-100 transition-all">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    tx.type === "income" ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"
                  }`}>
                    {tx.type === "income" ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{tx.description}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{tx.category}</span>
                      <span className="text-slate-200">•</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{tx.date}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black ${tx.type === "income" ? "text-emerald-500" : "text-rose-500"}`}>
                    {tx.type === "income" ? "+" : "-"} Rs. {tx.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

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
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                    type === "income" ? "bg-white text-emerald-500 shadow-sm" : "text-slate-400"
                  }`}
                >
                  {t.income}
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                    type === "expense" ? "bg-white text-rose-500 shadow-sm" : "text-slate-400"
                  }`}
                >
                  {t.expense}
                </button>
              </div>

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

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-2">
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
                  type === "income" ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-500 shadow-rose-500/20"
                }`}
              >
                {submitting ? "PROCESSING..." : t.save}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
