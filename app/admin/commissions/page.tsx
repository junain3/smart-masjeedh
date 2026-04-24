"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, DollarSign, Calendar, User, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { useAppToast } from "@/components/ToastProvider";

export default function CommissionsPage() {
  const { user, tenantContext } = useSupabaseAuth();
  const { toast, confirm } = useAppToast();
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  
  // Payout Modal states
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [selectedCollector, setSelectedCollector] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");
  const [collectorBalance, setCollectorBalance] = useState(0);
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);

  useEffect(() => {
    if (tenantContext?.masjidId) {
      fetchCommissions();
    }
  }, [tenantContext?.masjidId, filter]);

  async function fetchCommissions() {
    if (!supabase || !tenantContext?.masjidId) return;

    setLoading(true);
    try {
      let query = supabase
        .from('staff_commissions')
        .select(`
          *,
        .eq('masjid_id', tenantContext.masjidId);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setCommissions(data || []);
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to fetch commissions" });
    } finally {
      setLoading(false);
    }
  }

  async function approveCommission(commissionId: string) {
    try {
      const { error } = await supabase
        .from('staff_commissions')
        .update({
          status: 'approved',
          approved_by_user_id: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', commissionId)
        .eq('masjid_id', tenantContext?.masjidId);

      if (error) throw error;

      toast({ kind: "success", title: "Success", message: "Commission approved successfully" });
      fetchCommissions();
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to approve commission" });
    }
  }

  async function rejectCommission(commissionId: string) {
    const ok = await confirm({
      title: "Reject Commission",
      message: "Are you sure you want to reject this commission?",
      confirmText: "Reject",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('staff_commissions')
        .update({
          status: 'rejected',
          approved_by_user_id: user?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', commissionId)
        .eq('masjid_id', tenantContext?.masjidId);

      if (error) throw error;

      toast({ kind: "success", title: "Success", message: "Commission rejected successfully" });
      fetchCommissions();
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to reject commission" });
    }
  }

  const openPayoutModal = async (collectorId: string) => {
    setSelectedCollector(collectorId);
    setPayoutAmount("");
    setPayoutNote("");
    
    // Fetch collector's current balance
    try {
      const { data: collections } = await supabase
        .from('subscription_collections')
        .select('commission_amount')
        .eq('collected_by_user_id', collectorId)
        .eq('masjid_id', tenantContext?.masjidId)
        .eq('status', 'accepted');

      const { data: payments } = await supabase
        .from('collector_commission_payments')
        .select('amount')
        .eq('collector_user_id', collectorId)
        .eq('masjid_id', tenantContext?.masjidId);

      const earned = collections?.reduce((sum, item) => sum + (item.commission_amount || 0), 0) || 0;
      const paid = payments?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
      
      setCollectorBalance(earned - paid);
      setShowPayoutModal(true);
    } catch (err) {
      toast({ kind: "error", title: "Error", message: "Failed to fetch collector balance" });
    }
  };

  const handlePayoutSubmit = async () => {
    if (!selectedCollector || !payoutAmount || Number(payoutAmount) <= 0) {
      toast({ kind: "error", title: "Error", message: "Please enter a valid amount" });
      return;
    }

    setPayoutSubmitting(true);
    try {
      // Insert payment record
      const { error: paymentError } = await supabase
        .from('collector_commission_payments')
        .insert({
          masjid_id: tenantContext?.masjidId,
          collector_user_id: selectedCollector,
          amount: Number(payoutAmount),
          paid_at: new Date().toISOString(),
          paid_by_user_id: user?.id,
          note: payoutNote || 'Commission payout'
        });

      if (paymentError) throw paymentError;

      // Refresh commissions data
      await fetchCommissions();
      
      // Close modal and reset
      setShowPayoutModal(false);
      setSelectedCollector(null);
      setPayoutAmount("");
      setPayoutNote("");
      
      toast({ kind: "success", title: "Success", message: "Payment of Rs. " + Number(payoutAmount).toLocaleString() + " processed successfully!" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: "Payment failed: " + err.message });
    } finally {
      setPayoutSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              <Link href="/admin" className="flex items-center text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Admin
              </Link>
            </div>
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Commission Management</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={"py-4 px-6 border-b-2 font-medium text-sm capitalize " + (filter === status ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300")}
                >
                  {status} ({status === 'all' ? commissions.length : commissions.filter(c => c.status === status).length})
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Commissions List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {commissions.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No commissions found</h3>
              <p className="text-sm text-gray-600">
                {filter === 'pending' ? 'No pending commissions to review' : 'No commissions match this filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Family</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <User className="w-5 h-5 text-gray-400 mr-2" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {commission.staff_user?.email}
                            </div>
                            <div className="text-xs text-gray-500">Collected by: {commission.collection?.collected_by_user?.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {commission.collection?.family?.head_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {commission.collection?.family?.family_code}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        Rs. {commission.collection_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          Rs. {commission.commission_amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {commission.commission_percent}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(commission.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={"inline-flex px-2 py-1 text-xs font-semibold rounded-full " + getStatusColor(commission.status)}>
                          {commission.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {commission.status === 'pending' && (
                            <>
                              <button
                                onClick={() => approveCommission(commission.id)}
                                className="text-green-600 hover:text-green-900"
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => rejectCommission(commission.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openPayoutModal(commission.staff_user_id)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Pay Commission"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 -mx-8 -mt-8 px-8 pt-8 pb-6 rounded-t-3xl mb-6">
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <h2 className="text-xl font-bold">Pay Commission</h2>
                  <p className="text-blue-100 text-sm">Process commission payment</p>
                </div>
                <button 
                  onClick={() => setShowPayoutModal(false)}
                  className="text-white hover:bg-blue-500 p-2 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Current Balance Display */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
              <div className="flex justify-between items-center">
                <span className="text-blue-700 font-medium">Available Balance:</span>
                <span className="text-blue-900 font-bold text-lg">Rs. {collectorBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payout Amount (Rs.)
                </label>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={payoutSubmitting}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Feb 2026 Commission"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={payoutSubmitting}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPayoutModal(false)}
                className="flex-1 py-3 border border-gray-300 rounded-2xl font-medium hover:bg-gray-50 transition-colors"
                disabled={payoutSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handlePayoutSubmit}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all"
                disabled={payoutSubmitting}
              >
                {payoutSubmitting ? 'Processing...' : 'Pay Commission'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}
}
