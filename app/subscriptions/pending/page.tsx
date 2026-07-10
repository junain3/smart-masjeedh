"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle, Loader2, Users2, UserCircle2 } from "lucide-react";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { supabase } from "@/lib/supabase";
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

  const processApproval = async (collectionIds: string[]) => {
    if (!user || !tenantContext?.masjidId || collectionIds.length === 0) return;
    
    setBulkProcessing(true);
    
    try {
      const response = await fetch('/api/collections/approve-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

    pendingCollections.forEach((collection) => {
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
        collections,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [pendingCollections, collectorProfiles]);

  const selectedCollectorGroup = groupedCollectors.find(
    (group) => group.collectorId === selectedCollectorId
  );

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
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Pending Collections</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Pending Collection Approvals</h2>
            <div className="flex items-center justify-between mt-1">
              <p className="text-gray-600">
                Group pending collections by collector and approve them in a focused view.
              </p>
            </div>
          </div>
          
          <div className="p-6">
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
                        <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                          View
                        </span>
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
