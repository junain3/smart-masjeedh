"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, X, AlertCircle, Users, Wallet, Calendar, Filter, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, Language } from "@/lib/i18n/translations";
import { AppShell } from "@/components/AppShell";

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address?: string;
};

type User = {
  id: string;
  email?: string;
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
  collected_by_user_id: string;
  accepted_by_user_id?: string;
  accepted_at?: string;
  family?: Family;
  collector?: User;
};

export default function PendingCollectionsPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "accepted" | "rejected">("pending");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchData();
  }, []);

  async function fetchData() {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      // Fetch all collections with family and collector info
      const { data: collectionData, error: collectionErr } = await supabase
        .from("subscription_collections")
        .select(`
          *,
          family:families(id, family_code, head_name, address),
          collector:auth.users(id, email)
        `)
        .eq("masjid_id", session.user.id)
        .order("created_at", { ascending: false });

      if (collectionErr) throw collectionErr;
      setCollections(collectionData as any || []);

    } catch (err: any) {
      console.error("Fetch error:", err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredCollections = collections.filter(collection => {
    const matchesSearch = 
      (collection.family?.family_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (collection.family?.head_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (collection.collector?.email || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || collection.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  async function handleAccept(collectionId: string) {
    await processCollection(collectionId, "accepted");
  }

  async function handleReject(collectionId: string) {
    await processCollection(collectionId, "rejected");
  }

  async function processCollection(collectionId: string, newStatus: "accepted" | "rejected") {
    if (!supabase) return;
    setProcessing(collectionId);
    setError("");
    setSuccess("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const collection = collections.find(c => c.id === collectionId);
      if (!collection) throw new Error("Collection not found");

      if (newStatus === "accepted") {
        // Create the main transaction record
        const { error: txError } = await supabase.from("transactions").insert([
          {
            masjid_id: session.user.id,
            amount: collection.amount,
            description: `Subscription - ${collection.family?.family_code}`,
            type: "income",
            category: "Subscription",
            date: collection.date,
            family_id: collection.family_id,
          }
        ]);

        if (txError) throw txError;

        // Create commission record if commission amount > 0
        if (collection.commission_amount > 0) {
          const { error: commissionError } = await supabase.from("employee_commissions").insert([
            {
              masjid_id: session.user.id,
              employee_id: collection.collected_by_user_id,
              collection_id: collectionId,
              amount: collection.commission_amount,
            }
          ]);

          if (commissionError) throw commissionError;
        }
      }

      // Update collection status
      const { error: updateError } = await supabase
        .from("subscription_collections")
        .update({
          status: newStatus,
          accepted_by_user_id: session.user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", collectionId);

      if (updateError) throw updateError;

      setSuccess(`Collection ${newStatus} successfully!`);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  }

  const stats = {
    total: collections.reduce((sum, c) => sum + c.amount, 0),
    pending: collections.filter(c => c.status === "pending").reduce((sum, c) => sum + c.amount, 0),
    accepted: collections.filter(c => c.status === "accepted").reduce((sum, c) => sum + c.amount, 0),
    rejected: collections.filter(c => c.status === "rejected").reduce((sum, c) => sum + c.amount, 0),
    pendingCount: collections.filter(c => c.status === "pending").length,
    commissionTotal: collections.filter(c => c.status === "accepted").reduce((sum, c) => sum + (c.commission_amount || 0), 0),
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <AppShell title="Pending Collections">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="app-card p-4 text-center">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <AlertCircle className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-lg font-black text-slate-800">{stats.pendingCount}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending</p>
            <p className="text-xs text-slate-500">Rs. {stats.pending.toLocaleString()}</p>
          </div>
          <div className="app-card p-4 text-center">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Check className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-lg font-black text-slate-800">{collections.filter(c => c.status === "accepted").length}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accepted</p>
            <p className="text-xs text-slate-500">Rs. {stats.accepted.toLocaleString()}</p>
          </div>
          <div className="app-card p-4 text-center">
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <X className="w-5 h-5 text-rose-500" />
            </div>
            <p className="text-lg font-black text-slate-800">{collections.filter(c => c.status === "rejected").length}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rejected</p>
            <p className="text-xs text-slate-500">Rs. {stats.rejected.toLocaleString()}</p>
          </div>
          <div className="app-card p-4 text-center">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Wallet className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-lg font-black text-slate-800">Rs. {stats.commissionTotal.toLocaleString()}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Commission</p>
            <p className="text-xs text-slate-500">Total Paid</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
            <input 
              type="text"
              placeholder="Search by family code, name, or collector email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-100 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
            />
          </div>
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            {(["all", "pending", "accepted", "rejected"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  statusFilter === status ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="app-card p-4 border-rose-200 bg-rose-50/60 text-rose-800 text-[11px] font-bold">
            {error}
          </div>
        )}

        {success && (
          <div className="app-card p-4 border-emerald-200 bg-emerald-50/60 text-emerald-800 text-[11px] font-bold">
            {success}
          </div>
        )}

        {/* Collections List */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-1">Collections</h3>
          {filteredCollections.length === 0 ? (
            <div className="py-20 text-center app-card">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No collections found</p>
            </div>
          ) : (
            filteredCollections.map((collection) => (
              <div
                key={collection.id}
                className="app-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
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
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-800">
                        {collection.family?.family_code} - {collection.family?.head_name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          collection.status === "pending" ? "text-blue-500" :
                          collection.status === "accepted" ? "text-emerald-500" : "text-rose-500"
                        }`}>
                          {collection.status}
                        </span>
                        <span className="text-slate-200">•</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {collection.date}
                        </span>
                        <span className="text-slate-200">•</span>
                        <span className="text-[10px] font-bold text-slate-400">
                          by {collection.collector?.email}
                        </span>
                      </div>
                      {collection.notes && (
                        <p className="text-xs text-slate-500 mt-2">{collection.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm text-emerald-500">
                      Rs. {collection.amount.toLocaleString()}
                    </p>
                    {collection.commission_amount > 0 && (
                      <p className="text-xs text-purple-500 font-bold mt-1">
                        Commission: Rs. {collection.commission_amount.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {collection.status === "pending" && (
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleAccept(collection.id)}
                      disabled={processing === collection.id}
                      className="flex-1 py-2 px-4 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processing === collection.id ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Accept
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(collection.id)}
                      disabled={processing === collection.id}
                      className="flex-1 py-2 px-4 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}

                {collection.status === "accepted" && collection.accepted_at && (
                  <div className="text-xs text-emerald-600 font-bold">
                    Accepted on {new Date(collection.accepted_at).toLocaleString()}
                  </div>
                )}

                {collection.status === "rejected" && collection.accepted_at && (
                  <div className="text-xs text-rose-600 font-bold">
                    Rejected on {new Date(collection.accepted_at).toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
