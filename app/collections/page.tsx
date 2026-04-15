"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Plus, Users, Wallet, Calendar, X, Check, AlertCircle, Search, FileText, DollarSign, CreditCard, Briefcase } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTranslation, translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { Html5QrcodeScanner } from "html5-qrcode";
import { AppShell } from "@/components/AppShell";

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
  collected_by_user_id: string;
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
  const { user, tenantContext } = useSupabaseAuth();
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
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [commissionRate, setCommissionRate] = useState(0);
const [commissionEarned, setCommissionEarned] = useState(0);
const [commissionPaid, setCommissionPaid] = useState(0);
const [commissionBalance, setCommissionBalance] = useState(0);

  const t = getTranslation(lang);

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

  // Commission summary calculations
  useEffect(() => {
    const fetchCommissionSummary = async () => {
      if (!tenantContext?.masjidId || !user?.id) return;

      try {
        // Total earned from accepted collections
        const { data: earnedData } = await supabase
          .from('subscription_collections')
          .select('commission_amount')
          .eq('collected_by_user_id', user.id)
          .eq('masjid_id', tenantContext.masjidId)
          .eq('status', 'accepted');

        const earnedTotal = earnedData?.reduce((sum, item) => sum + (item.commission_amount || 0), 0) || 0;

        // Total paid from commission payments
        const { data: paidData } = await supabase
          .from('collector_commission_payments')
          .select('amount')
          .eq('collector_user_id', user.id)
          .eq('masjid_id', tenantContext.masjidId);

        const paidTotal = paidData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

        setCommissionEarned(earnedTotal);
        setCommissionPaid(paidTotal);
        setCommissionBalance(earnedTotal - paidTotal);
      } catch (err) {
        console.error('Failed to fetch commission summary:', err);
      }
    };

    fetchCommissionSummary();
  }, [tenantContext?.masjidId, user?.id]);

  const loadData = async () => {
    try {
      if (!tenantContext) return;

      // Get the authenticated user ID from auth, not from state
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const authUserId = session.user.id;

      // Load all data in parallel for better performance
      const [
        familiesResponse,
        collectionsResponse,
        profileResponse
      ] = await Promise.all([
        // Load families
        supabase
          .from("families")
          .select("id, family_code, head_name, address, phone")
          .eq("masjid_id", ctx.masjidId)
          .order("family_code"),
        
        // Load my collections
        supabase
          .from("subscription_collections")
          .select("*")
          .eq("masjid_id", ctx.masjidId)
          .eq("collected_by_user_id", authUserId)
          .order("created_at", { ascending: false }),
        
        // Load my commission rate (safe fallback)
        supabase
          .from("subscription_collector_profiles")
          .select("default_commission_percent")
          .eq("masjid_id", ctx.masjidId)
          .eq("user_id", authUserId)
          .maybeSingle()
      ]);

      // Add error guard for families
      if (familiesResponse.error) {
        console.error("Families fetch error:", familiesResponse.error);
      }

      const familiesData = familiesResponse.data;
      const collectionsData = collectionsResponse.data;
      const profileData = profileResponse.data;

      // Map family details to collections separately
      const collectionsWithFamilies = collectionsData?.map(collection => ({
        ...collection,
        family: familiesData?.find(f => f.id === collection.family_id)
      })) || [];

      // Process family subscription statuses (disabled until table exists)
      const subscriptionMap = new Map<string, FamilySubscriptionStatus>();
      // subscriptionData?.forEach(payment => {
      //   const existing = subscriptionMap.get(payment.family_id) || {
      //     family_id: payment.family_id,
      //     total_paid: 0,
      //     waiting_amount: 0,
      //     approved_amount: 0,
      //     last_payment_date: payment.payment_date
      //   };
      //   
      //   existing.total_paid += payment.amount;
      //   if (payment.status === 'waiting') {
      //     existing.waiting_amount += payment.amount;
      //   } else if (payment.status === 'approved') {
      //     existing.approved_amount += payment.amount;
      //   }
      //   
      //   if (payment.payment_date > existing.last_payment_date) {
      //     existing.last_payment_date = payment.payment_date;
      //   }
      //   
      //   subscriptionMap.set(payment.family_id, existing);
      // });

      setFamilies(familiesData || []);
      setCollections(collectionsWithFamilies || []);
      setFamilySubscriptions(subscriptionMap);
      setWaitingBalance(null); // balanceData?.[0] || null); // Disabled until RPC exists
      setCommissionRate(profileData?.default_commission_percent || 0);
    } catch (e: any) {
      setError(e.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    try {
      console.log('Collections: Starting print generation...');
      
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
          <title>Staff Collections Report</title>
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
          <h1>Staff Collections Report</h1>
          <table>
            <thead>
              <tr>
                <th>Family Code</th>
                <th>Head Name</th>
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
      
      console.log('Collections: Print window opened successfully');
      
    } catch (error) {
      console.error('Collections: Print generation error:', error);
      alert('Print generation failed: ' + (error as Error).message);
    }
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
    console.log('🔥 handleSubmit called');
    console.log('🔥 selectedFamilyId:', selectedFamilyId);
    console.log('🔥 amount:', amount);
    console.log('🔥 notes:', notes);
    
    if (!selectedFamilyId || !amount) {
      console.log('🔥 Validation failed - missing required fields');
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const ctx = tenantContext || await getTenantContext();
      console.log('🔥 ctx:', ctx);
      if (!ctx) throw new Error("Tenant context not found");

      // Get the authenticated user ID from auth, not from state
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔥 session:', session);
      if (!session?.user) throw new Error("Not authenticated");

      const authUserId = session.user.id;
      console.log('🔥 authUserId:', authUserId);

      const amountNum = parseFloat(amount);
      
      // Log user IDs for debugging
      console.log("DEBUG USER IDS:", {
        authUserId,
        collected_by_user_id: authUserId,
        tenantMasjidId: ctx.masjidId
      });
      
      // Fetch collector profile to get commission rate
      const { data: profile } = await supabase
        .from("subscription_collector_profiles")
        .select("default_commission_percent")
        .eq("user_id", authUserId)
        .eq("masjid_id", ctx.masjidId)
        .single();

      console.log("PROFILE RESULT:", profile);
      
      // Force fallback commission rate if profile query fails
      const commissionRate = profile?.default_commission_percent ?? 10;
      
      console.log('🔥 amountNum:', amountNum);
      console.log('🔥 commissionRate:', commissionRate);
      const commissionAmount = (amountNum * commissionRate) / 100;
      console.log('🔥 commissionAmount:', commissionAmount);
      
      const insertPayload = {
        masjid_id: ctx.masjidId,
        family_id: selectedFamilyId,
        amount: amountNum,
        commission_percent: commissionRate,
        commission_amount: commissionAmount,
        notes: notes || null,
        collected_by_user_id: authUserId,
        date: new Date().toISOString().split('T')[0]
      };
      
      console.log('🔥 Insert payload:', insertPayload);

      const { data, error: insertError } = await supabase
        .from("subscription_collections")
        .insert(insertPayload)
        .select()
        .single();

      console.log('🔥 Insert result data:', data);
      console.log('🔥 Insert error:', insertError);

      if (insertError) {
        console.error('🔥 Insert failed:', insertError);
        throw insertError;
      }

      // Create staff commission if there's a commission amount and the collector is a staff member
      if (commissionAmount > 0) {
        try {
          // Check if the collector is a staff member
          const { data: staffRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', authUserId)
            .eq('masjid_id', ctx.masjidId)
            .single();

          if (staffRole && ['staff', 'editor'].includes(staffRole.role)) {
            // Create pending commission
            const { error: commissionError } = await supabase
              .from('employee_commissions')
              .insert({
                masjid_id: ctx.masjidId,
                staff_user_id: authUserId,
                collection_id: data.id,
                commission_amount: commissionAmount,
                commission_percent: commissionRate,
                collection_amount: amountNum,
                status: 'pending',
                notes: `Auto-generated commission for collection of ${amountNum} from family ${selectedFamilyId}`
              });

            if (commissionError) {
              console.error('Failed to create staff commission:', commissionError);
              // Don't throw error - collection was successful, just log commission issue
            }
          }
        } catch (commissionErr) {
          console.error('Error checking staff role or creating commission:', commissionErr);
          // Don't throw error - collection was successful
        }
      }

      console.log('🔥 Collection successful, calling loadData()');
      setSuccess("Collection recorded successfully!");
      setIsModalOpen(false);
      setSelectedFamilyId("");
      setAmount("");
      setNotes("");
      loadData(); // Refresh data
    } catch (e: any) {
      console.error('🔥 Submit error:', e);
      setError(e.message || "Failed to record collection");
    } finally {
      setSubmitting(false);
      console.log('🔥 handleSubmit finished');
    }
  };

  const handleEdit = (collection: Collection) => {
    setEditingCollection(collection);
    setSelectedFamilyId(collection.family_id);
    setAmount(collection.amount.toString());
    setNotes(collection.notes || "");
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection || !selectedFamilyId || !amount) return;

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) {
        setError("Tenant context not found");
        setSubmitting(false);
        return;
      }

      const amountNum = parseFloat(amount);
      const commissionAmount = (amountNum * commissionRate) / 100;

      const { error: updateError } = await supabase
        .from("subscription_collections")
        .update({
          family_id: selectedFamilyId,
          amount: amountNum,
          commission_percent: commissionRate,
          commission_amount: commissionAmount,
          notes: notes.trim() || null,
        })
        .eq("id", editingCollection.id)
        .eq("collected_by_user_id", user?.id)
        .eq("status", "pending");

      if (updateError) throw updateError;

      // Update commission if exists
      try {
        await supabase
          .from("employee_commissions")
          .update({
            amount: commissionAmount,
            commission_percent: commissionRate,
            collection_amount: amountNum,
            notes: `Updated commission for collection of ${amountNum} from family ${selectedFamilyId}`
          })
          .eq("collection_id", editingCollection.id);
      } catch (commissionErr) {
        console.error('Failed to update commission:', commissionErr);
      }

      setSuccess("Collection updated successfully!");
      setIsEditModalOpen(false);
      setEditingCollection(null);
      setSelectedFamilyId("");
      setAmount("");
      setNotes("");
      loadData(); // Refresh data
    } catch (e: any) {
      setError(e.message || "Failed to update collection");
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

      {/* Commission Summary Card */}
      <div className="bg-white rounded-3xl p-6 border border-neutral-200 mb-6">
        <h3 className="text-lg font-black text-neutral-900 mb-4">Commission Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 mb-1">Total Earned</p>
                <p className="text-xl font-black text-emerald-700">Rs. {commissionEarned.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 mb-1">Total Paid</p>
                <p className="text-xl font-black text-blue-700">Rs. {commissionPaid.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 mb-1">Current Balance</p>
                <p className="text-xl font-black text-amber-700">Rs. {commissionBalance.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full app-btn-primary py-4 mb-6 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Add Collection
      </button>

      {/* My Pending Collections */}
      {collections.filter(c => c.status === 'pending' && c.collected_by_user_id === user?.id).length > 0 && (
        <>
          {/* Mobile Card Layout */}
          <div className="sm:hidden app-card p-5 mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
              My Pending Collections
            </h2>
            <div className="space-y-3">
              {collections
                .filter(c => c.status === 'pending' && c.collected_by_user_id === user?.id)
                .map((collection) => (
                  <div
                    key={collection.id}
                    className="bg-white rounded-2xl p-4 shadow-md border border-amber-200 space-y-3"
                  >
                    {/* Family Name and Code */}
                    <div className="flex items-center justify-between">
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
                        <div className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          Pending
                        </div>
                      </div>
                    </div>

                    {/* Commission and Notes */}
                    {collection.commission_amount > 0 && (
                      <div className="text-xs text-purple-600 font-bold">
                        Commission: {collection.commission_amount.toFixed(2)} ({collection.commission_percent}%)
                      </div>
                    )}
                    {collection.notes && (
                      <div className="text-xs text-slate-500">{collection.notes}</div>
                    )}

                    {/* Action Button */}
                    <div className="pt-2">
                      <button
                        onClick={() => handleEdit(collection)}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-xl font-medium transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:block app-card p-5 mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
              My Pending Collections
            </h2>
            <div className="space-y-2">
              {collections
                .filter(c => c.status === 'pending' && c.collected_by_user_id === user?.id)
                .map((collection) => (
                  <div
                    key={collection.id}
                    className="border border-amber-200 rounded-2xl p-4 bg-amber-50"
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
                        <div className="text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          Pending
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
                    <div className="mt-3">
                      <button
                        onClick={() => handleEdit(collection)}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {/* Recent Collections */}
      <div className="app-card p-5">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4">
          My Collections
        </h2>
        <>
          {/* Mobile Card Layout */}
          <div className="sm:hidden space-y-3">
            {collections.filter(c => c.status !== 'pending').length === 0 ? (
              <p className="text-[11px] font-bold text-slate-400 text-center py-8">
                No collections yet
              </p>
            ) : (
              collections.filter(c => c.status !== 'pending').map((collection) => (
                <div
                  key={collection.id}
                  className="bg-white rounded-2xl p-4 shadow-md border border-slate-100 space-y-3"
                >
                  {/* Family Name and Code */}
                  <div className="flex items-center justify-between">
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

                  {/* Commission and Notes */}
                  {collection.commission_amount > 0 && (
                    <div className="text-xs text-purple-600 font-bold">
                      Commission: {collection.commission_amount.toFixed(2)} ({collection.commission_percent}%)
                    </div>
                  )}
                  {collection.notes && (
                    <div className="text-xs text-slate-500">{collection.notes}</div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Desktop Layout */}
          <div className="hidden sm:block space-y-2">
            {collections.filter(c => c.status !== 'pending').length === 0 ? (
              <p className="text-[11px] font-bold text-slate-400 text-center py-8">
                No collections yet
              </p>
            ) : (
              collections.filter(c => c.status !== 'pending').map((collection) => (
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
        </>
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

      {/* Edit Collection Modal */}
      {isEditModalOpen && editingCollection && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">Edit Collection</h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-2xl"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              {/* Family Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Family
                </label>
                <select
                  value={selectedFamilyId}
                  onChange={(e) => setSelectedFamilyId(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  required
                >
                  <option value="">Select Family</option>
                  {families.map((family) => (
                    <option key={family.id} value={family.id}>
                      {family.family_code} - {family.head_name}
                    </option>
                  ))}
                </select>
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
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="Optional notes about this collection"
                />
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700">
                  {success}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!selectedFamilyId || !amount || submitting}
                className="w-full app-btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Updating...' : 'Update Collection'}
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
