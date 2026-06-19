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
  Download,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { escapePdfHtml, getPdfMasjidName } from "@/lib/pdf-utils";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useAppToast } from "@/components/ToastProvider";
import { useMockAuth } from "@/components/MockAuthProvider";
import { parsePermissions, hasModulePermission, isSuperAdmin } from "@/lib/permissions-utils";
import { AppShell } from "@/components/AppShell";
import RouteGuard from "@/components/RouteGuard";
import {
  formatTransactionCategory,
  formatTransactionDescription,
  isAccountSubscriptionTransaction,
  buildDirectSubscriptionDescription,
  syncCollectionForAccountTransaction,
  deleteCollectionForAccountTransaction,
  createPendingCollectionFromAccounts,
  updatePendingCollectionFromAccounts,
  deletePendingCollectionFromAccounts,
  extractDirectAccountNote,
  isDirectAccountCollection,
} from "@/lib/collection-utils";

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

type PendingAccountCollection = {
  id: string;
  family_id: string;
  amount: number;
  date: string;
  notes?: string | null;
  status: string;
};

export default function AccountsPage() {
  // ALL HOOKS FIRST - NO CONDITIONAL CALLS!
  const router = useRouter();
  const { user: authUser, signOut, tenantContext, loading: authLoading, resumeTick } = useSupabaseAuth();
  const { toast } = useAppToast();
  
  // State hooks
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [pendingAccountCollections, setPendingAccountCollections] = useState<PendingAccountCollection[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
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
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState<Language>("en");

  // Parse permissions and check access (no hooks here)
  const parsedPermissions = parsePermissions(JSON.stringify(tenantContext?.permissions || {}));
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);
  const hasAccountsAccess = hasModulePermission(parsedPermissions, 'accounts');
  
  // Login redirect effect
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    }
  }, [authLoading, authUser, router]);

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
  }, [authUser, tenantContext?.masjidId, resumeTick]);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);
  
  // Page-level access control (after all hooks)
  if (authLoading) return <div>Loading...</div>;
  if (!authUser) {
    router.push('/login');
    return null;
  }
  
  if (!hasAccountsAccess && !userIsSuperAdmin) {
    return <div>No access to Accounts module</div>;
  }

  const t = getTranslation(lang);

  const displayDescription = (tx: Transaction) =>
    formatTransactionDescription(tx.description, tx.category, tx.family_id);

  const displayCategory = (tx: Transaction) =>
    tx.category ? formatTransactionCategory(tx.category) : "";

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

  async function fetchData(currentUser: any) {
    if (!supabase || !currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      if (!tenantContext?.masjidId) {
        console.log("No tenant context available");
        return;
      }

      // Run queries in parallel instead of sequentially
      const [transactionsResponse, familiesResponse, pendingCollectionsResponse] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, amount, category, description, date, family_id, masjid_id, user_id, created_at")
          .eq("masjid_id", tenantContext.masjidId)
          .order("date", { ascending: false }),
        supabase
          .from("families")
          .select("id, family_code, head_name")
          .eq("masjid_id", tenantContext.masjidId),
        supabase
          .from("subscription_collections")
          .select("id, family_id, amount, date, notes, status")
          .eq("masjid_id", tenantContext.masjidId)
          .eq("status", "pending"),
      ]);

      if (transactionsResponse.error) throw transactionsResponse.error;
      if (familiesResponse.error) throw familiesResponse.error;
      if (pendingCollectionsResponse.error) throw pendingCollectionsResponse.error;

      setTransactions((transactionsResponse.data as Transaction[]) || []);
      setFamilies((familiesResponse.data as Family[]) || []);
      setPendingAccountCollections(
        ((pendingCollectionsResponse.data as PendingAccountCollection[]) || []).filter((c) =>
          isDirectAccountCollection(c.notes)
        )
      );
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
      const amountNum = parseFloat(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setErrorMessage("சரியான தொகை உள்ளிடவும்");
        setSubmitting(false);
        return;
      }

      if (type === "subscription" && !selectedFamilyId) {
        toast({
          kind: "error",
          title: "குடும்பம் தேவை",
          message: "சந்தா வரவுக்கு குடும்பத்தைத் தேர்ந்தெடுக்கவும்",
        });
        setSubmitting(false);
        return;
      }

      const selectedFamily = families.find((f) => f.id === selectedFamilyId);
      const isSubscription = type === "subscription";

      const finalDescription = isSubscription
        ? buildDirectSubscriptionDescription(
            selectedFamily?.family_code || "—",
            selectedFamily?.head_name || "—",
            description
          )
        : description;
      const finalCategory = isSubscription ? "subscription" : category;

      if (isSubscription && editingCollectionId) {
        const { error: updateError } = await updatePendingCollectionFromAccounts(
          supabase,
          editingCollectionId,
          ctx.masjidId,
          {
            familyId: selectedFamilyId,
            amount: amountNum,
            date,
            notes: description.trim() || null,
          }
        );
        if (updateError) throw updateError;
      } else if (isSubscription && !editingTransaction) {
        const { error: insertError } = await createPendingCollectionFromAccounts(supabase, {
          masjidId: ctx.masjidId,
          userId: authUserId,
          familyId: selectedFamilyId,
          amount: amountNum,
          date,
          notes: description.trim() || null,
        });
        if (insertError) throw insertError;
      } else if (editingTransaction) {
        const { error } = await supabase
          .from("transactions")
          .update({
            amount: amountNum,
            description: finalDescription,
            type: isSubscription ? "income" : type,
            category: finalCategory,
            date,
            masjid_id: ctx.masjidId,
            user_id: authUserId,
            family_id: null,
          })
          .eq("id", editingTransaction.id)
          .eq("masjid_id", ctx.masjidId);

        if (error) throw error;

        if (isSubscription) {
          const { error: syncError } = await syncCollectionForAccountTransaction(supabase, {
            masjidId: ctx.masjidId,
            userId: authUserId,
            familyId: selectedFamilyId,
            amount: amountNum,
            date,
            notes: description.trim() || null,
            transactionId: editingTransaction.id,
          });
          if (syncError) throw syncError;
        } else if (isAccountSubscriptionTransaction(editingTransaction)) {
          await deleteCollectionForAccountTransaction(supabase, editingTransaction.id);
        }
      } else if (!isSubscription) {
        const { error } = await supabase
          .from("transactions")
          .insert([
            {
              amount: amountNum,
              description: finalDescription,
              type,
              category: finalCategory,
              date,
              masjid_id: ctx.masjidId,
              user_id: authUserId,
              family_id: null,
            },
          ]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      const wasEditingPendingCollection = !!editingCollectionId;
      resetForm();
      await fetchData(user);
      if (isSubscription) {
        toast({
          kind: "success",
          title: "சந்தா பதிவு",
          message: wasEditingPendingCollection
            ? "நிலுவையில் உள்ள சந்தா புதுப்பிக்கப்பட்டது"
            : "குடும்பம் உடனே புதுப்பிக்கப்பட்டது — Main account-க்கு batch அனுமதியில் சேரும்",
        });
      }
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
    setEditingCollectionId(null);
  };

  const openPendingCollectionEditor = (collection: PendingAccountCollection) => {
    setEditingTransaction(null);
    setEditingCollectionId(collection.id);
    setType("subscription");
    setAmount(collection.amount.toString());
    setDate(collection.date);
    setSelectedFamilyId(collection.family_id);
    setDescription(extractDirectAccountNote(collection.notes));
    setCategory("");
    setIsModalOpen(true);
  };

  async function deletePendingCollection(id: string) {
    if (!supabase || !user) return;

    const ok = window.confirm("இந்த நிலுவை சந்தாவை நீக்க வேண்டுமா?");
    if (!ok) return;

    try {
      const ctx = tenantContext || (await getTenantContext());
      if (!ctx) throw new Error("Tenant context not available");

      const { error } = await deletePendingCollectionFromAccounts(supabase, id, ctx.masjidId);
      if (error) throw error;

      await fetchData(user);
      toast({
        kind: "success",
        title: "நீக்கப்பட்டது",
        message: "நிலுவை சந்தா நீக்கப்பட்டது",
      });
    } catch (err: any) {
      toast({
        kind: "error",
        title: "Error",
        message: err.message || "Failed to delete pending collection",
      });
    }
  }

  const openTransactionEditor = async (tx: Transaction) => {
    setEditingCollectionId(null);
    setEditingTransaction(tx);
    setAmount(tx.amount.toString());
    setDate(tx.date);
    setCategory(tx.category || "");

    if (isAccountSubscriptionTransaction(tx)) {
      setType("subscription");
      const { data: linked } = await supabase
        .from("subscription_collections")
        .select("family_id, notes")
        .eq("main_transaction_id", tx.id)
        .maybeSingle();
      setSelectedFamilyId(linked?.family_id || tx.family_id || "");
      setDescription(
        linked?.notes ||
          tx.description.replace(/^சந்தா வரவு[^:]*:\s*/i, "").replace(/^Subscription:\s*/i, "")
      );
    } else {
      setType(tx.type === "expense" ? "expense" : "income");
      setDescription(tx.description.replace(/^(Subscription|Income|Expense):\s*/i, ""));
      setSelectedFamilyId(tx.family_id || "");
    }
    setIsModalOpen(true);
  };

  async function deleteTransaction(id: string) {
    console.log("Deleting transaction ID:", id);
    console.log("Current tenant context:", tenantContext);
    if (!supabase || !user) return;

    const ok = window.confirm(t.confirm_delete);
    if (!ok) return;

    try {
      const ctx = tenantContext || await getTenantContext();
      console.log("Final ctx for delete:", ctx);
      if (!ctx) {
        console.error("No tenant context available!");
        throw new Error("Tenant context not available");
      }

      // First log the transaction to verify it exists
      const { data: existingTx, error: fetchError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", id)
        .eq("masjid_id", ctx.masjidId)
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching transaction to delete:", fetchError);
        throw fetchError;
      }

      console.log("Found transaction to delete:", existingTx);

      if (existingTx && isAccountSubscriptionTransaction(existingTx)) {
        const { error: collectionDeleteError } = await deleteCollectionForAccountTransaction(
          supabase,
          id
        );
        if (collectionDeleteError) throw collectionDeleteError;
      }

      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("masjid_id", ctx.masjidId);

      if (error) {
        console.error("Supabase delete error:", error);
        throw error;
      }

      console.log("Transaction deleted successfully!");
      await fetchData(user);
    } catch (err: any) {
      console.error("Full delete error:", err);
      toast({
        kind: "error",
        title: "Error",
        message: err.message || "Failed to delete transaction",
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

      const masjidName = await getPdfMasjidName(supabase, tenantContext?.masjidId);

      const html = `
        <html>
          <head>
            <title>Account Transactions - ${escapePdfHtml(masjidName)}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              h1 { color: #064e3b; text-align: center; margin-bottom: 6px; }
              h2 { text-align: center; margin-top: 0; }
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
              <h1>${escapePdfHtml(masjidName)}</h1>
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
                    <td>${escapePdfHtml(formatTransactionDescription(tx.description, tx.category, tx.family_id))}</td>
                    <td>${escapePdfHtml(tx.category ? formatTransactionCategory(tx.category) : "-")}</td>
                    <td>${escapePdfHtml(tx.type)}</td>
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

  const handleQrDecodedText = (decodedText: string) => {
    if (!decodedText) return;
    console.log("QR scanned:", decodedText);
    setIsScannerOpen(false);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <RouteGuard>
      <AppShell title={t.accounts}>
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
            className="flex-1 py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
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
                        <p className="font-semibold text-neutral-900">{displayDescription(tx)}</p>
                        {tx.category && (
                          <p className="text-sm text-neutral-600">{displayCategory(tx)}</p>
                        )}
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
                            onClick={() => openTransactionEditor(tx)}
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
                        <p className="font-semibold text-neutral-900 mb-1">{displayDescription(tx)}</p>
                        {tx.category && (
                          <p className="text-sm text-neutral-600">{displayCategory(tx)}</p>
                        )}
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
                            onClick={() => openTransactionEditor(tx)}
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

        {pendingAccountCollections.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-black text-amber-700 uppercase tracking-widest ml-1">
              நிலுவையில் உள்ள சந்தா (Main account-க்கு batch-ல் சேரும்)
            </h3>
            {pendingAccountCollections.map((collection) => {
              const family = families.find((f) => f.id === collection.family_id);
              return (
                <div
                  key={collection.id}
                  className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 truncate">
                      {family
                        ? `${family.family_code} — ${family.head_name}`
                        : "குடும்பம்"}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {collection.date} · நிலுவை — batch அனுமதி pending
                    </p>
                    {collection.notes && (
                      <p className="text-xs text-neutral-600 mt-1 truncate">
                        {extractDirectAccountNote(collection.notes)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-lg font-black text-amber-700">
                      Rs. {collection.amount.toLocaleString()}
                    </p>
                    <button
                      onClick={() => openPendingCollectionEditor(collection)}
                      className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deletePendingCollection(collection.id)}
                      className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AppShell>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-neutral-900">
                {editingTransaction || editingCollectionId ? "Edit Transaction" : t.add_transaction}
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
                    required
                    className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">குடும்பம் தேர்ந்தெடுக்கவும்</option>
                    {families.map((family) => (
                      <option key={family.id} value={family.id}>
                        {family.family_code} - {family.head_name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-emerald-600 mt-1">
                    குடும்பம் உடனே புதுப்பிக்கப்படும். Main account-க்கு pending batch அனுமதியில் சேரும் (கமிஷன் இல்லை).
                  </p>
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
                {submitting ? "Saving..." : editingTransaction || editingCollectionId ? "Update" : t.save}
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
    </RouteGuard>
  );
}