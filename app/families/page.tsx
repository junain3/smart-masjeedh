"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, RefreshCw, QrCode, X, ArrowLeft, CreditCard, Edit, Trash2, FileText, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { QrScannerModal } from "@/components/QrScannerModal";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { useMockAuth } from "@/components/MockAuthProvider";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import RouteGuard from "@/components/RouteGuard";
import { parsePermissions, hasModulePermission, isSuperAdmin } from "@/lib/permissions-utils";
import { escapePdfHtml, getPdfMasjidName } from "@/lib/pdf-utils";

type Family = {
  id: string;
  family_code: string;
  head_name: string;
  address: string;
  phone: string;
  subscription_amount?: number;
  opening_balance?: number;
  is_widow_head?: boolean;
  // New fields for enhanced data collection
  house_type?: 'own' | 'rent';
  has_toilet?: boolean;
  special_needs_details?: string;
  foreign_members_details?: string;
  health_details?: string;
  has_car?: boolean;
  has_three_wheeler?: boolean;
  has_van?: boolean;
  has_lorry?: boolean;
  has_tractor?: boolean;
  extra_notes?: string;
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
  
  // New fields for enhanced data collection
  const [houseType, setHouseType] = useState<"own" | "rent" | "">("");
  const [hasToilet, setHasToilet] = useState(false);
  const [specialNeedsDetails, setSpecialNeedsDetails] = useState("");
  const [foreignMembersDetails, setForeignMembersDetails] = useState("");
  const [healthDetails, setHealthDetails] = useState("");
  const [hasCar, setHasCar] = useState(false);
  const [hasThreeWheeler, setHasThreeWheeler] = useState(false);
  const [hasVan, setHasVan] = useState(false);
  const [hasLorry, setHasLorry] = useState(false);
  const [hasTractor, setHasTractor] = useState(false);
  const [extraNotes, setExtraNotes] = useState("");
  
  // Step management for 3-step form
  const [currentStep, setCurrentStep] = useState(1);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [paymentCollections, setPaymentCollections] = useState<any[]>([]);
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
  const [step1Errors, setStep1Errors] = useState<{ headName?: string; address?: string; phone?: string }>({});
  const [isAllQrModalOpen, setIsAllQrModalOpen] = useState(false);
  const [qrPrintMode, setQrPrintMode] = useState<"all" | "range" | "specific">("all");
  const [qrRangeInput, setQrRangeInput] = useState("");
  const [qrSpecificInput, setQrSpecificInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const t = getTranslation(lang);

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
      
      // Set new fields
      setHouseType(editingFamily.house_type || "");
      setHasToilet(editingFamily.has_toilet || false);
      setSpecialNeedsDetails(editingFamily.special_needs_details || "");
      setForeignMembersDetails(editingFamily.foreign_members_details || "");
      setHealthDetails(editingFamily.health_details || "");
      setHasCar(editingFamily.has_car || false);
      setHasThreeWheeler(editingFamily.has_three_wheeler || false);
      setHasVan(editingFamily.has_van || false);
      setHasLorry(editingFamily.has_lorry || false);
      setHasTractor(editingFamily.has_tractor || false);
      setExtraNotes(editingFamily.extra_notes || "");
      
      setIsOpen(true);
      setCurrentStep(1); // Reset to first step when editing
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
        .select("id, family_code, head_name, phone, address, subscription_amount, opening_balance, is_widow_head, house_type, has_toilet, special_needs_details, foreign_members_details, health_details, has_car, has_three_wheeler, has_van, has_lorry, has_tractor, extra_notes, created_at, masjid_id")
        .eq("masjid_id", tenantContext.masjidId)
        .order("family_code", { ascending: true });

      if (error) throw error;


      if (data) {
        setFamilies(data);
        setIsLive(true);
        setErrorMessage("");
        
        // Fetch payment collections separately (don't block families loading)
        try {
          const { data: paymentData, error: paymentError } = await supabase
            .from("subscription_collections")
            .select("id, family_id, date, status")
            .eq("masjid_id", tenantContext.masjidId);
            
          if (!paymentError && paymentData) {
            setPaymentCollections(paymentData);
          }
        } catch (paymentErr) {
          console.error("Payment collections fetch error:", paymentErr);
          // Don't block families loading if payment fetch fails
        }
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

      // Client-side validation for required fields
      if (!headName.trim()) {
        setErrorMessage("Family head name is required.");
        setLoading(false);
        return;
      }
      
      if (!phone.trim()) {
        setErrorMessage("Phone number is required.");
        setLoading(false);
        return;
      }
      
      if (!familyCode.trim()) {
        setErrorMessage("Family code is required.");
        setLoading(false);
        return;
      }

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
            is_widow_head: isWidowHead,
            // New fields
            house_type: houseType || null,
            has_toilet: hasToilet,
            special_needs_details: specialNeedsDetails || null,
            foreign_members_details: foreignMembersDetails || null,
            health_details: healthDetails || null,
            has_car: hasCar,
            has_three_wheeler: hasThreeWheeler,
            has_van: hasVan,
            has_lorry: hasLorry,
            has_tractor: hasTractor,
            extra_notes: extraNotes || null
          })
          .eq("id", editingFamily.id)
          .eq("masjid_id", tenantContext.masjidId);

        if (error) throw error;
        setSuccessMessage("குடும்ப விபரம் திருத்தப்பட்டது.");
      } else {
        // Insert new using RPC function for atomic family_code generation
        const { data, error } = await supabase.rpc('insert_family_with_auto_code', {
          p_masjid_id: tenantContext.masjidId,
          p_head_name: headName,
          p_address: address,
          p_phone: phone,
          p_subscription_amount: parseFloat(subscriptionAmount) || 0,
          p_opening_balance: parseFloat(openingBalance) || 0,
          p_is_widow_head: isWidowHead,
          p_house_type: houseType || null,
          p_has_toilet: hasToilet,
          p_special_needs_details: specialNeedsDetails || null,
          p_foreign_members_details: foreignMembersDetails || null,
          p_health_details: healthDetails || null,
          p_has_car: hasCar,
          p_has_three_wheeler: hasThreeWheeler,
          p_has_van: hasVan,
          p_has_lorry: hasLorry,
          p_has_tractor: hasTractor,
          p_extra_notes: extraNotes || null,
          p_user_id: authUserId
        }).select();

        if (!error && data && data.length > 0) {
          const newFamilyId = data[0].id;
          const assignedCode = data[0].family_code;

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

          setSuccessMessage(`குடும்பம் வெற்றிகரமாகச் சேமிக்கப்பட்டது. குறியீடு: ${assignedCode}`);
          router.push(`/families/${newFamilyId}`);  // Redirect to family details
        }

        if (error) throw error;
      }

      setIsOpen(false);
      resetForm();
      fetchFamilies();
    } catch (err: any) {
      // Handle duplicate family_code error
      if (err.message && err.message.includes('duplicate key') || err.message && err.message.includes('unique constraint')) {
        setErrorMessage("இந்த குடும்ப குறியீடு ஏற்கனவே உள்ளது. வேறொரு குறியீட்டைப் பயன்படுத்தவும். (This family code already exists. Please use a different code.)");
      } else {
        setErrorMessage(err.message);
      }
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
    setHouseType("");
    setHasToilet(false);
    setSpecialNeedsDetails("");
    setForeignMembersDetails("");
    setHealthDetails("");
    setHasCar(false);
    setHasThreeWheeler(false);
    setHasVan(false);
    setHasLorry(false);
    setHasTractor(false);
    setExtraNotes("");
    setCurrentStep(1);
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

  // Helper function to parse QR selection input
  const parseQrSelection = (input: string): number[] => {
    if (!input || input.trim() === "") return [];
    
    const trimmed = input.trim().replace(/\s+/g, ""); // Remove spaces
    
    // Handle range format like "12-20"
    if (trimmed.includes("-")) {
      const parts = trimmed.split("-");
      if (parts.length === 2) {
        const start = parseInt(parts[0]);
        const end = parseInt(parts[1]);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          const result: number[] = [];
          for (let i = start; i <= end; i++) {
            result.push(i);
          }
          return result;
        }
      }
    }
    
    // Handle comma-separated format like "1,3,7"
    if (trimmed.includes(",")) {
      const parts = trimmed.split(",");
      const result: number[] = [];
      for (const part of parts) {
        const num = parseInt(part);
        if (!isNaN(num) && num > 0) {
          result.push(num);
        }
      }
      return result;
    }
    
    // Handle single number
    const singleNum = parseInt(trimmed);
    if (!isNaN(singleNum) && singleNum > 0) {
      return [singleNum];
    }
    
    return [];
  };

  // Helper function to get selected families based on mode
  const getSelectedFamilies = (): Family[] => {
    if (qrPrintMode === "all") {
      return filteredFamilies;
    }
    
    let indices: number[] = [];
    
    if (qrPrintMode === "range") {
      indices = parseQrSelection(qrRangeInput);
    } else if (qrPrintMode === "specific") {
      indices = parseQrSelection(qrSpecificInput);
    }
    
    // Convert 1-based indices to 0-based array indices
    return indices
      .map(index => filteredFamilies[index - 1]) // Convert to 0-based
      .filter(family => family !== undefined); // Filter out undefined
  };

  // Generate QR code as dataURL using canvas
  const generateQRDataURL = async (text: string, pixelSize = 200): Promise<string> => {
    return new Promise((resolve, reject) => {
      QRCode.toDataURL(text, {
        width: pixelSize,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H'
      }, (error, url) => {
        if (error) {
          reject(error);
        } else {
          resolve(url);
        }
      });
    });
  };

  // Generate bulk QR codes PDF for selected families
  const generateBulkQRPDF = async () => {
    try {
      const selectedFamilies = getSelectedFamilies();
      
      if (selectedFamilies.length === 0) {
        return;
      }
      
      if (typeof window === 'undefined') {
        console.error('PDF generation not available in server-side rendering');
        return;
      }
      
      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // A4 portrait: full page — 3 × 3 = 9 QR stickers per sheet (cost-efficient).
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const masjidName = await getPdfMasjidName(supabase, tenantContext?.masjidId);
      const horizontalMargin = 5;
      const verticalMargin = 5;
      const cardSpacing = 2;
      const rowSpacing = 2;
      const cardsPerRow = 3;
      const rowsPerPage = 3;
      const usableWidth = pageWidth - horizontalMargin * 2;
      const usableHeight = pageHeight - verticalMargin * 2;
      const cardWidth = (usableWidth - cardSpacing * (cardsPerRow - 1)) / cardsPerRow;
      const cardHeight = (usableHeight - rowSpacing * (rowsPerPage - 1)) / rowsPerPage;
      const cardsPerPage = cardsPerRow * rowsPerPage;

      const drawTightCutBorder = (x: number, y: number, w: number, h: number) => {
        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.45);
        const dash = 2;
        const gap = 2;
        for (let i = 0; i < w; i += dash + gap) {
          doc.line(x + i, y, x + Math.min(i + dash, w), y);
          doc.line(x + i, y + h, x + Math.min(i + dash, w), y + h);
        }
        for (let i = 0; i < h; i += dash + gap) {
          doc.line(x, y + i, x, y + Math.min(i + dash, h));
          doc.line(x + w, y + i, x + w, y + Math.min(i + dash, h));
        }
      };
      
      // Generate QR cards for each family
      for (let index = 0; index < selectedFamilies.length; index++) {
        const family = selectedFamilies[index];
        if (index > 0 && index % cardsPerPage === 0) {
          doc.addPage();
        }

        const pageIndex = index % cardsPerPage;
        const rowIndex = Math.floor(pageIndex / cardsPerRow);
        const colIndex = pageIndex % cardsPerRow;
        const currentX = horizontalMargin + colIndex * (cardWidth + cardSpacing);
        const currentY = verticalMargin + rowIndex * (cardHeight + rowSpacing);

        try {
          const qrValue = `smart-masjeedh:family:${family.id}`;
          const borderPad = 1.2;
          const gapQrToText = 1.8;
          const codeFontSize = 8.5;
          const nameFontSize = 6.8;
          const nameMaxWidth = cardWidth - borderPad * 2 - 1;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(nameFontSize);
          const nameLines = doc.splitTextToSize(family.head_name, nameMaxWidth).slice(0, 2);
          const labelHeight = gapQrToText + codeFontSize * 0.38 + nameLines.length * (nameFontSize * 0.42) + 1;

          const qrSize = Math.min(
            cardWidth - borderPad * 2 - 0.5,
            cardHeight - labelHeight - borderPad * 2 - 0.5
          );
          const contentWidth = qrSize + borderPad * 2;
          const contentHeight = borderPad + qrSize + labelHeight + borderPad;
          const borderX = currentX + (cardWidth - contentWidth) / 2;
          const borderY = currentY + (cardHeight - contentHeight) / 2;
          const qrX = borderX + borderPad;
          const qrY = borderY + borderPad;
          const codeY = qrY + qrSize + gapQrToText + codeFontSize * 0.32;
          const centerX = borderX + contentWidth / 2;

          const qrPixelSize = Math.min(512, Math.max(280, Math.round(qrSize * 11)));
          const qrDataURL = await generateQRDataURL(qrValue, qrPixelSize);

          doc.setFillColor(255, 255, 255);
          doc.rect(borderX, borderY, contentWidth, contentHeight, "F");
          drawTightCutBorder(borderX, borderY, contentWidth, contentHeight);
          doc.addImage(qrDataURL, "PNG", qrX, qrY, qrSize, qrSize);

          doc.setTextColor(15, 23, 42);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(5.8);
          const masjidLines = doc.splitTextToSize(masjidName, nameMaxWidth).slice(0, 1);
          doc.text(masjidLines, centerX, codeY - 3.2, { align: "center" });
          doc.setFontSize(codeFontSize);
          doc.text(family.family_code, centerX, codeY, { align: "center" });

          doc.setFontSize(nameFontSize);
          nameLines.forEach((line: string, lineIndex: number) => {
            doc.text(line, centerX, codeY + 3.2 + lineIndex * (nameFontSize * 0.42), { align: "center" });
          });
          
        } catch (error) {
          console.error('Error generating QR card:', error);
        }
      }
      
      // Save PDF
      doc.save('family-qr-codes.pdf');
      
    } catch (error) {
      console.error('Bulk QR PDF generation error:', error);
      alert('PDF generation failed: ' + (error as Error).message);
    }
  };

  const generatePDF = async () => {
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
      const masjidName = await getPdfMasjidName(supabase, tenantContext?.masjidId);
      
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
            .pdf-masjid-name {
              text-align: center;
              margin: 0 0 6px;
              font-size: 22px;
              font-weight: bold;
              color: #064e3b;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px;
            }
            th, td { 
              border: 1px solid #333; 
              padding: 8px; 
              text-align: left;
              vertical-align: top;
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold;
              font-size: 11px;
            }
            td { 
              font-size: 10px;
              word-wrap: break-word;
              max-width: 150px;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            @media print {
              body { margin: 10px; }
              th, td { 
                border: 1px solid #000; 
                padding: 6px;
                font-size: 9px;
              }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="pdf-masjid-name">${escapePdfHtml(masjidName)}</div>
          <h1>Masjid Families List</h1>
          <table>
            <thead>
              <tr>
      `;
      
      // Add headers
      headers.forEach(header => {
        htmlContent += `<th>${header}</th>`;
      });
      htmlContent += `
              </tr>
            </thead>
            <tbody>
      `;
      
      // Add data rows
      tableData.forEach(row => {
        htmlContent += '<tr>';
        row.forEach(cell => {
          const cellValue = String(cell || '');
          const truncatedValue = cellValue.length > 50 ? cellValue.substring(0, 50) + '...' : cellValue;
          htmlContent += `<td>${escapePdfHtml(truncatedValue)}</td>`;
        });
        htmlContent += '</tr>';
      });
      
      htmlContent += `
            </tbody>
          </table>
          <div class="footer">
            Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print()" style="padding: 10px 20px; font-size: 14px;">
              🖨️ Print / Save as PDF
            </button>
            <br><br>
            <small>Use Ctrl+P or Cmd+P to print, then choose "Save as PDF"</small>
          </div>
        </body>
        </html>
      `;
      
      // Write content to new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Focus and trigger print dialog
      printWindow.focus();
      
      console.log('Families: Print window opened successfully');
      
    } catch (error) {
      console.error('Families: Print generation error:', error);
      alert('Print generation failed: ' + (error as Error).message);
    }
  };

  // Helper function to check if family has accepted payments for selected year
  const isFamilyPaidForYear = (familyId: string, selectedYear: number): boolean => {
    if (!paymentCollections || paymentCollections.length === 0) {
      return false;
    }
    
    return paymentCollections.some((collection: any) => 
      collection.family_id === familyId &&
      collection.status === "accepted" &&
      new Date(collection.date).getFullYear() === selectedYear
    );
  };

  const filteredFamilies = families.filter(f => {
    // Search filter
    const matchesSearch = f.head_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                       f.family_code.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Payment status filter - ALL should show all families immediately
    if (statusFilter === "all") {
      return matchesSearch;
    }
    
    // PAID filter
    if (statusFilter === "paid") {
      return matchesSearch && isFamilyPaidForYear(f.id, year);
    }
    
    // UNPAID filter
    if (statusFilter === "unpaid") {
      return matchesSearch && !isFamilyPaidForYear(f.id, year);
    }
    
    return matchesSearch;
  });


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
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{isLive ? t.live_data : t.demo_mode}</p>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{t.year}</label>
              <select value={year} onChange={e=>setYear(parseInt(e.target.value))} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1">
                {Array.from({length:6}).map((_,i)=> {
                  const y=new Date().getFullYear()-i;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
              <div className="flex items-center gap-1">
                <button onClick={()=>setStatusFilter("all")} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${statusFilter==="all"?"bg-emerald-50 text-emerald-600":"text-slate-500 border border-slate-200"}`}>{t.filter_all}</button>
                <button onClick={()=>setStatusFilter("paid")} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${statusFilter==="paid"?"bg-emerald-50 text-emerald-600":"text-slate-500 border border-slate-200"}`}>{t.paid}</button>
                <button onClick={()=>setStatusFilter("unpaid")} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${statusFilter==="unpaid"?"bg-emerald-50 text-emerald-600":"text-slate-500 border border-slate-200"}`}>{t.unpaid}</button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsPdfOptionsOpen(true)}
            className="p-2.5 bg-slate-50 text-blue-600 rounded-xl hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-1"
            title={t.download_pdf}
          >
            <Download className="h-4 w-4" />
            <span className="text-xs font-bold">PDF</span>
          </button>
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 transition-all active:scale-95 flex items-center gap-1"
          >
            <QrCode className="h-4 w-4" />
            <span className="text-xs font-bold">QR</span>
          </button>
          <button 
            onClick={() => setIsAllQrModalOpen(true)}
            className="p-2.5 bg-slate-50 text-emerald-600 rounded-xl hover:bg-emerald-50 active:scale-95 transition-all"
            title="Print All QR Codes"
          >
            <QrCode className="h-4 w-4" />
            <span className="text-xs font-bold">All QR</span>
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
          {!isFetching && filteredFamilies.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="p-6 bg-slate-100 rounded-full text-slate-300">
                <Users className="h-12 w-12" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-400">No Families Found</h2>
                <p className="text-sm text-slate-400">{lang === 'ta' ? 'குறியீடு அல்லது பெயரைக் கொண்டு தேடுங்கள்' : 'Search by name or code'}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Mobile Card Layout */}
              <div className="sm:hidden space-y-3 w-full">
                {filteredFamilies.map((family) => (
                  <div key={family.id} className="bg-white rounded-2xl p-4 shadow-md space-y-3">
                    {/* Family Name and Code */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/families/${family.id}`}
                          className="text-lg font-bold text-slate-900 truncate hover:text-emerald-600 transition-colors"
                        >
                          {family.head_name}
                        </Link>
                        <span className="text-xs font-black bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md uppercase tracking-tighter">
                          {family.family_code}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                        {family.address}
                      </p>
                      <p className="text-sm text-slate-600">{family.phone}</p>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          setEditingFamily(family);
                        }}
                        className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          deleteFamily(family.id);
                        }}
                        className="p-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden sm:block space-y-3 w-full">
                {filteredFamilies.map((family) => (
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
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                            <circle cx="12" cy="10" r="3"></circle>
                          </svg>
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
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {isPdfOptionsOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
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
              🖨️ Print Report
            </button>
          </div>
        </div>
      )}

      <QrScannerModal
        open={isScannerOpen}
        title={t.scan_qr}
        containerId="reader"
        onClose={() => setIsScannerOpen(false)}
        onDecodedText={handleQrDecodedText}
      />

      {isAllQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Print All QR Codes</h3>
              <button onClick={() => {
                setIsAllQrModalOpen(false);
                setQrPrintMode("all");
                setQrRangeInput("");
                setQrSpecificInput("");
              }} className="p-2 hover:bg-slate-50 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input 
                  type="radio" 
                  checked={qrPrintMode === "all"} 
                  onChange={() => setQrPrintMode("all")}
                />
                All families
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input 
                  type="radio" 
                  checked={qrPrintMode === "range"} 
                  onChange={() => setQrPrintMode("range")}
                />
                Range
              </label>
              <label className="flex items-center gap-2 text-sm font-bold">
                <input 
                  type="radio" 
                  checked={qrPrintMode === "specific"} 
                  onChange={() => setQrPrintMode("specific")}
                />
                Specific numbers
              </label>
            </div>

            <div className="space-y-3 mb-4">
              {qrPrintMode === "range" && (
                <input
                  type="text"
                  value={qrRangeInput}
                  onChange={(e) => setQrRangeInput(e.target.value)}
                  placeholder="12-20"
                  className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                />
              )}
              {qrPrintMode === "specific" && (
                <input
                  type="text"
                  value={qrSpecificInput}
                  onChange={(e) => setQrSpecificInput(e.target.value)}
                  placeholder="1,3,7"
                  className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                />
              )}
            </div>

            <div className="text-center mb-4">
              <p className={`text-sm font-bold ${getSelectedFamilies().length === 0 ? 'text-red-500' : 'text-slate-600'}`}>
                {qrPrintMode === "all" 
                  ? `${filteredFamilies.length} families selected`
                  : `${getSelectedFamilies().length} families selected`
                }
              </p>
              {getSelectedFamilies().length === 0 && (
                <p className="text-xs text-red-500 mt-1">No families selected.</p>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={generateBulkQRPDF}
                className="flex-1 py-3 rounded-2xl bg-emerald-600 text-white font-black disabled:opacity-50"
                disabled={getSelectedFamilies().length === 0}
              >
                Print
              </button>
              <button 
                onClick={() => {
                  setIsAllQrModalOpen(false);
                  setQrPrintMode("all");
                  setQrRangeInput("");
                  setQrSpecificInput("");
                }}
                className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex items-center justify-around py-4 px-6 shadow-2xl z-50">
        <Link href="/dashboard" className="flex flex-col items-center gap-1 group">
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
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom)+6rem)]">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-slate-900">{t.add_new_family}</h2>
              <button
                onClick={() => {
                  resetForm();
                  setIsOpen(false);
                }}
                className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-2">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                        currentStep === step
                          ? 'bg-emerald-500 text-white'
                          : step < currentStep
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {step}
                    </div>
                    {step < 3 && (
                      <div
                        className={`w-8 h-0.5 ${
                          step < currentStep ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
            {/* Step 1: Basic Family Details */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-slate-900">Basic Family Details</h3>
                  <p className="text-xs text-slate-500 mt-1">Enter essential family information</p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.name}</label>
                  <input
                    type="text"
                    value={headName}
                    onChange={(event) => {
                      setHeadName(event.target.value);
                      setStep1Errors(prev => ({ ...prev, headName: undefined }));
                    }}
                    className={`w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold ${step1Errors.headName ? 'border-2 border-red-500' : ''}`}
                    placeholder="Full Name"
                    required
                  />
                  {step1Errors.headName && (
                    <p className="text-red-500 text-xs mt-1">Required</p>
                  )}
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.address}</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(event) => {
                      setAddress(event.target.value);
                      setStep1Errors(prev => ({ ...prev, address: undefined }));
                    }}
                    className={`w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold ${step1Errors.address ? 'border-2 border-red-500' : ''}`}
                    placeholder="Complete Address"
                    required
                  />
                  {step1Errors.address && (
                    <p className="text-red-500 text-xs mt-1">Required</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.phone}</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setStep1Errors(prev => ({ ...prev, phone: undefined }));
                      }}
                      className={`w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold ${step1Errors.phone ? 'border-2 border-red-500' : ''}`}
                      placeholder="Phone Number"
                      required
                    />
                  {step1Errors.phone && (
                    <p className="text-red-500 text-xs mt-1">Required</p>
                  )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.family_code}</label>
                    <input
                      type="text"
                      value={familyCode}
                      onChange={(event) => setFamilyCode(event.target.value)}
                      className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                      placeholder="Family Code"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2 pt-4">
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
                
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setIsOpen(false);
                    }}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const errors: { headName?: string; address?: string; phone?: string } = {};
                      
                      if (!headName.trim()) {
                        errors.headName = "Required";
                      }
                      if (!address.trim()) {
                        errors.address = "Required";
                      }
                      if (!phone.trim()) {
                        errors.phone = "Required";
                      }
                      
                      setStep1Errors(errors);
                      
                      if (Object.keys(errors).length > 0) {
                        return;
                      }
                      
                      setCurrentStep(2);
                    }}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold bg-emerald-500 text-white"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: House & Finance */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-slate-900">House & Finance</h3>
                  <p className="text-xs text-slate-500 mt-1">Housing and financial information</p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">House Type</label>
                  <select
                    value={houseType}
                    onChange={(e) => setHouseType(e.target.value as "own" | "rent" | "")}
                    className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                  >
                    <option value="">Select house type</option>
                    <option value="own">Own</option>
                    <option value="rent">Rent</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="has_toilet"
                    checked={hasToilet}
                    onChange={(e) => setHasToilet(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 rounded-lg"
                  />
                  <label htmlFor="has_toilet" className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                    Has Toilet
                  </label>
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
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.opening_balance}</label>
                    <input
                      type="number"
                      value={openingBalance}
                      onChange={(event) => setOpeningBalance(event.target.value)}
                      className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold bg-emerald-500 text-white"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Extra Details */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-black text-slate-900">Extra Details</h3>
                  <p className="text-xs text-slate-500 mt-1">Additional information (optional)</p>
                </div>
                
                                
                <div className="space-y-3">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Vehicles Owned</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'car', label: 'Car', state: hasCar, setter: setHasCar },
                      { id: 'three_wheeler', label: 'Three Wheeler', state: hasThreeWheeler, setter: setHasThreeWheeler },
                      { id: 'van', label: 'Van', state: hasVan, setter: setHasVan },
                      { id: 'lorry', label: 'Lorry', state: hasLorry, setter: setHasLorry },
                      { id: 'tractor', label: 'Tractor', state: hasTractor, setter: setHasTractor }
                    ].map(({ id, label, state, setter }) => (
                      <div key={id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={id}
                          checked={state}
                          onChange={(e) => setter(e.target.checked)}
                          className="w-4 h-4 accent-emerald-500 rounded"
                        />
                        <label htmlFor={id} className="text-xs text-slate-600">{label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Extra Notes</label>
                  <textarea
                    value={extraNotes}
                    onChange={(e) => setExtraNotes(e.target.value)}
                    className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                    placeholder="Any additional notes"
                    rows={2}
                  />
                </div>
                
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600"
                  >
                    Previous
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-4 rounded-2xl text-sm font-bold bg-emerald-500 text-white disabled:opacity-50"
                  >
                    {loading ? "SAVING..." : t.save}
                  </button>
                </div>
              </div>
            )}
          </form>
          </div>
        </div>
      )}
    </div>
  );
}
