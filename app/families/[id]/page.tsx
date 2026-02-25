"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Trash2, User, Edit2, Search, MoreVertical, QrCode, TrendingUp, Wallet, FileText, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import { translations, Language } from "@/lib/i18n/translations";
import jsPDF from "jspdf";
import "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type Member = {
  id: string;
  family_id: string;
  member_code: string;
  full_name: string;
  relationship: string;
  age: number;
  gender: string;
  dob: string;
  nic: string;
  phone: string;
  civil_status: string;
  status: string;
};

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address: string;
  phone: string;
  subscription_amount: number;
  is_widow_head: boolean;
};

type Payment = {
  id: string;
  amount: number;
  date: string;
  description: string;
};

type Service = {
  id: string;
  name: string;
  date: string;
  status: string;
};

export default function FamilyDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "payments" | "services">("members");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  
  // Form states
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("மகன்");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [nic, setNic] = useState("");
  const [phone, setPhone] = useState("");
  const [civilStatus, setCivilStatus] = useState("Single");
  const [submitting, setSubmitting] = useState(false);

  const t = translations[lang];

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  // Age calculation from DOB
  useEffect(() => {
    if (dob) {
      const birthDate = new Date(dob);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      setAge(calculatedAge.toString());
    }
  }, [dob]);

  const fetchData = async () => {
    if (!supabase || !id) return;
    setLoading(true);
    setErrorMessage(""); 
    
    try {
      // Get current masjid ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const { data: familyData, error: familyError } = await supabase
        .from("families")
        .select("*")
        .eq("id", id)
        .eq("masjid_id", session.user.id) // Ensure user can only see their own masjid's family
        .single();
      
      if (familyError) throw familyError;
      if (familyData) setFamily(familyData);

      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("family_id", id)
        .eq("masjid_id", session.user.id); // Ensure user can only see their own masjid's members
      
      if (membersError) {
        // Specifically check if the error is "Table not found"
        if (membersError.code === 'PGRST116' || membersError.message.includes('Could not find the table')) {
          setErrorMessage("உறுப்பினர்கள் அட்டவணை (members table) இன்னும் உருவாக்கப்படவில்லை. தயவுசெய்து SQL migration-ஐ இயக்கவும்.");
          setMembers([]); // Set empty list as fallback
        } else {
          throw membersError;
        }
      } else if (membersData) {
        setMembers(membersData);
      }

      // Fetch payment history (subscriptions)
      const { data: paymentData } = await supabase
        .from("transactions")
        .select("id, amount, date, description")
        .eq("family_id", id)
        .eq("masjid_id", session.user.id)
        .order("date", { ascending: false });
      
      if (paymentData) setPayments(paymentData);

    } catch (error: any) {
      console.error("Error fetching data:", error);
      setErrorMessage(error.message || "தரவுகளைப் பெறுவதில் சிக்கல் ஏற்பட்டது.");
    } finally {
      setLoading(false);
    }
  };

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchData();
  }, [id]);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !id) return;
    setSubmitting(true);

    try {
      // Get current masjid ID
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("லாகின் செய்யப்படவில்லை.");

      const { error } = await supabase.from("members").insert([
        {
          family_id: id,
          full_name: fullName,
          relationship,
          age: parseInt(age),
          gender,
          dob,
          nic,
          phone,
          civil_status: civilStatus,
          masjid_id: session.user.id // Include masjid ID
        }
      ]);

      if (error) throw error;

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      alert(`பிழை: ${error.message || "உறுப்பினரைச் சேர்க்க முடியவில்லை"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFullName("");
    setRelationship("மகன்");
    setDob("");
    setAge("");
    setGender("Male");
    setNic("");
    setPhone("");
    setCivilStatus("Single");
  };

  const subBalance = (family?.subscription_amount || 0) * 12 - payments.reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-masjid-900">
        ஏற்றப்படுகிறது...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-6 font-sans">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/families" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-emerald-600">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-black">{t.family}</h1>
        </div>
        <button 
          onClick={generatePDF}
          className="p-2.5 bg-slate-50 text-blue-600 rounded-xl hover:bg-blue-50 active:scale-95 transition-all"
        >
          <FileText className="h-5 w-5" />
        </button>
      </header>

      {/* Summary Cards Row */}
      <div className="px-6 pt-6 grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 rounded-[2rem] p-5 border border-emerald-100 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t.recent_services}</span>
          </div>
          <p className="text-xs font-bold text-slate-700">Ramadan Dates</p>
          <p className="text-[9px] font-black text-emerald-600/60 uppercase">MARCH 2024</p>
        </div>
        <div className="bg-rose-50 rounded-[2rem] p-5 border border-rose-100 space-y-2">
          <div className="flex items-center gap-2 text-rose-600">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t.subscription_balance}</span>
          </div>
          <p className="text-sm font-black text-slate-900">Rs. {subBalance.toLocaleString()}</p>
          <p className="text-[9px] font-black text-rose-600/60 uppercase tracking-tighter">Due for 2024</p>
        </div>
      </div>

      {/* Family Info Section */}
      <div className="p-6">
        <div className="bg-white professional-card rounded-[2rem] p-6 space-y-6 relative overflow-hidden">
          {/* QR Button */}
          <button 
            onClick={() => setIsQrModalOpen(true)}
            className="absolute top-6 right-6 p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95"
          >
            <QrCode className="w-6 h-6" />
          </button>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">{t.family} Head</label>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-slate-900">{family?.head_name}</h2>
              {family?.is_widow_head && (
                <span className="px-3 py-1 bg-rose-50 text-rose-500 text-[10px] font-black uppercase rounded-full border border-rose-100">
                  {t.widow_head}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
                <p className="text-sm font-semibold text-slate-700">{family?.address}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-semibold text-slate-700">{family?.phone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pb-2">
        <div className="flex p-1 bg-slate-100 rounded-2xl">
          <button 
            onClick={() => setActiveTab("members")}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === "members" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400"
            }`}
          >
            {t.members}
          </button>
          <button 
            onClick={() => setActiveTab("payments")}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === "payments" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"
            }`}
          >
            {t.payment_history}
          </button>
          <button 
            onClick={() => setActiveTab("services")}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === "services" ? "bg-white text-amber-600 shadow-sm" : "text-slate-400"
            }`}
          >
            {t.services_received}
          </button>
        </div>
      </div>

      {/* Add Button & Search */}
      <div className="px-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
            {activeTab === "members" ? t.members : activeTab === "payments" ? t.payment_history : t.services_received}
          </h3>
          {activeTab === "members" && (
            <button 
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="h-12 w-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
            >
              <UserPlus className="h-6 w-6" />
            </button>
          )}
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {/* List Section */}
      <div className="flex-1 px-6 mt-6 overflow-y-auto">
        {activeTab === "members" ? (
          <div className="space-y-3 w-full">
            {filteredMembers.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-4">
                <div className="p-5 bg-slate-50 rounded-full text-slate-200">
                  <User className="h-10 w-10" />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No members found</p>
              </div>
            ) : (
              filteredMembers.map(member => (
                <div key={member.id} className="bg-white professional-card rounded-2xl p-4 flex items-center justify-between group animate-in fade-in duration-500">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-100 transition-colors flex-shrink-0">
                      <User className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                        {member.full_name}
                      </h3>
                      <p className="text-xs font-bold text-slate-400">{member.relationship} • {member.age} YEARS</p>
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 mt-1 inline-block">
                        {member.civil_status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setEditingMember(member)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => deleteMember(member.id)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === "payments" ? (
          <div className="space-y-3 w-full">
            {payments.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-4">
                <div className="p-5 bg-slate-50 rounded-full text-slate-200">
                  <Wallet className="h-10 w-10" />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No payments yet</p>
              </div>
            ) : (
              payments.map(payment => (
                <div key={payment.id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-50 shadow-sm animate-in fade-in duration-500">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">{payment.description}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{payment.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-emerald-500">+ Rs. {payment.amount.toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3 w-full">
            {services.map(service => (
              <div key={service.id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-50 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800">{service.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{service.date}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase ${
                  service.status === 'Received' ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-600'
                }`}>
                  {service.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 flex flex-col items-center text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6">
              <QrCode className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{t.qr_code}</h2>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-8">
              {family?.family_code} - {family?.head_name}
            </p>
            
            <div className="bg-slate-50 p-8 rounded-[2.5rem] border-4 border-emerald-500/10 mb-8 shadow-inner">
              <QRCodeSVG 
                value={`smart-masjeedh:family:${family?.id}`} 
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            <button 
              onClick={() => setIsQrModalOpen(false)}
              className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-slate-900/20"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-center text-slate-900">உறுப்பினர் சேர்க்கை</h2>
            
            <form onSubmit={addMember} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.full_name}</label>
                <input 
                  required 
                  type="text" 
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 ring-emerald-500/10" 
                  placeholder="E.g. Ahmed Khan" 
                  value={fullName} 
                  onChange={(e) => setFullName(e.target.value)} 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">உறவுமுறை</label>
                  <select 
                    required
                    value={relationship}
                    onChange={e => setRelationship(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20 appearance-none"
                  >
                    <option value="கணவன்">கணவன்</option>
                    <option value="மனைவி">மனைவி</option>
                    <option value="மகன்">மகன்</option>
                    <option value="மகள்">மகள்</option>
                    <option value="தந்தை">தந்தை</option>
                    <option value="தாய்">தாய்</option>
                    <option value="ஏனையோர்">ஏனையோர்</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">பிறந்த திகதி</label>
                  <input 
                    required
                    type="date"
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">வயது</label>
                  <input readOnly value={age} className="w-full bg-slate-100 border-none rounded-2xl p-4 text-sm text-slate-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">NIC</label>
                  <input 
                    value={nic}
                    onChange={e => setNic(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20" 
                    placeholder="12345V"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.phone}</label>
                <input 
                  type="tel" 
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 ring-emerald-500/10" 
                  placeholder="07XXXXXXXX" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value.slice(0, 10))} 
                  maxLength={10}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600"
                >
                  ரத்து
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                >
                  {submitting ? 'சேமி...' : 'சேமி'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
