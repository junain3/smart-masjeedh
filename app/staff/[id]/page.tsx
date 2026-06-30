"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Building2, CalendarDays, CreditCard, RefreshCw, Shield, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAppToast } from "@/components/ToastProvider";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { PaySalaryModal } from "@/components/staff/PaySalaryModal";
import { SalaryHistoryTable, type SalaryHistoryRow } from "@/components/staff/SalaryHistoryTable";
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
  status?: string | null;
  created_at?: string | null;
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
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingSalary, setPayingSalary] = useState(false);
  const [viewState, setViewState] = useState<ViewState>("loading");

  const parsedPermissions = parsePermissions(JSON.stringify(tenantContext?.permissions || {}));
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);
  const canManageStaff = hasModulePermission(parsedPermissions, "staff_management");
  const canManageAccounts = hasModulePermission(parsedPermissions, "accounts");
  const canManageSalary =
    userIsSuperAdmin ||
    tenantContext?.role === "super_admin" ||
    tenantContext?.role === "co_admin" ||
    canManageStaff ||
    canManageAccounts;

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

      if (!canManageSalary) {
        throw new Error("You do not have permission to view salary details for staff members.");
      }

      console.log("[StaffDetail] Route staffId:", staffId);
      console.log("[StaffDetail] Current tenant masjidId:", ctx.masjidId);

      const { data: staffRow, error: staffError } = await supabase
        .from("employees")
        .select("id, masjid_id, name, phone, role, monthly_salary, status, created_at")
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
      ]);

      if (masjidError) throw masjidError;

      setStaff(staffRow as StaffDetail);
      setMasjid((masjidRow as MasjidSummary) || null);
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
    } catch (err: any) {
      console.error("Failed to load staff detail:", err);
      setStaff(null);
      setMasjid(null);
      setSalaryHistory([]);
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

      const { error: rpcError } = await supabase.rpc("pay_staff_salary", {
        p_masjid_id: ctx.masjidId,
        p_staff_id: staff.id,
        p_amount: input.amount,
        p_salary_month: `${input.salaryMonth}-01`,
        p_payment_date: input.paymentDate,
        p_notes: input.notes || null,
      });

      if (rpcError) {
        if (rpcError.code === "42883") {
          throw new Error(
            "The `pay_staff_salary` database function is not installed yet. Run the staff salary SQL file first."
          );
        }
        throw rpcError;
      }

      setIsPayModalOpen(false);
      toast({
        kind: "success",
        title: "Salary Paid",
        message: `Salary payment recorded for ${staff.name} and synced to Accounts.`,
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

  if (!canManageSalary) {
    return (
      <AppShell title="Staff Detail" backHref="/staff">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 text-red-600" />
            <div>
              <h2 className="text-lg font-black text-red-900">Access Restricted</h2>
              <p className="mt-1 text-sm text-red-700">
                Only authorized admin users can view salary details and create salary payments.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

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
            status={staff.status}
            masjidName={masjid?.masjid_name || tenantContext?.masjidId}
            joinedAt={staff.created_at}
            canManageSalary={canManageSalary}
            onPaySalary={() => setIsPayModalOpen(true)}
          />

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Salary Payments</p>
                  <p className="mt-2 text-3xl font-black text-neutral-900">{salaryHistory.length}</p>
                </div>
                <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                  <Wallet className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Total Paid</p>
                  <p className="mt-2 text-3xl font-black text-emerald-700">
                    {formatCurrency(totalSalaryPaid)}
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Last Payment Date</p>
                  <p className="mt-2 text-lg font-black text-neutral-900">
                    {latestPayment ? formatDate(latestPayment.payment_date) : "Not paid yet"}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                  <CalendarDays className="h-6 w-6" />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-neutral-900">Salary Management</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Monthly salary history with finance integration into the Accounts module.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsPayModalOpen(true)}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Pay Salary
              </button>
            </div>

            {historyWarning && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                {historyWarning}
              </div>
            )}

            <SalaryHistoryTable rows={salaryHistory} loading={refreshing} />
          </section>
        </div>
      </AppShell>

      <PaySalaryModal
        open={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        onSubmit={handlePaySalary}
        submitting={payingSalary}
        defaultAmount={staff.monthly_salary}
      />
    </>
  );
}
