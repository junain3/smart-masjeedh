"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Plus, Users, Wallet, Calendar, X, Check, AlertCircle, Search, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { Html5QrcodeScanner } from "html5-qrcode";
import { AppShell } from "@/components/AppShell";
import jsPDF from "jspdf";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address?: string;
  phone?: string;
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
  family?: Family;
};

type CollectorWaitingBalance = {
  total_waiting_amount: number;
  total_collections_count: number;
};

type FamilySubscriptionStatus = {
  family_id: string;
  total_paid: number;
  waiting_amount: number;
  approved_amount: number;
  last_payment_date: string;
};

export default function CollectionsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [familySubscriptions, setFamilySubscriptions] = useState<Map<string, FamilySubscriptionStatus>>(new Map());
  const [waitingBalance, setWaitingBalance] = useState<CollectorWaitingBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [commissionRate, setCommissionRate] = useState(0);

  const t = translations[lang];

  // Filter families based on search term
  const filteredFamilies = useMemo(() => {
    if (!searchTerm) return families;
    const term = searchTerm.toLowerCase();
    return families.filter(family => 
      family.family_code.toLowerCase().includes(term) ||
      family.head_name.toLowerCase().includes(term) ||
      (family.address && family.address.toLowerCase().includes(term))
    );
  }, [families, searchTerm]);

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
        familiesResponse,
        collectionsResponse,
        balanceResponse,
        subscriptionResponse,
        profileResponse
      ] = await Promise.all([
        // Load families
        supabase
          .from("families")
          .select("id, family_code, head_name, address, phone")
          .eq("masjid_id", session.user.id)
          .order("family_code"),
        
        // Load my collections
        supabase
          .from("subscription_collections")
          .select(`
            *,
            family:families(id, family_code, head_name, address)
          `)
          .eq("masjid_id", session.user.id)
          .eq("collected_by_user_id", session.user.id)
          .order("created_at", { ascending: false }),
        
        // Load my waiting balance
        supabase
          .rpc("get_collector_waiting_balance", { p_collector_user_id: session.user.id }),
        
        // Load family subscription statuses
        supabase
          .from("family_subscription_payments")
          .select("family_id, amount, status, payment_date")
          .eq("masjid_id", session.user.id),
        
        // Load my commission rate
        supabase
          .from("subscription_collector_profiles")
          .select("default_commission_percent")
          .eq("masjid_id", session.user.id)
          .eq("user_id", session.user.id)
          .single()
      ]);

      const familiesData = familiesResponse.data;
      const collectionsData = collectionsResponse.data;
      const balanceData = balanceResponse.data;
      const subscriptionData = subscriptionResponse.data;
      const profileData = profileResponse.data;

      // Process family subscription statuses
      const subscriptionMap = new Map<string, FamilySubscriptionStatus>();
      subscriptionData?.forEach(payment => {
        const existing = subscriptionMap.get(payment.family_id) || {
          family_id: payment.family_id,
          total_paid: 0,
          waiting_amount: 0,
          approved_amount: 0,
          last_payment_date: payment.payment_date
        };
        
        existing.total_paid += payment.amount;
        if (payment.status === 'waiting') {
          existing.waiting_amount += payment.amount;
        } else if (payment.status === 'approved') {
          existing.approved_amount += payment.amount;
        }
        
        if (payment.payment_date > existing.last_payment_date) {
          existing.last_payment_date = payment.payment_date;
        }
        
        subscriptionMap.set(payment.family_id, existing);
      });

      setFamilies(familiesData || []);
      setCollections(collectionsData || []);
      setFamilySubscriptions(subscriptionMap);
      setWaitingBalance(balanceData?.[0] || null);
      setCommissionRate(profileData?.default_commission_percent || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text("Staff Collections Report", 14, 15);
    
    const tableData = collections.map(c => [
      c.family?.family_code || '',
      c.family?.head_name || '',
      c.date,
      `Rs. ${c.amount.toLocaleString()}`,
      c.commission_percent + '%',
      `Rs. ${c.commission_amount.toLocaleString()}`,
      c.status
    ]);

    doc.autoTable({
      startY: 20,
      head: [["Family Code", "Head Name", "Date", "Amount", "Commission %", "Commission", "Status"]],
      body: tableData,
    });

    doc.save("staff_collections.pdf");
  };

  const startScanner = () => {
    setIsScannerOpen(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        (decodedText) => {
          // Find family by QR code
          const family = families.find(f => f.family_code === decodedText);
          if (family) {
            setSelectedFamilyId(family.id);
            setIsScannerOpen(false);
            scanner.clear();
          } else {
            setError("Family not found for this QR code");
          }
        },
        (error) => {
          // Handle scan error silently
        }
      );
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamilyId || !amount) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const amountNum = parseFloat(amount);
      const commissionAmount = (amountNum * commissionRate) / 100;

      const { data, error: insertError } = await supabase
        .from("subscription_collections")
        .insert({
          masjid_id: session.user.id,
          family_id: selectedFamilyId,
          amount: amountNum,
          commission_percent: commissionRate,
          commission_amount: commissionAmount,
          notes: notes || null,
          collected_by_user_id: session.user.id,
          date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setSuccess("Collection recorded successfully!");
      setIsModalOpen(false);
      setSelectedFamilyId("");
      setAmount("");
      setNotes("");
      loadData(); // Refresh data
    } catch (e: any) {
      setError(e.message || "Failed to record collection");
    } finally {
      setSubmitting(false);
    }
  };

  const getFamilySubscriptionStatus = (familyId: string) => {
    return familySubscriptions.get(familyId);
  };

  const stats = useMemo(() => {
    const total = collections.reduce((sum, c) => sum + c.amount, 0);
    const pending = collections.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
    const approved = collections.filter(c => c.status === 'accepted').reduce((sum, c) => sum + c.amount, 0);
    const rejected = collections.filter(c => c.status === 'rejected').reduce((sum, c) => sum + c.amount, 0);
    const totalCommission = collections.reduce((sum, c) => sum + (c.commission_amount || 0), 0);

    return { total, pending, approved, rejected, totalCommission };
  }, [collections]);

  if (loading) {
    return (
      <AppShell title="Subscription Collections">
        <div className="app-card p-6 text-center text-[11px] font-bold text-slate-400">
          Loading...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title="Subscription Collections"
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-emerald-600">{stats.total.toFixed(2)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Collected</div>
        </div>
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-amber-600">{stats.pending.toFixed(2)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Waiting Approval</div>
        </div>
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-blue-600">{stats.approved.toFixed(2)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Approved</div>
        </div>
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-purple-600">{stats.totalCommission.toFixed(2)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">My Commission</div>
        </div>
      </div>

      {/* Waiting Balance Card */}
      {waitingBalance && waitingBalance.total_waiting_amount > 0 && (
        <div className="app-card p-4 mb-6 bg-amber-50 border-amber-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-amber-800">Waiting Balance</div>
              <div className="text-xs text-amber-600">
                {waitingBalance.total_collections_count} collections pending approval
              </div>
            </div>
            <div className="text-2xl font-black text-amber-600">
              {waitingBalance.total_waiting_amount.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full app-btn-primary py-4 mb-6 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Collection
      </button>

      {/* Recent Collections */}
      <div className="app-card p-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          My Collections
        </h2>
        <div className="space-y-2">
          {collections.length === 0 ? (
            <p className="text-[11px] font-bold text-slate-400 text-center py-8">
              No collections yet
            </p>
          ) : (
            collections.map((collection) => (
              <div
                key={collection.id}
                className="border border-slate-100 rounded-2xl p-4 bg-white"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-slate-800">
                      {collection.family?.family_code} - {collection.family?.head_name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {new Date(collection.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-600">
                      {collection.amount.toFixed(2)}
                    </div>
                    <div className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full ${
                      collection.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      collection.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {collection.status}
                    </div>
                  </div>
                </div>
                {collection.commission_amount > 0 && (
                  <div className="text-xs text-purple-600 font-bold">
                    Commission: {collection.commission_amount.toFixed(2)} ({collection.commission_percent}%)
                  </div>
                )}
                {collection.notes && (
                  <div className="text-xs text-slate-500 mt-1">{collection.notes}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Collection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">Add Collection</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-2xl"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* QR Scanner */}
              <div>
                <button
                  type="button"
                  onClick={startScanner}
                  className="w-full app-btn-secondary py-3 flex items-center justify-center gap-2"
                >
                  <QrCode className="w-5 h-5" />
                  Scan QR Code
                </button>
              </div>

              {/* Search */}
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search family by code or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                  />
                </div>
              </div>

              {/* Family Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Select Family
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-2xl">
                  {filteredFamilies.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      {searchTerm ? 'No families found' : 'No families available'}
                    </div>
                  ) : (
                    filteredFamilies.map((family) => {
                      const subscriptionStatus = getFamilySubscriptionStatus(family.id);
                      return (
                        <div
                          key={family.id}
                          onClick={() => setSelectedFamilyId(family.id)}
                          className={`p-3 border-b border-slate-100 last:border-b-0 cursor-pointer hover:bg-emerald-50 transition-colors ${
                            selectedFamilyId === family.id ? 'bg-emerald-50 border-emerald-200' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-sm text-slate-800">
                                {family.family_code} - {family.head_name}
                              </div>
                              {family.address && (
                                <div className="text-xs text-slate-400">{family.address}</div>
                              )}
                            </div>
                            {subscriptionStatus && (
                              <div className="text-xs text-right">
                                <div className="text-emerald-600 font-bold">
                                  {subscriptionStatus.approved_amount.toFixed(2)}
                                </div>
                                <div className="text-amber-600">
                                  {subscriptionStatus.waiting_amount.toFixed(2)} waiting
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Commission Display */}
              {amount && commissionRate > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-700">Commission ({commissionRate}%)</span>
                    <span className="text-sm font-black text-purple-600">
                      {((parseFloat(amount) * commissionRate) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
                  rows={3}
                  placeholder="Add any notes..."
                />
              </div>

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
                disabled={!selectedFamilyId || !amount || submitting}
                className="w-full app-btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Recording...' : 'Record Collection'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900">Scan QR Code</h3>
              <button
                onClick={() => setIsScannerOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-2xl"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div id="qr-reader" className="rounded-2xl overflow-hidden" />
          </div>
        </div>
      )}
    </AppShell>
  );
}
