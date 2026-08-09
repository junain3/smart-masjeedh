"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Building2, CalendarDays, CreditCard, RefreshCw, Shield, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAppToast } from "@/components/ToastProvider";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { AdvanceSalaryModal } from "@/components/staff/AdvanceSalaryModal";
import { CustomCreditModal } from "@/components/staff/CustomCreditModal";
import { PaySalaryModal } from "@/components/staff/PaySalaryModal";
import { SalaryHistoryTable, type SalaryHistoryRow } from "@/components/staff/SalaryHistoryTable";
import { StaffLedgerTable, type LedgerRow } from "@/components/staff/StaffLedgerTable";
import { StaffProfileCard } from "@/components/staff/StaffProfileCard";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { hasModulePermission, isSuperAdmin, parsePermissions } from "@/lib/permissions-utils";

type StaffDetail = {
  id: string;
  masjid_id: string;
  name: string;
  phone?: string | null;
  role: string;
  monthly_salary?: number | null;
  allowances?: number | null;
  category?: string | null;
  access_permissions?: { edit_salary?: boolean; view_reports?: boolean } | null;
  status?: string | null;
  created_at?: string | null;
  designation?: string | null;
  term_start?: string | null;
  term_end?: string | null;
  pending_arrears?: number | null;
  advances_paid?: number | null;
};

type MasjidSummary = {
  id: string;
  masjid_name?: string | null;
};

