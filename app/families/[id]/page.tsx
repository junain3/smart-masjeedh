"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserPlus, Trash2, User, Edit2, Search, MoreVertical } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Member = {
  id: string;
  family_id: string;
  full_name: string;
  relationship: string;
  age: number;
  gender: string;
  dob: string;
  nic: string;
  phone: string;
  civil_status: string;
};

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address: string;
  phone: string;
};

export default function FamilyDetailsPage() {
  const { id } = useParams();
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
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
    setErrorMessage(""); // Clear any previous error
    
    try {
      const { data: familyData, error: familyError } = await supabase
        .from("families")
        .select("*")
        .eq("id", id)
        .single();
      
      if (familyError) throw familyError;
      if (familyData) setFamily(familyData);

      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("family_id", id);
      
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
          civil_status: civilStatus
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

  const filteredMembers = members.filter(m => 
    m.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-masjid-900">
        ஏற்றப்படுகிறது...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-6 font-sans">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/families" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-emerald-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </Link>
          <div>
            <h1 className="text-lg font-bold leading-none">{family?.family_code}</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
              Family Details
            </p>
          </div>
        </div>
        <button className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 active:scale-95 transition-all">
          <Edit2 className="h-5 w-5" />
        </button>
      </header>

      {/* Family Info Section */}
      <div className="p-6">
        <div className="bg-white professional-card rounded-[2rem] p-6 space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Family Head</label>
            <h2 className="text-2xl font-black text-slate-900">{family?.head_name}</h2>
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

      {/* Add Button & Search */}
      <div className="px-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900">Members</h3>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="h-12 w-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
          >
            <UserPlus className="h-6 w-6" />
          </button>
        </div>
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
          <input 
            type="text"
            placeholder="Search member..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 px-6 mt-6 overflow-y-auto">
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs text-center flex flex-col gap-2">
            <p className="font-semibold">{errorMessage}</p>
            <button 
              onClick={fetchData}
              className="bg-red-100 hover:bg-red-200 py-2 px-4 rounded-xl text-[10px] font-bold transition-colors"
            >
              RETRY
            </button>
          </div>
        )}
        <div className="space-y-3 max-w-md mx-auto">
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
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter mb-0.5 bg-emerald-50 px-1.5 py-0.5 rounded-md inline-block">
                      {member.age} YEARS
                    </p>
                    <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                      {member.full_name}
                    </h3>
                    <p className="text-xs font-bold text-slate-400">{member.relationship}</p>
                  </div>
                </div>
                <button className="p-2 text-slate-300 hover:bg-slate-50 rounded-xl transition-all">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
      </div>

      {/* Add Member Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-center text-slate-900">உறுப்பினர் சேர்க்கை</h2>
            
            <form onSubmit={addMember} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">முழுப் பெயர்</label>
                <input 
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20" 
                  placeholder="பெயர்"
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
                <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">தொலைபேசி</label>
                <input 
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20" 
                  placeholder="07XXXXXXXX"
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
