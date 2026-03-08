"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Plus, Users, Wallet, Calendar, X, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode";
import { AppShell } from "@/components/AppShell";

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address?: string;
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

export default function CollectionsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchData();
  }, []);

  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "collections-reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true
        },
        false
      );
      scanner.render(onScanSuccess, onScanFailure);
      function onScanSuccess(decodedText: string) {
        if (decodedText.startsWith("smart-masjeedh:family:")) {
          const familyId = decodedText.split(":")[2];
          setSelectedFamilyId(familyId);
          setIsModalOpen(true);
          scanner.clear();
          setIsScannerOpen(false);
        }
      }
      function onScanFailure(_err: any) {}
      return () => {
        scanner.clear();
      };
    }
  }, [isScannerOpen]);

  async function fetchData() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Fetch user's collections
      const { data: collectionData, error: collectionErr } = await supabase
        .from("subscription_collections")
        .select(`
          *,
          family:families(id, family_code, head_name, address)
        `)
        .eq("collected_by_user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (collectionErr) throw collectionErr;
      setCollections(collectionData as any || []);

      // Fetch families for dropdown
      const { data: familyData } = await supabase
        .from("families")
        .select("id, family_code, head_name, address")
        .eq("masjid_id", session.user.id)
        .order("family_code", { ascending: true });
      
      if (familyData) setFamilies(familyData);

    } catch (err: any) {
      console.error("Fetch error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (!selectedFamilyId || !amount) {
        setError("Please select a family and enter amount");
        return;
      }

      // Get collector's commission rate
      const { data: collectorProfile } = await supabase
        .from("subscription_collector_profiles")
        .select("default_commission_percent")
        .eq("user_id", session.user.id)
        .eq("masjid_id", session.user.id)
        .single();

      const commissionPercent = collectorProfile?.default_commission_percent || 0;
      const commissionAmount = (parseFloat(amount) * commissionPercent) / 100;

      // Create collection record
      const { error } = await supabase.from("subscription_collections").insert([
        {
          masjid_id: session.user.id,
          family_id: selectedFamilyId,
          collected_by_user_id: session.user.id,
          amount: parseFloat(amount),
          commission_percent: commissionPercent,
          commission_amount: commissionAmount,
          notes: notes.trim() || null,
          date: new Date().toISOString().split('T')[0],
          status: "pending"
        }
      ]);

      if (error) throw error;

      setSuccess("Subscription recorded successfully! Awaiting admin approval.");
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const resetForm = () => {
    setSelectedFamilyId("");
    setAmount("");
    setNotes("");
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <AppShell
      title="Subscription Collections"
      actions={
        <>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="p-3 bg-slate-50 text-slate-600 rounded-3xl hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
            title="Scan QR Code"
          >
            <QrCode className="w-6 h-6" />
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="p-3 bg-emerald-500 text-white rounded-3xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            title="Add Collection"
          >
            <Plus className="w-6 h-6" />
          </button>
        </>
      }
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="app-card p-6 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              {collections.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Collected</p>
          </div>
          <div className="app-card p-6 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-blue-500" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              {collections.filter(c => c.status === "pending").length}
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending Approval</p>
          </div>
          <div className="app-card p-6 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-2xl font-black text-slate-800">
              {collections.filter(c => c.status === "accepted").length}
            </p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Approved</p>
          </div>
        </div>

        {/* Collections List */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Your Collections</h3>
          {collections.length === 0 ? (
            <div className="py-20 text-center app-card">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No collections yet</p>
              <p className="text-slate-400 text-sm mt-2">Start by scanning a QR code or adding a collection manually</p>
            </div>
          ) : (
            collections.map((collection) => (
              <div
                key={collection.id}
                className="app-card p-4 flex items-center justify-between group hover:border-emerald-200 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      collection.status === "pending"
                        ? "bg-blue-50 text-blue-500"
                        : collection.status === "accepted"
                        ? "bg-emerald-50 text-emerald-500"
                        : "bg-rose-50 text-rose-500"
                    }`}
                  >
                    {collection.status === "pending" ? (
                      <AlertCircle className="w-6 h-6" />
                    ) : collection.status === "accepted" ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <X className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">
                      {collection.family?.family_code} - {collection.family?.head_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {collection.status}
                      </span>
                      <span className="text-slate-200">•</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {collection.date}
                      </span>
                      {collection.commission_amount > 0 && (
                        <>
                          <span className="text-slate-200">•</span>
                          <span className="text-[10px] font-bold text-emerald-400 uppercase">
                            Commission: Rs. {collection.commission_amount.toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                    {collection.notes && (
                      <p className="text-xs text-slate-500 mt-1">{collection.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm text-emerald-500">
                    Rs. {collection.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* QR Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <header className="p-6 flex items-center justify-between text-white">
            <h2 className="text-xl font-black uppercase tracking-widest">Scan QR Code</h2>
            <button onClick={() => setIsScannerOpen(false)} className="p-3 bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div id="collections-reader" className="w-full max-w-sm rounded-[2.5rem] overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20"></div>
            <p className="mt-8 text-white/60 text-sm font-bold uppercase tracking-widest text-center">
              Align QR Code within the frame to scan
            </p>
          </div>
        </div>
      )}

      {/* Add Collection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-900">Add Collection</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-300" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-600 text-xs font-bold">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-600 text-xs font-bold">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Family</label>
                <select
                  required
                  value={selectedFamilyId}
                  onChange={e => setSelectedFamilyId(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none appearance-none"
                >
                  <option value="">Select Family</option>
                  {families.map(f => (
                    <option key={f.id} value={f.id}>{f.family_code} - {f.head_name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                <input 
                  required
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-lg font-black focus:ring-4 ring-emerald-500/10 outline-none"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-5 text-sm font-bold focus:ring-4 ring-emerald-500/10 outline-none resize-none"
                  placeholder="Add any notes..."
                  rows={3}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 rounded-3xl font-black text-white bg-emerald-500 shadow-xl shadow-emerald-500/20 transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {submitting ? "PROCESSING..." : "Submit Collection"}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
