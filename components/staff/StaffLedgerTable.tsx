"use client";

import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export type LedgerRow = {
  id: string;
  transaction_date: string;
  transaction_type: "credit" | "debit";
  amount: number;
  description: string;
  reference_type: string;
  balance_after: number;
  created_at: string;
};

type StaffLedgerTableProps = {
  rows: LedgerRow[];
  loading?: boolean;
};

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getBalanceColor(balance: number): string {
  if (balance > 0) return "text-emerald-700";
  if (balance < 0) return "text-red-700";
  return "text-neutral-700";
}

function getBalanceBg(balance: number): string {
  if (balance > 0) return "bg-emerald-50";
  if (balance < 0) return "bg-red-50";
  return "bg-neutral-50";
}

export function StaffLedgerTable({ rows, loading = false }: StaffLedgerTableProps) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center text-sm font-medium text-neutral-500">
        Loading ledger...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
        <ArrowDownCircle className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
        <h3 className="text-lg font-bold text-neutral-900">No ledger entries yet</h3>
        <p className="mt-2 text-sm text-neutral-500">
          Ledger entries will appear here once salary credits or payments are recorded.
        </p>
      </div>
    );
  }

  const currentBalance = rows[0]?.balance_after || 0;

  return (
    <div className="space-y-4">
      {/* Current Balance Card */}
      <div className={`rounded-3xl border p-4 sm:p-6 ${getBalanceBg(currentBalance)} border-${currentBalance > 0 ? 'emerald' : currentBalance < 0 ? 'red' : 'neutral'}-200`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-neutral-600">Net Balance</p>
            <p className={`mt-2 text-2xl sm:text-3xl font-black ${getBalanceColor(currentBalance)}`}>
              {currentBalance >= 0 ? "+" : ""}{formatCurrency(currentBalance)}
            </p>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600">
              {currentBalance > 0 ? "Salary dues owed to staff" : currentBalance < 0 ? "Staff has been overpaid" : "Balance is zero"}
            </p>
          </div>
          <div className={`rounded-2xl p-3 ${currentBalance > 0 ? 'bg-emerald-200 text-emerald-800' : currentBalance < 0 ? 'bg-red-200 text-red-800' : 'bg-neutral-200 text-neutral-800'}`}>
            {currentBalance > 0 ? <ArrowUpCircle className="h-6 w-6" /> : currentBalance < 0 ? <ArrowDownCircle className="h-6 w-6" /> : <ArrowDownCircle className="h-6 w-6" />}
          </div>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {row.transaction_type === "credit" ? (
                    <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 text-red-600" />
                  )}
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                    {row.transaction_type}
                  </p>
                </div>
                <p className="mt-1 text-sm font-semibold text-neutral-900">{row.description}</p>
                <p className="mt-1 text-xs text-neutral-500">{formatDate(row.transaction_date)}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-black ${row.transaction_type === "credit" ? "text-emerald-700" : "text-red-700"}`}>
                  {row.transaction_type === "credit" ? "+" : "-"}{formatCurrency(row.amount)}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-100">
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-neutral-500">Running Balance</p>
                <p className={`text-sm font-bold ${getBalanceColor(row.balance_after)}`}>
                  {row.balance_after >= 0 ? "+" : ""}{formatCurrency(row.balance_after)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden overflow-x-auto rounded-3xl border border-neutral-200 bg-white lg:block">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Date</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Type</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Description</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold uppercase tracking-widest text-neutral-500">Amount</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4 text-right text-xs font-bold uppercase tracking-widest text-neutral-500">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-neutral-700">{formatDate(row.transaction_date)}</td>
                <td className="px-4 sm:px-6 py-3 sm:py-4">
                  <div className="flex items-center gap-2">
                    {row.transaction_type === "credit" ? (
                      <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={`text-xs sm:text-sm font-semibold uppercase ${row.transaction_type === "credit" ? "text-emerald-700" : "text-red-700"}`}>
                      {row.transaction_type}
                    </span>
                  </div>
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-neutral-900">{row.description}</td>
                <td className={`px-4 sm:px-6 py-3 sm:py-4 text-right text-sm font-semibold ${row.transaction_type === "credit" ? "text-emerald-700" : "text-red-700"}`}>
                  {row.transaction_type === "credit" ? "+" : "-"}{formatCurrency(row.amount)}
                </td>
                <td className={`px-4 sm:px-6 py-3 sm:py-4 text-right text-sm font-bold ${getBalanceColor(row.balance_after)}`}>
                  {row.balance_after >= 0 ? "+" : ""}{formatCurrency(row.balance_after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
