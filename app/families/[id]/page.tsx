"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  UserPlus,
  Trash2,
  User,
  Edit2,
  Search,
  QrCode,
  TrendingUp,
  Wallet,
  FileText,
  CheckCircle,
  Clock,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { useMockAuth } from "@/components/MockAuthProvider";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

type Member = {
  id: string;
  family_id: string;
  member_code: string;
  name: string;
  relationship: string;
  age: number;
  gender: string;
  dob: string;
  nic: string;
  phone: string;
  civil_status: string;
  status: string;
  // New fields for enhanced data collection
  education?: string;
  occupation?: string;
  is_moulavi?: boolean;
  is_new_muslim?: boolean;
  // Person-specific fields moved from family level
  is_foreign_resident?: boolean;
  foreign_country?: string;
  foreign_contact?: string;
  has_special_needs?: boolean;
  special_needs_details?: string;
  has_health_issue?: boolean;
  health_details?: string;
};

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address: string;
  phone: string;
  subscription_amount: number;
  opening_balance?: number;
  is_widow_head: boolean;
};

type Payment = {
  id: string;
  amount: number;
  status: string;
  collected_by_user_id?: string;
  collected_at?: string;
  created_at: string;
};

type Service = {
  id: string;
  name: string;
  date: string;
  status: string;
};

