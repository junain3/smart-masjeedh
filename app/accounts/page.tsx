"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function AccountsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Accounts</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Accounts Management</h2>
          <p className="text-gray-600 mb-6">
            Manage your masjid accounts and financial records.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Income</h3>
              <p className="text-sm text-gray-600">Track donations and income sources</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Expenses</h3>
              <p className="text-sm text-gray-600">Manage masjid expenses and bills</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Reports</h3>
              <p className="text-sm text-gray-600">Generate financial reports</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useAppToast } from "@/components/ToastProvider";
import { EmptyState } from "@/components/EmptyState";
import { QrScannerModal } from "@/components/QrScannerModal";

type Transaction = {
  id: string;
  amount: number;
  description: string;
  type: "income" | "expense" | "subscription";
  category: string;
  date: string;
  masjid_id: string;
  family_id?: string;
};

type Family = {
  id: string;
  family_code: string;
  head_name: string;
};

export default function AccountsPage() {
  const router = useRouter();
  const { toast, confirm } = useAppToast();
  const [lang, setLang] = useState<Language>("en");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // NEW: Report filter states
  const [reportType, setReportType] = useState<"all" | "income" | "expense">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showReportOptions, setShowReportOptions] = useState(false);
  
  // Form states
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"income" | "expense" | "subscription">("income");
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [allowed, setAllowed] = useState(true);

  const t = translations[lang];

  const isNonZeroAmount = (amount: unknown) => {
    if (typeof amount !== "number") return false;
    if (!Number.isFinite(amount)) return false;
    return Math.abs(amount) > 0.000001;
  };

  const isEventInfoRow = (tx: Transaction) => {
    const desc = (tx.description || "").trim().toLowerCase();
    const cat = (tx.category || "").trim().toLowerCase();
    return /^event\s*[:\-]/i.test(desc) || /^event\s*[:\-]/i.test(cat);
  };

  const getFinancialKind = (tx: Transaction): "income" | "expense" => {
    // Treat legacy/UX "subscription" as "income" for display + summaries
    return tx.type === "expense" ? "expense" : "income";
  };

  const isFinancialTransaction = (tx: Transaction): boolean => {
    // Exclude events, but include subscription transactions for main account
    const desc = (tx.description || "").trim().toLowerCase();
    const cat = (tx.category || "").trim().toLowerCase();
    const isEvent = /^event\s*[:\-]/i.test(desc) || /^event\s*[:\-]/i.test(cat);
    
    // Include subscription transactions if they are for main account (no family_id)
    if (tx.type === "subscription") {
      return !isEvent && !tx.family_id; // Only main account subscriptions
    }
    
    // Include regular income/expense transactions (exclude events)
    return !isEvent;
  };

  const financialTransactions = transactions.filter((tx) => {
    // Only include actual financial transactions (income/expense), exclude events and subscriptions
    if (!isFinancialTransaction(tx)) return false;
    if (!isNonZeroAmount(tx.amount)) return false; // hide Rs. 0 / informational rows
    return true;
  });

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchData();
  }, []);

  const handleQrDecodedText = (decodedText: string) => {
    if (!decodedText) return;
    if (decodedText.startsWith("smart-masjeedh:family:")) {
      const familyId = decodedText.split(":")[2];
      setSelectedFamilyId(familyId);
      setType("subscription");
      setIsModalOpen(true);
      setIsScannerOpen(false);
    }
  };

  useEffect(() => {
    if (editingTransaction) {
      setAmount(editingTransaction.amount.toString());
      setDescription(editingTransaction.description);
      setType(editingTransaction.type === "income" && editingTransaction.family_id ? "subscription" : editingTransaction.type as any);
      setCategory(editingTransaction.category);
      setDate(editingTransaction.date);
      setSelectedFamilyId(editingTransaction.family_id || "");
      setIsModalOpen(true);
    }
  }, [editingTransaction]);

  async function fetchData() {
    if (!supabase) return;
    setLoading(true);
    try {
      const ctx = await getTenantContext();
      if (!ctx) {
        router.push("/login");
        return;
      }

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canAccounts = isAdmin || ctx.permissions?.accounts !== false;
      setAllowed(canAccounts);
      if (!canAccounts) {
        setTransactions([]);
        setFamilies([]);
        return;
      }

      // Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("*")
        .eq("masjid_id", ctx.masjidId)
        .order("date", { ascending: false });

      if (txError) {
        if (!txError.message.includes('table')) throw txError;
      } else if (txData) {
        setTransactions(txData);
      }

      // Fetch families for subscription selection
      const { data: famData } = await supabase
        .from("families")
        .select("id, family_code, head_name")
        .eq("masjid_id", ctx.masjidId)
        .order("family_code", { ascending: true });
      
      if (famData) setFamilies(famData);

    } catch (err: any) {
      console.error("Fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);

    try {
      const ctx = await getTenantContext();
      if (!ctx) return;

      const isAdmin = ctx.role === "super_admin" || ctx.role === "co_admin";
      const canAccounts = isAdmin || ctx.permissions?.accounts !== false;
      if (!canAccounts) {
        toast({ kind: "error", title: "Access denied", message: "You don't have permission." });
        return;
      }

      const finalType = type === "subscription" ? "income" : type;
      const finalCategory = type === "subscription" ? t.subscription : category;
      const finalDescription = type === "subscription" 
        ? `${t.subscription} - ${families.find(f => f.id === selectedFamilyId)?.family_code}`
        : description;

      if (editingTransaction) {
        const { error } = await supabase
          .from("transactions")
          .update({
            amount: parseFloat(amount),
            description: finalDescription,
            type: finalType,
            category: finalCategory,
            date,
            family_id: type === "subscription" ? selectedFamilyId : null
          })
          .eq("id", editingTransaction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").insert([
          {
            amount: parseFloat(amount),
            description: finalDescription,
            type: finalType,
            category: finalCategory,
            date,
            masjid_id: ctx.masjidId,
            family_id: type === "subscription" ? selectedFamilyId : null
          }
        ]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed" });
    } finally {
      setSubmitting(false);
    }
  }

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setCategory("");
    setSelectedFamilyId("");
    setType("income");
    setEditingTransaction(null);
  };

  async function deleteTransaction(id: string) {
    if (!supabase) return;
    const ok = await confirm({
      title: t.confirm_delete,
      message: t.confirm_delete,
      confirmText: t.remove || "Remove",
      cancelText: t.cancel || "Cancel",
    });
    if (!ok) return;
    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed" });
    }
  }

  const generatePDF = () => {
    try {
      console.log('Accounts: Starting print generation...');
      
      // Check client-side
      if (typeof window === 'undefined') {
        console.error('Print generation not available in server-side rendering');
        return;
      }
      
      // Create printable HTML
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        alert('Please allow popups for this website to print PDF');
        return;
      }
      
      // Filter transactions based on report type and date range
      let filteredTransactions = transactions.filter(tx => 
        tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
      
      // IMPORTANT: Only include financial transactions (income/expense), exclude events and subscriptions
      filteredTransactions = filteredTransactions.filter(tx => 
        isFinancialTransaction(tx)
      );
      
      // Apply report type filter
      if (reportType === "income") {
        filteredTransactions = filteredTransactions.filter(tx => getFinancialKind(tx) === "income");
      } else if (reportType === "expense") {
        filteredTransactions = filteredTransactions.filter(tx => getFinancialKind(tx) === "expense");
      }
      
      // Apply date range filter
      if (dateFrom) {
        filteredTransactions = filteredTransactions.filter(tx => tx.date >= dateFrom);
      }
      if (dateTo) {
        filteredTransactions = filteredTransactions.filter(tx => tx.date <= dateTo);
      }
      
      // Calculate totals
      const totalIncome = filteredTransactions
        .filter(tx => getFinancialKind(tx) === "income")
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = filteredTransactions
        .filter(tx => getFinancialKind(tx) === "expense")
        .reduce((sum, t) => sum + t.amount, 0);
      const netBalance = totalIncome - totalExpense;
      
      // Prepare table data
      const tableData = filteredTransactions.map(tx => [
        tx.date,
        tx.description,
        tx.category,
        getFinancialKind(tx).toUpperCase(),
        `Rs. ${tx.amount.toLocaleString()}`
      ]);
      
      // Generate HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Masjid Transactions Report</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 12px;
              line-height: 1.4;
            }
            h1 { 
              text-align: center; 
              margin-bottom: 20px;
              font-size: 18px;
              font-weight: bold;
            }
            .report-info {
              text-align: center;
              margin-bottom: 20px;
              font-size: 14px;
              color: #666;
            }
            .summary {
              background: #f5f5f5;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin: 5px 0;
              font-weight: bold;
            }
            .income { color: #28a745; }
            .expense { color: #dc3545; }
            .balance { color: #007bff; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 8px; 
              text-align: left;
              vertical-align: top;
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold;
              font-size: 11px;
            }
            td { 
              font-size: 10px;
              word-wrap: break-word;
              max-width: 150px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            @media print {
              body { margin: 10px; }
              th, td { 
                border: 1px solid #000; 
                padding: 6px;
                font-size: 9px;
              }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Masjid Transactions Report</h1>
          <div class="report-info">
            <strong>Report Type:</strong> ${reportType === "all" ? "All Transactions" : reportType === "income" ? "Income Only" : "Expense Only"}<br>
            ${dateFrom ? `<strong>From:</strong> ${dateFrom}` : ''}
            ${dateTo ? `<strong>To:</strong> ${dateTo}` : ''}
          </div>
          
          <div class="summary">
            <div class="summary-row">
              <span>Total Income:</span>
              <span class="income">Rs. ${totalIncome.toLocaleString()}</span>
            </div>
            <div class="summary-row">
              <span>Total Expense:</span>
              <span class="expense">Rs. ${totalExpense.toLocaleString()}</span>
            </div>
            <div class="summary-row" style="border-top: 1px solid #ccc; padding-top: 10px; margin-top: 10px;">
              <span>Net Balance:</span>
              <span class="balance">Rs. ${netBalance.toLocaleString()}</span>
            </div>
          </div>
          
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
      `;
      
      // Add data rows
      tableData.forEach(row => {
        htmlContent += '<tr>';
        row.forEach(cell => {
          const cellValue = String(cell || '');
          const truncatedValue = cellValue.length > 50 ? cellValue.substring(0, 50) + '...' : cellValue;
          htmlContent += `<td>${truncatedValue}</td>`;
        });
        htmlContent += '</tr>';
      });
      
      htmlContent += `
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px;">
              🖨️ Print / Save as PDF
            </button>
            <br><br>
            <small>Use Ctrl+P or Cmd+P to print, then choose "Save as PDF"</small>
          </div>
        </body>
        </html>
      `;
      
      // Write content to new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Focus and trigger print dialog
      printWindow.focus();
      
      console.log('Accounts: Print window opened successfully');
      
    } catch (error) {
      console.error('Accounts: Print generation error:', error);
      alert('Print generation failed: ' + (error as Error).message);
    }
  };

  const totalIncome = financialTransactions
    .filter(tx => getFinancialKind(tx) === "income")
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalExpense = financialTransactions
    .filter(tx => getFinancialKind(tx) === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
    
  const balance = totalIncome - totalExpense;

  const filteredTransactions = financialTransactions.filter(tx => 
    isFinancialTransaction(tx)
  ).filter(tx => 
    (tx.description || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.category || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading)
    return (
      <AppShell title={t.accounts}>
        <div className="app-card p-6 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-neutral-600">{t.loading}</p>
        </div>
      </AppShell>
    );

  if (!allowed) {
    return (
      <AppShell title={t.accounts}>
        <div className="app-card p-6 text-center text-[11px] font-bold text-neutral-600">
          Access denied.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t.accounts}
      actions={
        <>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="p-3 bg-neutral-50 text-neutral-600 rounded-3xl hover:bg-emerald-50 hover:text-emerald-700 transition-all active:scale-95"
            title={t.scan_qr}
          >
            <QrCode className="w-6 h-6" />
          </button>
          <button
            onClick={() => setShowReportOptions(!showReportOptions)}
            className="p-3 bg-neutral-50 text-neutral-600 rounded-3xl hover:bg-neutral-100 transition-all active:scale-95"
            title="Report Options"
          >
            <FileText className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="p-3 bg-emerald-600 text-white rounded-3xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
            title={t.add_transaction}
          >
            <Plus className="w-6 h-6" />
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Report Options Popup */}
        {showReportOptions && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Report Options</h3>
                <button
                  onClick={() => setShowReportOptions(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Report Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Report Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setReportType("all")}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        reportType === "all" 
                          ? "bg-blue-600 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setReportType("income")}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        reportType === "income" 
                          ? "bg-green-600 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Income
                    </button>
                    <button
                      onClick={() => setReportType("expense")}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        reportType === "expense" 
                          ? "bg-red-600 text-white" 
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      Expense
                    </button>
                  </div>
                </div>
                
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium mb-2">Date Range (Optional)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Generate Button */}
                <button
                  onClick={() => {
                    setShowReportOptions(false);
                    generatePDF();
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all"
                >
                  🖨️ Generate Report
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Balance Card */}
        <div className="rounded-3xl p-8 text-white shadow-xl relative overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-emerald-900">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Wallet className="w-24 h-24" />
          </div>
          <div className="relative z-10 space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">{t.balance}</p>
            <h2 className="text-4xl font-black">Rs. {balance.toLocaleString()}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t.income}</span>
              </div>
              <p className="font-bold">Rs. {totalIncome.toLocaleString()}</p>
            </div>
            <div className="space-y-1 border-l border-white/10 pl-4">
              <div className="flex items-center gap-1.5 text-rose-400">
                <TrendingDown className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{t.expense}</span>
              </div>
              <p className="font-bold">Rs. {totalExpense.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400 group-focus-within:text-emerald-600 transition-colors" />
          <input 
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="app-input pl-12 font-bold"
          />
        </div>

        {/* Transactions List */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-neutral-600 uppercase tracking-widest ml-1">{t.transactions}</h3>
          {filteredTransactions.length === 0 ? (
            <EmptyState
              title={lang === "tm" ? "பரிவர்த்தனைகள் இல்லை" : "No transactions"}
              description={lang === "tm" ? "முதல் பரிவர்த்தனையைச் சேர்க்கவும்" : "Add your first transaction to get started."}
              icon={<Wallet className="w-8 h-8" />}
            />
          ) : (
            filteredTransactions.map((tx, idx) => {
              const kind = getFinancialKind(tx);
              const altBg = idx % 2 === 0 ? "bg-white/65" : "bg-emerald-50/20";
              return (
                <div
                  key={tx.id}
                  className={`app-glass-card ${altBg} p-5 flex items-center justify-between group hover:border-emerald-200 transition-all relative overflow-hidden`}
                >
                  <div
                    className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${
                      kind === "income" ? "bg-emerald-600" : "bg-rose-600"
                    }`}
                  />
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-3xl border flex items-center justify-center ${
                        kind === "income"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                          : "bg-rose-50 text-rose-700 border-rose-200"
                      }`}
                    >
                      {kind === "income" ? (
                        <TrendingUp className="w-6 h-6" />
                      ) : (
                        <TrendingDown className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-neutral-900">
                        {tx.description}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-bold text-neutral-600 uppercase">
                          {tx.category}
                        </span>
                        <span className="text-neutral-300">•</span>
                        <span className="text-[10px] font-bold text-neutral-600 uppercase">
                          {tx.date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="text-right mr-2">
                      <p
                        className={`font-black text-sm ${
                          kind === "income"
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }`}
                      >
                        {kind === "income" ? "+" : "-"} Rs.{" "}
                        {tx.amount.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setEditingTransaction(tx)}
                      className="p-2 text-neutral-600 hover:bg-neutral-50 rounded-3xl transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteTransaction(tx.id)}
                      className="p-2 text-rose-700 hover:bg-rose-50 rounded-3xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <QrScannerModal
        open={isScannerOpen}
        title={t.scan_qr}
        containerId="accounts-reader"
        onClose={() => setIsScannerOpen(false)}
        onDecodedText={handleQrDecodedText}
      />

      {/* Add Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-neutral-900">{t.add_transaction}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors">
                <X className="w-6 h-6 text-neutral-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Type Toggle */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-neutral-50 rounded-3xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => setType("income")}
                  className={`py-3 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    type === "income" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-600"
                  }`}
                >
                  {t.income}
                </button>
                <button
                  type="button"
                  onClick={() => setType("subscription")}
                  className={`py-3 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    type === "subscription" ? "bg-white text-emerald-700 shadow-sm" : "text-neutral-600"
                  }`}
                >
                  {t.subscription}
                </button>
                <button
                  type="button"
                  onClick={() => setType("expense")}
                  className={`py-3 rounded-3xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    type === "expense" ? "bg-white text-rose-700 shadow-sm" : "text-neutral-600"
                  }`}
                >
                  {t.expense}
                </button>
              </div>

              {type === "subscription" && (
                <div className="app-field animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="app-label">{t.select_family}</label>
                  <select
                    required
                    value={selectedFamilyId}
                    onChange={e => setSelectedFamilyId(e.target.value)}
                    className="app-select font-bold appearance-none"
                  >
                    <option value="">{t.select_family}</option>
                    {families.map(f => (
                      <option key={f.id} value={f.id}>{f.family_code} - {f.head_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="app-field">
                <label className="app-label">{t.amount}</label>
                <input 
                  required
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="app-input text-lg font-black"
                  placeholder="0.00"
                />
              </div>

              {type !== "subscription" && (
                <div className="app-field">
                  <label className="app-label">{t.description}</label>
                  <input 
                    required
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className="app-input font-bold"
                    placeholder="E.g. Friday Donation"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {type !== "subscription" && (
                  <div className="app-field">
                    <label className="app-label">{t.category}</label>
                    <input 
                      required
                      type="text"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="app-input font-bold"
                      placeholder="E.g. Charity"
                    />
                  </div>
                )}
                <div className={`app-field ${type === "subscription" ? "col-span-2" : ""}`}>
                  <label className="app-label">{t.date}</label>
                  <input 
                    required
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="app-input font-bold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full py-5 rounded-3xl font-black text-white shadow-xl transition-all active:scale-[0.97] disabled:opacity-50 ${
                  type === "expense"
                    ? "bg-rose-600 shadow-rose-600/20"
                    : "bg-emerald-600 shadow-emerald-600/20"
                }`}
              >
                {submitting ? "PROCESSING..." : t.save}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
