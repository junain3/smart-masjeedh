"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, RefreshCw, QrCode, X, ArrowLeft, CreditCard, Edit, Trash2, FileText, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { QrScannerModal } from "@/components/QrScannerModal";
import { QRCodeSVG } from "qrcode.react";
import { useMockAuth } from "@/components/MockAuthProvider";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import RouteGuard from "@/components/RouteGuard";
import { parsePermissions, hasModulePermission, isSuperAdmin } from "@/lib/permissions-utils";

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address: string;
  phone: string;
  subscription_amount?: number;
  opening_balance?: number;
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
  const { user, tenantContext, loading: authLoading, resumeTick } = useSupabaseAuth();
  
  // Parse permissions and check access
  const parsedPermissions = parsePermissions(JSON.stringify(tenantContext?.permissions || {}));
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);
  const hasFamiliesAccess = hasModulePermission(parsedPermissions, 'families');
  
  // Role-based super admin fallback
  const isSuperAdminByRole = tenantContext?.role === 'super_admin' || user?.role === 'super_admin';
  
  // Page-level access control
  if (authLoading) return <div>Loading...</div>;
  if (!user) {
    router.push('/login');
    return null;
  }
  
  if (!hasFamiliesAccess && !userIsSuperAdmin && !isSuperAdminByRole) {
    return <div>No access to Families module</div>;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [headName, setHeadName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [subscriptionAmount, setSubscriptionAmount] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [isWidowHead, setIsWidowHead] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [editingFamily, setEditingFamily] = useState<Family | null>(null);
  const [isPdfOptionsOpen, setIsPdfOptionsOpen] = useState(false);
  const [pdfCols, setPdfCols] = useState<{code:boolean; head:boolean; address:boolean; phone:boolean; sub:boolean}>({code:true, head:true, address:true, phone:true, sub:true});
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [allowed, setAllowed] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [lang, setLang] = useState<Language>("en");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [isCodePrintOpen, setIsCodePrintOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [invalidCodes, setInvalidCodes] = useState<string[]>([]);
  const [printFamilies, setPrintFamilies] = useState<Family[]>([]);

  const t = getTranslation(lang);

  // Debug log to verify safe translation object
  console.log("FAMILIES PAGE LANG DEBUG", { lang, tKeys: Object.keys(t), hasHome: !!t.home });

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (!tenantContext?.masjidId) return;
    fetchFamilies();
  }, [tenantContext?.masjidId, resumeTick]);


  useEffect(() => {
    if (editingFamily) {
      setHeadName(editingFamily.head_name);
      setAddress(editingFamily.address);
      setPhone(editingFamily.phone);
      setFamilyCode(editingFamily.family_code);
      setSubscriptionAmount(editingFamily.subscription_amount?.toString() || "");
      setOpeningBalance(editingFamily.opening_balance?.toString() || "");
      setIsWidowHead(editingFamily.is_widow_head || false);
      setIsOpen(true);
    }
  }, [editingFamily]);

  const handleQrDecodedText = (decodedText: string) => {
    if (!decodedText) return;
    if (decodedText.startsWith("smart-masjeedh:family:")) {
      const familyId = decodedText.split(":")[2];
      setIsScannerOpen(false);
      router.push(`/families/${familyId}`);
    }
  };

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
    try {
      if (!supabase) return;
      setIsFetching(true);

      if (!tenantContext?.masjidId) {
        setIsFetching(false);
        return;
      }

      const isAdmin = tenantContext.role === "super_admin" || tenantContext.role === "co_admin";
      const canMembers = isAdmin || tenantContext.permissions?.members !== false;
      setAllowed(canMembers);
      if (!canMembers) {
        setFamilies([]);
        setIsLive(false);
        return;
      }

      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("masjid_id", tenantContext.masjidId)
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
      if (!tenantContext?.masjidId) {
        setLoading(false);
        throw new Error("லாகின் செய்யப்படவில்லை.");
      }

      // Get the authenticated user ID from auth, not from state
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("லாகின் செய்யப்படவில்லை.");

      const authUserId = session.user.id;

      const isAdmin = tenantContext.role === "super_admin" || tenantContext.role === "co_admin";
      const canMembers = isAdmin || tenantContext.permissions?.members !== false;
      if (!canMembers) throw new Error("Access denied");

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
            opening_balance: parseFloat(openingBalance) || 0,
            is_widow_head: isWidowHead
          })
          .eq("id", editingFamily.id)
          .eq("masjid_id", tenantContext.masjidId);

        if (error) throw error;
        setSuccessMessage("குடும்ப விபரம் திருத்தப்பட்டது.");
      } else {
        // Insert new
        const { data, error } = await supabase
          .from("families")
          .insert([
            {
              family_code: familyCode,
              head_name: headName,
              address,
              phone,
              subscription_amount: parseFloat(subscriptionAmount) || 0,
              opening_balance: parseFloat(openingBalance) || 0,
              is_widow_head: isWidowHead,
              user_id: authUserId, // Use authenticated user ID
              masjid_id: tenantContext.masjidId // Include masjid ID
            }
          ])
          .select()
          .single();

        if (!error && data) {
          const newFamilyId = data.id;
          
          // Check if head member already exists (safe pattern)
          const { data: existingHead } = await supabase
            .from("members")
            .select("id")
            .eq("family_id", newFamilyId)
            .eq("relationship", "Head")
            .maybeSingle();

          if (!existingHead) {
            // Create head member only if doesn't exist
            const { error: memberInsertError } = await supabase.from("members").insert([{
              family_id: newFamilyId,
              name: headName,              // Keep for future compatibility
              full_name: headName,        // Add for database NOT NULL constraint
              relationship: "Head",
              civil_status: "",
              user_id: authUserId,
              masjid_id: tenantContext.masjidId
            }]);
            
            if (memberInsertError) {
              console.error("Head member creation failed:", memberInsertError);
              throw new Error(`Failed to create family head member: ${memberInsertError.message}`);
            }
          }
        }

        if (error) throw error;
        setSuccessMessage("குடும்பம் வெற்றிகரமாகச் சேமிக்கப்பட்டது.");
        if (data) {
          router.push(`/families/${data.id}`);  // Redirect to family details
        }
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
    setOpeningBalance("");
    setIsWidowHead(false);
    setEditingFamily(null);
  };

  async function deleteFamily(id: string) {
    if (!supabase || !confirm(t.confirm_delete)) return;
    try {
      if (!tenantContext?.masjidId) return;

      const isAdmin = tenantContext.role === "super_admin" || tenantContext.role === "co_admin";
      const canMembers = isAdmin || tenantContext.permissions?.members !== false;
      if (!canMembers) {
        alert("Access denied");
        return;
      }

      const { error } = await supabase
        .from("families")
        .delete()
        .eq("id", id)
        .eq("masjid_id", tenantContext.masjidId);
      if (error) throw error;
      fetchFamilies();
    } catch (err: any) {
      alert(err.message);
    }
  }

  const generatePDF = () => {
    try {
      console.log('Families: Starting print generation...');
      
      // Check client-side
      if (typeof window === 'undefined') {
        console.error('Print generation not available in server-side rendering');
        return;
      }
      
      // Create printable HTML
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        alert('Please allow popups for this website to print PDF');
        return;
      }
      
      // Prepare headers
      const headers: string[] = [];
      if (pdfCols.code) headers.push("Code");
      if (pdfCols.head) headers.push("Head Name");
      if (pdfCols.address) headers.push("Address");
      if (pdfCols.phone) headers.push("Phone");
      if (pdfCols.sub) headers.push("Sub. Amt");

      // Prepare table data
      const tableData = filteredFamilies.map(f => {
        const row: (string|number)[] = [];
        if (pdfCols.code) row.push(f.family_code);
        if (pdfCols.head) row.push(f.head_name);
        if (pdfCols.address) row.push(f.address);
        if (pdfCols.phone) row.push(f.phone);
        if (pdfCols.sub) row.push(f.subscription_amount || 0);
        return row;
      });
      
      // Generate HTML content
      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Masjid Families List</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              font-size: 12px;
              line-height: 1.4;
            }
            h1 { 
              text-align: center; 
              margin-bottom: 20px;
              font-size: 18px;
              font-weight: bold;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 8px; 

const handlePrintByCode = async () => {
  if (!families.length) {
    await fetchFamilies();
  }

  const requestedCodes = parseCodeInput(codeInput);
  const validFamilies = families.filter(family => 
    requestedCodes.some(code => family.family_code.toLowerCase() === code.toLowerCase())
  );
  const invalid = requestedCodes.filter(code => 
    !families.some(family => family.family_code.toLowerCase() === code.toLowerCase())
  );
  
  setInvalidCodes(invalid);
  
  if (validFamilies.length > 0) {
    setPrintFamilies(validFamilies);
    setIsPrintMode(true);
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setIsPrintMode(false);
        setPrintFamilies([]);
        setInvalidCodes([]);
        setCodeInput("");
        setIsCodePrintOpen(false);
      }, 300);
    }, 150);
  }
};

