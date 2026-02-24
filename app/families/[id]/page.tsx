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
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Header */}
      <div className="px-4 py-4 flex items-center justify-between">
        <Link href="/families" className="p-1">
          <ArrowLeft className="h-6 w-6 text-emerald-600" />
        </Link>
      </div>

      {/* Family Info Section */}
      <div className="px-4 pb-6">
        <div className="flex justify-between items-start mb-1">
          <h1 className="text-3xl font-bold text-slate-900">{family?.family_code}</h1>
          <button className="flex items-center gap-1 bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-semibold shadow-sm">
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
        </div>
        <p className="text-slate-500 text-lg mb-6">{family?.head_name}</p>

        <div className="space-y-4">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-400">Address</span>
            <span className="text-slate-900 font-medium text-right max-w-[200px]">{family?.address}</span>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <span className="text-slate-400">Phone</span>
            <span className="text-slate-900 font-medium">{family?.phone}</span>
          </div>
        </div>
      </div>

      {/* Add Button & Search */}
      <div className="relative px-4 mb-4">
        <div className="flex justify-end mb-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="h-10 w-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg active:scale-90 transition-transform"
          >
            <UserPlus className="h-6 w-6" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-1 ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 px-4 overflow-y-auto">
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs text-center flex flex-col gap-2">
            <p className="font-semibold">{errorMessage}</p>
            <button 
              onClick={fetchData}
              className="bg-red-100 hover:bg-red-200 py-2 px-4 rounded-xl text-[10px] font-bold transition-colors"
            >
              மீண்டும் முயற்சிக்க (RETRY)
            </button>
          </div>
        )}
        {filteredMembers.length === 0 ? (
          <div className="py-10 text-center">
            <User className="h-12 w-12 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-400">உறுப்பினர்கள் யாரும் இல்லை</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredMembers.map(member => (
              <div key={member.id} className="py-4 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center">
                    <User className="h-6 w-6 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-0.5">
                      {member.age} YEARS
                    </p>
                    <h3 className="text-sm font-bold text-slate-900">{member.full_name}</h3>
                    <p className="text-xs text-slate-400">{member.relationship}</p>
                  </div>
                </div>
                <button className="p-2 text-slate-300 hover:text-slate-600">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
        )}
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
