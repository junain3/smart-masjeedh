 "use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address: string;
  phone: string;
};

const dummyFamilies: Family[] = [
  {
    id: "1",
    family_code: "FAM-001",
    head_name: "உதாரண குடும்பம் 1",
    address: "மாதிரி தெரு, ஊர் பெயர்",
    phone: "9000000001"
  },
  {
    id: "2",
    family_code: "FAM-002",
    head_name: "உதாரண குடும்பம் 2",
    address: "மாதிரி தெரு, ஊர் பெயர்",
    phone: "9000000002"
  }
];

export default function FamiliesPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [headName, setHeadName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [families, setFamilies] = useState<Family[]>(dummyFamilies);
  const [isLive, setIsLive] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function fetchFamilies() {
    if (!supabase) return;
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .order("family_code", { ascending: true });

      if (error) throw error;
      if (data) {
        setFamilies(data);
        setIsLive(true);
        setErrorMessage("");
      }
    } catch (err: any) {
      console.error("Fetch error:", err.message);
      setErrorMessage("உண்மையான தரவுகளைப் பெறுவதில் சிக்கல். மாதிரி தரவுகள் காட்டப்படுகின்றன.");
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    fetchFamilies();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    if (!supabase) {
      setErrorMessage("Supabase இணைப்பு இல்லை.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from("families").insert([
        {
          family_code: familyCode,
          head_name: headName,
          address,
          phone
        }
      ]);

      if (error) throw error;

      setSuccessMessage("குடும்பம் வெற்றிகரமாகச் சேமிக்கப்பட்டது.");
      setIsOpen(false);
      setHeadName("");
      setAddress("");
      setPhone("");
      setFamilyCode("");
      fetchFamilies();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredFamilies = families.filter(f => 
    f.head_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.family_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-24 font-sans">
      {/* App Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-emerald-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-none">Families</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              {isLive ? "• Live Data" : "• Demo Mode"}
            </p>
          </div>
        </div>
        <button 
          onClick={fetchFamilies}
          disabled={isFetching}
          className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 active:scale-95 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Messages */}
      <div className="px-4 mt-2">
        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-2xl text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-300">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="bg-amber-50 border border-amber-100 text-amber-700 px-4 py-3 rounded-2xl text-[10px] font-bold">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Search & Actions */}
      <div className="p-4 space-y-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or code..."
            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setErrorMessage("");
          }}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
        >
          <Plus className="h-5 w-5" />
          Add New Family
        </button>
      </div>

      {/* Families List */}
      <section className="flex-1 px-4 overflow-y-auto pb-6">
        <div className="space-y-3 w-full">
          {filteredFamilies.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="p-6 bg-slate-100 rounded-full text-slate-300">
                <Users className="h-12 w-12" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-400">No Families Found</h2>
                <p className="text-sm text-slate-400">குறியீடு அல்லது பெயரைக் கொண்டு தேடுங்கள்</p>
              </div>
            </div>
          ) : (
            filteredFamilies.map((family) => (
              <Link
                key={family.id}
                href={`/families/${family.id}`}
                className="block bg-white professional-card rounded-[1.5rem] p-5 active:scale-[0.98] transition-all group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                        {family.family_code}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors truncate">
                      {family.head_name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                      {family.address}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">{family.phone}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around py-4 px-6 shadow-2xl z-50">
        <Link href="/" className="flex flex-col items-center gap-1 group">
          <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Home</span>
        </Link>
        <Link href="/families" className="flex flex-col items-center gap-1 group">
          <div className="p-3 bg-emerald-50 rounded-2xl transition-colors">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Families</span>
        </Link>
        <div className="flex flex-col items-center gap-1 group opacity-40">
          <div className="p-3 bg-slate-50 rounded-2xl">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accounts</span>
        </div>
      </nav>

      {/* Add Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-slate-900">Add New Family</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Head Name</label>
                <input
                  type="text"
                  value={headName}
                  onChange={(event) => setHeadName(event.target.value)}
                  className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  placeholder="Full Name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                  placeholder="Complete Address"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                    placeholder="07XXXXXXXX"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Family Code</label>
                  <input
                    type="text"
                    value={familyCode}
                    onChange={(event) => setFamilyCode(event.target.value)}
                    className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                    placeholder="M01"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 text-white py-5 rounded-[1.5rem] font-black text-base shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
              >
                {loading ? "SAVING..." : "SAVE FAMILY"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
