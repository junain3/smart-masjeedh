"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, QrCode, X, Check, AlertCircle, Search, FileText, Pencil, History } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTranslation, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { escapePdfHtml, getPdfMasjidName } from "@/lib/pdf-utils";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { AppShell } from "@/components/AppShell";
import { QrScannerModal } from "@/components/QrScannerModal";
import { EmptyState } from "@/components/EmptyState";
import { calcCommission, sortFamiliesByCode, calculateFamilyBalance } from "@/lib/collection-utils";
import { fetchUserNames } from "@/lib/user-utils";

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address?: string;
  subscription_amount?: number;
  opening_balance?: number;
};

type Collection = {
  id: string;
  family_id: string;
  collected_by_user_id: string;
  amount: number;
  notes?: string;
  date: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
  commission_percent?: number;
  commission_amount?: number;
  family?: Family;
};

const STATUS_LABEL: Record<Collection["status"], string> = {
  pending: "நிலுவை",
  accepted: "அனுமதி",
  rejected: "நிராகரி",
};

const STATUS_CLASS: Record<Collection["status"], string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
};

export default function CollectionsPage() {
  const { user, tenantContext, loading: authLoading, resumeTick } = useSupabaseAuth();
  const [lang, setLang] = useState<Language>("en");
  const [families, setFamilies] = useState<Family[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [commissionRate, setCommissionRate] = useState(0);
  const [commissionEarned, setCommissionEarned] = useState(0);
  const [commissionPending, setCommissionPending] = useState(0);
  const [collectorProfiles, setCollectorProfiles] = useState<Record<string, string>>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [familyBalance, setFamilyBalance] = useState<{ annualSubscription: number; totalDue: number } | null>(null);

  const t = getTranslation(lang);
  const isAdminView = Boolean(
    tenantContext?.role === "super_admin" || tenantContext?.permissions?.subscriptions_approve
  );

  const filteredFamilies = useMemo(() => {
    if (!searchTerm.trim()) return families;
    const term = searchTerm.toLowerCase();
    return families.filter(
      (f) =>
        f.family_code.toLowerCase().includes(term) ||
        f.head_name.toLowerCase().includes(term) ||
        (f.address && f.address.toLowerCase().includes(term))
    );
  }, [families, searchTerm]);

  const stats = useMemo(() => {
    const pending = collections
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + c.amount, 0);
    const approved = collections
      .filter((c) => c.status === "accepted")
      .reduce((sum, c) => sum + c.amount, 0);
    return { pending, approved, count: collections.length };
  }, [collections]);

  const selectedFamily = families.find((f) => f.id === selectedFamilyId);
  const estimatedCommission = useMemo(() => {
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0 || commissionRate <= 0) return 0;
    return calcCommission(amt, commissionRate);
  }, [amount, commissionRate]);

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!tenantContext?.masjidId || !user?.id) {
      setLoading(false);
      setCollections([]);
      setFamilies([]);
      return;
    }

    void loadData();
  }, [tenantContext?.masjidId, user?.id, resumeTick, authLoading]);

  const selectFamily = async (family: Family) => {
    setSelectedFamilyId(family.id);
    
    // Use centralized balance calculation helper
    try {
      const balanceData = await calculateFamilyBalance(
        supabase,
        family.id,
        tenantContext?.masjidId || "",
        family
      );
      setFamilyBalance(balanceData);
      // Set default amount to total due (remaining balance) instead of annual subscription
      setAmount(String(balanceData.totalDue));
    } catch (error) {
      console.error("Error fetching family balance:", error);
      const fallbackTotalDue = (family.opening_balance || 0) + (family.subscription_amount || 0);
      setFamilyBalance({
        annualSubscription: family.subscription_amount || 0,
        totalDue: fallbackTotalDue
      });
      setAmount(String(fallbackTotalDue));
    }
  };

  const loadData = async () => {
    if (!tenantContext?.masjidId || !user?.id) return;
    setLoading(true);
    setError("");
    try {
      const familiesPromise = supabase
        .from("families")
        .select("id, family_code, head_name, address, subscription_amount, opening_balance")
        .eq("masjid_id", tenantContext.masjidId)
        .order("family_code");

      const collectionsQuery = supabase
        .from("subscription_collections")
        .select("*")
        .eq("masjid_id", tenantContext.masjidId)
        .order("created_at", { ascending: false });

      const collectionsPromise = isAdminView
        ? collectionsQuery
        : collectionsQuery.eq("collected_by_user_id", user.id);

      const profilePromise = supabase
        .from("subscription_collector_profiles")
        .select("default_commission_percent")
        .eq("masjid_id", tenantContext.masjidId)
        .eq("user_id", user.id)
        .maybeSingle();

      const [familiesRes, collectionsRes, profileRes] = await Promise.all([
        familiesPromise,
        collectionsPromise,
        profilePromise,
      ]);

      if (familiesRes.error) throw familiesRes.error;
      if (collectionsRes.error) throw collectionsRes.error;

      const familyList = sortFamiliesByCode(familiesRes.data || []) as Family[];
      const collectionList = collectionsRes.data || [];
      const collectorIds = Array.from(
        new Set(collectionList.map((c) => c.collected_by_user_id).filter(Boolean))
      ) as string[];

      // Fetch user names using the new helper function
      let collectorProfileMap: Record<string, string> = {};
      if (collectorIds.length > 0) {
        collectorProfileMap = await fetchUserNames(supabase, collectorIds);
      }

      const withFamilies = collectionList.map((c) => ({
        ...c,
        family: familyList.find((f) => f.id === c.family_id),
      }));

      const rate = Number(profileRes.data?.default_commission_percent ?? 0);
      const earned = collectionList
        .filter((c) => c.status === "accepted")
        .reduce((sum, c) => sum + (c.commission_amount || 0), 0);
      const pendingComm = collectionList
        .filter((c) => c.status === "pending")
        .reduce((sum, c) => sum + calcCommission(c.amount, rate), 0);

      setCommissionRate(rate);
      setCommissionEarned(earned);
      setCommissionPending(pendingComm);
      setFamilies(familyList);
      setCollections(withFamilies);
      setCollectorProfiles(collectorProfileMap);
    } catch (e: any) {
      setError(e.message || "தரவு ஏற்ற முடியவில்லை");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedFamilyId("");
    setAmount("");
    setNotes("");
    setSearchTerm("");
    setError("");
    setSuccess("");
    setEditingCollection(null);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (collection: Collection) => {
    if (collection.status !== "pending") return;
    setEditingCollection(collection);
    setSelectedFamilyId(collection.family_id);
    setAmount(String(collection.amount));
    setNotes(collection.notes || "");
    setIsModalOpen(true);
  };

  const resolveFamilyFromQr = (text: string) => {
    if (text.startsWith("smart-masjeedh:family:")) {
      return text.split(":")[2];
    }
    const byCode = families.find(
      (f) => f.family_code.toLowerCase() === text.trim().toLowerCase()
    );
    return byCode?.id || null;
  };

  const handleQrDecoded = (text: string) => {
    const familyId = resolveFamilyFromQr(text);
    if (!familyId) {
      setError("இந்த QR-க்கு குடும்பம் கிடைக்கவில்லை");
      return;
    }
    setSelectedFamilyId(familyId);
    const family = families.find((f) => f.id === familyId);
    if (family?.subscription_amount) setAmount(String(family.subscription_amount));
    setIsScannerOpen(false);
    setIsModalOpen(true);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFamilyId || !amount) return;

    // Show confirmation dialog instead of submitting directly
    setShowConfirmDialog(true);
  };

  const confirmSubmit = async () => {
    setShowConfirmDialog(false);
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const ctx = tenantContext || (await getTenantContext());
      if (!ctx) throw new Error("Masjid context not found");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not logged in");

      const amountNum = parseFloat(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        throw new Error("சரியான தொகை உள்ளிடவும்");
      }

      if (editingCollection) {
        const { error: updateError } = await supabase
          .from("subscription_collections")
          .update({
            family_id: selectedFamilyId,
            amount: amountNum,
            notes: notes.trim() || null,
          })
          .eq("id", editingCollection.id)
          .eq("collected_by_user_id", session.user.id)
          .eq("status", "pending");

        if (updateError) throw updateError;
        setSuccess("வசூல் புதுப்பிக்கப்பட்டது");
      } else {
        const response = await fetch("/api/collections/add", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            ...(session.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            family_id: selectedFamilyId,
            collection_amount: amountNum,
            notes: notes.trim() || "",
            payment_method: "cash",
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "வசூல் பதிவு தோல்வி");
        }

        if (result.sms_sent && !result.sms_sent.success) {
          console.error("[collections/page] auto SMS failed after add", result.sms_sent);
        }

        if (result.auto_approved) {
          setSuccess("வசூல் பதிவாகி நேரடியாக அனுமதிக்கப்பட்டது");
        } else {
          setSuccess("வசூல் பதிவாகியது — நிர்வாகி அனுமதிக்க வேண்டும்");
        }
      }

      closeModal();
      loadData();
    } catch (e: any) {
      setError(e.message || "பதிவு தோல்வி");
    } finally {
      setSubmitting(false);
    }
  };

  const generatePDF = async () => {
    if (typeof window === "undefined") return;
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) {
      alert("PDF-க்கு popup அனுமதி தேவை");
      return;
    }

    const masjidName = await getPdfMasjidName(supabase, tenantContext?.masjidId);
    const rows = collections
      .map(
        (c) => `<tr>
          <td>${escapePdfHtml(c.family?.family_code || "")}</td>
          <td>${escapePdfHtml(c.family?.head_name || "")}</td>
          <td>${escapePdfHtml(c.date || "")}</td>
          <td>Rs. ${c.amount?.toLocaleString() || 0}</td>
          <td>${escapePdfHtml(STATUS_LABEL[c.status] || c.status)}</td>
        </tr>`
      )
      .join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>வசூல் அறிக்கை</title>
      <style>body{font-family:Arial;margin:20px;font-size:12px}table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #333;padding:8px}th{background:#f0f0f0}</style></head><body>
      <h2 style="text-align:center;color:#064e3b">${escapePdfHtml(masjidName)}</h2>
      <h3 style="text-align:center">எனது வசூல் அறிக்கை</h3>
      <table><thead><tr><th>குடும்பம்</th><th>தலைவர்</th><th>தேதி</th><th>தொகை</th><th>நிலை</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  if (authLoading || loading) {
    return (
      <AppShell title={t.collections}>
        <div className="rounded-3xl border border-neutral-200 bg-white p-12 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="text-sm font-medium text-neutral-500">Loading collections...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={t.collections}
      actions={
        <button
          onClick={generatePDF}
          className="p-3 bg-slate-50 text-blue-600 rounded-3xl hover:bg-blue-50"
          title="அறிக்கை"
        >
          <FileText className="w-5 h-5" />
        </button>
      }
    >
      {/* கமிஷன் சுருக்கம் */}
      {commissionRate > 0 && (
        <div className="app-card p-4 mb-4 bg-purple-50 border border-purple-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-purple-600 uppercase">உங்கள் கமிஷன் வீதம்</p>
              <p className="text-2xl font-black text-purple-800">{commissionRate}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-purple-600">அனுமதிக்கப்பட்ட கமிஷன்</p>
              <p className="font-black text-purple-800">Rs. {commissionEarned.toLocaleString()}</p>
              {commissionPending > 0 && (
                <p className="text-[10px] text-amber-700 mt-0.5">
                  நிலுவை (~Rs. {commissionPending.toLocaleString()})
                </p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-purple-500 mt-2">
            அனுமதிக்கப்பட்ட வசூலில் மட்டும் கமிஷன் கணக்கிடப்படும்
          </p>
        </div>
      )}

      {/* எளிய சுருக்கம் */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-amber-600">{stats.pending.toFixed(0)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase">நிலுவை (Rs.)</div>
        </div>
        <div className="app-card p-4 text-center">
          <div className="text-2xl font-black text-emerald-600">{stats.approved.toFixed(0)}</div>
          <div className="text-xs font-bold text-slate-400 uppercase">அனுமதி (Rs.)</div>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-4 text-center">
        குடும்பத்தைத் தேர்ந்தெடுத்து தொகை பதிவு செய்யுங்கள். நிர்வாகி அனுமதித்த பிறகு கணக்கில் சேரும்.
      </p>

      <button
        onClick={openAddModal}
        className="w-full app-btn-primary py-4 mb-6 flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        புதிய வசூல்
      </button>

      {error && !isModalOpen && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ஒரே பட்டியல் */}
      <div className="app-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
            {isAdminView ? "அனைத்து வசூல்கள்" : "எனது வசூல்கள்"} ({stats.count})
          </h2>
          {isAdminView && (
            <Link
              href="/collections/history"
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              <History className="w-4 h-4" />
              History
            </Link>
          )}
        </div>

        {collections.length === 0 ? (
          <EmptyState
            title="No collections yet"
            description="No subscription collections have been recorded. Start by adding a new collection from a family."
            icon={<FileText className="h-7 w-7" />}
            action={
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                புதிய வசூல்
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {collections.map((c) => (
              <div
                key={c.id}
                className="border border-slate-100 rounded-2xl p-4 bg-white flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-800 truncate">
                    {c.family?.family_code} — {c.family?.head_name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(c.created_at).toLocaleDateString("ta-LK")}
                  </div>
                  {isAdminView && (
                    <div className="text-[11px] font-semibold text-slate-500 mt-1">
                      Collector: {collectorProfiles[c.collected_by_user_id] || "Collector"}
                    </div>
                  )}
                  {c.notes && <div className="text-xs text-slate-500 mt-1">{c.notes}</div>}
                  {c.status === "accepted" && (c.commission_amount ?? 0) > 0 && (
                    <div className="text-xs text-purple-600 font-bold mt-1">
                      கமிஷன்: Rs. {c.commission_amount?.toLocaleString()} ({c.commission_percent}%)
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-emerald-600">Rs. {c.amount.toLocaleString()}</div>
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_CLASS[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </span>
                  {c.status === "pending" && (
                    <button
                      onClick={() => openEditModal(c)}
                      className="mt-2 flex items-center gap-1 text-xs text-blue-600 font-bold ml-auto"
                    >
                      <Pencil className="w-3 h-3" />
                      திருத்து
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* வசூல் படிவம் */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 flex-shrink-0">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-black text-slate-900">
                  {editingCollection ? "வசூல் திருத்து" : "புதிய வசூல்"}
                </h3>
                <button onClick={closeModal} className="p-2 hover:bg-slate-50 rounded-2xl">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            </div>
            
            <div className="px-6 pb-32 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingCollection && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setIsScannerOpen(true);
                    }}
                    className="w-full app-btn-secondary py-3 flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-5 h-5" />
                    QR ஸ்கேன்
                  </button>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="குடும்பம் தேடு..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-2xl">
                  {filteredFamilies.length === 0 ? (
                    <p className="p-4 text-center text-xs text-slate-400">குடும்பம் இல்லை</p>
                  ) : (
                    filteredFamilies.map((family) => (
                      <button
                        key={family.id}
                        type="button"
                        onClick={() => selectFamily(family)}
                        className={`w-full text-left p-3 border-b border-slate-100 last:border-0 hover:bg-emerald-50 ${
                          selectedFamilyId === family.id ? "bg-emerald-50" : ""
                        }`}
                      >
                        <div className="font-bold text-sm">{family.family_code} — {family.head_name}</div>
                        {family.subscription_amount ? (
                          <div className="text-xs text-emerald-600">சந்தா: Rs. {family.subscription_amount}</div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>

                {selectedFamily && familyBalance && (
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-emerald-900">{selectedFamily.head_name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFamilyId("");
                          setFamilyBalance(null);
                          setAmount("");
                        }}
                        className="text-xs text-emerald-600 hover:text-emerald-800 underline"
                      >
                        மாற்று
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-700">வருடாந்த சந்தா</span>
                        <span className="font-bold text-emerald-900">Rs. {familyBalance.annualSubscription}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-700">செலுத்த வேண்டிய பாக்கி</span>
                        <span className="font-bold text-emerald-900">Rs. {familyBalance.totalDue}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">தொகை (Rs.)</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500/20"
                    required
                  />
                  {commissionRate > 0 && estimatedCommission > 0 && !editingCollection && (
                    <p className="text-xs text-purple-600 mt-2 font-bold">
                      மதிப்பிடப்பட்ட கமிஷன் ({commissionRate}%): Rs. {estimatedCommission.toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">குறிப்பு (விரும்பினால்)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-2xl outline-none resize-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700">{error}</div>
                )}
                {success && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!selectedFamilyId || !amount || submitting}
                  className="w-full app-btn-primary py-3 disabled:opacity-50"
                >
                  {submitting ? "சேமிக்கிறது..." : editingCollection ? "புதுப்பி" : "பதிவு செய்"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog && selectedFamily && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">உறுதி செய்யவும்</h3>
              <p className="text-slate-600 text-sm">இந்த கட்டணத்தை செய்ய விரும்புகிறீர்களா?</p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-slate-600 text-sm">குடும்பம்</span>
                <span className="font-bold text-slate-900">{selectedFamily.head_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 text-sm">தொகை</span>
                <span className="font-bold text-emerald-600">Rs. {amount}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-3 border-2 border-slate-200 rounded-2xl text-slate-700 font-bold hover:bg-slate-50 transition"
              >
                ரத்து செய்
              </button>
              <button
                onClick={confirmSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {submitting ? "சேமிக்கிறது..." : "உறுதி"}
              </button>
            </div>
          </div>
        </div>
      )}

      <QrScannerModal
        open={isScannerOpen}
        title="குடும்ப QR ஸ்கேன்"
        containerId="collections-qr-reader"
        onClose={() => setIsScannerOpen(false)}
        onDecodedText={handleQrDecoded}
        helperText="குடும்ப QR குறியீட்டை ஸ்கேன் செய்யுங்கள்"
      />
    </AppShell>
  );
}
