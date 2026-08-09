"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type CustomCreditInput = {
  amount: number;
  creditType: string;
  description: string;
  creditDate: string;
  notes: string;
};

type CustomCreditModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CustomCreditInput) => Promise<void> | void;
  submitting?: boolean;
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export function CustomCreditModal(props: CustomCreditModalProps) {
  const { open, onClose, onSubmit, submitting = false } = props;

  const [amount, setAmount] = useState("");
  const [creditType, setCreditType] = useState("bonus");
  const [description, setDescription] = useState("");
  const [creditDate, setCreditDate] = useState(getToday());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setCreditType("bonus");
    setDescription("");
    setCreditDate(getToday());
    setNotes("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-neutral-900">Post Custom Credit</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Add bonuses, allowances, gifts, or other credits to the staff ledger.
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

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              amount: Number(amount),
              creditType,
              description: description.trim(),
              creditDate,
              notes: notes.trim(),
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">Credit Type</label>
            <select
              value={creditType}
              onChange={(event) => setCreditType(event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="bonus">Bonus</option>
              <option value="allowance">Allowance</option>
              <option value="gift">Gift</option>
              <option value="other">Other</option>
            </select>
          </div>

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
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">Description</label>
            <input
              type="text"
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g., Performance bonus, Eid bonus"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">Credit Date</label>
            <input
              type="date"
              required
              value={creditDate}
              onChange={(event) => setCreditDate(event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-700">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes for this credit"
              className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

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
              className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Processing..." : "Post Credit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
