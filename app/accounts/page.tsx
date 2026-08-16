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
import { AddTransactionModal } from "@/components/accounts/AddTransactionModal";
import RouteGuard from "@/components/RouteGuard";
import { BrandLoadingScreen } from "@/components/BrandLoadingScreen";
import { EmptyState } from "@/components/EmptyState";
import {
  formatTransactionCategory,
  formatTransactionDescription,
  isAccountSubscriptionTransaction,
  buildDirectSubscriptionDescription,
  syncCollectionForAccountTransaction,
  deleteCollectionForAccountTransaction,
  buildDirectAccountCollectionNotes,
  updatePendingCollectionFromAccounts,
  deletePendingCollectionFromAccounts,
  extractDirectAccountNote,
  isDirectAccountCollection,
  sortFamiliesByCode,
  calculateFamilyBalance,
} from "@/lib/collection-utils";
import { fetchUserNames } from "@/lib/user-utils";

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
  subscription_amount?: number;
  opening_balance?: number;
};

type Staff = {
  id: string;
  name: string;
  role: string;
  monthly_salary?: number | null;
  allowances?: number | null;
  category?: string | null;
};

type PendingAccountCollection = {
  id: string;
  family_id: string;
  amount: number;
  date: string;
  notes?: string | null;
  status: string;
};

