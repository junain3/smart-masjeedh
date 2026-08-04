"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle, Loader2, Users2, UserCircle2, History, Calendar, Filter, Download } from "lucide-react";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { supabase } from "@/lib/supabase";
import { escapePdfHtml, getPdfMasjidName } from "@/lib/pdf-utils";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useAppToast } from "@/components/ToastProvider";
import { EmptyState } from "@/components/EmptyState";
import { BrandLoadingScreen } from "@/components/BrandLoadingScreen";

export const dynamic = 'force-dynamic';

type PendingCollection = {
  id: string;
  family_id: string;
  amount: number;
  commission_percent: number;
  commission_amount: number;
  notes?: string;
  date: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  accepted_by_user_id?: string;
  accepted_at?: string;
  collection_source: "collector" | "admin_direct";
  collected_by_user_id: string;
  family?: {
    family_code: string;
    head_name: string;
    address?: string;
    phone?: string;
  };
  collector?: {
    email: string;
  };
};

type HistoryCollection = {
  id: string;
  family_id: string;
  amount: number;
  commission_percent: number;
  commission_amount: number;
  notes?: string;
  date: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  accepted_by_user_id?: string;
  accepted_at?: string;
  collection_source: "collector" | "admin_direct";
  collected_by_user_id: string;
  families?: {
    family_code: string;
    head_name: string;
    address?: string;
    phone?: string;
  };
};

