"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, X, AlertCircle, Users, Wallet, Calendar, Filter, Search, DollarSign, TrendingUp, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { AppShell } from "@/components/AppShell";

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address?: string;
};

type User = {
  id: string;
  email?: string;
};

type Collection = {
  id: string;
  family_id: string;
  amount: number;
  commission_percent: number;
  commission_amount: number;
  notes?: string;
  date: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  collected_by_user_id: string;
  accepted_by_user_id?: string;
  accepted_at?: string;
  accept_date?: string;
  family?: Family;
  collector?: User;
};

type CollectorWaitingBalance = {
  collector_user_id: string;
  collector_email: string;
  total_waiting_amount: number;
  total_collections_count: number;
};

type ApprovalStats = {
  total_pending: number;
  total_pending_amount: number;
  total_accepted: number;
  total_accepted_amount: number;
  total_rejected: number;
  total_rejected_amount: number;
  total_commission_paid: number;
};

export default function PendingCollectionsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectorBalances, setCollectorBalances] = useState<CollectorWaitingBalance[]>([]);
  const [approvalStats, setApprovalStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("pending");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const t = translations[lang];

  // Filter collections based on search and status
  const filteredCollections = useMemo(() => {
    let filtered = collections;

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.family?.family_code.toLowerCase().includes(query) ||
        c.family?.head_name.toLowerCase().includes(query) ||
        c.collector?.email?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [collections, searchQuery, statusFilter]);

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
        collectionsResponse,
        balancesResponse
      ] = await Promise.all([
        // Load all collections with family info
        supabase
          .from("subscription_collections")
          .select(`
            *,
            family:families(id, family_code, head_name, address)
          `)
          .eq("masjid_id", session.user.id)
          .order("created_at", { ascending: false }),
        
        // Load collector waiting balances
        supabase
          .from("collector_waiting_balances")
          .select(`
            collector_user_id,
            total_waiting_amount,
            total_collections_count
          `)
          .eq("masjid_id", session.user.id)
          .gt("total_waiting_amount", 0)
      ]);

      const collectionsData = collectionsResponse.data;
      const balancesData = balancesResponse.data;

      // Load collector info separately (more efficient)
      const collectorIds = [...new Set([
        ...(collectionsData?.map(c => c.collected_by_user_id) || []),
        ...(balancesData?.map(b => b.collector_user_id) || [])
      ])];
      
      let collectorsData = [];
      if (collectorIds.length > 0) {
        const { data: collectors } = await supabase
          .from("user_roles")
          .select("user_id, email")
          .in("user_id", collectorIds);
        collectorsData = collectors || [];
      }

      // Merge collector info
      const collectionsWithCollectors = collectionsData?.map(collection => ({
        ...collection,
        collector: collectorsData?.find(c => c.user_id === collection.collected_by_user_id)
      }));

      // Merge collector info for balances
      const balancesWithCollectors = balancesData?.map(balance => ({
        ...balance,
        collector: collectorsData?.find(c => c.user_id === balance.collector_user_id)
      }));

      // Calculate approval stats
      const stats = collectionsData?.reduce((acc: ApprovalStats, collection) => {
        if (collection.status === 'pending') {
          acc.total_pending++;
          acc.total_pending_amount += collection.amount;
        } else if (collection.status === 'accepted') {
          acc.total_accepted++;
          acc.total_accepted_amount += collection.amount;
          acc.total_commission_paid += collection.commission_amount || 0;
        } else if (collection.status === 'rejected') {
          acc.total_rejected++;
          acc.total_rejected_amount += collection.amount;
        }
        return acc;
      }, {
        total_pending: 0,
        total_pending_amount: 0,
        total_accepted: 0,
        total_accepted_amount: 0,
        total_rejected: 0,
        total_rejected_amount: 0,
        total_commission_paid: 0,
      });

      setCollections(collectionsWithCollectors || []);
      setCollectorBalances(
        balancesWithCollectors?.map(b => ({
          collector_user_id: b.collector_user_id,
          collector_email: (b as any).collector?.email || 'Unknown',
          total_waiting_amount: b.total_waiting_amount,
          total_collections_count: b.total_collections_count,
        })) || []
      );
      setApprovalStats(stats);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    try {
      console.log('Pending: Starting print generation...');
      
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
      
      // Generate HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Pending Collections Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
            h1 { text-align: center; margin-bottom: 20px; font-size: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; font-size: 11px; }
            td { font-size: 10px; word-wrap: break-word; }
            .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #666; }
            @media print { body { margin: 10px; } th, td { border: 1px solid #000; padding: 6px; font-size: 9px; } }
          </style>
        </head>
        <body>
          <h1>Pending Collections Report</h1>
          <table>
            <thead>
              <tr>
                <th>Family Code</th>
                <th>Head Name</th>
                <th>Collector</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Commission %</th>
                <th>Commission</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      // Add data rows
      collections.forEach(c => {
        htmlContent += '<tr>';
        htmlContent += `<td>${c.family?.family_code || ''}</td>`;
        htmlContent += `<td>${c.family?.head_name || ''}</td>`;
        htmlContent += `<td>${(c as any).collector?.email || 'Unknown'}</td>`;
        htmlContent += `<td>${c.date || ''}</td>`;
        htmlContent += `<td>Rs. ${c.amount?.toLocaleString() || 0}</td>`;
        htmlContent += `<td>${c.commission_percent || 0}%</td>`;
        htmlContent += `<td>Rs. ${c.commission_amount?.toLocaleString() || 0}</td>`;
        htmlContent += `<td>${c.status || ''}</td>`;
        htmlContent += '</tr>';
      });
      
      htmlContent += `
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
          <div style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px;">
              🖨️ Print / Save as PDF
            </button>
          </div>
        </body>
        </html>
      `;
      
      // Write content to new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      console.log('Pending: Print window opened successfully');
      
    } catch (error) {
      console.error('Pending: Print generation error:', error);
      alert('Print generation failed: ' + (error as Error).message);
    }
  };

  const handleApprove = async (collectionId: string) => {
    setProcessing(collectionId);
    setError("");
    setSuccess("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Get collection details
      const { data: collection } = await supabase
        .from("subscription_collections")
        .select("*")
        .eq("id", collectionId)
        .single();

      if (!collection) throw new Error("Collection not found");

      // Update collection status to accepted
      const { error: updateError } = await supabase
        .from("subscription_collections")
        .update({
          status: 'accepted',
          accepted_by_user_id: session.user.id,
          accepted_at: new Date().toISOString(),
          accept_date: new Date().toISOString().split('T')[0]
        })
        .eq("id", collectionId);

      if (updateError) throw updateError;

      setSuccess("Collection approved successfully!");
      loadData(); // Refresh data
    } catch (e: any) {
      setError(e.message || "Failed to approve collection");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (collectionId: string) => {
    setProcessing(collectionId);
    setError("");
    setSuccess("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Update collection status to rejected
      const { error: updateError } = await supabase
        .from("subscription_collections")
        .update({
          status: 'rejected',
          accepted_by_user_id: session.user.id,
          accepted_at: new Date().toISOString()
        })
        .eq("id", collectionId);

      if (updateError) throw updateError;

      setSuccess("Collection rejected successfully!");
      loadData(); // Refresh data
    } catch (e: any) {
      setError(e.message || "Failed to reject collection");
    } finally {
      setProcessing(null);
    }
  };

  const handleBulkApprove = async (collectorUserId: string) => {
    if (!confirm(`Approve all pending collections for this collector?`)) return;

    setProcessing(`bulk-${collectorUserId}`);
    setError("");
    setSuccess("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Get all pending collections for this collector
      const { data: pendingCollections } = await supabase
        .from("subscription_collections")
        .select("id")
        .eq("masjid_id", session.user.id)
        .eq("collected_by_user_id", collectorUserId)
        .eq("status", "pending");

      if (!pendingCollections?.length) {
        setSuccess("No pending collections found for this collector");
        return;
      }

      // Update all pending collections
      const collectionIds = pendingCollections.map(c => c.id);
      const { error: updateError } = await supabase
        .from("subscription_collections")
        .update({
          status: 'accepted',
          accepted_by_user_id: session.user.id,
          accepted_at: new Date().toISOString(),
          accept_date: new Date().toISOString().split('T')[0]
        })
        .in("id", collectionIds);

      if (updateError) throw updateError;

      setSuccess(`${collectionIds.length} collections approved successfully!`);
      loadData(); // Refresh data
    } catch (e: any) {
      setError(e.message || "Failed to approve collections");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <AppShell title="Pending Collections">
        <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">
          Loading...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title="Pending Collections"
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
      {approvalStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="app-card p-4 text-center">
            <div className="text-2xl font-black text-amber-600">{approvalStats.total_pending}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending</div>
            <div className="text-xs text-amber-600">{approvalStats.total_pending_amount.toFixed(2)}</div>
          </div>
          <div className="app-card p-4 text-center">
            <div className="text-2xl font-black text-emerald-600">{approvalStats.total_accepted}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accepted</div>
            <div className="text-xs text-emerald-600">{approvalStats.total_accepted_amount.toFixed(2)}</div>
          </div>
          <div className="app-card p-4 text-center">
            <div className="text-2xl font-black text-rose-600">{approvalStats.total_rejected}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rejected</div>
            <div className="text-xs text-rose-600">{approvalStats.total_rejected_amount.toFixed(2)}</div>
          </div>
          <div className="app-card p-4 text-center">
            <div className="text-2xl font-black text-purple-600">{approvalStats.total_commission_paid.toFixed(2)}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Commission Paid</div>
          </div>
        </div>
      )}

      {/* Collector Waiting Balances */}
      {collectorBalances.length > 0 && (
        <div className="app-card p-5 mb-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
            Collector Waiting Balances
          </h2>
          <div className="space-y-2">
            {collectorBalances.map((balance) => (
              <div
                key={balance.collector_user_id}
                className="flex items-center justify-between p-3 border border-amber-200 rounded-2xl bg-amber-50"
              >
                <div>
                  <div className="font-bold text-sm text-amber-800">{balance.collector_email}</div>
                  <div className="text-xs text-amber-600">
                    {balance.total_collections_count} collections waiting
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-black text-amber-600">
                      {balance.total_waiting_amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-amber-500">waiting</div>
                  </div>
                  <button
                    onClick={() => handleBulkApprove(balance.collector_user_id)}
                    disabled={processing === `bulk-${balance.collector_user_id}`}
                    className="app-btn-primary px-4 py-2 text-xs disabled:opacity-50"
                  >
                    {processing === `bulk-${balance.collector_user_id}` ? 'Approving...' : 'Approve All'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="app-card p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by family code, name, or collector email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            {(["all", "pending", "accepted", "rejected"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-colors ${
                  statusFilter === status
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="app-card p-4 mb-6 bg-rose-50 border-rose-200">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-bold">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="app-card p-4 mb-6 bg-emerald-50 border-emerald-200">
          <div className="flex items-center gap-2 text-emerald-600">
            <Check className="w-4 h-4" />
            <span className="text-xs font-bold">{success}</span>
          </div>
        </div>
      )}

      {/* Collections List */}
      <div className="app-card p-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          Collections ({filteredCollections.length})
        </h2>
        <div className="space-y-2">
          {filteredCollections.length === 0 ? (
            <p className="text-[11px] font-bold text-slate-400 text-center py-8">
              No collections found
            </p>
          ) : (
            filteredCollections.map((collection) => (
              <div
                key={collection.id}
                className="border border-slate-100 rounded-2xl p-4 bg-white"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="font-bold text-slate-800">
                        {collection.family?.family_code} - {collection.family?.head_name}
                      </div>
                      <div className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                        collection.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        collection.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {collection.status}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mb-1">
                      Collected by: {collection.collector?.email || 'Unknown'}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(collection.created_at).toLocaleDateString()} at {new Date(collection.created_at).toLocaleTimeString()}
                    </div>
                    {collection.family?.address && (
                      <div className="text-xs text-slate-400">{collection.family.address}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-emerald-600">
                      {collection.amount.toFixed(2)}
                    </div>
                    {collection.commission_amount > 0 && (
                      <div className="text-xs text-purple-600 font-bold">
                        Commission: {collection.commission_amount.toFixed(2)} ({collection.commission_percent}%)
                      </div>
                    )}
                  </div>
                </div>

                {collection.notes && (
                  <div className="text-xs text-slate-500 mb-3 italic">
                    Notes: {collection.notes}
                  </div>
                )}

                {collection.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(collection.id)}
                      disabled={processing === collection.id}
                      className="flex-1 app-btn-primary py-2 text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {processing === collection.id ? (
                        'Processing...'
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          Approve
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(collection.id)}
                      disabled={processing === collection.id}
                      className="flex-1 app-btn-secondary py-2 text-xs disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {processing === collection.id ? (
                        'Processing...'
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          Reject
                        </>
                      )}
                    </button>
                  </div>
                )}

                {collection.status === 'accepted' && collection.accepted_at && (
                  <div className="text-xs text-emerald-600 font-bold">
                    Approved on {new Date(collection.accepted_at).toLocaleDateString()} at {new Date(collection.accepted_at).toLocaleTimeString()}
                  </div>
                )}

                {collection.status === 'rejected' && collection.accepted_at && (
                  <div className="text-xs text-rose-600 font-bold">
                    Rejected on {new Date(collection.accepted_at).toLocaleDateString()} at {new Date(collection.accepted_at).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
