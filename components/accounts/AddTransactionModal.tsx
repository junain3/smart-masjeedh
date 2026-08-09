"use client";

import { useEffect, useState } from "react";
import { X, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";

type StaffMember = {
  id: string;
  name: string;
  role: string;
  monthly_salary: number;
  category: string;
};

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  subscription_amount?: number;
  opening_balance?: number;
};

type StaffBalance = {
  pendingSalary: number;
  totalDue: number;
  advancesPaid?: number;
  ledgerBalance?: number;
};

type FamilyBalance = {
  annualSubscription: number;
  totalDue: number;
};

type AddTransactionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    type: "income" | "expense" | "subscription";
    amount: number;
    description: string;
    category: string;
    date: string;
    staffId?: string | null;
    familyId?: string | null;
  }) => Promise<void> | void;
  submitting?: boolean;
  editingTransaction?: any | null;
  editingCollectionId?: string | null;
  masjidId: string;
  staff: StaffMember[];
  families: Family[];
};

type TransactionType = "income" | "expense" | "subscription";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export function AddTransactionModal(props: AddTransactionModalProps) {
  const { open, onClose, onSubmit, submitting = false, editingTransaction, editingCollectionId, masjidId, staff = [], families = [] } = props;

  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(getToday());
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [staffBalance, setStaffBalance] = useState<StaffBalance | null>(null);
  const [familyBalance, setFamilyBalance] = useState<FamilyBalance | null>(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState("");
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);

  // Reset form when modal opens/closes or editing transaction changes
  useEffect(() => {
    if (!open) {
      resetForm();
    } else if (editingCollectionId) {
      setType("subscription");
      setSelectedFamilyId(editingCollectionId);
    } else if (editingTransaction) {
      setType(editingTransaction.type);
      setAmount(editingTransaction.amount.toString());
      setDescription(editingTransaction.description || "");
      setCategory(editingTransaction.category || "");
      setDate(editingTransaction.date || getToday());
      setSelectedStaffId(editingTransaction.staff_id || "");
      setSelectedFamilyId(editingTransaction.family_id || "");
    }
  }, [open, editingTransaction, editingCollectionId]);

  // Fetch staff balance when staff is selected for salary/advance salary
  useEffect(() => {
    const calculateStaffBalance = async () => {
      if (type === "expense" && (category === "Salary" || category === "Advance Salary") && selectedStaffId && masjidId) {
        const selectedStaff = staff.find((s) => s.id === selectedStaffId);
        if (selectedStaff) {
          try {
            // Fetch current balance from staff_ledger table
            const { data: ledgerData } = await supabase
              .from("staff_ledger")
              .select("balance_after")
              .eq("staff_id", selectedStaffId)
              .eq("masjid_id", masjidId)
              .order("transaction_date", { ascending: false })
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            const currentBalance = ledgerData?.balance_after || 0;

            // Also fetch advances from employees table for reference
            const { data: employeeData } = await supabase
              .from("employees")
              .select("advances_paid, monthly_salary, allowances")
              .eq("id", selectedStaffId)
              .eq("masjid_id", masjidId)
              .maybeSingle();

            const advancesPaid = Number(employeeData?.advances_paid || 0);
            const monthlySalary = Number(employeeData?.monthly_salary || 0);
            const allowances = Number(employeeData?.allowances || 0);
            const expectedMonthly = monthlySalary + allowances;

            if (category === "Advance Salary") {
              setStaffBalance({
                pendingSalary: advancesPaid,
                totalDue: advancesPaid,
                advancesPaid,
                ledgerBalance: currentBalance,
              });
              setAmount(""); // Don't auto-fill for advances
            } else {
              // For regular salary, use ledger balance (positive = dues owed)
              const totalDue = currentBalance > 0 ? currentBalance : expectedMonthly;
              setStaffBalance({
                pendingSalary: totalDue,
                totalDue,
                advancesPaid,
                ledgerBalance: currentBalance,
              });
              // Set default amount to total due
              setAmount(String(totalDue));
            }
          } catch (error) {
            console.error("Error calculating staff balance:", error);
            setStaffBalance(null);
          }
        }
      } else {
        setStaffBalance(null);
      }
    };
    calculateStaffBalance();
  }, [selectedStaffId, type, category, masjidId, staff]);

  // Calculate family balance when family is selected for subscription
  useEffect(() => {
    const calculateFamilyBalance = async () => {
      if (type === "subscription" && selectedFamilyId && masjidId) {
        const selectedFamily = families.find((f) => f.id === selectedFamilyId);
        if (selectedFamily) {
          try {
            // Calculate family balance (simplified version)
            const annualSubscription = Number(selectedFamily.subscription_amount || 0);
            const openingBalance = Number(selectedFamily.opening_balance || 0);
            const totalDue = annualSubscription + openingBalance;
            
            setFamilyBalance({
              annualSubscription,
              totalDue,
            });
            // Set default amount to total due
            setAmount(String(totalDue));
          } catch (error) {
            console.error("Error calculating family balance:", error);
            setFamilyBalance(null);
          }
        }
      } else {
        setFamilyBalance(null);
      }
    };
    calculateFamilyBalance();
  }, [selectedFamilyId, type, masjidId, families]);

  const resetForm = () => {
    setType("expense");
    setAmount("");
    setDescription("");
    setCategory("");
    setDate(getToday());
    setSelectedStaffId("");
    setSelectedFamilyId("");
    setStaffBalance(null);
    setFamilyBalance(null);
    setStaffSearchQuery("");
    setShowStaffDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      type,
      amount: Number(amount),
      description: description.trim(),
      category: category.trim(),
      date,
      staffId: selectedStaffId || null,
      familyId: selectedFamilyId || null,
    });
  };

  const filteredStaff = staff
    .filter(s => s.category === "Employee")
    .filter(s => 
      staffSearchQuery === "" || 
      s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
      s.role.toLowerCase().includes(staffSearchQuery.toLowerCase())
    );

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-neutral-900">
            {editingTransaction ? "Edit Transaction" : "Add Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransactionType)}
              className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Amount</label>
            <input
              type="number"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0.00"
            />
            {staffBalance && staffBalance.ledgerBalance !== undefined && amount !== String(staffBalance.totalDue) && (
              <p className="mt-1 text-xs text-neutral-500">
                Default was Rs. {staffBalance.totalDue.toLocaleString()} - you can override this amount
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Description</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Enter description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {type === "income" || type === "expense" ? (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Category</label>
              {type === "expense" ? (
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setSelectedStaffId(""); // Reset staff when category changes
                    setStaffBalance(null);
                  }}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Select category</option>
                  <option value="Salary">Salary</option>
                  <option value="Advance Salary">Advance Salary</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Events">Events</option>
                  <option value="Other">Other</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter category"
                />
              )}
            </div>
          ) : null}

          {type === "subscription" && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Select Family</label>
              <select
                value={selectedFamilyId}
                onChange={(e) => setSelectedFamilyId(e.target.value)}
                required
                className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select family</option>
                {families.map((family) => (
                  <option key={family.id} value={family.id}>
                    {family.family_code} — {family.head_name} (Rs. {Number(family.subscription_amount || 0).toLocaleString()})
                  </option>
                ))}
              </select>
              
              {familyBalance && (
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl p-4 mt-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-700">வருடாந்த சந்தா</span>
                      <span className="font-bold text-emerald-900">Rs. {familyBalance.annualSubscription.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-700">செலுத்த வேண்டிய பாக்கி</span>
                      <span className="font-bold text-emerald-900">Rs. {familyBalance.totalDue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {type === "expense" && (category === "Salary" || category === "Advance Salary") && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Select Staff Member
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  <input
                    type="text"
                    value={staffSearchQuery}
                    onChange={(e) => {
                      setStaffSearchQuery(e.target.value);
                      setShowStaffDropdown(true);
                    }}
                    onFocus={() => setShowStaffDropdown(true)}
                    placeholder="Search staff by name or role..."
                    className="w-full pl-10 pr-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                
                {showStaffDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
                    {filteredStaff.length === 0 ? (
                      <div className="p-3 text-sm text-neutral-500">No staff members found</div>
                    ) : (
                      filteredStaff.map((staffMember) => (
                        <button
                          key={staffMember.id}
                          type="button"
                          onClick={() => {
                            setSelectedStaffId(staffMember.id);
                            setStaffSearchQuery(`${staffMember.name} - ${staffMember.role}`);
                            setShowStaffDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-b-0"
                        >
                          <div className="font-medium text-neutral-900">{staffMember.name}</div>
                          <div className="text-xs text-neutral-500">{staffMember.role} · Rs. {Number(staffMember.monthly_salary || 0).toLocaleString()}/month</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              {staffBalance && (
                <div className={`bg-gradient-to-br border-2 rounded-2xl p-4 mt-3 ${category === "Advance Salary" ? "from-amber-50 to-amber-100 border-amber-200" : "from-blue-50 to-blue-100 border-blue-200"}`}>
                  <div className="space-y-2">
                    {category === "Salary" && staffBalance.ledgerBalance !== undefined && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700 font-semibold">Ledger Balance</span>
                        <span className={`font-bold ${staffBalance.ledgerBalance > 0 ? "text-emerald-700" : staffBalance.ledgerBalance < 0 ? "text-red-700" : "text-neutral-700"}`}>
                          {staffBalance.ledgerBalance >= 0 ? "+" : ""}Rs. {staffBalance.ledgerBalance.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className={category === "Advance Salary" ? "text-amber-700" : "text-blue-700"}>
                        {category === "Advance Salary" ? "Current Advances" : "Suggested Payment"}
                      </span>
                      <span className={`font-bold ${category === "Advance Salary" ? "text-amber-900" : "text-blue-900"}`}>
                        Rs. {staffBalance.pendingSalary.toLocaleString()}
                      </span>
                    </div>
                    {category === "Salary" && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700">Total Due</span>
                          <span className="font-bold text-blue-900">Rs. {staffBalance.totalDue.toLocaleString()}</span>
                        </div>
                        {staffBalance.advancesPaid !== undefined && staffBalance.advancesPaid > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-amber-700">Advances Paid</span>
                            <span className="font-bold text-amber-900">Rs. {staffBalance.advancesPaid.toLocaleString()}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
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
              className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Processing..." : editingTransaction ? "Update" : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
