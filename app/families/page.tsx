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

  return (
    <div className="min-h-screen bg-masjid-700 text-white px-4 py-6 flex flex-col">
      <header className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-masjid-100/80">
            Masjid Admin {isLive ? "• Live" : "• Offline Mode"}
          </p>
          <h1 className="text-lg font-semibold leading-snug">
            குடும்பங்கள் நிர்வாகம்
            <span className="block text-xs text-masjid-100/80">
              (Families Management)
            </span>
          </h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchFamilies}
            disabled={isFetching}
            className="rounded-full border border-masjid-100/20 bg-masjid-700/40 p-2 text-masjid-50 hover:bg-masjid-600/70"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/"
            className="rounded-full border border-masjid-100/20 bg-masjid-700/40 px-3 py-1.5 text-xs font-medium text-masjid-50 hover:bg-masjid-600/70"
          >
            Home
          </Link>
        </div>
      </header>

      {successMessage && (
        <div className="mt-4 rounded-xl bg-emerald-500/90 px-4 py-2 text-xs font-medium animate-pulse">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 rounded-xl bg-amber-500/90 px-4 py-2 text-[10px] font-medium">
          {errorMessage}
        </div>
      )}

      <div className="mt-6 flex items-center gap-2 rounded-2xl bg-masjid-800/70 px-3 py-2 shadow-sm">
        <Search className="h-4 w-4 text-masjid-100/70" />
        <input
          type="text"
          placeholder="குடும்பங்களை பெயர் மூலம் தேடுங்கள்..."
          className="h-8 flex-1 bg-transparent text-xs text-masjid-50 placeholder:text-masjid-100/50 outline-none"
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setErrorMessage("");
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-masjid-800 shadow-sm hover:bg-masjid-50"
        >
          <Plus className="h-4 w-4" />
          Add New Family
        </button>
      </div>

      <section className="mt-6 flex-1 overflow-y-auto">
        <div className="w-full max-w-sm mx-auto space-y-3">
          {families.length === 0 ? (
            <div className="rounded-3xl bg-masjid-800/70 px-6 py-8 text-center shadow-lg">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-masjid-700/80">
                <Users className="h-8 w-8 text-masjid-100" />
              </div>
              <h2 className="text-base font-semibold">
                No Data Found
              </h2>
              <p className="mt-2 text-xs text-masjid-100/80">
                "Add New Family" பட்டனை அழுத்தி குடும்பங்களை சேர்க்கவும்.
              </p>
            </div>
          ) : (
            families.map((family) => (
              <Link
                key={family.id}
                href={`/families/${family.id}`}
                className="block rounded-2xl bg-masjid-800/80 px-4 py-3 text-left shadow transition-all hover:bg-masjid-800 active:scale-[0.98] border border-masjid-700/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">
                      {family.head_name}
                    </div>
                    <div className="text-[11px] text-masjid-100/80 truncate">
                      {family.address}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px] font-bold text-emerald-400">
                      {family.family_code}
                    </div>
                    <div className="text-[10px] text-masjid-100/70">
                      {family.phone}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {isOpen && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-masjid-900 px-5 py-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Add New Family
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs text-masjid-100/80 hover:text-white"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <div className="space-y-1">
                <label className="block text-[11px] text-masjid-100/80">
                  குடும்பத் தலைவர் பெயர்
                </label>
                <input
                  type="text"
                  value={headName}
                  onChange={(event) => setHeadName(event.target.value)}
                  className="w-full rounded-xl bg-masjid-800/80 px-3 py-2 text-xs text-white outline-none placeholder:text-masjid-100/50"
                  placeholder="குடும்பத் தலைவர் பெயர்"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-masjid-100/80">
                  முகவரி
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full rounded-xl bg-masjid-800/80 px-3 py-2 text-xs text-white outline-none placeholder:text-masjid-100/50"
                  placeholder="முகவரி"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-masjid-100/80">
                  தொலைபேசி எண்
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="w-full rounded-xl bg-masjid-800/80 px-3 py-2 text-xs text-white outline-none placeholder:text-masjid-100/50"
                  placeholder="தொலைபேசி எண்"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] text-masjid-100/80">
                  குடும்ப எண்
                </label>
                <input
                  type="text"
                  value={familyCode}
                  onChange={(event) => setFamilyCode(event.target.value)}
                  className="w-full rounded-xl bg-masjid-800/80 px-3 py-2 text-xs text-white outline-none placeholder:text-masjid-100/50"
                  placeholder="குடும்ப எண்"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-3 w-full rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? "Saving..." : "Save Family"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