type ViewState = "loading" | "ready" | "not_found" | "unauthorized" | "error";

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function StaffDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const staffId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { toast } = useAppToast();
  const { user, loading: authLoading, tenantContext } = useSupabaseAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [unauthorizedMessage, setUnauthorizedMessage] = useState("");
  const [historyWarning, setHistoryWarning] = useState("");
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [masjid, setMasjid] = useState<MasjidSummary | null>(null);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryRow[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerRow[]>([]);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isCustomCreditModalOpen, setIsCustomCreditModalOpen] = useState(false);
  const [payingSalary, setPayingSalary] = useState(false);
  const [givingAdvance, setGivingAdvance] = useState(false);
  const [postingCredit, setPostingCredit] = useState(false);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; balance: number }>>([]);
  const [viewState, setViewState] = useState<ViewState>("loading");

  const parsedPermissions = parsePermissions(JSON.stringify(tenantContext?.permissions || {}));
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions, tenantContext?.role);
  const canManageStaff = hasModulePermission(parsedPermissions, "staff_management");
  const canManageAccounts = hasModulePermission(parsedPermissions, "accounts");
  const canManageSalary =
    userIsSuperAdmin ||
    tenantContext?.role === "super_admin" ||
    tenantContext?.role === "co_admin" ||
    canManageStaff ||
    canManageAccounts ||
    Boolean(staff?.access_permissions?.edit_salary);

  const canViewReports =
    userIsSuperAdmin ||
    hasModulePermission(parsedPermissions, "reports") ||
    Boolean(staff?.access_permissions?.view_reports);

  const totalSalaryPaid = useMemo(
    () => salaryHistory.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [salaryHistory]
  );

  const latestPayment = salaryHistory[0];

  const resolveTenant = async () => {
    const ctx = tenantContext || (await getTenantContext());
    if (!ctx?.masjidId) {
      throw new Error("Masjid context is not available. Please sign in again.");
    }
    return ctx;
  };

  const loadStaffDetail = async (showRefreshingState = false) => {
    if (!staffId || !supabase) return;

    if (showRefreshingState) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setViewState("loading");
    }

    setError("");
    setUnauthorizedMessage("");
    setHistoryWarning("");

    try {
      const ctx = await resolveTenant();

      console.log("[StaffDetail] Route staffId:", staffId);
      console.log("[StaffDetail] Current tenant masjidId:", ctx.masjidId);

      const { data: staffRow, error: staffError } = await supabase
        .from("employees")
        .select("id, masjid_id, name, phone, role, monthly_salary, allowances, category, access_permissions, created_at, designation, term_start, term_end, pending_arrears, advances_paid")
        .eq("id", staffId)
        .maybeSingle();

      console.log("[StaffDetail] Raw employee response without masjid filter:", {
        staffId,
        currentMasjidId: ctx.masjidId,
        data: staffRow,
        error: staffError,
      });

      if (staffError) throw staffError;

      if (!staffRow) {
        setStaff(null);
        setMasjid(null);
        setSalaryHistory([]);
        setViewState("not_found");
        return;
      }

      if (staffRow.masjid_id !== ctx.masjidId) {
        console.warn("[StaffDetail] Tenant mismatch detected:", {
          staffId,
          currentMasjidId: ctx.masjidId,
          staffMasjidId: staffRow.masjid_id,
        });

        setStaff(null);
        setMasjid(null);
        setSalaryHistory([]);
        setUnauthorizedMessage(
          "This staff record belongs to a different mosque than the one currently selected."
        );
        setViewState("unauthorized");
        return;
      }

      const [
        { data: masjidRow, error: masjidError },
        { data: salaryRows, error: salaryError },
        { data: accountsData, error: accountsError },
        { data: ledgerData, error: ledgerError },
      ] = await Promise.all([
        supabase
          .from("masjids")
          .select("id, masjid_name")
          .eq("id", staffRow.masjid_id)
          .maybeSingle(),
        supabase
          .from("salary_payments")
          .select("id, amount, salary_month, payment_date, notes, finance_transaction_id")
          .eq("staff_id", staffId)
          .eq("masjid_id", staffRow.masjid_id)
          .order("payment_date", { ascending: false }),
        supabase
          .from("accounts")
          .select("id, name, balance")
          .eq("masjid_id", staffRow.masjid_id)
          .eq("is_active", true),
        supabase
          .from("staff_ledger")
          .select("*")
          .eq("staff_id", staffId)
          .eq("masjid_id", staffRow.masjid_id)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);

      if (masjidError) throw masjidError;

      setStaff({ ...staffRow, status: (staffRow as any)?.status || 'active' } as StaffDetail);
      setMasjid((masjidRow as MasjidSummary) || null);
      setAccounts((accountsData as Array<{ id: string; name: string; balance: number }>) || []);
      setViewState("ready");

      if (salaryError) {
        if (salaryError.code === "42P01") {
          setSalaryHistory([]);
          setHistoryWarning(
            "The `salary_payments` table is not available yet. Run the staff salary migration to enable payment history."
          );
        } else {
          throw salaryError;
        }
      } else {
        setSalaryHistory((salaryRows as SalaryHistoryRow[]) || []);
      }

      if (ledgerError) {
        if (ledgerError.code === "42P01") {
          setLedgerEntries([]);
        } else {
          console.warn("Failed to load ledger entries:", ledgerError);
          setLedgerEntries([]);
        }
      } else {
        setLedgerEntries((ledgerData as LedgerRow[]) || []);
      }
    } catch (err: any) {
      console.error("Failed to load staff detail:", err);
      setStaff(null);
      setMasjid(null);
      setSalaryHistory([]);
      setLedgerEntries([]);
      setError(err.message || "Failed to load staff details.");
      setViewState("error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user || !staffId) return;
    void loadStaffDetail();
  }, [user, staffId, tenantContext?.masjidId, canManageSalary]);

  const handlePaySalary = async (input: {
    amount: number;
    salaryMonth: string;
    paymentDate: string;
    notes: string;
  }) => {
    if (!staff) return;

    if (!canManageSalary) {
      toast({
        kind: "error",
        title: "Access Denied",
        message: "You do not have permission to create salary payments.",
      });
      return;
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      toast({
        kind: "error",
        title: "Validation Error",
        message: "Salary amount must be greater than zero.",
      });
      return;
    }

    if (!input.salaryMonth) {
      toast({
        kind: "error",
        title: "Validation Error",
        message: "Please select the salary month.",
      });
      return;
    }

    setPayingSalary(true);

    try {
      const ctx = await resolveTenant();

      // Check for duplicate payment for the same month
      const { data: existingPayment } = await supabase
        .from("salary_payments")
        .select("id")
        .eq("staff_id", staff.id)
        .eq("masjid_id", ctx.masjidId)
        .eq("salary_month", `${input.salaryMonth}-01`)
        .single();

      if (existingPayment) {
        toast({
          kind: "error",
          title: "Duplicate Payment",
          message: `Salary for ${input.salaryMonth} has already been paid to ${staff.name}.`,
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      const authUserId = session.user.id;

      // Record transaction
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert([
          {
            amount: input.amount,
            description: `Salary payment to ${staff.name}`,
            type: "expense",
            category: "Salary",
            date: input.paymentDate,
            masjid_id: ctx.masjidId,
            user_id: authUserId,
            family_id: null,
            staff_id: staff.id,
          },
        ]);

      if (transactionError) throw transactionError;

      // Record salary payment
      const { data: salaryPaymentData, error: salaryError } = await supabase
        .from("salary_payments")
        .insert([
          {
            staff_id: staff.id,
            masjid_id: ctx.masjidId,
            amount: input.amount,
            salary_month: `${input.salaryMonth}-01`,
            payment_date: input.paymentDate,
            notes: input.notes || null,
          },
        ])
        .select()
        .single();

      if (salaryError) throw salaryError;

      // Create ledger entry (debit for payment)
      const { data: currentBalance } = await supabase
        .from("staff_ledger")
        .select("balance_after")
        .eq("staff_id", staff.id)
        .eq("masjid_id", ctx.masjidId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const previousBalance = currentBalance?.balance_after || 0;
      const newBalance = previousBalance - input.amount;

      const { error: ledgerError } = await supabase
        .from("staff_ledger")
        .insert([
          {
            masjid_id: ctx.masjidId,
            staff_id: staff.id,
            transaction_date: input.paymentDate,
            transaction_type: "debit",
            amount: input.amount,
            description: `Salary payment for ${input.salaryMonth}`,
            reference_type: "salary_payment",
            reference_id: salaryPaymentData.id,
            balance_after: newBalance,
            created_by: authUserId,
          },
        ]);

      if (ledgerError) {
        console.warn("Failed to create ledger entry:", ledgerError);
      }

      // Deduct from pending arrears using RPC
      const { error: updateError } = await supabase.rpc('deduct_pending_arrears', {
        p_staff_id: staff.id,
        p_masjid_id: ctx.masjidId,
        p_amount: input.amount
      });

      // If RPC doesn't exist, fall back to direct update
      if (updateError && updateError.code === '42883') {
        const { data: currentStaff } = await supabase
          .from("employees")
          .select("pending_arrears")
          .eq("id", staff.id)
          .eq("masjid_id", ctx.masjidId)
          .single();
        
        const newArrears = Math.max(0, Number(currentStaff?.pending_arrears || 0) - input.amount);
        
        const { error: fallbackError } = await supabase
          .from("employees")
          .update({ pending_arrears: newArrears })
          .eq("id", staff.id)
          .eq("masjid_id", ctx.masjidId);
        
        if (fallbackError) throw fallbackError;
      } else if (updateError) {
        throw updateError;
      }

      setIsPayModalOpen(false);
      toast({
        kind: "success",
        title: "Salary Paid",
        message: `Salary payment of Rs. ${Number(input.amount).toLocaleString()} recorded for ${staff.name}. Pending arrears updated.`,
      });

      await loadStaffDetail(true);
    } catch (err: any) {
      toast({
        kind: "error",
        title: "Payment Failed",
        message: err.message || "Failed to process salary payment.",
      });
    } finally {
      setPayingSalary(false);
    }
  };

  const handleGiveAdvance = async (input: {
    amount: number;
    advanceDate: string;
    notes: string;
    accountId?: string | null;
  }) => {
    if (!staff) return;

    if (!canManageSalary) {
      toast({
        kind: "error",
        title: "Access Denied",
        message: "You do not have permission to give advance salary.",
      });
      return;
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      toast({
        kind: "error",
        title: "Validation Error",
        message: "Advance amount must be greater than zero.",
      });
      return;
    }

    setGivingAdvance(true);

    try {
      const ctx = await resolveTenant();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      const authUserId = session.user.id;

      // Record transaction
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert([
          {
            amount: input.amount,
            description: `Advance salary to ${staff.name}`,
            type: "expense",
            category: "Advance Salary",
            date: input.advanceDate,
            masjid_id: ctx.masjidId,
            user_id: authUserId,
            family_id: null,
            staff_id: staff.id,
          },
        ]);

      if (transactionError) throw transactionError;

      // Update employee advances_paid
      const { data: currentStaff } = await supabase
        .from("employees")
        .select("advances_paid")
        .eq("id", staff.id)
        .eq("masjid_id", ctx.masjidId)
        .single();

      const newAdvances = Number(currentStaff?.advances_paid || 0) + input.amount;

      const { error: updateError } = await supabase
        .from("employees")
        .update({ advances_paid: newAdvances })
        .eq("id", staff.id)
        .eq("masjid_id", ctx.masjidId);

      if (updateError) throw updateError;

      // Record in salary_advances table
      const { data: advanceData, error: advanceError } = await supabase
        .from("salary_advances")
        .insert([
          {
            masjid_id: ctx.masjidId,
            staff_id: staff.id,
            amount: input.amount,
            advance_date: input.advanceDate,
            notes: input.notes || null,
            paid_by_user_id: authUserId,
          },
        ])
        .select()
        .single();

      if (advanceError) {
        // If salary_advances table doesn't exist, just log warning
        console.warn("salary_advances table not available:", advanceError);
      }

      // Create repayment schedule if enabled
      if (input.enableRepaymentSchedule && input.monthlyDeduction && input.repaymentStartMonth && input.repaymentEndMonth && advanceData?.id) {
        const { error: scheduleError } = await supabase.rpc('create_advance_repayment_schedule', {
          p_masjid_id: ctx.masjidId,
          p_staff_id: staff.id,
          p_advance_id: advanceData.id,
          p_total_amount: input.amount,
          p_monthly_deduction: input.monthlyDeduction,
          p_start_month: `${input.repaymentStartMonth}-01`,
          p_end_month: `${input.repaymentEndMonth}-01`
        });

        if (scheduleError) {
          console.warn("Failed to create repayment schedule:", scheduleError);
        }
      }

      // Create ledger entry (debit for advance payment)
      const { data: currentBalance } = await supabase
        .from("staff_ledger")
        .select("balance_after")
        .eq("staff_id", staff.id)
        .eq("masjid_id", ctx.masjidId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const previousBalance = currentBalance?.balance_after || 0;
      const newBalance = previousBalance - input.amount;

      const { error: ledgerError } = await supabase
        .from("staff_ledger")
        .insert([
          {
            masjid_id: ctx.masjidId,
            staff_id: staff.id,
            transaction_date: input.advanceDate,
            transaction_type: "debit",
            amount: input.amount,
            description: `Advance salary payment`,
            reference_type: "advance_payment",
            reference_id: null,
            balance_after: newBalance,
            created_by: authUserId,
          },
        ]);

      if (ledgerError) {
        console.warn("Failed to create ledger entry:", ledgerError);
      }

      setIsAdvanceModalOpen(false);
      toast({
        kind: "success",
        title: "Advance Given",
        message: `Advance salary of Rs. ${Number(input.amount).toLocaleString()} recorded for ${staff.name}. Total advances: Rs. ${newAdvances.toLocaleString()}.`,
      });

      await loadStaffDetail(true);
    } catch (err: any) {
      toast({
        kind: "error",
        title: "Advance Failed",
        message: err.message || "Failed to process advance salary.",
      });
    } finally {
      setGivingAdvance(false);
    }
  };

  const handlePostMonthlySalary = async (salaryMonth: string) => {
    if (!staff || !staff.monthly_salary) return;

    if (!canManageSalary) {
      toast({
        kind: "error",
        title: "Access Denied",
        message: "You do not have permission to post salary credits.",
      });
      return;
    }

    try {
      const ctx = await resolveTenant();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      const authUserId = session.user.id;

      // Check if credit already exists for this month
      const { data: existingCredit } = await supabase
        .from("staff_ledger")
        .select("id")
        .eq("staff_id", staff.id)
        .eq("masjid_id", ctx.masjidId)
        .eq("reference_type", "monthly_salary_credit")
        .eq("transaction_date", `${salaryMonth}-01`)
        .single();

      if (existingCredit) {
        toast({
          kind: "error",
          title: "Duplicate Credit",
          message: `Salary credit for ${salaryMonth} has already been posted.`,
        });
        return;
      }

      // Get current balance
      const { data: currentBalance } = await supabase
        .from("staff_ledger")
        .select("balance_after")
        .eq("staff_id", staff.id)
        .eq("masjid_id", ctx.masjidId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const previousBalance = currentBalance?.balance_after || 0;
      const newBalance = previousBalance + staff.monthly_salary;

      // Create ledger entry (credit for monthly salary due)
      const { error: ledgerError } = await supabase
        .from("staff_ledger")
        .insert([
          {
            masjid_id: ctx.masjidId,
            staff_id: staff.id,
            transaction_date: `${salaryMonth}-01`,
            transaction_type: "credit",
            amount: staff.monthly_salary,
            description: `Monthly salary credit for ${salaryMonth}`,
            reference_type: "monthly_salary_credit",
            reference_id: null,
            balance_after: newBalance,
            created_by: authUserId,
          },
        ]);

      if (ledgerError) throw ledgerError;

      toast({
        kind: "success",
        title: "Salary Credit Posted",
        message: `Monthly salary credit of Rs. ${Number(staff.monthly_salary).toLocaleString()} posted for ${salaryMonth}.`,
      });

      await loadStaffDetail(true);
    } catch (err: any) {
      toast({
        kind: "error",
        title: "Credit Failed",
        message: err.message || "Failed to post salary credit.",
      });
    }
  };

  const handlePostCustomCredit = async (input: {
    amount: number;
    creditType: string;
    description: string;
    creditDate: string;
    notes: string;
  }) => {
    if (!staff) return;

    if (!canManageSalary) {
      toast({
        kind: "error",
        title: "Access Denied",
        message: "You do not have permission to post custom credits.",
      });
      return;
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      toast({
        kind: "error",
        title: "Validation Error",
        message: "Credit amount must be greater than zero.",
      });
      return;
    }

    setPostingCredit(true);

    try {
      const ctx = await resolveTenant();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not authenticated");

      const authUserId = session.user.id;

      // Use RPC to post custom credit
      const { error: creditError } = await supabase.rpc('post_custom_credit', {
        p_masjid_id: ctx.masjidId,
        p_staff_id: staff.id,
        p_amount: input.amount,
        p_credit_type: input.creditType,
        p_description: input.description,
        p_credit_date: input.creditDate,
        p_notes: input.notes || null
      });

      if (creditError) {
        // If RPC doesn't exist, fall back to direct insert
        console.warn("post_custom_credit RPC not available, using direct insert:", creditError);
        
        const { data: currentBalance } = await supabase
          .from("staff_ledger")
          .select("balance_after")
          .eq("staff_id", staff.id)
          .eq("masjid_id", ctx.masjidId)
          .order("transaction_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const previousBalance = currentBalance?.balance_after || 0;
        const newBalance = previousBalance + input.amount;

        const { error: ledgerError } = await supabase
          .from("staff_ledger")
          .insert([
            {
              masjid_id: ctx.masjidId,
              staff_id: staff.id,
              transaction_date: input.creditDate,
              transaction_type: "credit",
              amount: input.amount,
              description: `${input.description} (${input.creditType})`,
              reference_type: "custom_credit",
              reference_id: null,
              balance_after: newBalance,
              created_by: authUserId,
            },
          ]);

        if (ledgerError) throw ledgerError;
      }

      setIsCustomCreditModalOpen(false);
      toast({
        kind: "success",
        title: "Credit Posted",
        message: `${input.creditType} of Rs. ${Number(input.amount).toLocaleString()} posted for ${staff.name}.`,
      });

      await loadStaffDetail(true);
    } catch (err: any) {
      toast({
        kind: "error",
        title: "Credit Failed",
        message: err.message || "Failed to post custom credit.",
      });
    } finally {
      setPostingCredit(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppShell title="Staff Detail" backHref="/staff">
        <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="text-sm font-medium text-neutral-600">Loading staff profile...</p>
        </div>
      </AppShell>
    );
  }

  if (!user) return null;

  if (viewState === "unauthorized") {
    return (
      <AppShell title="Staff Detail" backHref="/staff">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-amber-600" />
            <div>
              <h2 className="text-lg font-black text-amber-900">Unauthorized</h2>
              <p className="mt-1 text-sm text-amber-800">
                {unauthorizedMessage || "You cannot access this staff record from the current mosque context."}
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (viewState === "error") {
    return (
      <AppShell title="Staff Detail" backHref="/staff">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h2 className="text-lg font-black text-red-900">Failed To Load Staff Detail</h2>
              <p className="mt-1 text-sm text-red-800">
                {error || "An unexpected error occurred while loading this staff record."}
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (viewState === "not_found" || !staff) {
    return (
      <AppShell title="Staff Detail" backHref="/staff">
        <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-neutral-300" />
          <h2 className="text-lg font-black text-neutral-900">Staff Member Not Found</h2>
          <p className="mt-2 text-sm text-neutral-500">
            The requested staff record could not be found, or access is blocked by row-level security.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <>
      <AppShell
        title="Staff Detail"
        backHref="/staff"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/accounts"
              className="hidden rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 sm:inline-flex"
            >
              Accounts
            </Link>
            <button
              type="button"
              onClick={() => void loadStaffDetail(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        }
      >
        <div className="space-y-6">
          {error && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Failed to load staff detail</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-neutral-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
              <div className="inline-flex items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-2">
                <ArrowLeft className="h-4 w-4 text-neutral-400" />
                <span>Staff Directory</span>
              </div>
              <span className="text-neutral-300">/</span>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700">
                <Building2 className="h-4 w-4" />
                <span>{staff.name}</span>
              </div>
            </div>
          </div>

          <StaffProfileCard
            name={staff.name}
            role={staff.role}
            phone={staff.phone}
            monthlySalary={staff.monthly_salary}
            allowances={staff.allowances}
            status={staff.status}
            category={staff.category}
            accessPermissions={staff.access_permissions}
            masjidName={masjid?.masjid_name || tenantContext?.masjidId}
            joinedAt={staff.created_at}
            canManageSalary={canManageSalary && (staff.category || "Employee") === "Employee"}
            onPaySalary={() => setIsPayModalOpen(true)}
            onGiveAdvance={() => setIsAdvanceModalOpen(true)}
            designation={staff.designation}
            termStart={staff.term_start}
            termEnd={staff.term_end}
            pendingArrears={staff.pending_arrears}
            advancesPaid={staff.advances_paid}
          />

          {!canViewReports && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Reporting access is currently restricted for this staff member.
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-neutral-500">Salary Payments</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-neutral-900">{salaryHistory.length}</p>
                </div>
                <div className="rounded-2xl bg-emerald-100 p-2 sm:p-3 text-emerald-700">
                  <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-neutral-500">Total Paid</p>
                  <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-700">
                    {formatCurrency(totalSalaryPaid)}
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-100 p-2 sm:p-3 text-blue-700">
                  <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-sm sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-neutral-500">Last Payment Date</p>
                  <p className="mt-2 text-base sm:text-lg font-black text-neutral-900">
                    {latestPayment ? formatDate(latestPayment.payment_date) : "Not paid yet"}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-100 p-2 sm:p-3 text-amber-700">
                  <CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
              </div>
            </div>
          </section>

          {canManageSalary ? (
            <>
              <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-sm">
                <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-neutral-900">Financial Ledger</h2>
                    <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                      Credit/Debit ledger with running balance. Positive = dues owed, Negative = overpaid.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                    {staff.monthly_salary && (
                      <div className="flex items-center gap-2">
                        <input
                          type="month"
                          id="creditMonth"
                          defaultValue={new Date().toISOString().slice(0, 7)}
                          className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const monthInput = document.getElementById('creditMonth') as HTMLInputElement;
                            if (monthInput?.value) {
                              void handlePostMonthlySalary(monthInput.value);
                            }
                          }}
                          className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-4 py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-blue-700"
                        >
                          Post Credit
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCustomCreditModalOpen(true)}
                      className="inline-flex items-center justify-center rounded-2xl bg-purple-600 px-4 py-2 text-xs sm:text-sm font-bold text-white transition hover:bg-purple-700"
                    >
                      Custom Credit
                    </button>
                  </div>
                </div>
                <StaffLedgerTable rows={ledgerEntries} loading={refreshing} />
              </section>

              <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-sm">
                <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-neutral-900">Salary Management</h2>
                    <p className="mt-1 text-xs sm:text-sm text-neutral-500">
                      Monthly salary history with finance integration into the Accounts module.
                    </p>
                  </div>

                  {(staff.category || "Employee") === "Employee" && (
                    <button
                      type="button"
                      onClick={() => setIsPayModalOpen(true)}
                      className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-white transition hover:bg-emerald-700"
                    >
                      Pay Salary
                    </button>
                  )}
                </div>

                {historyWarning && (
                  <div className="mb-4 sm:mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-4 text-xs sm:text-sm text-amber-800">
                    {historyWarning}
                  </div>
                )}

                <SalaryHistoryTable rows={salaryHistory} loading={refreshing} />
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-black text-amber-900">Profile view only</h2>
              <p className="mt-2 text-xs sm:text-sm text-amber-800">
                Salary payments and management actions are restricted for your role, but the staff profile details remain available.
              </p>
            </section>
          )}
        </div>
      </AppShell>

      <PaySalaryModal
        open={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        onSubmit={handlePaySalary}
        submitting={payingSalary}
        defaultAmount={staff.monthly_salary}
        currentBalance={ledgerEntries[0]?.balance_after || 0}
        accounts={accounts}
      />

      <AdvanceSalaryModal
        open={isAdvanceModalOpen}
        onClose={() => setIsAdvanceModalOpen(false)}
        onSubmit={handleGiveAdvance}
        submitting={givingAdvance}
        currentAdvances={staff.advances_paid}
        accounts={accounts}
      />

      <CustomCreditModal
        open={isCustomCreditModalOpen}
        onClose={() => setIsCustomCreditModalOpen(false)}
        onSubmit={handlePostCustomCredit}
        submitting={postingCredit}
      />
    </>
  );
}
