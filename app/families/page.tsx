"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, RefreshCw, QrCode, X, ArrowLeft, CreditCard, Edit, Trash2, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Html5QrcodeScanner } from "html5-qrcode";
import { translations, Language } from "@/lib/i18n/translations";
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
  address: string;
  phone: string;
  subscription_amount?: number;
  is_widow_head?: boolean;
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
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [headName, setHeadName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [isWidowHead, setIsWidowHead] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [families, setFamilies] = useState<Family[]>(dummyFamilies);
  const [isLive, setIsLive] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState<Language>("en");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [isPdfOptionsOpen, setIsPdfOptionsOpen] = useState(false);
  const [pdfCols, setPdfCols] = useState<{code:boolean; head:boolean; address:boolean; phone:boolean; sub:boolean}>({code:true, head:true, address:true, phone:true, sub:true});

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
    fetchFamilies();
  }, []);

  useEffect(() => {
    if (editingFamily) {
      setHeadName(editingFamily.head_name);
      setAddress(editingFamily.address);
      setPhone(editingFamily.phone);
      setFamilyCode(editingFamily.family_code);
      setSubscriptionAmount(editingFamily.subscription_amount?.toString() || "");
      setIsWidowHead(editingFamily.is_widow_head || false);
      setIsOpen(true);
    }
  }, [editingFamily]);

  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      scanner.render(onScanSuccess, onScanFailure);

      function onScanSuccess(decodedText: string) {
        // smart-masjeedh:family:UUID
        if (decodedText.startsWith("smart-masjeedh:family:")) {
          const familyId = decodedText.split(":")[2];
          scanner.clear();
          setIsScannerOpen(false);
          router.push(`/families/${familyId}`);
        }
      }

      function onScanFailure(error: any) {
        // handle scan failure, usually better to ignore and keep scanning
      }

      return () => {
        scanner.clear();
      };
    }
  }, [isScannerOpen]);

  useEffect(() => {
    if (isOpen && families.length > 0 && isLive && !editingFamily) {
      // Find the last family code format
      const lastFamily = families[families.length - 1];
      const lastCode = lastFamily.family_code;
      
      // Try to extract prefix and number (e.g., FM-01 -> FM, 01)
      const match = lastCode.match(/^([A-Za-z\s-]+)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2]);
        setFamilyCode(`${prefix}${(num + 1).toString().padStart(match[2].length, '0')}`);
      } else {
        // Fallback if format is different
        setFamilyCode("");
      }
    } else if (isOpen && !isLive) {
      setFamilyCode("FM-01");
    }
  }, [isOpen, families, isLive]);

  async function fetchFamilies() {
    if (!supabase) return;
    setIsFetching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("masjid_id", session.user.id)
        .order("family_code", { ascending: true });

      if (error) throw error;
      if (data) {
        setFamilies(data);
        setIsLive(true);
        setErrorMessage("");
      }
    } catch (err: any) {
      console.error("Fetch error:", err.message);
      setErrorMessage("உண்மையான தரவுகளைப் பெறுவதில் சிக்கல்.");
    } finally {
      setIsFetching(false);
    }
  }

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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("லாகின் செய்யப்படவில்லை.");

      if (editingFamily) {
        // Update existing
        const { error } = await supabase
          .from("families")
          .update({
            family_code: familyCode,
            head_name: headName,
            address,
            phone,
            subscription_amount: parseFloat(subscriptionAmount) || 0,
            is_widow_head: isWidowHead
          })
          .eq("id", editingFamily.id)
          .eq("masjid_id", session.user.id);

        if (error) throw error;
        setSuccessMessage("குடும்ப விபரம் திருத்தப்பட்டது.");
      } else {
        // Insert new
        const { error } = await supabase.from("families").insert([
          {
            family_code: familyCode,
            head_name: headName,
            address,
            phone,
            subscription_amount: parseFloat(subscriptionAmount) || 0,
            is_widow_head: isWidowHead,
            masjid_id: session.user.id // Include masjid ID
          }
        ]);

        if (error) throw error;
        setSuccessMessage("குடும்பம் வெற்றிகரமாகச் சேமிக்கப்பட்டது.");
      }

      setIsOpen(false);
      resetForm();
      fetchFamilies();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  const resetForm = () => {
    setHeadName("");
    setAddress("");
    setPhone("");
    setFamilyCode("");
    setSubscriptionAmount("");
    setIsWidowHead(false);
    setEditingFamily(null);
  };

  async function deleteFamily(id: string) {
    if (!supabase || !confirm(t.confirm_delete)) return;
    try {
      const { error } = await supabase
        .from("families")
        .delete()
        .eq("id", id);
      if (error) throw error;
      fetchFamilies();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.text("Masjid Families List", 14, 15);
    
    const headers: string[] = [];
    if (pdfCols.code) headers.push("Code");
    if (pdfCols.head) headers.push("Head Name");
    if (pdfCols.address) headers.push("Address");
    if (pdfCols.phone) headers.push("Phone");
    if (pdfCols.sub) headers.push("Sub. Amt");

    const tableData = filteredFamilies.map(f => {
      const row: (string|number)[] = [];
      if (pdfCols.code) row.push(f.family_code);
      if (pdfCols.head) row.push(f.head_name);
      if (pdfCols.address) row.push(f.address);
      if (pdfCols.phone) row.push(f.phone);
      if (pdfCols.sub) row.push(f.subscription_amount || 0);
      return row;
    });

    doc.autoTable({
      startY: 20,
      head: [headers],
      body: tableData,
    });

    doc.save("families_list.pdf");
  };

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
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-lg font-black leading-none">{t.families}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              {isLive ? t.live_data : t.demo_mode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPdfOptionsOpen(true)}
            className="p-2.5 bg-slate-50 text-blue-600 rounded-xl hover:bg-blue-50 transition-all active:scale-95"
            title={t.download_pdf}
          >
            <FileText className="h-5 w-5" />
          </button>
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
          >
            <QrCode className="h-5 w-5" />
          </button>
          <button 
            onClick={fetchFamilies}
            disabled={isFetching}
            className="p-2.5 bg-slate-50 text-emerald-600 rounded-xl hover:bg-emerald-100 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-5 w-5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
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
            placeholder={t.search}
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
          {t.add_new_family}
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
                <p className="text-sm text-slate-400">{lang === 'tm' ? 'குறியீடு அல்லது பெயரைக் கொண்டு தேடுங்கள்' : 'Search by name or code'}</p>
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
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingFamily(family);
                        }}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteFamily(family.id);
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400">{family.phone}</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {isPdfOptionsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">PDF Columns</h3>
              <button onClick={() => setIsPdfOptionsOpen(false)} className="p-2 hover:bg-slate-50 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.code} onChange={e=>setPdfCols(s=>({...s,code:e.target.checked}))}/> Code</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.head} onChange={e=>setPdfCols(s=>({...s,head:e.target.checked}))}/> Head</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.address} onChange={e=>setPdfCols(s=>({...s,address:e.target.checked}))}/> Address</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.phone} onChange={e=>setPdfCols(s=>({...s,phone:e.target.checked}))}/> Phone</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.sub} onChange={e=>setPdfCols(s=>({...s,sub:e.target.checked}))}/> Sub. Amt</label>
            </div>
            <button onClick={() => { setIsPdfOptionsOpen(false); generatePDF(); }} className="w-full py-3 rounded-2xl bg-blue-600 text-white font-black">
              Generate PDF
            </button>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <header className="p-6 flex items-center justify-between text-white">
            <h2 className="text-xl font-black uppercase tracking-widest">{t.scan_qr}</h2>
            <button onClick={() => setIsScannerOpen(false)} className="p-3 bg-white/10 rounded-full">
              <X className="w-6 h-6" />
            </button>
          </header>
          <div className="flex-1 flex flex-col items-center justify-center p-6">
            <div id="reader" className="w-full max-w-sm rounded-[2.5rem] overflow-hidden border-4 border-emerald-500 shadow-2xl shadow-emerald-500/20"></div>
            <p className="mt-8 text-white/60 text-sm font-bold uppercase tracking-widest text-center">
              Align QR Code within the frame to scan
            </p>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around py-4 px-6 shadow-2xl z-50">
        <Link href="/" className="flex flex-col items-center gap-1 group">
          <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.home}</span>
        </Link>
        <Link href="/families" className="flex flex-col items-center gap-1 group">
          <div className="p-3 bg-emerald-50 rounded-2xl transition-colors">
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">{t.families}</span>
        </Link>
        <Link href="/accounts" className="flex flex-col items-center gap-1 group">
          <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-slate-100 transition-colors">
            <CreditCard className="w-6 h-6 text-slate-400" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.accounts}</span>
        </Link>
      </nav>

      {/* Add Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-slate-900">{t.add_new_family}</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.name}</label>
                <input
                  type="text"
                  value={headName}
                  onChange={(event) => setHeadName(event.target.value)}
                  className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                  placeholder="Full Name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.address}</label>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                  placeholder="Complete Address"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.phone}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
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
                    className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                    placeholder="M01"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.subscription_amount}</label>
                  <input
                    type="number"
                    value={subscriptionAmount}
                    onChange={(event) => setSubscriptionAmount(event.target.value)}
                    className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="widow_head"
                    checked={isWidowHead}
                    onChange={(e) => setIsWidowHead(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 rounded-lg"
                  />
                  <label htmlFor="widow_head" className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                    {t.widow_head}
                  </label>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-500 text-white py-5 rounded-[1.5rem] font-black text-base shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
              >
                {loading ? "SAVING..." : t.save}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