const familiesForPrint = printFamilies.length ? printFamilies : families;

const printStyles = `
  @media print {
    .print-only {
      display: block !important;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: white;
      z-index: 9999;
    }
    .no-print {
      display: none !important;
    }
    .print-qr-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin: 10px;
      padding: 20px;
    }
    .print-qr-item {
      border: 2px solid #000;
      padding: 15px;
      text-align: center;
      page-break-inside: avoid;
      margin-bottom: 20px;
      background: white;
    }
    .qr-code-container {
      margin-bottom: 10px;
    }
    .family-info {
      font-size: 14px;
      line-height: 1.4;
      font-weight: bold;
    }
    .family-code {
      font-size: 16px;
      color: #0066cc;
      margin-bottom: 5px;
    }
    .head-name {
      font-size: 12px;
      color: #333;
    }
  }
  @media screen {
    .print-only {
      display: none;
    }
  }
  @page {
    margin: 1cm;
    size: A4;
  }
`;

{isCodePrintOpen && (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-black">Print by Family Code</h3>
        <button onClick={() => setIsCodePrintOpen(false)} className="p-2 hover:bg-slate-50 rounded-full">
          <X className="w-5 h-5 text-slate-400" />
        </button>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Family Codes</label>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="M1-M19 or M1,M4,M5"
            className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all font-bold"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handlePrintByCode}
            className="flex-1 bg-purple-600 text-white py-3 rounded-2xl font-black"
          >
            Print Selected
          </button>
          <button 
            onClick={() => setIsCodePrintOpen(false)}
            className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-2xl font-black"
          >
            Cancel
          </button>
        </div>
        {invalidCodes.length > 0 && (
          <div className="bg-red-50 border border-red-100 text-red-700 px-3 py-2 rounded-lg text-sm">
            <p className="font-bold">Invalid codes:</p>
            <p>{invalidCodes.join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  )}

      {/* Print-only QR codes section */}
      {isPrintMode && (
        <div className="print-only">
          <style dangerouslySetInnerHTML={{ __html: printStyles }} />
          <div className="print-qr-grid">
            {familiesForPrint.map((family) => (
              <div key={family.id} className="print-qr-item">
                <div className="qr-code-container">
                  <QRCodeSVG 
                    value={`smart-masjeedh:family:${family.id}`} 
                    size={120} 
                    level="H" 
                    includeMargin={false}
                  />
                </div>
                <div className="family-info">
                  <div className="family-code">{family.family_code}</div>
                  <div className="head-name">{family.head_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
