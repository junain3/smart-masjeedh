"use client";

import Link from "next/link";
import { FileText, Wallet } from "lucide-react";

export type SalaryHistoryRow = {
  id: string;
  amount: number;
  salary_month: string;
  payment_date: string;
  notes?: string | null;
  finance_transaction_id?: string | null;
};

type SalaryHistoryTableProps = {
  rows: SalaryHistoryRow[];
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

function formatSalaryMonth(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function SalaryHistoryTable({ rows, loading = false }: SalaryHistoryTableProps) {
  if (loading) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center text-sm font-medium text-neutral-500">
        Loading salary history...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-200 bg-white px-6 py-14 text-center">
        <Wallet className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
        <h3 className="text-lg font-bold text-neutral-900">No salary payments yet</h3>
        <p className="mt-2 text-sm text-neutral-500">
          Salary payments will appear here once the first payment is recorded.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 lg:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Salary Month</p>
                <p className="mt-1 text-base font-black text-neutral-900">{formatSalaryMonth(row.salary_month)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Amount</p>
                <p className="mt-1 text-base font-black text-emerald-700">{formatCurrency(row.amount)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Payment Date</p>
                <p className="mt-1 text-sm font-medium text-neutral-800">{formatDate(row.payment_date)}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Finance</p>
                {row.finance_transaction_id ? (
                  <Link href="/accounts" className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:text-emerald-900">
                    <FileText className="h-4 w-4" />
                    View in Accounts
                  </Link>
                ) : (
                  <p className="mt-1 text-sm font-medium text-neutral-500">Not linked</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Notes</p>
              <p className="mt-1 text-sm text-neutral-700">{row.notes || "No notes"}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-3xl border border-neutral-200 bg-white lg:block">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Salary Month</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Amount</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Payment Date</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Notes</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Finance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-neutral-50">
                <td className="px-6 py-4 text-sm font-semibold text-neutral-900">{formatSalaryMonth(row.salary_month)}</td>
                <td className="px-6 py-4 text-sm font-semibold text-emerald-700">{formatCurrency(row.amount)}</td>
                <td className="px-6 py-4 text-sm text-neutral-700">{formatDate(row.payment_date)}</td>
                <td className="px-6 py-4 text-sm text-neutral-700">{row.notes || "No notes"}</td>
                <td className="px-6 py-4 text-sm">
                  {row.finance_transaction_id ? (
                    <Link href="/accounts" className="font-semibold text-emerald-700 hover:text-emerald-900">
                      View in Accounts
                    </Link>
                  ) : (
                    <span className="text-neutral-500">Not linked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
