"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type SalaryPaymentInput = {
  amount: number;
  salaryMonth: string;
  paymentDate: string;
  notes: string;
  accountId?: string | null;
  override?: boolean;
};

type PaySalaryModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: SalaryPaymentInput) => Promise<void> | void;
  submitting?: boolean;
  defaultAmount?: number | null;
  currentBalance?: number | null;
  defaultMonth?: string;
  accounts?: Array<{ id: string; name: string; balance: number }>;
  hasDuplicatePayment?: boolean;
};

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export function PaySalaryModal(props: PaySalaryModalProps) {
  const { open, onClose, onSubmit, submitting = false, defaultAmount, currentBalance, defaultMonth, accounts = [], hasDuplicatePayment = false } = props;

  const [amount, setAmount] = useState(currentBalance && currentBalance > 0 ? String(currentBalance) : (defaultAmount ? String(defaultAmount) : ""));
  const [salaryMonth, setSalaryMonth] = useState(defaultMonth || getCurrentMonth());
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [override, setOverride] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(currentBalance && currentBalance > 0 ? String(currentBalance) : (defaultAmount ? String(defaultAmount) : ""));
    setSalaryMonth(defaultMonth || getCurrentMonth());
    setPaymentDate(getToday());
    setNotes("");
    setAccountId("");
    setOverride(false);
  }, [defaultAmount, currentBalance, defaultMonth, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-neutral-900">Pay Salary</h2>
            <p className="mt-1 text-sm text-neutral-500">
              This creates both a salary payment record and a finance expense entry.
            </p>
            {currentBalance !== undefined && currentBalance !== null && (
              <div className={`mt-2 rounded-2xl px-3 py-1.5 text-xs font-semibold ${currentBalance > 0 ? 'bg-emerald-50 text-emerald-700' : currentBalance < 0 ? 'bg-red-50 text-red-700' : 'bg-neutral-50 text-neutral-600'}`}>
                Current Balance: {currentBalance >= 0 ? '+' : ''}Rs. {Number(currentBalance).toLocaleString()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-neutral-500 hover:bg-neutral-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (hasDuplicatePayment && !override) {
              return;
            }
            await onSubmit({
              amount: Number(amount),
              salaryMonth,
              paymentDate,
              notes: notes.trim(),
              accountId: accountId || null,
              override,
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">Amount</label>
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
            {currentBalance !== undefined && currentBalance !== null && amount !== String(currentBalance) && (
              <p className="mt-1 text-xs text-neutral-500">
                Default was Rs. {Number(currentBalance).toLocaleString()} - you can override this amount
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700">Salary Month</label>
              <input
                type="month"
                required
                value={salaryMonth}
                onChange={(event) => setSalaryMonth(event.target.value)}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-700">Payment Date</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
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
              placeholder="Optional notes for this payment"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {hasDuplicatePayment && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">Duplicate Payment Warning</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Salary for {salaryMonth} has already been paid. This will create an additional payment record and may result in a negative balance.
                  </p>
                  <label className="mt-3 flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={(e) => setOverride(e.target.checked)}
                      className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-amber-800">
                      I understand and want to proceed with this payment
                    </span>
                  </label>
                </div>
              </div>
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
              className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Processing..." : "Confirm Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
