"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import {
  Wallet,
  Calendar,
  QrCode,
  X,
  Edit,
  Trash2,
  Search,
  Menu,
  LogOut,
  Settings,
  HelpCircle,
  Briefcase,
  Download,
  Home as HomeIcon,
  Users,
  CreditCard,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useAppToast } from "@/components/ToastProvider";
import { useMockAuth } from "@/components/MockAuthProvider";
import { parsePermissions, hasModulePermission, isSuperAdmin } from "@/lib/permissions-utils";

export const dynamic = "force-dynamic";

type Transaction = {
  id: string;
  amount: number;
  description: string;
  type: "income" | "expense" | "subscription";
  category: string;
  date: string;
  family_id?: string | null;
  user_id?: string;
};

type Family = {
  id: string;
  family_code: string;
  head_name: string;
};

export default function AccountsPage() {
  const router = useRouter();
  const { user: authUser, signOut, tenantContext, loading: authLoading } = useSupabaseAuth();
  
  // Parse permissions and check access
  const parsedPermissions = parsePermissions(JSON.stringify(tenantContext?.permissions || {}));
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);
  const hasAccountsAccess = hasModulePermission(parsedPermissions, 'accounts');
  
  // Login redirect effect
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authLoading, authUser, router]);
  
  // Page-level access control
  if (authLoading) return <div>Loading...</div>;
  if (!authUser) {
    router.push('/login');
    return null;
  }
  
  if (!hasAccountsAccess && !userIsSuperAdmin) {
    return <div>No access to Accounts module</div>;
  }

  const { toast } = useAppToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense" | "subscription">("income");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [allowed, setAllowed] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState<Language>("en");

  const t = translations[lang];

  const isNonZeroAmount = (value: unknown) => {
    if (typeof value !== "number") return false;
    if (!Number.isFinite(value)) return false;
    return Math.abs(value) > 0.000001;
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
    const isEvent = isEventInfoRow(tx);

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
    const checkAuth = async () => {
      if (!authUser) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        return;
      }

      setUser(authUser);
      // Only fetch data when tenantContext is available
      if (tenantContext?.masjidId) {
        await fetchData(authUser);
      }
    };

    checkAuth();
  }, [authUser, tenantContext?.masjidId]);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  async function fetchData(currentUser: any) {
    if (!supabase || !currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx || !ctx.masjidId) {
        console.log("No tenant context or masjidId available");
        setLoading(false);
        return;
      }

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .eq("masjid_id", ctx.masjidId)
        .order("date", { ascending: false });

      if (transactionsError) throw transactionsError;

      const { data: familiesData, error: familiesError } = await supabase
        .from("families")
        .select("id, family_code, head_name")
        .eq("masjid_id", ctx.masjidId);

      if (familiesError) throw familiesError;

      setTransactions((transactionsData as Transaction[]) || []);
      setFamilies((familiesData as Family[]) || []);
      setErrorMessage("");
    } catch (err: any) {
      console.error("Fetch error:", err);
      setErrorMessage(err.message || "Failed to load data.");
      setTransactions([]);
      setFamilies([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;

    setSubmitting(true);

    try {
      // Use tenantContext from useMockAuth instead of getTenantContext
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) {
        setErrorMessage("Tenant context not found");
        setSubmitting(false);
        return;
      }

      // Get the authenticated user ID from auth, not from state
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setErrorMessage("Not authenticated");
        setSubmitting(false);
        return;
      }

      const authUserId = session.user.id;

      const finalDescription =
        type === "subscription" ? `Subscription: ${description}` : description;
      const finalCategory = type === "subscription" ? "subscription" : category;

      if (editingTransaction) {
        const { error } = await supabase
          .from("transactions")
          .update({
            amount: parseFloat(amount),
            description: finalDescription,
            type: type === "subscription" ? "income" : type,
            category: finalCategory,
            date,
            masjid_id: ctx.masjidId,
            user_id: authUserId,
            family_id: type === "subscription" ? selectedFamilyId : null,
          })
          .eq("id", editingTransaction.id)
          .eq("masjid_id", ctx.masjidId);

        if (error) throw error;
      } else {
        console.log("TRANSACTION INSERT MASJID ID:", ctx?.masjidId);
console.log("SELECTED FAMILY ID:", selectedFamilyId);
console.log("AUTH USER ID:", authUserId);
const { error } = await supabase
  .from("transactions")
  .insert([
    {
      amount: parseFloat(amount),
      description: finalDescription,
      type: type === "subscription" ? "income" : type,
      category: finalCategory,
      date,
      masjid_id: ctx.masjidId,
      user_id: authUserId,
      family_id: type === "subscription" ? selectedFamilyId : null,
    },
  ]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      await fetchData(user);
    } catch (err: any) {
      console.error("Transaction error:", err);
      toast({
        kind: "error",
        title: "Transaction Failed",
        message: err.message || "Failed",
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
    setDate(new Date().toISOString().split("T")[0]);
    setEditingTransaction(null);
  };

  async function deleteTransaction(id: string) {
    if (!supabase || !user) return;

    const ok = window.confirm(t.confirm_delete);
    if (!ok) return;

    try {
      // Use tenantContext from useMockAuth instead of getTenantContext
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;

      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("masjid_id", ctx.masjidId);

      if (error) throw error;
      await fetchData(user);
    } catch (err: any) {
      toast({
        kind: "error",
        title: "Error",
        message: err.message || "Failed",
      });
    }
  }

  const handlePrintPDF = async () => {
    try {
      const printWindow = window.open("", "_blank", "width=800,height=600");
      if (!printWindow) {
        alert("Please allow popups for this website to print PDF");
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
                ${transactions
                  .map(
                    (tx) => `
                  <tr>
                    <td>${new Date(tx.date).toLocaleDateString()}</td>
                    <td>${tx.description}</td>
                    <td>${tx.category || "-"}</td>
                    <td>${tx.type}</td>
                    <td>${tx.type === "expense" ? "-" : "+"}Rs. ${tx.amount}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error("Accounts: PDF generation error:", error);
      alert("PDF generation failed: " + (error as Error).message);
    }
  };

  const handleLogout = async () => {
    try {
      if (signOut) {
        await signOut();
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      window.location.href = "/login";
    }
  };

  const handleQrDecodedText = (decodedText: string) => {
    if (!decodedText) return;
    console.log("QR scanned:", decodedText);
    setIsScannerOpen(false);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-neutral-200 transform transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-neutral-200">
            <h1 className="text-2xl font-black text-neutral-900">MJM</h1>
            <p className="text-sm text-neutral-600">Mubeen Jummah Masjid</p>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <Link
              href="/dashboard"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all"
            >
              <HomeIcon className="w-5 h-5" />
              <span>{t.dashboard}</span>
            </Link>

            <Link
              href="/families"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all"
            >
              <Users className="w-5 h-5" />
              <span>{t.families}</span>
            </Link>

            <Link
              href="/accounts"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-700 rounded-3xl font-bold transition-all border-2 border-emerald-200"
            >
              <CreditCard className="w-5 h-5" />
              <span>{t.accounts}</span>
            </Link>

            <Link
              href="/staff"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all"
            >
              <Briefcase className="w-5 h-5 text-emerald-600" />
              <span>{t.staff_management || t.staff}</span>
            </Link>

            <Link
              href="/settings"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all"
            >
              <Settings className="w-5 h-5" />
              <span>{t.settings}</span>
            </Link>

            <Link
              href="/events"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all"
            >
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

      <div className="flex-1 flex flex-col min-h-screen">
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

        <main className="flex-1 p-4 lg:p-6 space-y-6">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4">
              {errorMessage}
            </div>
          )}

          <div className="rounded-3xl p-8 text-white shadow-xl relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-emerald-900">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Wallet className="w-24 h-24" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Total Income</p>
                  <h3 className="text-2xl font-black text-emerald-400">
                    Rs.{" "}
                    {financialTransactions
                      .filter((tx) => getFinancialKind(tx) === "income")
                      .reduce((sum, tx) => sum + tx.amount, 0)
                      .toLocaleString()}
                  </h3>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">Total Expense</p>
                  <h3 className="text-2xl font-black text-rose-400">
                    Rs.{" "}
                    {financialTransactions
                      .filter((tx) => getFinancialKind(tx) === "expense")
                      .reduce((sum, tx) => sum + tx.amount, 0)
                      .toLocaleString()}
                  </h3>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">{t.balance}</p>
                  <h2 className="text-2xl font-black">
                    Rs.{" "}
                    {financialTransactions
                      .reduce(
                        (sum, tx) => sum + (getFinancialKind(tx) === "income" ? tx.amount : -tx.amount),
                        0
                      )
                      .toLocaleString()}
                  </h2>
                </div>
              </div>
            </div>
          </div>

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

          <div className="space-y-3">
            <h3 className="text-sm font-black text-neutral-600 uppercase tracking-widest ml-1">
              {t.transactions}
            </h3>

            {filteredTransactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-neutral-200">
                <Wallet className="w-12 h-12 mx-auto mb-4 text-neutral-300" />
                <h3 className="font-semibold text-neutral-900 mb-2">
                  {searchQuery ? "No transactions found" : "No transactions"}
                </h3>
                <p className="text-sm text-neutral-600">
                  {searchQuery
                    ? "Try a different search term"
                    : "Add your first transaction to get started."}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card Layout */}
                <div className="sm:hidden space-y-3 w-full">
                  {filteredTransactions.map((tx, idx) => {
                    const kind = getFinancialKind(tx);
                    const altBg = idx % 2 === 0 ? "bg-white/65" : "bg-emerald-50/20";

                    return (
                      <div
                        key={tx.id}
                        className={`bg-white rounded-2xl p-4 shadow-md space-y-3 border ${altBg}`}
                      >
                        {/* Transaction Type and Date */}
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-sm font-black uppercase tracking-widest ${
                              kind === "income" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {kind === "income" ? "Income" : "Expense"}
                          </span>
                          <span className="text-xs text-neutral-500">{tx.date}</span>
                        </div>

                        {/* Description and Category */}
                        <div className="space-y-1">
                          <p className="font-semibold text-neutral-900">{tx.description}</p>
                          {tx.category && <p className="text-sm text-neutral-600">{tx.category}</p>}
                        </div>

                        {/* Amount and Actions */}
                        <div className="flex items-center justify-between pt-2">
                          <p
                            className={`text-xl font-black ${
                              kind === "income" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {kind === "income" ? "+" : "-"}Rs. {tx.amount.toLocaleString()}
                          </p>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingTransaction(tx);
                                setAmount(tx.amount.toString());
                                setDescription(
                                  tx.description.replace(/^(Subscription|Income|Expense):\s*/i, "")
                                );
                                setCategory(tx.category);
                                setDate(tx.date);
                                setType(tx.type);
                                setSelectedFamilyId(tx.family_id || "");
                                setIsModalOpen(true);
                              }}
                              className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => deleteTransaction(tx.id)}
                              className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden sm:block space-y-3 w-full">
                  {filteredTransactions.map((tx, idx) => {
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
                            <span
                              className={`text-sm font-black uppercase tracking-widest ${
                                kind === "income" ? "text-emerald-600" : "text-rose-600"
                              }`}
                            >
                              {kind === "income" ? "Income" : "Expense"}
                            </span>
                            <span className="text-xs text-neutral-500">{tx.date}</span>
                          </div>
                          <p className="font-semibold text-neutral-900 mb-1">{tx.description}</p>
                          {tx.category && <p className="text-sm text-neutral-600">{tx.category}</p>}
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-xl font-black ${
                              kind === "income" ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {kind === "income" ? "+" : "-"}Rs. {tx.amount.toLocaleString()}
                          </p>

                          <div className="flex gap-1 mt-2">
                            <button
                              onClick={() => {
                                setEditingTransaction(tx);
                                setAmount(tx.amount.toString());
                                setDescription(
                                  tx.description.replace(/^(Subscription|Income|Expense):\s*/i, "")
                                );
                                setCategory(tx.category);
                                setDate(tx.date);
                                setType(tx.type);
                                setSelectedFamilyId(tx.family_id || "");
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
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

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
                <label className="block text-sm font-medium text-neutral-700 mb-2">{t.type}</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "income" | "expense" | "subscription")}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="subscription">Subscription</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">{t.amount}</label>
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
                <label className="block text-sm font-medium text-neutral-700 mb-2">{t.date}</label>
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
                {submitting ? "Saving..." : editingTransaction ? "Update" : t.save}
              </button>
            </form>
          </div>
        </div>
      )}

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