export default function SubscriptionsPendingPage() {
  const { user, tenantContext, loading: authLoading, resumeTick } = useSupabaseAuth();
  const { toast } = useAppToast();
  const [pendingCollections, setPendingCollections] = useState<PendingCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [collectorProfiles, setCollectorProfiles] = useState<Record<string, string>>({});
  const [selectedCollectorId, setSelectedCollectorId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<"all" | "collector" | "admin_direct">("all");
  
  // History tab state
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [historyCollections, setHistoryCollections] = useState<HistoryCollection[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");

  // Check if user has approval permission
  const canApprove = tenantContext?.permissions?.subscriptions_approve || tenantContext?.role === 'super_admin';

  useEffect(() => {
    if (!canApprove) {
      setLoading(false);
      return;
    }

    if (!tenantContext?.masjidId) {
      if (!authLoading) {
        setLoading(false);
        setPendingCollections([]);
      }
      return;
    }

    void fetchPendingCollections();
  }, [canApprove, tenantContext?.masjidId, resumeTick, authLoading]);

  useEffect(() => {
    if (activeTab === "history" && tenantContext?.masjidId) {
      void fetchHistoryCollections();
    }
  }, [activeTab, tenantContext?.masjidId]);

  const fetchPendingCollections = async () => {
    try {
      console.log("FETCH_PENDING_START", { masjidId: tenantContext?.masjidId });
      
      const { data, error } = await supabase
        .from("subscription_collections")
        .select("*")
        .eq("masjid_id", tenantContext?.masjidId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      console.log("FETCH_PENDING_RESULT", { data, error });

      if (error) {
        console.error("FETCH_PENDING_ERROR", error);
        throw error;
      }

      const collectionList = data || [];
      const collectorIds = Array.from(
        new Set(collectionList.map((c: any) => c.collected_by_user_id).filter(Boolean))
      ) as string[];

      let profileMap: Record<string, string> = {};
      if (collectorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", collectorIds);

        profileMap = Object.fromEntries(
          (profilesData || []).map((profile: any) => [
            profile.id,
            profile.full_name || profile.email || "Collector",
          ])
        );
      }

      setPendingCollections(collectionList);
      setCollectorProfiles(profileMap);
    } catch (error: any) {
      console.error("FETCH_PENDING_CATCH", error);
      toast({
        kind: "error",
        title: "Error",
        message: `Failed to load pending collections: ${error.message || error}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoryCollections = async () => {
    if (!tenantContext?.masjidId) return;
    
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_collections")
        .select(`
          *,
          families (
            family_code,
            head_name,
            address,
            phone
          )
        `)
        .eq("masjid_id", tenantContext.masjidId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("FETCH_HISTORY_ERROR", error);
        throw error;
      }

      const collectionList = data || [];
      const collectorIds = Array.from(
        new Set(collectionList.map((c: any) => c.collected_by_user_id).filter(Boolean))
      ) as string[];

      let profileMap: Record<string, string> = {};
      if (collectorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("user_profiles")
          .select("id, full_name, email")
          .in("id", collectorIds);

        profileMap = Object.fromEntries(
          (profilesData || []).map((profile: any) => [
            profile.id,
            profile.full_name || profile.email || "Unknown",
          ])
        );
      }

      setHistoryCollections(collectionList);
      setCollectorProfiles(prev => ({ ...prev, ...profileMap }));
    } catch (error: any) {
      console.error("FETCH_HISTORY_CATCH", error);
      toast({
        kind: "error",
        title: "Error",
        message: `Failed to load collection history: ${error.message || error}`,
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const processApproval = async (collectionIds: string[]) => {
    if (!user || !tenantContext?.masjidId || collectionIds.length === 0) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast({
        kind: "error",
        title: "Approval Error",
        message: "Please log in to approve collections",
      });
      return;
    }
    
    setBulkProcessing(true);
    
    try {
      const response = await fetch('/api/collections/approve-single', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(session.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({
          collection_ids: collectionIds,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to approve collections');
      }

      if (result.success) {
        if (result.sms_results?.some((sms: { success: boolean }) => !sms.success)) {
          console.error("[subscriptions/pending] auto SMS failures during approval", result.sms_results);
        }

        toast({
          kind: "success",
          title: "Collections Approved",
          message: `Successfully approved ${result.success_count} collections. Total: Rs. ${Number(result.total_amount || 0).toFixed(2)}`,
        });

        setSelectedCollectionIds([]);
        await fetchPendingCollections();
      } else {
        toast({
          kind: "error",
          title: "Approval Failed",
          message: result.error || "Failed to approve collections",
        });

        if (result.failures && result.failures.length > 0) {
          console.error("Approval failures:", result.failures);
        }
      }
    } catch (error: any) {
      console.error("PROCESS_APPROVAL_ERROR", error);
      toast({
        kind: "error",
        title: "Approval Error",
        message: error.message || "Failed to process approval",
      });
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleAccept = async (collectionId: string) => {
    await processApproval([collectionId]);
  };

  const handleApproveCollector = async (collectorId: string) => {
    const collectorCollections = pendingCollections.filter(
      (collection) => collection.collected_by_user_id === collectorId
    );

    if (collectorCollections.length === 0) {
      toast({
        kind: "error",
        title: "No Collections",
        message: "There are no pending collections for this collector.",
      });
      return;
    }

    await processApproval(collectorCollections.map((collection) => collection.id));
    setSelectedCollectorId(null);
  };

  const groupedCollectors = useMemo(() => {
    const groups = new Map<string, PendingCollection[]>();

    const filteredCollections = filterSource === "all" 
      ? pendingCollections 
      : pendingCollections.filter(c => c.collection_source === filterSource);

    filteredCollections.forEach((collection) => {
      const collectorId = collection.collected_by_user_id || "unassigned";
      const existing = groups.get(collectorId) || [];
      existing.push(collection);
      groups.set(collectorId, existing);
    });

    return Array.from(groups.entries())
      .map(([collectorId, collections]) => ({
        collectorId,
        collectorName: collectorId === "unassigned"
          ? "Unassigned Collector"
          : collectorProfiles[collectorId] || "Collector",
        collectionCount: collections.length,
        totalAmount: collections.reduce((sum, collection) => sum + Number(collection.amount || 0), 0),
        collectionSource: collections[0]?.collection_source || "collector",
        collections,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [pendingCollections, collectorProfiles, filterSource]);

  const selectedCollectorGroup = groupedCollectors.find(
    (group) => group.collectorId === selectedCollectorId
  );

  // History tab computed values
  const filteredHistoryCollections = useMemo(() => {
    let filtered = historyCollections;

    if (filterYear) {
      filtered = filtered.filter(c => {
        const collectionDate = new Date(c.date);
        return collectionDate.getFullYear().toString() === filterYear;
      });
    }

    if (filterMonth) {
      filtered = filtered.filter(c => {
        const collectionDate = new Date(c.date);
        return (collectionDate.getMonth() + 1).toString() === filterMonth;
      });
    }

    return filtered;
  }, [historyCollections, filterMonth, filterYear]);

  const historyGrandTotal = useMemo(() => {
    return filteredHistoryCollections.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }, [filteredHistoryCollections]);

  const availableYears = useMemo(() => {
    const years = new Set(
      historyCollections.map(c => new Date(c.date).getFullYear().toString())
    );
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [historyCollections]);

  const availableMonths = useMemo(() => {
    const months = new Set(
      historyCollections
        .filter(c => !filterYear || new Date(c.date).getFullYear().toString() === filterYear)
        .map(c => (new Date(c.date).getMonth() + 1).toString())
    );
    return Array.from(months).sort((a, b) => parseInt(a) - parseInt(b));
  }, [historyCollections, filterYear]);

  const monthNames = {
    "1": "January", "2": "February", "3": "March", "4": "April",
    "5": "May", "6": "June", "7": "July", "8": "August",
    "9": "September", "10": "October", "11": "November", "12": "December"
  };

  const handlePrintHistory = async () => {
    try {
      const masjidName = await getPdfMasjidName(supabase, tenantContext?.masjidId);

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Collection History - ${escapePdfHtml(masjidName)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              color: #1f2937;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #064e3b;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #064e3b;
              font-size: 28px;
              margin: 0 0 5px 0;
              font-weight: bold;
            }
            .header h2 {
              color: #047857;
              font-size: 18px;
              margin: 0;
              font-weight: normal;
            }
            .meta {
              text-align: right;
              color: #6b7280;
              font-size: 12px;
              margin-bottom: 20px;
            }
            .summary-box {
              background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
              border: 2px solid #059669;
              border-radius: 12px;
              padding: 20px;
              margin-bottom: 25px;
            }
            .summary-box h3 {
              color: #064e3b;
              margin: 0 0 15px 0;
              font-size: 16px;
              font-weight: bold;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #a7f3d0;
            }
            .summary-row:last-child {
              border-bottom: none;
            }
            .summary-label {
              color: #047857;
              font-weight: 500;
            }
            .summary-value {
              color: #064e3b;
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            th {
              background-color: #064e3b;
              color: white;
              font-weight: bold;
              padding: 12px 10px;
              text-align: left;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            td {
              border: 1px solid #e5e7eb;
              padding: 10px;
              font-size: 13px;
            }
            tbody tr:nth-child(even) {
              background-color: #f9fafb;
            }
            tbody tr:hover {
              background-color: #f3f4f6;
            }
            tfoot {
              background-color: #064e3b;
              color: white;
              font-weight: bold;
            }
            tfoot td {
              border: none;
              padding: 15px 10px;
            }
            .badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 20px;
              font-size: 11px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .badge-admin {
              background-color: #f3e8ff;
              color: #7c3aed;
              border: 1px solid #c4b5fd;
            }
            .badge-collector {
              background-color: #dbeafe;
              color: #2563eb;
              border: 1px solid #93c5fd;
            }
            .badge-accepted {
              background-color: #dcfce7;
              color: #16a34a;
              border: 1px solid #86efac;
            }
            .badge-rejected {
              background-color: #fee2e2;
              color: #dc2626;
              border: 1px solid #fca5a5;
            }
            .badge-pending {
              background-color: #fef3c7;
              color: #d97706;
              border: 1px solid #fcd34d;
            }
            .amount {
              font-weight: 600;
              color: #064e3b;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .summary-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${escapePdfHtml(masjidName)}</h1>
            <h2>Collection History Report</h2>
          </div>
          
          <div class="meta">
            Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
            <br>
            ${filterYear ? `Year: ${escapePdfHtml(filterYear)}` : 'All Years'} 
            ${filterMonth ? `| Month: ${escapePdfHtml(monthNames[filterMonth as keyof typeof monthNames])}` : ''}
          </div>

          <div class="summary-box">
            <h3>Summary</h3>
            <div class="summary-row">
              <span class="summary-label">Total Collections</span>
              <span class="summary-value">${filteredHistoryCollections.length}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Grand Total</span>
              <span class="summary-value">Rs. ${historyGrandTotal.toFixed(2)}</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Family</th>
                <th>Collected By</th>
                <th>Source</th>
                <th>Status</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${filteredHistoryCollections.map(collection => `
                <tr>
                  <td>${new Date(collection.date).toLocaleDateString()}</td>
                  <td>
                    <strong>${escapePdfHtml(collection.families?.head_name || 'Unknown')}</strong>
                    <br>
                    <small style="color: #6b7280;">${escapePdfHtml(collection.families?.family_code || '')}</small>
                  </td>
                  <td>${escapePdfHtml(collectorProfiles[collection.collected_by_user_id] || 'Unknown')}</td>
                  <td>
                    <span class="badge ${collection.collection_source === 'admin_direct' ? 'badge-admin' : 'badge-collector'}">
                      ${escapePdfHtml(collection.collection_source === 'admin_direct' ? 'Admin Direct' : 'Collector')}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-${collection.status}">
                      ${escapePdfHtml(collection.status.charAt(0).toUpperCase() + collection.status.slice(1))}
                    </span>
                  </td>
                  <td class="amount" style="text-align: right;">Rs. ${Number(collection.amount || 0).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" style="text-align: right;">Grand Total</td>
                <td style="text-align: right;">Rs. ${historyGrandTotal.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([printContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      
      const printWindow = window.open(url, '_blank');
      
      if (!printWindow) {
        toast({
          kind: "error",
          title: "Print Error",
          message: "Please allow popups to print the collection history.",
        });
        URL.revokeObjectURL(url);
        return;
      }

      printWindow.onload = () => {
        printWindow.print();
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        kind: "error",
        title: "Print Error",
        message: `PDF generation failed: ${(error as Error).message}`,
      });
    }
  };

  if (authLoading || (loading && canApprove)) {
    return <BrandLoadingScreen />;
  }

  if (!canApprove) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to approve collections</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Home
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold text-gray-900">Pending Collections</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Collection Management</h2>
              {/* Tab Navigation */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === "pending"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Pending Approvals
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    activeTab === "history"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Collection History
                </button>
              </div>
            </div>
            <p className="text-gray-600 mt-1">
              {activeTab === "pending" 
                ? "Group pending collections by collector and approve them in a focused view."
                : "View complete history of all subscription collections with filtering options."
              }
            </p>
          </div>
          
          <div className="p-6">
            {activeTab === "pending" ? (
              <>
                {/* Filter Section */}
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Filter by source:</span>
                  <button
                    onClick={() => setFilterSource("all")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      filterSource === "all"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterSource("collector")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      filterSource === "collector"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Collector
                  </button>
                  <button
                    onClick={() => setFilterSource("admin_direct")}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      filterSource === "admin_direct"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Admin Direct
                  </button>
                </div>

                {/* Summary Section */}
                {!loading && pendingCollections.length > 0 && (
                  <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-blue-900">Collector Summary</h3>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-blue-700">
                          <p>
                            <span className="font-medium">Pending collectors:</span> {groupedCollectors.length}
                          </p>
                          <p>
                            <span className="font-medium">Pending collections:</span> {pendingCollections.length}
                          </p>
                          <p>
                            <span className="font-medium">Pending amount:</span> Rs. {pendingCollections.reduce((sum, c) => sum + Number(c.amount || 0), 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/80 px-3 py-2 text-sm text-blue-800">
                        Select a collector card to review and approve their pending collections.
                      </div>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center">
                    <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-emerald-600" />
                    <p className="text-sm font-medium text-neutral-500">Loading pending collections...</p>
                  </div>
                ) : pendingCollections.length === 0 ? (
                  <EmptyState
                    title="No pending collections"
                    description="All subscription collections have been reviewed. New submissions from collectors will appear here for approval."
                    icon={<Check className="h-7 w-7 text-emerald-500" />}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {groupedCollectors.map((group) => (
                        <button
                          key={group.collectorId}
                          type="button"
                          onClick={() => setSelectedCollectorId(group.collectorId)}
                          className="rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between">
                            <div className="rounded-full bg-emerald-50 p-3 text-emerald-600">
                              {group.collectorId === "unassigned" ? (
                                <UserCircle2 className="h-6 w-6" />
                              ) : (
                                <Users2 className="h-6 w-6" />
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                {group.collectionSource === "admin_direct" ? "Admin Direct" : "Collector"}
                              </span>
                              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                                View
                              </span>
                            </div>
                          </div>
                          <h3 className="mt-4 font-semibold text-gray-900">{group.collectorName}</h3>
                          <p className="mt-1 text-sm text-gray-600">{group.collectionCount} pending collections</p>
                          <div className="mt-4 flex items-center justify-between text-sm">
                            <span className="text-gray-500">Total amount</span>
                            <span className="font-semibold text-gray-900">Rs. {group.totalAmount.toFixed(2)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* History Tab Content */}
                {/* Filter Section */}
                <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Filters</span>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
                      <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">All Years</option>
                        {availableYears.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
                      <select
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        disabled={!filterYear}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">All Months</option>
                        {availableMonths.map(month => (
                          <option key={month} value={month}>{monthNames[month as keyof typeof monthNames]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => { setFilterYear(""); setFilterMonth(""); }}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>

                {/* Summary Section */}
                {!historyLoading && filteredHistoryCollections.length > 0 && (
                  <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-emerald-900">Summary</h3>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-emerald-700">
                          <p>
                            <span className="font-medium">Total collections:</span> {filteredHistoryCollections.length}
                          </p>
                          <p>
                            <span className="font-medium">Grand total:</span> Rs. {historyGrandTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handlePrintHistory}
                        className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-200 transition"
                      >
                        <Download className="w-4 h-4" />
                        Download PDF
                      </button>
                    </div>
                  </div>
                )}

                {historyLoading ? (
                  <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center">
                    <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-emerald-600" />
                    <p className="text-sm font-medium text-neutral-500">Loading collection history...</p>
                  </div>
                ) : filteredHistoryCollections.length === 0 ? (
                  <EmptyState
                    title="No collections found"
                    description={historyCollections.length === 0 
                      ? "No collections have been recorded yet."
                      : "No collections match the selected filters."
                    }
                    icon={<Calendar className="h-7 w-7 text-emerald-500" />}
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Family
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Collected By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Source
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredHistoryCollections.map((collection) => (
                          <tr key={collection.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {new Date(collection.date).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>
                                <div className="font-medium">{collection.families?.head_name}</div>
                                <div className="text-gray-500">{collection.families?.family_code}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {collectorProfiles[collection.collected_by_user_id] || "Unknown"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                collection.collection_source === "admin_direct"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}>
                                {collection.collection_source === "admin_direct" ? "Admin Direct" : "Collector"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                collection.status === "accepted"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : collection.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}>
                                {collection.status.charAt(0).toUpperCase() + collection.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                              Rs. {Number(collection.amount || 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                          <td colSpan={5} className="px-6 py-4 text-sm text-gray-900">
                            Grand Total
                          </td>
                          <td className="px-6 py-4 text-sm text-right text-gray-900">
                            Rs. {historyGrandTotal.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {selectedCollectorGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Collector view</p>
                <h3 className="text-xl font-semibold text-gray-900">{selectedCollectorGroup.collectorName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApproveCollector(selectedCollectorGroup.collectorId)}
                  disabled={bulkProcessing}
                  className="flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Approve All
                </button>
                <button
                  onClick={() => setSelectedCollectorId(null)}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-semibold text-emerald-900">Pending collections for this collector</h4>
                    <p className="text-sm text-emerald-700">
                      {selectedCollectorGroup.collectionCount} collection(s) totaling Rs. {selectedCollectorGroup.totalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {selectedCollectorGroup.collections.map((collection) => (
                  <div key={collection.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-semibold text-gray-900">
                            {collection.family?.family_code} - {collection.family?.head_name}
                          </h3>
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                            Pending
                          </span>
                          {collection.collection_source === "admin_direct" && (
                            <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                              Admin Direct
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                          Collected by: {collectorProfiles[collection.collected_by_user_id] || collection.collector?.email || "Collector"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                          <span>Amount: Rs. {Number(collection.amount || 0).toFixed(2)}</span>
                          <span>Date: {new Date(collection.created_at).toLocaleDateString()}</span>
                        </div>
                        {collection.notes && (
                          <p className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Notes:</span> {collection.notes}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => handleAccept(collection.id)}
                        disabled={processing === collection.id}
                        className="inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {processing === collection.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-2 h-4 w-4" />
                        )}
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