export default function FamilyDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const familyId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { user: authUser, tenantContext } = useMockAuth();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<Language>("en");
  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "payments" | "services">("members");
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [collectionAmount, setCollectionAmount] = useState("");
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [collectionNote, setCollectionNote] = useState("");
  const [isCollectionSubmitting, setIsCollectionSubmitting] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("மகன்");
  const [dob, setDob] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [nic, setNic] = useState("");
  const [phone, setPhone] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // New fields for enhanced data collection
  const [education, setEducation] = useState("");
  const [occupation, setOccupation] = useState("");
  const [isMoulavi, setIsMoulavi] = useState(false);
  const [isNewMuslim, setIsNewMuslim] = useState(false);
  
  // Person-specific fields moved from family level
  const [isForeignResident, setIsForeignResident] = useState(false);
  const [foreignCountry, setForeignCountry] = useState("");
  const [foreignContact, setForeignContact] = useState("");
  const [hasSpecialNeeds, setHasSpecialNeeds] = useState(false);
  const [specialNeedsDetails, setSpecialNeedsDetails] = useState("");
  const [hasHealthIssue, setHasHealthIssue] = useState(false);
  const [healthDetails, setHealthDetails] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const t = getTranslation(lang);

  const normalizeRelationship = (value?: string) => {
  const map: Record<string, string> = {
    "கணவன்": "Husband",
    "மனைவி": "Wife",
    "மகன்": "Son",
    "மகள்": "Daughter",
    "தந்தை": "Father",
    "தாய்": "Mother",
    "ஏனையோர்": "Other",
    "குடும்பத் தலைவர்": "Family Head",
    "Head": "Family Head",
  };
  return map[value || ""] || value || "-";
};
  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

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

  useEffect(() => {
    const checkAuth = async () => {
      if (!authUser) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (!tenantContext?.masjidId) {
        setLoading(false);
        setErrorMessage("Masjid context not found.");
        return;
      }

      if (!familyId) {
        setLoading(false);
        setErrorMessage("Family ID not found.");
        return;
      }

      setUser(authUser);
      await fetchData(authUser);
    };

    void checkAuth();
  }, [authUser, tenantContext, familyId, router]);

  useEffect(() => {
    // Recovery: Detect when app regains focus or becomes visible after idle session
    const handleFocus = async () => {
      if (authUser) {
        console.log("Recovering from stale session on focus");
        await fetchData(authUser);
      }
    };

    const handleVisibility = async () => {
      if (document.visibilityState === "visible" && authUser) {
        console.log("Recovering from stale session on visibility change");
        await fetchData(authUser);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [authUser]);

  const fetchData = async (currentUser: any) => {
    if (!supabase || !familyId || !currentUser || !tenantContext?.masjidId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const { data: familyData, error: familyError } = await supabase
        .from("families")
        .select("*")
        .eq("id", familyId)
        .eq("masjid_id", tenantContext.masjidId)
        .single();

      if (familyError || !familyData) {
        console.log("Family fetch error:", familyError);
        setFamily(null);
        return;
      }

      setFamily(familyData);

      const { data: membersData, error: membersError } = await supabase
        .from("members")
        .select("*")
        .eq("family_id", familyId)
        .eq("masjid_id", tenantContext.masjidId)
        .order("name");

      if (membersError) throw membersError;
      setMembers(membersData || []);

      const { data: paymentsData, error: paymentsError } = await supabase
        .from("subscription_collections")
        .select("id, amount, status, collected_by_user_id, date, accepted_at, created_at")
        .eq("family_id", familyId)
        .eq("masjid_id", tenantContext.masjidId)
                .order("created_at", { ascending: false });

      console.log("DEBUG PAYMENTS QUERY:");
      console.log("- familyId:", familyId);
      console.log("- masjidId:", tenantContext.masjidId);
      console.log("- paymentsData:", paymentsData);
      console.log("- paymentsError:", paymentsError);
      console.log("- paymentsData length:", paymentsData?.length || 0);

      if (paymentsError) {
        console.log("Payments fetch error:", paymentsError);
        setPayments([]);
      } else {
        const mappedPayments = paymentsData || [];
        console.log("DEBUG PAYMENTS MAPPING:");
        console.log("- mappedPayments:", mappedPayments);
        console.log("- mappedPayments length:", mappedPayments.length);
        setPayments(mappedPayments);
      }

      const { data: servicesData, error: servicesError } = await supabase
        .from("service_distributions")
        .select("id, status, date, name")
        .eq("family_id", familyId)
        .eq("masjid_id", tenantContext.masjidId)
        .order("date", { ascending: false });

      if (servicesError) {
        console.log("Services fetch error:", servicesError);
        setServices([]);
      } else {
        setServices(
          (servicesData || []).map((s: any) => ({
            id: s.id,
            name: s.name || "Service",
            date: s.date,
            status: s.status,
          }))
        );
      }
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setErrorMessage(err?.message || "Failed to load family details.");
      setFamily(null);
      setMembers([]);
      setPayments([]);
      setServices([]);
    } finally {
      setLoading(false);
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
    setCivilStatus("");
    
    // Reset new fields
    setEducation("");
    setOccupation("");
    setIsMoulavi(false);
    setIsNewMuslim(false);
    
    // Reset person-specific fields
    setIsForeignResident(false);
    setForeignCountry("");
    setForeignContact("");
    setHasSpecialNeeds(false);
    setSpecialNeedsDetails("");
    setHasHealthIssue(false);
    setHealthDetails("");
  };

  const openEditMember = (member: Member) => {
    setEditingMember(member);
    setFullName(member.name || "");
    setRelationship(member.relationship || "மகன்");
    setDob(member.dob || "");
    setAge(member.age ? String(member.age) : "");
    setGender(member.gender || "Male");
    setNic(member.nic || "");
    setPhone(member.phone || "");
    setCivilStatus(member.civil_status || "");
    
    // Set new fields
    setEducation(member.education || "");
    setOccupation(member.occupation || "");
    setIsMoulavi(member.is_moulavi || false);
    setIsNewMuslim(member.is_new_muslim || false);
    
    // Set person-specific fields
    setIsForeignResident(member.is_foreign_resident || false);
    setForeignCountry(member.foreign_country || "");
    setForeignContact(member.foreign_contact || "");
    setHasSpecialNeeds(member.has_special_needs || false);
    setSpecialNeedsDetails(member.special_needs_details || "");
    setHasHealthIssue(member.has_health_issue || false);
    setHealthDetails(member.health_details || "");
    
    setIsModalOpen(true);
  };

  const addCollection = async () => {
    if (!supabase || !familyId || !user || !tenantContext?.masjidId) return;
    
    const amountNum = parseFloat(collectionAmount);
    if (!amountNum || amountNum <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setIsCollectionSubmitting(true);
    
    try {
      const insertPayload = {
        masjid_id: tenantContext.masjidId,
        family_id: familyId,
        amount: amountNum,
        commission_percent: 0,
        commission_amount: 0,
        notes: collectionNote || null,
        collected_by_user_id: user.id,
        date: collectionDate
      };

      const { data, error: insertError } = await supabase
        .from("subscription_collections")
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        console.error('Collection insert failed:', insertError);
        alert("Failed to add collection: " + insertError.message);
      } else {
        // Reset form
        setCollectionAmount("");
        setCollectionNote("");
        setCollectionDate(new Date().toISOString().split('T')[0]);
        
        // Close modal
        setIsCollectionModalOpen(false);
        
        // Refresh data
        await fetchData(user);
        
        alert("Collection added successfully!");
      }
    } catch (error: any) {
      console.error('Collection error:', error);
      alert("Error: " + error.message);
    } finally {
      setIsCollectionSubmitting(false);
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supabase || !familyId || !user || !tenantContext?.masjidId) return;

    setSubmitting(true);
    setSuccessMessage("");

    try {
      if (!user.id) {
        alert("User ID not found");
        return;
      }

      if (editingMember) {
        const { error } = await supabase
          .from("members")
          .update({
            name: fullName,              // Keep for future compatibility
            full_name: fullName,        // Add for database NOT NULL constraint
            relationship,
            age: age ? parseInt(age, 10) : null,
            gender,
            dob,
            nic,
            phone,
            civil_status: civilStatus,
            // New fields
            education: education || null,
            occupation: occupation || null,
            is_moulavi: isMoulavi,
            is_new_muslim: isNewMuslim,
            // Person-specific fields
            is_foreign_resident: isForeignResident,
            foreign_country: foreignCountry || null,
            foreign_contact: foreignContact || null,
            has_special_needs: hasSpecialNeeds,
            special_needs_details: specialNeedsDetails || null,
            has_health_issue: hasHealthIssue,
            health_details: healthDetails || null,
          })
          .eq("id", editingMember.id)
          .eq("masjid_id", tenantContext.masjidId);

        if (error) throw error;
        setSuccessMessage("Member details updated!");
      } else {
        const { error } = await supabase.from("members").insert([
          {
            family_id: familyId,
            name: fullName,
            full_name: fullName,
            relationship,
            age: age ? parseInt(age, 10) : null,
            gender,
            dob,
            nic,
            phone,
            civil_status: civilStatus,
            // New fields
            education: education || null,
            occupation: occupation || null,
            is_moulavi: isMoulavi,
            is_new_muslim: isNewMuslim,
            // Person-specific fields
            is_foreign_resident: isForeignResident,
            foreign_country: foreignCountry || null,
            foreign_contact: foreignContact || null,
            has_special_needs: hasSpecialNeeds,
            special_needs_details: specialNeedsDetails || null,
            has_health_issue: hasHealthIssue,
            health_details: healthDetails || null,
            user_id: user.id,
            masjid_id: tenantContext.masjidId,
          },
        ]);

        if (error) throw error;
        setSuccessMessage("New member added successfully!");
      }

      setIsModalOpen(false);
      resetForm();
      await fetchData(user);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (error: any) {
      console.error("ADD MEMBER Error:", error);
     alert(`Error: ${error.message || t.failed_to_add_member}`);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteMember = async (memberId: string) => {
    if (!supabase || !tenantContext?.masjidId || !window.confirm(t.confirm_delete)) return;

    try {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", memberId)
        .eq("masjid_id", tenantContext.masjidId);

      if (error) throw error;
      await fetchData(user);
    } catch (error: any) {
      console.error("DELETE MEMBER Error:", error);
      alert(error.message);
    }
  };

  const toggleServiceStatus = async (serviceId: string) => {
    if (!supabase || !tenantContext?.masjidId) return;

    try {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return;

      const newStatus = service.status === "Received" ? "Pending" : "Received";

      const { error } = await supabase
        .from("service_distributions")
        .update({ status: newStatus })
        .eq("id", serviceId)
        .eq("masjid_id", tenantContext.masjidId);

      if (error) throw error;
      await fetchData(user);
    } catch (error: any) {
      console.error("TOGGLE SERVICE Error:", error);
      alert(error.message);
    }
  };

  const generatePDF = () => {
    try {
      if (typeof window === "undefined") {
        alert("PDF generation not available in server-side rendering");
        return;
      }

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      doc.text(`Family: ${family?.head_name} (${family?.family_code})`, 15, 15);

      const tableData = members.map((m) => [
        m.name,
        normalizeRelationship(m.relationship),
        m.age,
        m.gender,
        m.nic,
        m.phone,
      ]);

      autoTable(doc, {
        startY: 25,
        head: [["Name", "Relation", "Age", "Gender", "NIC", "Phone"]],
        body: tableData,
        columnStyles: {
          0: {cellWidth: 40},  // Name
          1: {cellWidth: 25},  // Relation
          2: {cellWidth: 15},  // Age
          3: {cellWidth: 20},  // Gender
          4: {cellWidth: 30},  // NIC
          5: {cellWidth: 35},  // Phone
        },
        styles: { 
          fontSize: 9,
          cellPadding: 2
        },
        margin: { 
          top: 20, 
          left: 15, 
          right: 15, 
          bottom: 20 
        },
        didDrawPage: (data) => {
          // Add page number at bottom
          doc.text(`Page ${doc.getCurrentPageInfo().pageNumber}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
        }
      });

      doc.save(`family_${family?.family_code}_members.pdf`);
    } catch (error) {
      console.error("PDF generation error:", error);
      alert("PDF generation failed: " + (error as Error).message);
    }
  };

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.relationship.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const annualFee = Number(family?.subscription_amount || 0);
  const totalApproved = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = annualFee - totalApproved;
  const isOverpaid = remainingBalance < 0;
  const openingBal = family?.opening_balance || 0;

  console.log("DEBUG CALCULATIONS:");
  console.log("- selectedYear:", selectedYear);
  console.log("- payments array:", payments);
  console.log("- payments.length:", payments.length);
  console.log("- annualFee:", annualFee);
  console.log("- totalApproved:", totalApproved);

  const paidThisYear = payments
    .filter((p) => {
      const paymentDate = p.collected_at || p.created_at;
      const y = new Date(paymentDate).getFullYear();
      return y === selectedYear && p.amount > 0;
    })
    .reduce((s, p) => s + p.amount, 0);

  console.log("- paidThisYear:", paidThisYear);

  const paidPrevYear = payments
    .filter((p) => {
      const paymentDate = p.collected_at || p.created_at;
      return new Date(paymentDate).getFullYear() === selectedYear - 1 && p.amount > 0;
    })
    .reduce((s, p) => s + p.amount, 0);

  const previousArrears = openingBal;
  const currentDue = annualFee - paidThisYear;
  const finalDue = previousArrears + currentDue;

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!family) {
    return <div>Family not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-6 font-sans">
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

      {errorMessage && (
        <div className="px-6 pt-6">
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-[2rem] flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            </div>
            <p className="text-[11px] font-black text-amber-900 uppercase tracking-tight leading-relaxed">
              {errorMessage}
            </p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="px-6 pt-6">
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-[2rem] flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-xs font-bold text-emerald-900">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="px-6 pt-6 grid grid-cols-2 gap-4">
        <div className="bg-emerald-50 rounded-[2rem] p-5 border border-emerald-100 space-y-2">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t.recent_services}</span>
          </div>
          <p className="text-xs font-bold text-slate-700">Ramadan Dates</p>
          <p className="text-[9px] font-black text-emerald-600/60 uppercase">MARCH 2024</p>
        </div>

        <div className="bg-rose-50 rounded-[2rem] p-5 border border-rose-100 space-y-3">
          <div className="flex items-center gap-2 text-rose-600">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t.subscription_balance}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.year}</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="text-xs font-bold bg-white border border-rose-100 rounded-lg px-2 py-1"
            >
              {Array.from({ length: 6 }).map((_, i) => {
                const y = new Date().getFullYear() - i;
                return (
                  <option key={y} value={y}>
                    {y}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="text-[11px] space-y-1 font-bold text-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 uppercase tracking-widest">{t.opening_balance}</span>
              <span>Rs. {openingBal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 uppercase tracking-widest">{t.annual_fee}</span>
              <span>Rs. {annualFee.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 uppercase tracking-widest">{t.paid}</span>
              <span>Rs. {paidThisYear.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 uppercase tracking-widest">Prev Arrears</span>
              <span>Rs. {previousArrears.toLocaleString()}</span>
            </div>
          </div>
          <p className="text-sm font-black text-slate-900">Rs. {finalDue.toLocaleString()}</p>
          <p className="text-[9px] font-black text-rose-600/60 uppercase tracking-tighter">Due for {selectedYear}</p>
        </div>
      </div>

      {/* Add Subscription Button */}
      <div className="bg-blue-50 rounded-[2rem] p-5 border border-blue-100 mb-6">
        <button
          onClick={() => setIsCollectionModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all"
        >
          <Wallet className="w-4 h-4" />
          Add Subscription
        </button>
      </div>

      <div className="p-6">
        <div className="bg-white professional-card rounded-[2rem] p-6 space-y-6 relative overflow-hidden">
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Address</p>
                <p className="text-sm font-semibold text-slate-700">{family?.address}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                <p className="text-sm font-semibold text-slate-700">{family?.phone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

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

      <div className="px-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
            {activeTab === "members" ? t.members : activeTab === "payments" ? t.payment_history : t.services_received}
          </h3>
          {activeTab === "members" && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full ml-2">
              {members.length} Members
            </span>
          )}
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
              filteredMembers.map((member) => (
                <div key={member.id} className="bg-white professional-card rounded-2xl p-4 flex items-center justify-between group animate-in fade-in duration-500">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-100 transition-colors flex-shrink-0">
                      <User className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-emerald-600 transition-colors">
                        {member.name}
                      </h3>
                      <p className="text-xs font-bold text-slate-400">
                        {normalizeRelationship(member.relationship)}{member.age ? ` \u2022 ${member.age} YEARS` : ""}
                      </p>
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 mt-1 inline-block">
                        {member.civil_status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditMember(member)}
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
            {/* Payment Summary Section */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">Payment Summary</h3>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Annual Fee:</span> Rs. {annualFee.toLocaleString()}
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Total Approved:</span> Rs. {totalApproved.toLocaleString()}
                    </p>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Remaining Balance:</span> Rs. {finalDue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-4">
                <div className="p-5 bg-slate-50 rounded-full text-slate-200">
                  <Wallet className="h-10 w-10" />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No payments yet</p>
              </div>
            ) : (
              payments.map((payment) => (
                <div key={payment.id} className="bg-white rounded-2xl p-4 flex items-center justify-between border border-slate-50 shadow-sm animate-in fade-in duration-500">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      payment.status === 'pending' ? 'bg-yellow-50 text-yellow-500' : 'bg-blue-50 text-blue-500'
                    }`}>
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-800">Subscription Collection</h4>
                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${
                          payment.status === 'pending' 
                            ? 'bg-yellow-100 text-yellow-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {payment.status === 'pending' ? 'Pending' : 'Accepted'}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{payment.collected_at || payment.created_at}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black ${
                      payment.status === 'pending' ? 'text-yellow-500' : 'text-emerald-500'
                    }`}>
                      + Rs. {payment.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3 w-full">
            {services.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-4">
                <div className="p-5 bg-slate-50 rounded-full text-slate-200">
                  <CheckCircle className="h-10 w-10" />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No services recorded</p>
              </div>
            ) : (
              services.map((service) => (
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
                  <button
                    onClick={() => {}}
                    className={`px-3 py-1 rounded-full text-[8px] font-black uppercase transition-all active:scale-95 ${
                      service.status === "Received"
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {service.status === "Received" ? t.active : t.inactive}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

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
              <QRCodeSVG value={`smart-masjeedh:family:${family?.id}`} size={200} level="H" includeMargin={false} />
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 text-center text-slate-900">{t.add_member}</h2>

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
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">{t.relationship}</label>
                  <select
                    required
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20 appearance-none"
                  >
                    <option value="கணவன்">{t.husband}</option>
<option value="மனைவி">{t.wife}</option>
<option value="மகன்">{t.son}</option>
<option value="மகள்">{t.daughter}</option>
<option value="தந்தை">{t.father}</option>
<option value="தாய்">{t.mother}</option>
<option value="ஏனையோர்">{t.other}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">{t.date_of_birth}</label>
                  <input
                    required
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">{t.age}</label>
                  <input readOnly value={age} className="w-full bg-slate-100 border-none rounded-2xl p-4 text-sm text-slate-500" />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">NIC</label>
                  <input
                    value={nic}
                    onChange={(e) => setNic(e.target.value)}
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

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.civil_status}</label>
                <select
                  value={civilStatus}
                  onChange={(e) => setCivilStatus(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20"
                >
                  <option value="">{t.select_option}</option>
                  <option value="Single">{t.single}</option>
                  <option value="Married">{t.married}</option>
                  <option value="Divorced">{t.divorced}</option>
                  <option value="Widowed">{t.widowed}</option>
                  <option value="Other">{t.other}</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">Education</label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20"
                    placeholder="e.g. High School, Bachelor's Degree"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">Occupation</label>
                  <input
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20"
                    placeholder="e.g. Teacher, Engineer, Business"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_moulavi"
                    checked={isMoulavi}
                    onChange={(e) => setIsMoulavi(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <label htmlFor="is_moulavi" className="text-xs text-slate-600 font-medium">Moulavi</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_new_muslim"
                    checked={isNewMuslim}
                    onChange={(e) => setIsNewMuslim(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <label htmlFor="is_new_muslim" className="text-xs text-slate-600 font-medium">New Muslim</label>
                </div>
              </div>

              {/* Foreign Resident Section */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_foreign_resident"
                      checked={isForeignResident}
                      onChange={(e) => setIsForeignResident(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <label htmlFor="is_foreign_resident" className="text-xs text-slate-600 font-medium">Foreign Resident</label>
                  </div>
                  
                  {isForeignResident && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 animate-in fade-in duration-300">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">Country</label>
                        <input
                          type="text"
                          value={foreignCountry}
                          onChange={(e) => setForeignCountry(e.target.value)}
                          className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20"
                          placeholder="Country name"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">Contact Details</label>
                        <input
                          type="text"
                          value={foreignContact}
                          onChange={(e) => setForeignContact(e.target.value)}
                          className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20"
                          placeholder="Contact information"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Special Needs Section */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="has_special_needs"
                      checked={hasSpecialNeeds}
                      onChange={(e) => setHasSpecialNeeds(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <label htmlFor="has_special_needs" className="text-xs text-slate-600 font-medium">Has Special Needs</label>
                  </div>
                  
                  {hasSpecialNeeds && (
                    <div className="mt-3 animate-in fade-in duration-300">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">Special Needs Details</label>
                        <textarea
                          value={specialNeedsDetails}
                          onChange={(e) => setSpecialNeedsDetails(e.target.value)}
                          className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20"
                          placeholder="Describe special needs or accommodations"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Health Section */}
              <div className="border-t border-slate-100 pt-4 mt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="has_health_issue"
                      checked={hasHealthIssue}
                      onChange={(e) => setHasHealthIssue(e.target.checked)}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <label htmlFor="has_health_issue" className="text-xs text-slate-600 font-medium">Has Health Issue</label>
                  </div>
                  
                  {hasHealthIssue && (
                    <div className="mt-3 animate-in fade-in duration-300">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-400 uppercase font-bold ml-1">Health Details</label>
                        <textarea
                          value={healthDetails}
                          onChange={(e) => setHealthDetails(e.target.value)}
                          className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm focus:ring-2 ring-emerald-500/20"
                          placeholder="Health-related information"
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-4 rounded-2xl text-sm font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50"
                >
                  {submitting ? t.saving : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection Modal */}
      {isCollectionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600">
                <Wallet className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Add Subscription</span>
              </div>
              <button
                onClick={() => setIsCollectionModalOpen(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount</label>
                <input
                  type="number"
                  value={collectionAmount}
                  onChange={(e) => setCollectionAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Enter amount"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                <input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Note (Optional)</label>
                <textarea
                  value={collectionNote}
                  onChange={(e) => setCollectionNote(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Add any notes..."
                  rows={2}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setIsCollectionModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={addCollection}
                  disabled={isCollectionSubmitting}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isCollectionSubmitting ? "Adding..." : "Add Subscription"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}