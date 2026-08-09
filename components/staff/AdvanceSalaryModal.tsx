"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type AdvanceSalaryInput = {
  amount: number;
  advanceDate: string;
  notes: string;
  accountId?: string | null;
  enableRepaymentSchedule?: boolean;
  monthlyDeduction?: number | null;
  repaymentStartMonth?: string | null;
  repaymentEndMonth?: string | null;
};

type AdvanceSalaryModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: AdvanceSalaryInput) => Promise<void> | void;
  submitting?: boolean;
  currentAdvances?: number;
  accounts?: Array<{ id: string; name: string; balance: number }>;
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export function AdvanceSalaryModal(props: AdvanceSalaryModalProps) {
  const { open, onClose, onSubmit, submitting = false, currentAdvances = 0, accounts = [] } = props;

  const [amount, setAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(getToday());
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [enableRepaymentSchedule, setEnableRepaymentSchedule] = useState(false);
  const [monthlyDeduction, setMonthlyDeduction] = useState("");
  const [repaymentStartMonth, setRepaymentStartMonth] = useState("");
  const [repaymentEndMonth, setRepaymentEndMonth] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setAdvanceDate(getToday());
    setNotes("");
    setAccountId("");
    setEnableRepaymentSchedule(false);
    setMonthlyDeduction("");
    setRepaymentStartMonth("");
    setRepaymentEndMonth("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-neutral-900">Give Advance Salary</h2>
            <p className="mt-1 text-sm text-neutral-500">
              This creates an advance payment record that will be deducted from future salary payments.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {currentAdvances > 0 && (
          <div className="mb-4 rounded-2xl bg-amber-50 p-4 border border-amber-200">
            <div className="flex justify-between text-sm">
              <span className="text-amber-700 font-semibold">Current Advances</span>
              <span className="text-amber-900 font-bold">Rs. {Number(currentAdvances).toLocaleString()}</span>
            </div>
          </div>
        )}

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              amount: Number(amount),
              advanceDate,
              notes: notes.trim(),
              accountId: accountId || null,
              enableRepaymentSchedule,
              monthlyDeduction: enableRepaymentSchedule ? Number(monthlyDeduction) : null,
              repaymentStartMonth: enableRepaymentSchedule ? repaymentStartMonth : null,
              repaymentEndMonth: enableRepaymentSchedule ? repaymentEndMonth : null,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">Advance Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">Advance Date</label>
            <input
              type="date"
              required
              value={advanceDate}
              onChange={(event) => setAdvanceDate(event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {accounts.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700">Disbursement Account</label>
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select account (optional)</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - Rs. {Number(account.balance).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">Notes</label>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes for this advance payment"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enableRepayment"
                checked={enableRepaymentSchedule}
                onChange={(event) => setEnableRepaymentSchedule(event.target.checked)}
                className="h-5 w-5 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="enableRepayment" className="text-sm font-semibold text-neutral-700">
                Enable Installment Repayment Schedule
              </label>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Automatically deduct fixed amounts from monthly salary payments
            </p>
          </div>

          {enableRepaymentSchedule && (
            <div className="space-y-4 rounded-2xl bg-neutral-50 p-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-700">Monthly Deduction Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={monthlyDeduction}
                  onChange={(event) => setMonthlyDeduction(event.target.value)}
                  placeholder="e.g., 10000"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-neutral-700">Start Month</label>
                  <input
                    type="month"
                    required
                    value={repaymentStartMonth}
                    onChange={(event) => setRepaymentStartMonth(event.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-neutral-700">End Month</label>
                  <input
                    type="month"
                    required
                    value={repaymentEndMonth}
                    onChange={(event) => setRepaymentEndMonth(event.target.value)}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              {amount && monthlyDeduction && (
                <div className="rounded-2xl bg-blue-50 p-3 text-xs text-blue-800">
                  Estimated {Math.ceil(Number(amount) / Number(monthlyDeduction))} months to repay Rs. {Number(amount).toLocaleString()} at Rs. {Number(monthlyDeduction).toLocaleString()}/month
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Processing..." : "Give Advance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
