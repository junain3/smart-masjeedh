"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Users, RefreshCw, QrCode, X, ArrowLeft, CreditCard, Edit, Trash2, FileText, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { translations, getTranslation, Language } from "@/lib/i18n/translations";
import { QrScannerModal } from "@/components/QrScannerModal";
import { useMockAuth } from "@/components/MockAuthProvider";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import RouteGuard from "@/components/RouteGuard";
import { parsePermissions, hasModulePermission, isSuperAdmin } from "@/lib/permissions-utils";
import { escapePdfHtml, getPdfMasjidName } from "@/lib/pdf-utils";
import SearchResultsPrintView from "@/components/SearchResultsPrintView";
import { getPrintEngine, getPrintButtonLabel, type PrintReportType } from "@/lib/print-engine";

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
  const [pdfCols, setPdfCols] = useState<{serialTick:boolean; code:boolean; head:boolean; address:boolean; phone:boolean; sub:boolean; signature:boolean}>({serialTick:false, code:true, head:true, address:true, phone:true, sub:true, signature:false});
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
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const printViewRef = useRef<HTMLDivElement>(null);
  const [printMasjidName, setPrintMasjidName] = useState("Masjid");
  
  // Family duplicate prevention state
  const [allMasjidMembers, setAllMasjidMembers] = useState<any[]>([]);
  const [possibleDuplicateFamilies, setPossibleDuplicateFamilies] = useState<Family[]>([]);
  const [showFamilyDuplicateWarning, setShowFamilyDuplicateWarning] = useState(false);
  const [confirmedNoFamilyDuplicate, setConfirmedNoFamilyDuplicate] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState<string>("");
  const [isStrictBlock, setIsStrictBlock] = useState(false);
  
  // Restore deleted family code state
  const [isRestoreMode, setIsRestoreMode] = useState(false);
  const [manualFamilyCode, setManualFamilyCode] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  const t = getTranslation(lang);

  // Helper functions for input formatting
  const formatTitleCase = (str: string): string => {
    return str
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
      );
  };

  const formatPhone = (str: string): string => {
    return str.replace(/\s+/g, '').trim();
  };

  // Helper function for simple fuzzy name matching
  const areFamilyNamesSimilar = (name1: string, name2: string): boolean => {
    const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (n1.includes(n2) || n2.includes(n1)) return true;
    
    let diffs = 0;
    const minLen = Math.min(n1.length, n2.length);
    const maxLen = Math.max(n1.length, n2.length);
    
    if (maxLen - minLen > 3) return false;
    
    for (let i = 0; i < minLen; i++) {
      if (n1[i] !== n2[i]) diffs++;
      if (diffs > 2) return false;
    }
    
    diffs += (maxLen - minLen);
    return diffs <= 2;
  };

  // Check for family duplicates
  const checkForFamilyDuplicates = (): { isDuplicate: boolean; isStrict: boolean; reason: string; matches: Family[] } => {
    console.log("=== checkForFamilyDuplicates START ===");
    
    if (!tenantContext?.masjidId) {
      console.log("- No masjidId, returning no duplicates");
      return { isDuplicate: false, isStrict: false, reason: "", matches: [] };
    }

    const trimmedHeadName = headName?.trim();
    const trimmedAddress = address?.trim();
    const trimmedPhone = phone?.trim();

    console.log("- Input values:");
    console.log("  - headName:", trimmedHeadName);
    console.log("  - address:", trimmedAddress);
    console.log("  - phone:", trimmedPhone);

    const warningDuplicates: Family[] = [];
    let warningReason = "";

    // Warning checks only (Add Family form doesn't have NIC/DOB fields)
    for (const existingFamily of families) {
      if (editingFamily && existingFamily.id === editingFamily.id) continue;

      let isWarningMatch = false;
      let matchReason = "";

      // Same phone
      if (trimmedPhone && existingFamily.phone?.trim() === trimmedPhone) {
        isWarningMatch = true;
        matchReason = "Same phone number";
      }
      // Same address
      else if (trimmedAddress && existingFamily.address?.trim() === trimmedAddress) {
        isWarningMatch = true;
        matchReason = "Same address";
      }
      // Very similar head_name
      else if (trimmedHeadName && existingFamily.head_name && areFamilyNamesSimilar(trimmedHeadName, existingFamily.head_name)) {
        isWarningMatch = true;
        matchReason = "Similar head name";
      }
      // Same phone + similar/same name
      else if (trimmedPhone && existingFamily.phone?.trim() === trimmedPhone && 
               trimmedHeadName && existingFamily.head_name && areFamilyNamesSimilar(trimmedHeadName, existingFamily.head_name)) {
        isWarningMatch = true;
        matchReason = "Same phone and similar name";
      }

      if (isWarningMatch) {
        warningDuplicates.push(existingFamily);
        warningReason = matchReason;
      }
    }

    const hasWarning = warningDuplicates.length > 0;

    console.log("- Results:");
    console.log("  - warningDuplicates:", warningDuplicates.length);

    if (hasWarning) {
      console.log("- Warning duplicate found, reason:", warningReason);
      return {
        isDuplicate: true,
        isStrict: false,
        reason: warningReason,
        matches: warningDuplicates
      };
    }

    console.log("- No duplicates found");
    return { isDuplicate: false, isStrict: false, reason: "", matches: [] };
  };

  const getCacheKey = (masjidId: string) => `families_cache_${masjidId}`;
  const getPaymentsCacheKey = (masjidId: string) => `family_payments_cache_${masjidId}`;
  const getMembersCacheKey = (masjidId: string) => `family_members_cache_${masjidId}`;

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (!tenantContext?.masjidId) return;

    // Load stale data from localStorage first for instant UI load
    const cachedFamilies = localStorage.getItem(getCacheKey(tenantContext.masjidId));
    const cachedPayments = localStorage.getItem(getPaymentsCacheKey(tenantContext.masjidId));
    const cachedMembers = localStorage.getItem(getMembersCacheKey(tenantContext.masjidId));
    
    if (cachedFamilies) {
      const parsedFamilies = JSON.parse(cachedFamilies);
      setFamilies(parsedFamilies);
      setIsLive(true);
    }
    if (cachedPayments) {
      setPaymentCollections(JSON.parse(cachedPayments));
    }
    if (cachedMembers) {
      setAllMasjidMembers(JSON.parse(cachedMembers));
    }

    // Revalidate in background
    fetchFamilies();
  }, [tenantContext?.masjidId, resumeTick]);

  useEffect(() => {
    const fetchPrintMasjidName = async () => {
      if (!tenantContext?.masjidId) return;
      const name = await getPdfMasjidName(supabase, tenantContext.masjidId);
      setPrintMasjidName(name);
    };
    fetchPrintMasjidName();
  }, [tenantContext?.masjidId]);


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
        .select("id, family_code, head_name, phone, address, is_widow_head, subscription_amount, opening_balance, created_at, masjid_id")
        .eq("masjid_id", tenantContext.masjidId)
        .order("family_code", { ascending: true });

      if (error) throw error;

      if (data) {
        const sortedFamilies = (data || []).sort((a, b) => {
          const numA = parseInt((a.family_code || "").replace(/\D/g, "")) || 0;
          const numB = parseInt((b.family_code || "").replace(/\D/g, "")) || 0;
          return numA - numB;
        });

        setFamilies(sortedFamilies);
        setIsLive(true);
        setErrorMessage("");
        
        // Save families to localStorage immediately for instant load next time
        localStorage.setItem(getCacheKey(tenantContext.masjidId), JSON.stringify(sortedFamilies));
        
        // Fetch all masjid members for duplicate detection
        try {
          const { data: membersData, error: membersError } = await supabase
            .from("members")
            .select("*")
            .eq("masjid_id", tenantContext.masjidId);
            
          if (!membersError && membersData) {
            setAllMasjidMembers(membersData);
            localStorage.setItem(getMembersCacheKey(tenantContext.masjidId), JSON.stringify(membersData));
          }
        } catch (membersErr) {
          console.error("Members fetch error:", membersErr);
          // Don't block families loading if members fetch fails
        }
        
        // Fetch payment collections separately (don't block families loading)
        try {
          const { data: paymentData, error: paymentError } = await supabase
            .from("subscription_collections")
            .select("id, family_id, date, status")
            .eq("masjid_id", tenantContext.masjidId);
            
          if (!paymentError && paymentData) {
            setPaymentCollections(paymentData);
            localStorage.setItem(getPaymentsCacheKey(tenantContext.masjidId), JSON.stringify(paymentData));
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

      // Check for family duplicates
      if (!confirmedNoFamilyDuplicate && !editingFamily) {
        const duplicateCheck = checkForFamilyDuplicates();
        
        if (duplicateCheck.isDuplicate) {
          setPossibleDuplicateFamilies(duplicateCheck.matches);
          setDuplicateReason(duplicateCheck.reason);
          
          // Show warning modal
          setShowFamilyDuplicateWarning(true);
          setLoading(false);
          return;
        }
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
        
        // Close form and reset
        setIsOpen(false);
        resetForm();
        fetchFamilies();
      } else {
        let newFamilyId: string;
        let assignedCode: string;
        
        if (isRestoreMode && manualFamilyCode.trim()) {
          // Check if code already exists first
          const { data: existingFamily, error: checkError } = await supabase
            .from("families")
            .select("id")
            .eq("masjid_id", tenantContext.masjidId)
            .eq("family_code", manualFamilyCode.trim())
            .maybeSingle();
          
          if (checkError) throw checkError;
          
          if (existingFamily) {
            throw new Error("This family code already exists. Please use a different code.");
          }
          
          // Insert family directly with manual code
          const { data: insertData, error: insertError } = await supabase
            .from("families")
            .insert([{
              family_code: manualFamilyCode.trim(),
              head_name: headName,
              address,
              phone,
              subscription_amount: parseFloat(subscriptionAmount) || 0,
              opening_balance: parseFloat(openingBalance) || 0,
              is_widow_head: isWidowHead,
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
              extra_notes: extraNotes || null,
              user_id: authUserId,
              masjid_id: tenantContext.masjidId
            }])
            .select();
          
          if (insertError) throw insertError;
          
          if (!insertData || insertData.length === 0) {
            throw new Error("Failed to create family.");
          }
          
          newFamilyId = insertData[0].id;
          assignedCode = manualFamilyCode.trim();
          
          // Create family head member manually for restore mode
          const { error: memberInsertError } = await supabase.from("members").insert([{
            family_id: newFamilyId,
            name: headName,
            full_name: headName,
            relationship: "Family Head",
            civil_status: "",
            user_id: authUserId,
            masjid_id: tenantContext.masjidId
          }]);
          
          if (memberInsertError) {
            // Don't fail the whole thing if member creation fails
          }
        } else {
          // Normal mode: use RPC function for automatic family_code generation
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

          if (error) throw error;

          if (!data || data.length === 0) {
            throw new Error("Failed to create family.");
          }
          
          newFamilyId = data[0].id;
          assignedCode = data[0].family_code;
        }

        setSuccessMessage(`குடும்பம் வெற்றிகரமாகச் சேமிக்கப்பட்டது. குறியீடு: ${assignedCode}`);
        
        // Close form and reset first
        setIsOpen(false);
        resetForm();
        
        // Refresh the families list
        await fetchFamilies();
        
        // Then redirect
        await router.push(`/families/${newFamilyId}`);
      }
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
    
    // Reset duplicate prevention state
    setPossibleDuplicateFamilies([]);
    setShowFamilyDuplicateWarning(false);
    setConfirmedNoFamilyDuplicate(false);
    setDuplicateReason("");
    setIsStrictBlock(false);
    
    // Reset restore mode state
    setIsRestoreMode(false);
    setManualFamilyCode("");
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
    const QRCode = (await import("qrcode")).default;
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

      const { default: jsPDF } = await import("jspdf");
      
      // Create new PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const masjidName = await getPdfMasjidName(supabase, tenantContext?.masjidId);
      
      // 3 columns × 4 rows = 12 cards per A4 portrait page
      const horizontalMargin = 5;
      const verticalMargin = 5;
      const cardSpacing = 2;
      const rowSpacing = 2;
      const cardsPerRow = 3;
      const rowsPerPage = 4;
      const usableWidth = pageWidth - horizontalMargin * 2;
      const usableHeight = pageHeight - verticalMargin * 2;
      const cardWidth = (usableWidth - cardSpacing * (cardsPerRow - 1)) / cardsPerRow;
      const cardHeight = (usableHeight - rowSpacing * (rowsPerPage - 1)) / rowsPerPage;
      const cardsPerPage = cardsPerRow * rowsPerPage;

      const drawDashedCutBorder = (x: number, y: number, w: number, h: number) => {
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.3);
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
          const borderPad = 1.5;
          const gapQrToText = 2;
          const codeFontSize = 10;
          const nameFontSize = 7.5;
          const nameMaxWidth = cardWidth - borderPad * 2 - 2;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(nameFontSize);
          const nameLines = doc.splitTextToSize(family.head_name, nameMaxWidth).slice(0, 2);
          const labelHeight = gapQrToText + codeFontSize * 0.4 + nameLines.length * (nameFontSize * 0.45) + 1.5;

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
          const codeY = qrY + qrSize + gapQrToText + codeFontSize * 0.35;
          const centerX = borderX + contentWidth / 2;

          const qrPixelSize = Math.min(512, Math.max(280, Math.round(qrSize * 11)));
          const qrDataURL = await generateQRDataURL(qrValue, qrPixelSize);

          doc.setFillColor(255, 255, 255);
          doc.rect(borderX, borderY, contentWidth, contentHeight, "F");
          drawDashedCutBorder(borderX, borderY, contentWidth, contentHeight);
          doc.addImage(qrDataURL, "PNG", qrX, qrY, qrSize, qrSize);

          doc.setTextColor(0, 0, 0);
          
          // Masjid name (smaller, but readable)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6);
          const masjidLines = doc.splitTextToSize(masjidName, nameMaxWidth).slice(0, 1);
          doc.text(masjidLines, centerX, codeY - 3.5, { align: "center" });
          
          // Family code (M number - bold and clear)
          doc.setFontSize(codeFontSize);
          doc.setFont("helvetica", "bold");
          doc.text(family.family_code, centerX, codeY, { align: "center" });
          
          // Family head name (clear, bold)
          doc.setFontSize(nameFontSize);
          doc.setFont("helvetica", "bold");
          nameLines.forEach((line: string, lineIndex: number) => {
            doc.text(line, centerX, codeY + 3.5 + lineIndex * (nameFontSize * 0.45), { align: "center" });
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
      if (typeof window === "undefined") {
        alert("PDF generation not available in server-side rendering");
        return;
      }

      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      
      const masjidName = await getPdfMasjidName(supabase, tenantContext?.masjidId);

      // Tamil to English translation mapping
      const tamilToEnglishMap: Record<string, string> = {
        "உலருணவு விநியோகம்": "Dry Ration Distribution",
        "உலருணவு": "Dry Ration Distribution",
        "உழ்ஹிய்யா": "Udhkiya Distribution",
        "உள்ஹிய்யா": "Udhkiya Distribution",
        "பெருநாள் உதவி": "Eid Festival Relief"
      };

      // Header section - all center-aligned
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(6, 78, 59); // Dark green for masjid name
      doc.text(masjidName, pageWidth / 2, 14, { align: "center" });
      
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42); // Dark slate for subtitle
      doc.text("Masjid Families List", pageWidth / 2, 21, { align: "center" });
      
      // Prepare headers
      const headers: string[] = [];
      if (pdfCols.serialTick) headers.push("S.No");
      if (pdfCols.code) headers.push("Family Code");
      if (pdfCols.head) headers.push("Head Name");
      if (pdfCols.address) headers.push("Address");
      if (pdfCols.phone) headers.push("Phone");
      if (pdfCols.signature) headers.push("Signature");

      // Prepare table data
      const tableBody = filteredFamilies.map((f, index) => {
        const row: (string|number|{content: string, styles: any})[] = [];
        if (pdfCols.serialTick) row.push(index + 1);
        if (pdfCols.code) row.push({ content: f.family_code, styles: { fontStyle: "bold" } });
        if (pdfCols.head) row.push({ content: f.head_name, styles: { fontStyle: "bold" } });
        if (pdfCols.address) row.push(f.address);
        if (pdfCols.phone) row.push(f.phone);
        if (pdfCols.signature) row.push("");
        return row;
      });

      autoTable(doc, {
        startY: 30,
        head: [headers],
        body: tableBody,
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        headStyles: {
          fillColor: [6, 78, 59],
          textColor: 255,
          fontStyle: 'bold'
        },
        theme: 'grid'
      });

      doc.save('masjid-families-list.pdf');
      
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('PDF generation failed: ' + (error as Error).message);
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
    // Search filter with smart Sri Lankan phone number handling and pure number → only address matching
    const cleanQuery = searchQuery.trim().toLowerCase();
    const isPureNumber = /^\d+$/.test(cleanQuery);
    const isPhonePattern = isPureNumber && cleanQuery.startsWith('07') && cleanQuery.length >= 4;

    // 1. Head Name Match (Always partial match)
    const matchesName = f.head_name?.toLowerCase().includes(cleanQuery);

    // 2. Family Code Match (ONLY match if it's NOT a pure number, meaning user typed 'M' or letters)
    const matchesFamilyCode = !isPureNumber
      ? f.family_code?.toLowerCase().includes(cleanQuery)
      : false;

    // 3. Address Match (If pure number, use strict word boundaries so "10" matches "10/1", "10-A" but NOT "109")
    let matchesAddress = false;
    if (f.address) {
      const addressLower = f.address.toLowerCase();
      if (isPureNumber) {
        const boundaryRegex = new RegExp(`\\b${cleanQuery}\\b`);
        matchesAddress = boundaryRegex.test(addressLower);
      } else {
        matchesAddress = addressLower.includes(cleanQuery);
      }
    }

    const matchesSearch =
      matchesName ||
      matchesFamilyCode ||
      matchesAddress ||
      (isPhonePattern ? f.phone?.toLowerCase().includes(cleanQuery) : false);
    
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

  // ADDITIVE ONLY: Print handler for search results
  const handlePrintSearchResults = () => {
    const reportType: PrintReportType = "filtered-search-results";
    const engine = getPrintEngine(reportType);
    if (engine === "browser-print") {
      window.print();
    }
  };

  // ADDITIVE ONLY: Download PDF handler for search results
  const handleDownloadSearchResultsPdf = async () => {
    if (!printViewRef.current) return;
    const element = printViewRef.current;
    const { default: html2pdf } = await import("html2pdf.js");
    const opt = {
      margin: 10,
      filename: "masjid-search-results.pdf",
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    html2pdf().from(element).set(opt).save();
  };

  if (authLoading) return <div>Loading...</div>;
  if (!user) return null;
  if (!hasFamiliesAccess && !userIsSuperAdmin && !isSuperAdminByRole) {
    return <div>No access to Families module</div>;
  }

  return (
    <>
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-24 font-sans print:hidden">
            {/* App Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 py-4 border-b border-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-emerald-600 shrink-0">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black leading-none truncate">{t.families}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">{isLive ? t.live_data : t.demo_mode}</p>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider shrink-0">{t.year}</label>
                <select value={year} onChange={e=>setYear(parseInt(e.target.value))} className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 shrink-0">
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
          
          {/* More Menu Button */}
          <div className="relative shrink-0">
            <button 
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 active:scale-95 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
              </svg>
              <span className="text-xs font-bold ml-1 hidden sm:inline">More</span>
            </button>
            
            {/* More Menu Dropdown */}
            {isMoreMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-0" 
                  onClick={() => setIsMoreMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 overflow-hidden">
                  <button 
                    onClick={() => {
                      setIsPdfOptionsOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <Download className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-bold text-slate-700">PDF</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsScannerOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <QrCode className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-bold text-slate-700">QR</span>
                  </button>
                  <button 
                    onClick={() => {
                      setIsAllQrModalOpen(true);
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors"
                  >
                    <QrCode className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-bold text-slate-700">All QR</span>
                  </button>
                  <button 
                    onClick={() => {
                      fetchFamilies();
                      setIsMoreMenuOpen(false);
                    }}
                    disabled={isFetching}
                    className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 text-emerald-600 ${isFetching ? 'animate-spin' : ''}`} />
                    <span className="text-sm font-bold text-slate-700">Refresh</span>
                  </button>
                </div>
              </>
            )}
          </div>
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

        {searchQuery && (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm font-medium text-emerald-700 px-1">
              {filteredFamilies.length} குடும்பங்கள் கண்டறியப்பட்டன (Families found)
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handlePrintSearchResults}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                {getPrintButtonLabel("filtered-search-results", "Search Results")}
              </button>
              <button 
                onClick={handleDownloadSearchResultsPdf}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors"
              >
                Download PDF
              </button>
            </div>
          </div>
        )}

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
            <div className="grid grid-cols-1 gap-3 mb-4">
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.serialTick} onChange={e=>setPdfCols(s=>({...s,serialTick:e.target.checked}))}/> Serial Number Tick Box</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.code} onChange={e=>setPdfCols(s=>({...s,code:e.target.checked}))}/> Family Code</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.head} onChange={e=>setPdfCols(s=>({...s,head:e.target.checked}))}/> Head Name</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.address} onChange={e=>setPdfCols(s=>({...s,address:e.target.checked}))}/> Address</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.phone} onChange={e=>setPdfCols(s=>({...s,phone:e.target.checked}))}/> Phone</label>
              <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={pdfCols.signature} onChange={e=>setPdfCols(s=>({...s,signature:e.target.checked}))}/> Signature Column</label>
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
                    onBlur={(event) => {
                      if (event.target.value) {
                        setHeadName(formatTitleCase(event.target.value));
                      }
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
                    onBlur={(event) => {
                      if (event.target.value) {
                        setAddress(formatTitleCase(event.target.value));
                      }
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
                      onBlur={(event) => {
                        setPhone(formatPhone(event.target.value));
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
                    {isRestoreMode ? (
                      <input
                        type="text"
                        value={manualFamilyCode}
                        onChange={(event) => {
                          console.log("=== Manual family code changed ===");
                          console.log("- New value:", event.target.value);
                          setManualFamilyCode(event.target.value);
                        }}
                        className="w-full rounded-2xl bg-amber-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all font-bold"
                        placeholder="Enter deleted family code (e.g., M4)"
                        required
                      />
                    ) : (
                      <input
                        type="text"
                        value={familyCode}
                        onChange={(event) => setFamilyCode(event.target.value)}
                        className="w-full rounded-2xl bg-slate-50 border-none px-5 py-4 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold"
                        placeholder="Family Code"
                        required
                      />
                    )}
                  </div>
                </div>
                
                {/* Admin-only restore option */}
                {(userIsSuperAdmin || isSuperAdminByRole) && !editingFamily && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="restore_mode"
                        checked={isRestoreMode}
                        onChange={(e) => {
                          console.log("=== Restore mode checkbox changed ===");
                          console.log("- New state:", e.target.checked);
                          setIsRestoreMode(e.target.checked);
                        }}
                        className="w-5 h-5 accent-amber-500 rounded-lg"
                      />
                      <label htmlFor="restore_mode" className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                        Restore deleted family code
                      </label>
                    </div>
                    {isRestoreMode && (
                      <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-amber-900">
                          Use this only for restoring accidentally deleted families.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Debug info (hidden, but logs) */}
                {(() => {
                  console.log("=== Restore UI Render Debug ===");
                  console.log("- userIsSuperAdmin:", userIsSuperAdmin);
                  console.log("- isSuperAdminByRole:", isSuperAdminByRole);
                  console.log("- editingFamily:", !!editingFamily);
                  console.log("- isRestoreMode:", isRestoreMode);
                  console.log("- manualFamilyCode:", manualFamilyCode);
                  return null;
                })()}
                
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

      {/* Family Duplicate Warning Modal */}
      {showFamilyDuplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <h2 className="text-2xl font-bold mb-4 text-center text-slate-900">Possible duplicate family found</h2>
            <p className="text-sm text-slate-600 mb-6 text-center">
              {duplicateReason ? `${duplicateReason}.` : "We found a family that might be a duplicate."} Please review:
            </p>
            
            <div className="space-y-3 mb-6">
              {possibleDuplicateFamilies.map((duplicate) => (
                <div key={duplicate.id} className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                  <h3 className="font-bold text-slate-900">{duplicate.head_name}</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {duplicate.family_code}
                    {duplicate.address && ` • ${duplicate.address}`}
                    {duplicate.phone && ` • ${duplicate.phone}`}
                  </p>
                </div>
              ))}
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => {
                  console.log("- Family duplicate warning: Cancel clicked");
                  setShowFamilyDuplicateWarning(false);
                  setConfirmedNoFamilyDuplicate(false);
                }}
                className="flex-1 py-4 rounded-2xl text-sm font-bold bg-slate-100 text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log("- Family duplicate warning: Continue Anyway clicked");
                  setConfirmedNoFamilyDuplicate(true);
                  setShowFamilyDuplicateWarning(false);
                  console.log("- Calling handleSubmit again");
                  handleSubmit({ preventDefault: () => {} } as React.FormEvent);
                }}
                className="flex-1 py-4 rounded-2xl text-sm font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

    {/* Hidden Print View for html2pdf capturing */}
    {searchQuery && filteredFamilies.length > 0 && (
      <div className="hidden">
        <SearchResultsPrintView
          ref={printViewRef}
          title="Families Search Results"
          results={filteredFamilies}
          columns={[
            { key: "family_code", label: "Family Code" },
            { key: "head_name", label: "Head Name" },
            { key: "address", label: "Address" },
            { key: "phone", label: "Phone" }
          ]}
          masjidName={printMasjidName}
        />
      </div>
    )}

    {/* Print View for Browser Print (window.print) */}
    {searchQuery && filteredFamilies.length > 0 && (
      <div className="hidden print:block">
        <SearchResultsPrintView
          title="Families Search Results"
          results={filteredFamilies}
          columns={[
            { key: "family_code", label: "Family Code" },
            { key: "head_name", label: "Head Name" },
            { key: "address", label: "Address" },
            { key: "phone", label: "Phone" }
          ]}
          masjidName={printMasjidName}
        />
      </div>
    )}
    </>
  );
}