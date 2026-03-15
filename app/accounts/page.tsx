"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Search, TrendingUp, TrendingDown, Wallet, Calendar, Tag, MoreVertical, X, Edit, Trash2, FileText, QrCode, Home as HomeIcon, Users, CreditCard, Menu, LogOut, Settings, HelpCircle, Briefcase, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { useAuthSession } from "@/hooks/useAuthSession";
import { AuthGuard } from "@/components/AuthGuard";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useAppToast } from "@/components/ToastProvider";
import { AppShell } from "@/components/AppShell";

export const dynamic = 'force-dynamic';

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
  const { user, loading: authLoading, isAuthenticated } = useAuthSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showReportOptions, setShowReportOptions] = useState(false);
  
  // Form states
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense" | "subscription">("income");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useAppToast();
  const [lang, setLang] = useState<Language>("en");

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
    return tx.type === "expense" ? "expense" : "income";
  };

  const isFinancialTransaction = (tx: Transaction): boolean => {
    const desc = (tx.description || "").trim().toLowerCase();
    const cat = (tx.category || "").trim().toLowerCase();
    const isEvent = /^event\s*[:\-]/i.test(desc) || /^event\s*[:\-]/i.test(cat);
    
    if (tx.type === "subscription") {
      return !isEvent && !tx.family_id;
    }
    
    return !isEvent;
  };

  const financialTransactions = transactions.filter((tx) => {
    if (!isFinancialTransaction(tx)) return false;
    if (!isNonZeroAmount(tx.amount)) return false;
    return true;
  });

  const filteredTransactions = financialTransactions.filter((tx) => {
    const q = searchQuery.trim().toLowerCase();
    if (q === "") return true;
    return (
      (tx.description || "").toLowerCase().includes(q) ||
      (tx.category || "").toLowerCase().includes(q) ||
      (tx.type || "").toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchData();
    }
  }, [isAuthenticated, user]);

  async function fetchData() {
    if (!supabase) return;
    setLoading(true);
    setErrorMessage("");
    try {
      // Get authenticated user - BLOCK if not logged in
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated. Please login again.");
      }

      // Fetch ONLY user's transactions - RLS ensures this
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id) // Explicit user filter
        .order("date", { ascending: false });

      if (transactionsError) throw transactionsError;

      // Fetch families for subscriptions (user's families only)
      const { data: familiesData, error: familiesError } = await supabase
        .from("families")
        .select("id, family_code, head_name")
        .eq("user_id", user.id); // User's families only

      if (familiesError) throw familiesError;

      setTransactions(transactionsData || []);
      setFamilies(familiesData || []);
      setErrorMessage("");
    } catch (err: any) {
      console.error("Fetch error:", err);
      setErrorMessage(err.message || "Failed to load data. Please login again.");
      setTransactions([]);
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);

    try {
      // Get authenticated user - BLOCK if not logged in
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("User not authenticated. Please login again.");
      }

      const finalDescription = type === "subscription" ? `Subscription: ${description}` : description;
      const finalType = type === "subscription" ? "income" : type;
      const finalCategory = type === "subscription" ? "subscription" : category;

      if (editingTransaction) {
        // Update existing transaction - MUST include user_id check
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
          .eq("id", editingTransaction.id)
          .eq("user_id", user.id); // Extra safety check
        
        if (error) throw error;
      } else {
        // Insert new transaction - MUST include user_id
        const { error } = await supabase.from("transactions").insert([
          {
            amount: parseFloat(amount),
            description: finalDescription,
            type: finalType,
            category: finalCategory,
            date,
            user_id: user.id, // CRITICAL: Always include user_id
            family_id: type === "subscription" ? selectedFamilyId : null
          }
        ]);
        
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      console.error("Transaction error:", err);
      toast({ 
        kind: "error", 
        title: "Transaction Failed", 
        message: err.message || "Failed to save transaction. Please ensure you're logged in." 
      });
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
    if (!supabase) return;
    const ok = window.confirm(t.confirm_delete);
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed" });
    }
  }

  const handlePrintPDF = async () => {
    try {
      // Create printable HTML
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        alert('Please allow popups for this website to print PDF');
        return;
      }
      
      const html = `
        <html>
          <head>
            <title>Account Transactions - MJM</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #047857; text-align: center; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #047857; color: white; }
              .income { color: #059669; }
              .expense { color: #dc2626; }
              .subscription { color: #7c3aed; }
              .header { text-align: center; margin-bottom: 30px; }
              .date { text-align: right; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Mubeen Jummah Masjid</h1>
              <h2>Account Transactions</h2>
            </div>
            <div class="date">Generated: ${new Date().toLocaleDateString()}</div>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.map(tx => `
                  <tr>
                    <td>${new Date(tx.date).toLocaleDateString()}</td>
                    <td>${tx.description}</td>
                    <td>${tx.category || '-'}</td>
                    <td><span class="${tx.type}">${tx.type}</span></td>
                    <td class="${tx.type}">${tx.type === 'income' ? '+' : '-'}₹${tx.amount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div style="margin-top: 20px; text-align: right;">
              <strong>Total Income: ₹${transactions.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0)}</strong><br>
              <strong>Total Expense: ₹${transactions.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)}</strong><br>
              <strong>Total Subscriptions: ₹${transactions.filter(tx => tx.type === 'subscription').reduce((sum, tx) => sum + tx.amount, 0)}</strong>
            </div>
          </body>
        </html>
      `;
      
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
      
    } catch (error) {
      console.error('Accounts: PDF generation error:', error);
      alert('PDF generation failed: ' + (error as Error).message);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const handleQrDecodedText = (decodedText: string) => {
    if (!decodedText) return;
    // Handle QR code scanning for transactions
    console.log('QR scanned:', decodedText);
    setIsScannerOpen(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t.loading || "Loading..."}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-neutral-200 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-neutral-200">
            <h1 className="text-2xl font-black text-neutral-900">MJM</h1>
            <p className="text-sm text-neutral-600">Mubeen Jummah Masjid</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <HomeIcon className="w-5 h-5" />
              <span>{t.dashboard}</span>
            </Link>
            <Link href="/families" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Users className="w-5 h-5" />
              <span>{t.families}</span>
            </Link>
            <Link href="/accounts" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-700 rounded-3xl font-bold transition-all border-2 border-emerald-200">
              <CreditCard className="w-5 h-5" />
              <span>{t.accounts}</span>
            </Link>
            <Link href="/staff" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Briefcase className="w-5 h-5 text-emerald-600" />
              <span>{t.staff_management || t.staff}</span>
            </Link>
            <Link href="/settings" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Settings className="w-5 h-5" />
              <span>{t.settings}</span>
            </Link>
            <Link href="/events" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span>{t.events || "Events"}</span>
            </Link>
            <div className="flex items-center gap-4 p-4 opacity-40 text-neutral-600 rounded-3xl font-bold cursor-not-allowed">
              <HelpCircle className="w-5 h-5" />
              <span>Help & Support</span>
            </div>
          </nav>

          <button 
            onClick={handleLogout}
            className="m-4 flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 rounded-3xl font-bold transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-20 border-b border-neutral-200">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-neutral-600 hover:bg-neutral-50 rounded-3xl transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black text-neutral-900">{t.accounts}</h1>
          <div className="w-10"></div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6">
          {/* Balance Card */}
          <div className="rounded-3xl p-8 text-white shadow-xl relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-emerald-900">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Wallet className="w-24 h-24" />
            </div>
            <div className="relative z-10 space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">{t.balance}</p>
              <h2 className="text-4xl font-black">Rs. {financialTransactions.reduce((sum, t) => sum + (getFinancialKind(t) === "income" ? t.amount : -t.amount), 0).toLocaleString()}</h2>
            </div>
          </div>

          {/* Add Transaction Button */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="flex-1 py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all"
            >
              {t.add_transaction}
            </button>
            <button
              onClick={handlePrintPDF}
              className="flex-1 py-4 bg-blue-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download PDF
            </button>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="py-4 px-4 bg-purple-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-purple-700 active:scale-95 transition-all"
            >
              <QrCode className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder={t.search || "Search transactions..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Transactions List */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-neutral-600 uppercase tracking-widest ml-1">{t.transactions}</h3>
            {filteredTransactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200">
                <Wallet className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                <h3 className="font-semibold text-neutral-900 mb-2">
                  {searchQuery ? "No transactions found" : (lang === "tm" ? "பரிவர்த்தனைகள் இல்லை" : "No transactions")}
                </h3>
                <p className="text-sm text-neutral-600">
                  {searchQuery ? "Try a different search term" : (lang === "tm" ? "முதல் பரிவர்த்தனையைச் சேர்க்கவும்" : "Add your first transaction to get started.")}
                </p>
              </div>
            ) : (
              filteredTransactions.map((tx, idx) => {
                const kind = getFinancialKind(tx);
                const altBg = idx % 2 === 0 ? "bg-white/65" : "bg-emerald-50/20";
                return (
                  <div
                    key={tx.id}
                    className={`bg-white rounded-3xl p-5 flex items-center justify-between group hover:border-emerald-200 transition-all relative overflow-hidden border ${altBg}`}
                  >
                    <div
                      className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${
                        kind === "income" ? "bg-emerald-600" : "bg-rose-600"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-sm font-black uppercase tracking-widest ${
                          kind === "income" ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {kind === "income" ? "Income" : "Expense"}
                        </span>
                        <span className="text-xs text-neutral-500">{tx.date}</span>
                      </div>
                      <p className="font-semibold text-neutral-900 mb-1">{tx.description}</p>
                      {tx.category && (
                        <p className="text-sm text-neutral-600">{tx.category}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black ${
                        kind === "income" ? "text-emerald-600" : "text-rose-600"
                      }`}>
                        {kind === "income" ? "+" : "-"}Rs. {tx.amount.toLocaleString()}
                      </p>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => {
                            setEditingTransaction(tx);
                            setAmount(tx.amount.toString());
                            setDescription(tx.description.replace(/^(Subscription|Income|Expense):\s*/i, ""));
                            setCategory(tx.category);
                            setDate(tx.date);
                            setType(tx.type);
                            setIsModalOpen(true);
                          }}
                          className="p-1 text-neutral-400 hover:text-emerald-600 transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Add/Edit Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-neutral-900">
                {editingTransaction ? "Edit Transaction" : t.add_transaction}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t.type}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="subscription">Subscription</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t.amount}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t.description}
                </label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter description"
                />
              </div>

              {type === "income" || type === "expense" ? (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t.category}
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter category"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t.family}
                  </label>
                  <select
                    value={selectedFamilyId}
                    onChange={(e) => setSelectedFamilyId(e.target.value)}
                    className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Select Family</option>
                    {families.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.family_code} - {family.head_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t.date}
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {submitting ? "Saving..." : (editingTransaction ? "Update" : t.save)}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {isScannerOpen && (
        <QrScannerModal
          open={isScannerOpen}
          title="Scan QR Code"
          containerId="qr-scanner"
          onClose={() => setIsScannerOpen(false)}
          onDecodedText={handleQrDecodedText}
        />
      )}
    </div>
  );
}
