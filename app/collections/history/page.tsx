"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Download, Filter, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchUserNames } from "@/lib/user-utils";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useAppToast } from "@/components/ToastProvider";
import { EmptyState } from "@/components/EmptyState";
import { BrandLoadingScreen } from "@/components/BrandLoadingScreen";

export const dynamic = 'force-dynamic';

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
};

export default function CollectionHistoryPage() {
  const { user, tenantContext, loading: authLoading, resumeTick } = useSupabaseAuth();
  const { toast } = useAppToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [collectorProfiles, setCollectorProfiles] = useState<Record<string, string>>({});

  // Check if user has permission to view collections
  const canView = tenantContext?.permissions?.subscriptions_collect || 
                 tenantContext?.permissions?.subscriptions_approve || 
                 tenantContext?.role === 'super_admin';

  useEffect(() => {
    if (!canView) {
      setLoading(false);
      return;
    }

    if (!tenantContext?.masjidId) {
      if (!authLoading) {
        setLoading(false);
        setCollections([]);
      }
      return;
    }

    void fetchCollections();
  }, [canView, tenantContext?.masjidId, resumeTick, authLoading]);

  const fetchCollections = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_collections")
        .select(`
          *,
          family (
            family_code,
            head_name,
            address,
            phone
          )
        `)
        .eq("masjid_id", tenantContext?.masjidId)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("FETCH_COLLECTIONS_ERROR", error);
        throw error;
      }

      const collectionList = data || [];
      const collectorIds = Array.from(
        new Set(collectionList.map((c: any) => c.collected_by_user_id).filter(Boolean))
      ) as string[];

      // Fetch user names using the new helper function
      let profileMap: Record<string, string> = {};
      if (collectorIds.length > 0) {
        profileMap = await fetchUserNames(supabase, collectorIds);
      }

      setCollections(collectionList);
      setCollectorProfiles(profileMap);
    } catch (error: any) {
      console.error("FETCH_COLLECTIONS_CATCH", error);
      toast({
        kind: "error",
        title: "Error",
        message: `Failed to load collection history: ${error.message || error}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCollections = useMemo(() => {
    let filtered = collections;

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
  }, [collections, filterMonth, filterYear]);

  const grandTotal = useMemo(() => {
    return filteredCollections.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  }, [filteredCollections]);

  const availableYears = useMemo(() => {
    const years = new Set(
      collections.map(c => new Date(c.date).getFullYear().toString())
    );
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [collections]);

  const availableMonths = useMemo(() => {
    const months = new Set(
      collections
        .filter(c => !filterYear || new Date(c.date).getFullYear().toString() === filterYear)
        .map(c => (new Date(c.date).getMonth() + 1).toString())
    );
    return Array.from(months).sort((a, b) => parseInt(a) - parseInt(b));
  }, [collections, filterYear]);

  const monthNames = {
    "1": "January", "2": "February", "3": "March", "4": "April",
    "5": "May", "6": "June", "7": "July", "8": "August",
    "9": "September", "10": "October", "11": "November", "12": "December"
  };

  if (authLoading || (loading && canView)) {
    return <BrandLoadingScreen />;
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-900 mb-2">Access Denied</p>
          <p className="text-gray-600">You don't have permission to view collection history</p>
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
              <Link href="/collections" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Collections
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Collection History</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Collection History</h2>
            <p className="text-gray-600 mt-1">
              View complete history of all subscription collections with filtering options.
            </p>
          </div>
          
          <div className="p-6">
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
            {!loading && filteredCollections.length > 0 && (
              <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-900">Summary</h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-emerald-700">
                      <p>
                        <span className="font-medium">Total collections:</span> {filteredCollections.length}
                      </p>
                      <p>
                        <span className="font-medium">Grand total:</span> Rs. {grandTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center">
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-emerald-600" />
                <p className="text-sm font-medium text-neutral-500">Loading collection history...</p>
              </div>
            ) : filteredCollections.length === 0 ? (
              <EmptyState
                title="No collections found"
                description={collections.length === 0 
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
                    {filteredCollections.map((collection) => (
                      <tr key={collection.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(collection.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            <div className="font-medium">{collection.family?.head_name}</div>
                            <div className="text-gray-500">{collection.family?.family_code}</div>
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
                        Rs. {grandTotal.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
