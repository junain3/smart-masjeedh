"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Wallet, Calendar, Users, TrendingUp, AlertCircle, Check, Plus, X, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { AppShell } from "@/components/AppShell";
import jsPDF from "jspdf";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type StaffMember = {
  id: string;
  email: string;
  role: string;
};

type StaffCommissionBalance = {
  staff_user_id: string;
  staff_email: string;
  total_commission_earned: number;
  total_commission_paid: number;
  available_balance: number;
};

type SalaryLedgerEntry = {
  id: string;
  staff_user_id: string;
  transaction_type: 'base_salary' | 'collection_commission' | 'salary_payment';
  amount: number;
  balance_change: number;
  description: string;
  transaction_date: string;
  created_at: string;
  staff?: StaffMember;
};

export default function SalaryManagementPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [commissionBalances, setCommissionBalances] = useState<StaffCommissionBalance[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<SalaryLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [baseSalary, setBaseSalary] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load all data in parallel for better performance
      const [
        staffResponse,
        balancesResponse,
        ledgerResponse
      ] = await Promise.all([
        // Load staff members
        supabase
          .from("user_roles")
          .select("user_id, email, role")
          .eq("masjid_id", session.user.id)
          .in("role", ["staff", "editor"]),
        
        // Load commission balances
        supabase
          .rpc("get_staff_commission_balance", { p_staff_user_id: null }),
        
        // Load salary ledger entries
        supabase
          .from("staff_salary_ledger")
          .select(`
            *,
            staff:user_roles(user_id, email, role)
          `)
          .eq("masjid_id", session.user.id)
          .order("created_at", { ascending: false })
      ]);

      const staffData = staffResponse.data;
      const balancesData = balancesResponse.data;
      const ledgerData = ledgerResponse.data;

      setStaffMembers(staffData?.map(staff => ({
        id: staff.user_id,
        email: staff.email,
        role: staff.role
      })) || []);
      setCommissionBalances(balancesData || []);
      setLedgerEntries(ledgerData || []);
    } catch (e: any) {
      setError(e.message || "Failed to load salary data");
    } finally {
      setLoading(false);
    }
  };

  const handleSalaryPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !baseSalary) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const { error: paymentError } = await supabase
        .rpc("process_staff_salary_payment", {
          p_masjid_id: (await supabase.auth.getSession()).data.session?.user.id,
          p_staff_user_id: selectedStaff,
          p_base_salary: parseFloat(baseSalary),
          p_payment_date: paymentDate
        });

      if (paymentError) throw paymentError;

      setSuccess("Salary payment processed successfully!");
      setIsModalOpen(false);
      setSelectedStaff("");
      setBaseSalary("");
      loadData(); // Refresh data
    } catch (e: any) {
      setError(e.message || "Failed to process salary payment");
    } finally {
      setProcessing(false);
    }
  };

  const generatePDF = () => {
    try {
      console.log('Salary: Starting PDF generation...');
      
      // Check if jsPDF is available
      if (typeof window === 'undefined') {
        alert('PDF generation not available in server-side rendering');
        return;
      }
      
      const doc = new jsPDF();
      doc.text("Staff Commission Balances Report", 14, 15);
      
      const tableData = commissionBalances.map(b => [
        b.staff_email,
        `Rs. ${b.total_commission_earned.toLocaleString()}`,
        `Rs. ${b.total_commission_paid.toLocaleString()}`,
        `Rs. ${b.available_balance.toLocaleString()}`
      ]);

      doc.autoTable({
        startY: 20,
        head: [["Staff Email", "Total Earned", "Total Paid", "Available Balance"]],
        body: tableData,
      });

      console.log('Salary: PDF created, attempting download...');
      doc.save("staff_commission_balances.pdf");
      console.log('Salary: PDF download initiated');
    } catch (error) {
      console.error('Salary: PDF generation error:', error);
      alert('PDF generation failed: ' + (error as Error).message);
    }
  };

  const stats = useMemo(() => {
    const totalCommissionEarned = commissionBalances.reduce((sum, balance) => sum + balance.total_commission_earned, 0);
    const totalCommissionPaid = commissionBalances.reduce((sum, balance) => sum + balance.total_commission_paid, 0);
    const totalAvailableBalance = commissionBalances.reduce((sum, balance) => sum + balance.available_balance, 0);
    const totalBaseSalaryPaid = ledgerEntries
      .filter(entry => entry.transaction_type === 'salary_payment' && entry.description?.includes('Base salary'))
      .reduce((sum, entry) => sum + Math.abs(entry.balance_change), 0);

    return {
      totalCommissionEarned,
      totalCommissionPaid,
      totalAvailableBalance,
      totalBaseSalaryPaid,
      totalStaff: staffMembers.length,
    };
  }, [commissionBalances, ledgerEntries, staffMembers]);

  if (loading) {
    return (
      <AppShell title="Salary Management">
        <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">
          Loading...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title="Salary Management"
      actions={
        <button
          onClick={generatePDF}
          className="p-3 bg-slate-50 text-blue-600 rounded-3xl hover:bg-blue-50 transition-all active:scale-95"
          title="Download PDF"
        >
          <FileText className="w-6 h-6" />
        </button>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-emerald-600">{stats.totalStaff}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Staff</div>
        </div>
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-purple-600">{stats.totalCommissionEarned.toFixed(2)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Commission Earned</div>
        </div>
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-blue-600">{stats.totalCommissionPaid.toFixed(2)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Commission Paid</div>
        </div>
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-amber-600">{stats.totalAvailableBalance.toFixed(2)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Available Balance</div>
        </div>
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-rose-600">{stats.totalBaseSalaryPaid.toFixed(2)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Base Salary Paid</div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full app-btn-primary py-4 mb-6 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Process Salary Payment
      </button>

      {/* Staff Commission Balances */}
      <div className="app-card p-5 mb-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          Staff Commission Balances
        </h2>
        <div className="space-y-2">
          {commissionBalances.length === 0 ? (
            <p className="text-[11px] font-bold text-slate-400 text-center py-8">
              No commission balances found
            </p>
          ) : (
            commissionBalances.map((balance) => (
              <div
                key={balance.staff_user_id}
                className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl bg-white"
              >
                <div>
                  <div className="font-bold text-sm text-slate-800">{balance.staff_email}</div>
                  <div className="text-xs text-slate-400">
                    Earned: {balance.total_commission_earned.toFixed(2)} | 
                    Paid: {balance.total_commission_paid.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-emerald-600">
                    {balance.available_balance.toFixed(2)}
                  </div>
                  <div className="text-xs text-emerald-500">Available</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Ledger Entries */}
      <div className="app-card p-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          Recent Salary Ledger Entries
        </h2>
        <div className="space-y-2">
          {ledgerEntries.length === 0 ? (
            <p className="text-[11px] font-bold text-slate-400 text-center py-8">
              No ledger entries found
            </p>
          ) : (
            ledgerEntries.slice(0, 20).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-3 border border-slate-100 rounded-2xl bg-white"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="font-bold text-sm text-slate-800">
                      {entry.staff?.email || 'Unknown Staff'}
                    </div>
                    <div className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                      entry.transaction_type === 'base_salary' ? 'bg-rose-100 text-rose-700' :
                      entry.transaction_type === 'collection_commission' ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {entry.transaction_type.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">{entry.description}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(entry.created_at).toLocaleDateString()} at {new Date(entry.created_at).toLocaleTimeString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-black ${
                    entry.balance_change > 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {entry.balance_change > 0 ? '+' : ''}{entry.balance_change.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-400">
                    Balance: {entry.amount.toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Salary Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">Process Salary Payment</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-2xl"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSalaryPayment} className="space-y-4">
              {/* Staff Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Select Staff
                </label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  required
                >
                  <option value="">Choose staff member...</option>
                  {staffMembers.map((staff) => {
                    const balance = commissionBalances.find(b => b.staff_user_id === staff.id);
                    return (
                      <option key={staff.id} value={staff.id}>
                        {staff.email} {balance ? `(Commission: ${balance.available_balance.toFixed(2)})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Base Salary */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Base Salary
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  required
                />
              </div>

              {/* Commission Preview */}
              {selectedStaff && baseSalary && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3">
                  <div className="text-xs font-bold text-purple-700 mb-2">Payment Breakdown:</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Base Salary:</span>
                      <span className="font-bold">{parseFloat(baseSalary).toFixed(2)}</span>
                    </div>
                    {(() => {
                      const balance = commissionBalances.find(b => b.staff_user_id === selectedStaff);
                      return balance && balance.available_balance > 0 ? (
                        <div className="flex justify-between text-sm">
                          <span>Commission:</span>
                          <span className="font-bold">{balance.available_balance.toFixed(2)}</span>
                        </div>
                      ) : null;
                    })()}
                    <div className="border-t border-purple-200 pt-1 mt-1">
                      <div className="flex justify-between text-sm font-bold">
                        <span>Total Payment:</span>
                        <span>
                          {(() => {
                            const balance = commissionBalances.find(b => b.staff_user_id === selectedStaff);
                            const total = parseFloat(baseSalary) + (balance?.available_balance || 0);
                            return total.toFixed(2);
                          })()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 text-rose-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-bold">{error}</span>
                  </div>
                </div>
              )}

              {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Check className="w-4 h-4" />
                    <span className="text-xs font-bold">{success}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!selectedStaff || !baseSalary || processing}
                className="w-full app-btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? 'Processing...' : 'Process Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
