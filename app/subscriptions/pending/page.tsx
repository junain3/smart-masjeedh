"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Check, AlertCircle, Loader2 } from "lucide-react";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useAppToast } from "@/components/ToastProvider";

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

  // Check if user has approval permission
  const canApprove = tenantContext?.permissions?.subscriptions_approve || tenantContext?.role === 'super_admin';

  useEffect(() => {
    if (!canApprove || !tenantContext?.masjidId) return;
    
    fetchPendingCollections();
  }, [canApprove, tenantContext?.masjidId, resumeTick]);

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
      
      setPendingCollections(data || []);
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
      const { data, error } = await supabase.rpc('approve_subscription_collections', {
        p_collection_ids: collectionIds,
        p_user_id: user.id,
        p_masjid_id: tenantContext.masjidId
      });

      if (error) throw error;

      const result = data as any;
      
      if (result.success) {
        toast({
          kind: "success",
          title: "Collections Approved",
          message: `Successfully approved ${result.success_count} collections. Total: Rs. ${result.total_amount?.toFixed(2)}`,
        });
        
        // Clear selection and refresh data
        setSelectedCollectionIds([]);
        fetchPendingCollections();
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

  const handleBulkConfirm = async () => {
    if (selectedCollectionIds.length === 0) return;
    await processApproval(selectedCollectionIds);
  };

  const handleAccept = async (collectionId: string) => {
    await processApproval([collectionId]);
  };

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
            <p className="text-gray-600 mt-1">
              Review and approve pending subscription collections
            </p>
          </div>
          
          <div className="p-6">
            {/* Summary Section */}
            {!loading && pendingCollections.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">Summary</h3>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Total Pending Collections:</span> {pendingCollections.length}
                      </p>
                      <p className="text-sm text-blue-700">
                        <span className="font-medium">Total Pending Amount:</span> Rs. {pendingCollections.reduce((sum, c) => sum + c.amount, 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <button
                      onClick={handleBulkConfirm}
                      disabled={bulkProcessing}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {bulkProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Confirm All Received
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-600">Loading pending collections...</span>
              </div>
            ) : !loading && pendingCollections.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Collections</h3>
                <p className="text-gray-600">There are no pending collections to review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingCollections.map((collection) => (
                  <div key={collection.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <input
                        type="checkbox"
                        checked={selectedCollectionIds.includes(collection.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCollectionIds([...selectedCollectionIds, collection.id]);
                          } else {
                            setSelectedCollectionIds(selectedCollectionIds.filter(id => id !== collection.id));
                          }
                        }}
                        className="mt-1 mr-3"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-4 mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {collection.family?.family_code} - {collection.family?.head_name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              Collected by: {collection.collector?.email}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">
                              Rs. {collection.amount.toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(collection.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        {collection.notes && (
                          <p className="text-sm text-gray-600 mt-2">
                            <span className="font-medium">Notes:</span> {collection.notes}
                          </p>
                        )}
                        
                        {collection.commission_amount > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Commission:</span> Rs. {collection.commission_amount.toFixed(2)} 
                            ({collection.commission_percent}%)
                          </p>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleAccept(collection.id)}
                          disabled={processing === collection.id}
                          className="flex items-center px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processing === collection.id ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Confirm Received
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