type StaffBalance = {
  pendingSalary: number;
  totalDue: number;
  advancesPaid?: number;
  ledgerBalance?: number;
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
  const [staff, setStaff] = useState<Staff[]>([]);
  const [pendingAccountCollections, setPendingAccountCollections] = useState<PendingAccountCollection[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [showReportOptions, setShowReportOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSalaryPayment, setPendingSalaryPayment] = useState<{
    staffId: string;
    staffName: string;
    amount: number;
    date: string;
    category: string;
  } | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState<Language>("en");
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [selectedFamilyId, setSelectedFamilyId] = useState("");

  // Parse permissions and check access (no hooks here)
  const parsedPermissions = parsePermissions(JSON.stringify(tenantContext?.permissions || {}));
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions, tenantContext?.role);
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
        if (!authLoading) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
        }
        return;
      }

      setUser(authUser);

      if (tenantContext?.masjidId) {
        await fetchData(authUser);
      } else if (!authLoading) {
        setLoading(false);
      }
    };

    checkAuth();
  }, [authUser, tenantContext?.masjidId, resumeTick, authLoading]);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);
  
  // Page-level access control (after all hooks)
  if (authLoading) return <BrandLoadingScreen />;
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
        setTransactions([]);
        setFamilies([]);
        setPendingAccountCollections([]);
        return;
      }

      // Run queries in parallel instead of sequentially
      const [transactionsResponse, familiesResponse, staffResponse, pendingCollectionsResponse] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, type, amount, category, description, date, family_id, masjid_id, user_id, created_at")
          .eq("masjid_id", tenantContext.masjidId)
          .order("date", { ascending: false }),
        supabase
          .from("families")
          .select("id, family_code, head_name, subscription_amount, opening_balance")
          .eq("masjid_id", tenantContext.masjidId),
        supabase
          .from("employees")
          .select("id, name, role, monthly_salary, allowances, category")
          .eq("masjid_id", tenantContext.masjidId),
        supabase
          .from("subscription_collections")
          .select("id, family_id, amount, date, notes, status")
          .eq("masjid_id", tenantContext.masjidId)
          .eq("status", "pending"),
      ]);

      if (transactionsResponse.error) throw transactionsResponse.error;
      if (familiesResponse.error) throw familiesResponse.error;
      if (staffResponse.error) throw staffResponse.error;
      if (pendingCollectionsResponse.error) throw pendingCollectionsResponse.error;

      const transactionsList = transactionsResponse.data || [];
      const familiesList = familiesResponse.data || [];
      const staffList = staffResponse.data || [];
      const pendingCollectionsList = pendingCollectionsResponse.data || [];

      // Fetch user names for transactions
      const userIds = Array.from(
        new Set(transactionsList.map((t: any) => t.user_id).filter(Boolean))
      ) as string[];
      
      if (userIds.length > 0) {
        const namesMap = await fetchUserNames(supabase, userIds);
        setUserNames(namesMap);
      }

      setTransactions(transactionsList);
      setFamilies(familiesList);
      setStaff(staffList);
      setPendingAccountCollections(
        ((pendingCollectionsList as PendingAccountCollection[]) || []).filter((c) =>
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

  async function handleSubmit(data: {
    type: "income" | "expense" | "subscription";
    amount: number;
    description: string;
    category: string;
    date: string;
    staffId?: string | null;
    familyId?: string | null;
  }) {
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
      const amountNum = data.amount;
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setErrorMessage("சரியான தொகை உள்ளிடவும்");
        setSubmitting(false);
        return;
      }

      // Show confirmation modal for salary payments
      if (data.type === "expense" && (data.category === "Salary" || data.category === "Advance Salary") && data.staffId) {
        const selectedStaffMember = staff.find((s) => s.id === data.staffId);
        if (selectedStaffMember) {
          setPendingSalaryPayment({
            staffId: data.staffId,
            staffName: selectedStaffMember.name,
            amount: amountNum,
            date: data.date,
            category: data.category,
          });
          setShowConfirmModal(true);
          setSubmitting(false);
          return;
        }
      }

      if (data.type === "subscription" && !data.familyId) {
        toast({
          kind: "error",
          title: "குடும்பம் தேவை",
          message: "சந்தா வரவுக்கு குடும்பத்தைத் தேர்ந்தெடுக்கவும்",
        });
        setSubmitting(false);
        return;
      }

      const selectedFamily = families.find((f) => f.id === data.familyId);
      const isSubscription = data.type === "subscription";

      const finalDescription = isSubscription
        ? buildDirectSubscriptionDescription(
            selectedFamily?.family_code || "—",
            selectedFamily?.head_name || "—",
            data.description
          )
        : data.description;
      const finalCategory = isSubscription ? "subscription" : data.category;

      let addApiResult: { auto_approved?: boolean } | null = null;

      if (isSubscription && editingCollectionId) {
        const { error: updateError } = await updatePendingCollectionFromAccounts(
          supabase,
          editingCollectionId,
          ctx.masjidId,
          {
            familyId: data.familyId,
            amount: amountNum,
            date: data.date,
            notes: data.description.trim() || null,
          }
        );
        if (updateError) throw updateError;
      } else if (isSubscription && !editingTransaction) {
        const response = await fetch("/api/collections/add", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(session.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            family_id: data.familyId,
            collection_amount: amountNum,
            notes: buildDirectAccountCollectionNotes(data.description.trim() || null),
            payment_method: "cash",
            date: data.date,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Failed to create collection");
        }

        addApiResult = result;

        if (result.sms_sent && !result.sms_sent.success) {
          console.error("[accounts/page] auto SMS failed after add", result.sms_sent);
        }
      } else if (editingTransaction) {
        const { error } = await supabase
          .from("transactions")
          .update({
            amount: amountNum,
            description: finalDescription,
            type: isSubscription ? "income" : data.type,
            category: finalCategory,
            date: data.date,
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
            familyId: data.familyId,
            amount: amountNum,
            date: data.date,
            notes: data.description.trim() || null,
            transactionId: editingTransaction.id,
          });
          if (syncError) throw syncError;
        } else if (isAccountSubscriptionTransaction(editingTransaction)) {
          await deleteCollectionForAccountTransaction(supabase, editingTransaction.id);
        }
      } else if (!isSubscription) {
        // Create ledger entry for staff salary payments
        let ledgerError = null;
        if (data.type === "expense" && (data.category === "Salary" || data.category === "Advance Salary") && data.staffId) {
          const { data: currentBalance } = await supabase
            .from("staff_ledger")
            .select("balance_after")
            .eq("staff_id", data.staffId)
            .eq("masjid_id", ctx.masjidId)
            .order("transaction_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const previousBalance = currentBalance?.balance_after || 0;
          const newBalance = previousBalance - amountNum;

          const { error: ledgerInsertError } = await supabase
            .from("staff_ledger")
            .insert([
              {
                masjid_id: ctx.masjidId,
                staff_id: data.staffId,
                transaction_date: data.date,
                transaction_type: "debit",
                amount: amountNum,
                description: `Payment via Accounts module`,
                reference_type: data.category === "Advance Salary" ? "advance_payment" : "salary_payment",
                reference_id: null,
                balance_after: newBalance,
              },
            ]);

          ledgerError = ledgerInsertError;
          if (ledgerError) {
            console.warn("Failed to create ledger entry:", ledgerError);
          }
        }

        const { error } = await supabase
          .from("transactions")
          .insert([
            {
              amount: amountNum,
              description: finalDescription,
              type: data.type,
              category: finalCategory,
              date: data.date,
              masjid_id: ctx.masjidId,
              user_id: authUserId,
              family_id: null,
              staff_id: data.staffId || null,
            },
          ]);

        if (error) throw error;
      }

      setIsModalOpen(false);
      const wasEditingPendingCollection = !!editingCollectionId;
      setEditingTransaction(null);
      setEditingCollectionId(null);
      await fetchData(user);
      if (isSubscription) {
        const autoApprovedNew = !editingCollectionId && addApiResult?.auto_approved === true;
        toast({
          kind: "success",
          title: "சந்தா பதிவு",
          message: editingCollectionId
            ? "நிலுவையில் உள்ள சந்தா புதுப்பிக்கப்பட்டது"
            : autoApprovedNew
              ? "குடும்ப சந்தா நேரடியாக பதிவு செய்யப்பட்டது மற்றும் கணக்கில் சேர்க்கப்பட்டது"
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

  const confirmSalaryPayment = async () => {
    if (!pendingSalaryPayment || !supabase || !user) return;

    setSubmitting(true);
    try {
      const ctx = tenantContext || (await getTenantContext());
      if (!ctx) throw new Error("Tenant context not available");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      const authUserId = session.user.id;
      const isAdvanceSalary = pendingSalaryPayment.category === "Advance Salary";

      // Record as expense in transactions
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert([
          {
            amount: pendingSalaryPayment.amount,
            description: isAdvanceSalary 
              ? `Advance salary for ${pendingSalaryPayment.staffName}`
              : `Salary payment for ${pendingSalaryPayment.staffName}`,
            type: "expense",
            category: isAdvanceSalary ? "Advance Salary" : "Salary",
            date: pendingSalaryPayment.date,
            masjid_id: ctx.masjidId,
            user_id: authUserId,
            family_id: null,
            staff_id: pendingSalaryPayment.staffId,
          },
        ]);

      if (transactionError) throw transactionError;

      if (isAdvanceSalary) {
        // Use give_advance_salary RPC for advance payments
        const { error: advanceError } = await supabase.rpc('give_advance_salary', {
          p_masjid_id: ctx.masjidId,
          p_staff_id: pendingSalaryPayment.staffId,
          p_amount: pendingSalaryPayment.amount,
          p_advance_date: pendingSalaryPayment.date,
          p_notes: description.trim() || null,
        });

        if (advanceError) {
          // If RPC doesn't exist, fall back to manual update
          if (advanceError.code === '42883') {
            const { data: currentStaff } = await supabase
              .from("employees")
              .select("advances_paid")
              .eq("id", pendingSalaryPayment.staffId)
              .eq("masjid_id", ctx.masjidId)
              .single();
            
            const newAdvances = Number(currentStaff?.advances_paid || 0) + pendingSalaryPayment.amount;
            
            const { error: fallbackError } = await supabase
              .from("employees")
              .update({ advances_paid: newAdvances })
              .eq("id", pendingSalaryPayment.staffId)
              .eq("masjid_id", ctx.masjidId);
            
            if (fallbackError) throw fallbackError;
          } else {
            throw advanceError;
          }
        }
      } else {
        // Regular salary payment
        // Record in salary_payments table
        const { error: salaryError } = await supabase
          .from("salary_payments")
          .insert([
            {
              staff_id: pendingSalaryPayment.staffId,
              masjid_id: ctx.masjidId,
              amount: pendingSalaryPayment.amount,
              salary_month: `${new Date(pendingSalaryPayment.date).toISOString().slice(0, 7)}-01`,
              payment_date: pendingSalaryPayment.date,
              notes: description.trim() || null,
            },
          ]);

        if (salaryError) throw salaryError;

        // Create ledger entry (debit for payment)
        const { data: currentBalance } = await supabase
          .from("staff_ledger")
          .select("balance_after")
          .eq("staff_id", pendingSalaryPayment.staffId)
          .eq("masjid_id", ctx.masjidId)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const previousBalance = currentBalance?.balance_after || 0;
        const newBalance = previousBalance - pendingSalaryPayment.amount;

        const { error: ledgerError } = await supabase
          .from("staff_ledger")
          .insert([
            {
              masjid_id: ctx.masjidId,
              staff_id: pendingSalaryPayment.staffId,
              transaction_date: pendingSalaryPayment.date,
              transaction_type: "debit",
              amount: pendingSalaryPayment.amount,
              description: `Salary payment via Accounts module`,
              reference_type: "salary_payment",
              reference_id: null,
              balance_after: newBalance,
            },
          ]);

        if (ledgerError) {
          console.warn("Failed to create ledger entry:", ledgerError);
        }

        // Deduct from pending arrears using RPC
        const { error: updateError } = await supabase.rpc('deduct_pending_arrears', {
          p_staff_id: pendingSalaryPayment.staffId,
          p_masjid_id: ctx.masjidId,
          p_amount: pendingSalaryPayment.amount
        });

        // If RPC doesn't exist, fall back to direct update
        if (updateError && updateError.code === '42883') {
          const { data: currentStaff } = await supabase
            .from("employees")
            .select("pending_arrears")
            .eq("id", pendingSalaryPayment.staffId)
            .eq("masjid_id", ctx.masjidId)
            .single();
          
          const newArrears = Math.max(0, Number(currentStaff?.pending_arrears || 0) - pendingSalaryPayment.amount);
          
          const { error: fallbackError } = await supabase
            .from("employees")
            .update({ pending_arrears: newArrears })
            .eq("id", pendingSalaryPayment.staffId)
            .eq("masjid_id", ctx.masjidId);
          
          if (fallbackError) throw fallbackError;
        } else if (updateError) {
          throw updateError;
        }
      }

      setShowConfirmModal(false);
      setPendingSalaryPayment(null);
      setIsModalOpen(false);
      setEditingTransaction(null);
      setEditingCollectionId(null);
      await fetchData(user);
      
      toast({
        kind: "success",
        title: isAdvanceSalary ? "Advance Salary Given" : "Salary Paid",
        message: isAdvanceSalary
          ? `Advance salary of Rs. ${pendingSalaryPayment.amount.toLocaleString()} recorded for ${pendingSalaryPayment.staffName}. Advances balance updated.`
          : `Salary payment of Rs. ${pendingSalaryPayment.amount.toLocaleString()} recorded for ${pendingSalaryPayment.staffName}. Pending arrears updated.`,
      });
    } catch (err: any) {
      console.error("Salary payment error:", err);
      toast({
        kind: "error",
        title: "Payment Failed",
        message: err.message || "Failed to process salary payment",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openPendingCollectionEditor = (collection: PendingAccountCollection) => {
    setSelectedFamilyId(collection.family_id);
    setEditingTransaction(null);
    setEditingCollectionId(collection.id);
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
              .close-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #047857;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
              }
              .close-btn:hover {
                background: #065f46;
              }
              @media print {
                .close-btn { display: none; }
              }
            </style>
          </head>
          <body>
            <button class="close-btn" onclick="window.close()">Close</button>
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
    return (
      <RouteGuard>
        <AppShell title={t.accounts}>
          <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
            <p className="text-sm font-medium text-neutral-500">Loading accounts...</p>
          </div>
        </AppShell>
      </RouteGuard>
    );
  }

  return (
    <RouteGuard>
      <AppShell title={t.accounts}>
        <div className="flex flex-col gap-6">
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
              setEditingTransaction(null);
              setEditingCollectionId(null);
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
            <EmptyState
              title={searchQuery ? "No transactions found" : "No transactions yet"}
              description={
                searchQuery
                  ? "Try a different search term or clear the search bar."
                  : "Your account ledger is empty. Add your first income, expense, or subscription entry."
              }
              icon={<Wallet className="h-7 w-7" />}
              action={
                !searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTransaction(null);
                      setEditingCollectionId(null);
                      setIsModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                  >
                    <Plus className="h-4 w-4" />
                    {t.add_transaction}
                  </button>
                ) : undefined
              }
            />
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
                        {tx.user_id && userNames[tx.user_id] && (
                          <p className="text-xs text-neutral-500">By: {userNames[tx.user_id]}</p>
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
                        {tx.user_id && userNames[tx.user_id] && (
                          <p className="text-xs text-neutral-500">By: {userNames[tx.user_id]}</p>
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
        </div>
      </AppShell>

      <AddTransactionModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        editingTransaction={editingTransaction}
        editingCollectionId={editingCollectionId}
        masjidId={tenantContext?.masjidId || ""}
        staff={staff}
        families={families}
      />

      {isScannerOpen && (
        <QrScannerModal
          open={isScannerOpen}
          title="Scan QR Code"
          containerId="qr-scanner"
          onClose={() => setIsScannerOpen(false)}
          onDecodedText={handleQrDecodedText}
        />
      )}

      {showConfirmModal && pendingSalaryPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-black text-neutral-900 mb-4">Confirm Salary Payment</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Staff Member:</span>
                <span className="font-semibold text-neutral-900">{pendingSalaryPayment.staffName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Amount:</span>
                <span className="font-bold text-emerald-700">Rs. {pendingSalaryPayment.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Payment Date:</span>
                <span className="font-semibold text-neutral-900">{new Date(pendingSalaryPayment.date).toLocaleDateString()}</span>
              </div>
            </div>
            <p className="text-sm text-neutral-600 mb-6">
              This will record the salary payment as an expense in the Accounts module and update the staff's payment history.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingSalaryPayment(null);
                }}
                disabled={submitting}
                className="flex-1 py-3 border-2 border-neutral-200 rounded-2xl font-bold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmSalaryPayment}
                disabled={submitting}
                className="flex-1 py-3 bg-emerald-600 rounded-2xl font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {submitting ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RouteGuard>
  );
}