"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Commission {
  id: string;
  collector_id: string;
  collector_name: string;
  amount: number;
  collection_date: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface CommissionApprovalProps {
  masjidId: string;
}

export default function CommissionApproval({ masjidId }: CommissionApprovalProps) {
  const [pendingCommissions, setPendingCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingCommissions();
  }, [masjidId]);

  const fetchPendingCommissions = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("commissions")
        .select(`
          id,
          collector_id,
          amount,
          collection_date,
          status,
          created_at,
          staff!collector_id (
            name
          )
        `)
        .eq("masjid_id", masjidId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const commissions: Commission[] = (data || []).map((item: any) => ({
        id: item.id,
        collector_id: item.collector_id,
        collector_name: item.staff?.name || "Unknown",
        amount: item.amount,
        collection_date: item.collection_date,
        status: item.status,
        created_at: item.created_at
      }));

      setPendingCommissions(commissions);
    } catch (error) {
      console.error("Error fetching pending commissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (commissionId: string) => {
    try {
      setProcessing(commissionId);
      
      // Get commission details
      const { data: commission, error: fetchError } = await supabase
        .from("commissions")
        .select("*")
        .eq("id", commissionId)
        .single();

      if (fetchError) throw fetchError;

      // Update commission status
      const { error: updateError } = await supabase
        .from("commissions")
        .update({ status: "approved" })
        .eq("id", commissionId);

      if (updateError) throw updateError;

      // Add to staff's salary ledger
      const { error: ledgerError } = await supabase
        .from("salary_ledger")
        .insert({
          staff_id: commission.collector_id,
          masjid_id: masjidId,
          amount: commission.amount,
          type: "commission",
          description: `Commission approved for collection on ${commission.collection_date}`,
          transaction_date: new Date().toISOString().split("T")[0],
          status: "approved"
        });

      if (ledgerError) throw ledgerError;

      // Refresh the list
      await fetchPendingCommissions();
    } catch (error) {
      console.error("Error approving commission:", error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (commissionId: string) => {
    try {
      setProcessing(commissionId);
      
      const { error } = await supabase
        .from("commissions")
        .update({ status: "rejected" })
        .eq("id", commissionId);

      if (error) throw error;

      // Refresh the list
      await fetchPendingCommissions();
    } catch (error) {
      console.error("Error rejecting commission:", error);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Commission Approval</h3>
        <div className="text-center py-4">Loading pending commissions...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Commission Approval</h3>
      
      {pendingCommissions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No pending commissions to approve
        </div>
      ) : (
        <div className="space-y-4">
          {pendingCommissions.map((commission) => (
            <div key={commission.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {commission.collector_name}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Collection Date: {new Date(commission.collection_date).toLocaleDateString()}
                  </div>
                  <div className="text-lg font-semibold text-emerald-600 mt-2">
                    ₹{commission.amount.toLocaleString()}
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleApprove(commission.id)}
                    disabled={processing === commission.id}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing === commission.id ? "Processing..." : "Approve"}
                  </button>
                  <button
                    onClick={() => handleReject(commission.id)}
                    disabled={processing === commission.id}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing === commission.id ? "Processing..." : "Reject"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
