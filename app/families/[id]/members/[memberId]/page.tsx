"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, User } from "lucide-react";
import jsPDF from "jspdf";
import { supabase } from "@/lib/supabase";
import { getPdfMasjidName } from "@/lib/pdf-utils";
import { useMockAuth } from "@/components/MockAuthProvider";

type FamilySummary = {
  id: string;
  family_code: string;
  head_name: string;
};

type MemberDetails = {
  id: string;
  family_id: string;
  name: string;
  member_code?: string;
  relationship?: string;
  age?: number;
  gender?: string;
  dob?: string;
  nic?: string;
  phone?: string;
  civil_status?: string;
  education?: string;
  occupation?: string;
  is_moulavi?: boolean;
  is_new_muslim?: boolean;
  is_foreign_resident?: boolean;
  foreign_country?: string;
  foreign_contact?: string;
  has_special_needs?: boolean;
  special_needs_details?: string;
  has_health_issue?: boolean;
  health_details?: string;
};

const detailFields = [
  { key: "member_code", label: "Member Code" },
  { key: "relationship", label: "Relationship" },
  { key: "age", label: "Age" },
  { key: "gender", label: "Gender" },
  { key: "dob", label: "Date of Birth" },
  { key: "nic", label: "NIC" },
  { key: "phone", label: "Phone" },
  { key: "civil_status", label: "Civil Status" },
  { key: "education", label: "Education" },
  { key: "occupation", label: "Occupation" },
  { key: "foreign_country", label: "Foreign Country" },
  { key: "foreign_contact", label: "Foreign Contact" },
  { key: "special_needs_details", label: "Special Needs" },
  { key: "health_details", label: "Health Details" },
] as const;

export default function MemberDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const familyId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const memberId = Array.isArray(params?.memberId) ? params.memberId[0] : params?.memberId;
  const { user: authUser, tenantContext } = useMockAuth();

  const [loading, setLoading] = useState(true);
  const [family, setFamily] = useState<FamilySummary | null>(null);
  const [member, setMember] = useState<MemberDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!authUser) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }

      if (!supabase || !tenantContext?.masjidId || !familyId || !memberId) {
        setLoading(false);
        setErrorMessage("Member தகவலை ஏற்ற முடியவில்லை.");
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const [{ data: familyData, error: familyError }, { data: memberData, error: memberError }] = await Promise.all([
          supabase
            .from("families")
            .select("id, family_code, head_name")
            .eq("id", familyId)
            .eq("masjid_id", tenantContext.masjidId)
            .single(),
          supabase
            .from("members")
            .select("*")
            .eq("id", memberId)
            .eq("family_id", familyId)
            .eq("masjid_id", tenantContext.masjidId)
            .single(),
        ]);

        if (familyError) throw familyError;
        if (memberError) throw memberError;

        setFamily(familyData);
        setMember(memberData);
      } catch (error: any) {
        console.error("Member detail fetch error:", error);
        setErrorMessage(error.message || "Member தகவலை ஏற்ற முடியவில்லை.");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [authUser, tenantContext, familyId, memberId, router]);

  const visibleDetails = useMemo(() => {
    if (!member) return [];

    return detailFields
      .map(({ key, label }) => {
        const rawValue = member[key];
        const value = rawValue === null || rawValue === undefined || rawValue === "" ? null : String(rawValue);
        return value ? { label, value } : null;
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;
  }, [member]);

  const generatePDF = async () => {
    if (!member || !family) return;

    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const masjidName = await getPdfMasjidName(supabase, tenantContext?.masjidId);
      let y = 20;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(masjidName, 105, y, { align: "center" });

      y += 10;
      doc.text("Member Details", 15, y);

      y += 10;
      doc.setFontSize(12);
      doc.text(`Family: ${family.head_name} (${family.family_code})`, 15, y);

      y += 12;
      doc.setFontSize(16);
      doc.text(member.name || "Member", 15, y);

      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);

      visibleDetails.forEach(({ label, value }) => {
        const lines = doc.splitTextToSize(`${label}: ${value}`, 180);
        if (y + lines.length * 6 > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(lines, 15, y);
        y += lines.length * 6 + 2;
      });

      doc.save(`member_${member.name || "details"}.pdf`);
    } catch (error) {
      console.error("Member PDF generation error:", error);
      alert("PDF generation failed");
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (!member || !family) {
    return <div className="p-8 text-center">{errorMessage || "Member not found"}</div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-8 font-sans">
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/families/${family.id}`} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-emerald-600">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-lg font-black">Member Details</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{family.family_code}</p>
          </div>
        </div>
        <button
          onClick={generatePDF}
          className="p-2.5 bg-slate-50 text-blue-600 rounded-xl hover:bg-blue-50 active:scale-95 transition-all"
        >
          <FileText className="h-5 w-5" />
        </button>
      </header>

      <main className="p-6 space-y-4 max-w-2xl w-full mx-auto">
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
              <User className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">{member.name}</h2>
              <p className="text-sm font-bold text-slate-500">{member.relationship || "-"}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {family.head_name}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleDetails.map(({ label, value }) => (
            <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
              <p className="mt-2 text-sm font-bold text-slate-800 break-words">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Flags</p>
            <div className="mt-3 space-y-2 text-sm font-bold text-slate-700">
              <p>Moulavi: {member.is_moulavi ? "Yes" : "No"}</p>
              <p>New Muslim: {member.is_new_muslim ? "Yes" : "No"}</p>
              <p>Foreign Resident: {member.is_foreign_resident ? "Yes" : "No"}</p>
              <p>Special Needs: {member.has_special_needs ? "Yes" : "No"}</p>
              <p>Health Issue: {member.has_health_issue ? "Yes" : "No"}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
