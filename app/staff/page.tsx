"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Edit2, Trash2, X, Users, DollarSign, Calendar, Mail, Phone, Briefcase, Shield, Home as HomeIcon, CreditCard, Menu, LogOut, Settings, HelpCircle, Check, AlertCircle, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTranslation, translations, Language } from "@/lib/i18n/translations";
import { getTenantContext } from "@/lib/tenant";
import { useAppToast } from "@/components/ToastProvider";
import { useMockAuth } from "@/components/MockAuthProvider";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import StaffProfile from "@/components/StaffProfile";
import { parsePermissions, hasModulePermission, isSuperAdmin } from "@/lib/permissions-utils";

export const dynamic = 'force-dynamic';

type Permissions = {
  accounts: boolean;
  members: boolean;
  subscriptions_collect: boolean;
  subscriptions_approve: boolean;
  staff_management: boolean;
  reports: boolean;
  settings: boolean;
  events: boolean;
};

export type Staff = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "super_admin" | "co_admin" | "staff" | "editor";
  basic_salary: number;
  salary_amount?: number;
  status: "active" | "inactive";
  created_at: string;
  masjid_id: string;
  user_id: string;
  permissions?: Permissions;
  commission_rate?: number;
  enable_collection?: boolean;
};

export default function StaffPage() {
  const router = useRouter();
  const { toast, confirm } = useAppToast();
  const { user, loading: authLoading, tenantContext, signOut } = useSupabaseAuth();

  // Page-level access control
  if (authLoading) return <div>Loading...</div>;
  if (!user) {
    router.push('/login');
    return null;
  }
  
  // Parse permissions and check access
  const parsedPermissions = parsePermissions(tenantContext?.permissions || null);
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);
  const hasStaffAccess = hasModulePermission(parsedPermissions, 'staff_management');
  
  if (!hasStaffAccess && !userIsSuperAdmin) {
    return <div>No access</div>;
  }
  
  const [lang, setLang] = useState<Language>("en");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'administrators' | 'employees'>('employees');

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"super_admin" | "co_admin" | "staff" | "editor">("staff");
  const [basicSalary, setBasicSalary] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [submitting, setSubmitting] = useState(false);

  const [staffBalances, setStaffBalances] = useState<{[key: string]: number}>({});

  // Staff Profile View states (simplified)
  const [showProfileView, setShowProfileView] = useState(false);
  const [selectedStaffProfile, setSelectedStaffProfile] = useState<Staff | null>(null);

  // User Access Management states
  const [userRoles, setUserRoles] = useState<any[]>([]);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [editingUserRole, setEditingUserRole] = useState<any>(null);
  const [editingRole, setEditingRole] = useState('staff');
  const [permissions, setPermissions] = useState({
    accounts: false,
    members: false,
    subscriptions_collect: false,
    subscriptions_approve: false,
    staff_management: false,
    reports: false,
    settings: false,
    events: false
  });

  // Invite User states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('staff');
  const [inviteCommissionPercent, setInviteCommissionPercent] = useState('10');
  const [invitePermissions, setInvitePermissions] = useState<Permissions>({
    accounts: false,
    members: false,
    subscriptions_collect: false,
    subscriptions_approve: false,
    staff_management: false,
    reports: false,
    settings: false,
    events: false
  });
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteError, setInviteError] = useState('');

  const t = getTranslation(lang);

  const canManageAccess = tenantContext?.role === "super_admin" || tenantContext?.role === "co_admin";

  useEffect(() => {
    const savedLang = localStorage.getItem("app_lang") as Language;
    if (savedLang) setLang(savedLang);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchStaff();
    fetchUserRoles();
  }, [user]);

  useEffect(() => {
    if (tenantContext?.masjidId) {
      fetchUserRoles();
    }
  }, [tenantContext?.masjidId]);

  async function fetchUserRoles() {
    if (!supabase || !tenantContext?.masjidId) return;
    
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, email, role, permissions, user_id")
        .eq("masjid_id", tenantContext.masjidId);

      if (error) throw error;
      setUserRoles(data || []);
    } catch (err: any) {
      console.error("Fetch user roles error:", err);
      toast({ kind: "error", title: "Error", message: "Failed to fetch user roles" });
    }
  }

  async function fetchStaff() {
    if (!supabase) return;
    setLoading(true);
    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) {
        router.push("/login");
        return;
      }

      // Auto-add current user as Super Admin if no staff exists
      const mockStaff: Staff[] = staff.length === 0 ? [
        {
          id: ctx.userId || "current_user",
          name: user?.name || user?.email || "Super Admin",
          email: user?.email || "admin@mjm.com",
          phone: user?.phone || "+919876543210",
          role: "super_admin",
          basic_salary: 0,
          status: "active",
          created_at: new Date().toISOString(),
          masjid_id: ctx.masjidId,
          user_id: ctx.userId,
          permissions: {
            accounts: true,
            members: true,
            subscriptions_collect: true,
            subscriptions_approve: true,
            staff_management: true,
            reports: true,
            settings: true,
            events: true
          },
          commission_rate: 0,
          enable_collection: false
        }
      ] : [];
      
      setStaff(mockStaff);
      
      // Fetch staff balances after staff data is loaded
      fetchStaffBalances();
    } catch (err: any) {
      console.error("Fetch error:", err);
      toast({ kind: "error", title: "Error", message: err.message || "Failed to fetch staff" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSubmitting(true);

    try {
      const ctx = tenantContext || await getTenantContext();
      if (!ctx) return;

      if (editingStaff) {
        // Update staff (mock - replace with real DB update)
        setStaff(prev => prev.map(s => 
          s.id === editingStaff.id 
            ? { 
                ...s, 
                name, 
                email, 
                phone, 
                role, 
                basic_salary: parseFloat(basicSalary), 
                status 
              }
            : s
        ));
      } else {
        // Create new staff (mock - replace with real DB insert)
        const newStaff: Staff = {
          id: Date.now().toString(),
          name,
          email,
          phone,
          role,
          basic_salary: parseFloat(basicSalary),
          status,
          created_at: new Date().toISOString(),
          masjid_id: ctx.masjidId,
          user_id: ctx.userId,
          permissions,
          commission_rate: 10, // Default commission rate
          enable_collection: permissions?.subscriptions_collect || false
        };
        setStaff(prev => [...prev, newStaff]);
      }

      setIsModalOpen(false);
      resetForm();
      toast({ kind: "success", title: "Success", message: `Staff ${editingStaff ? "updated" : "added"} successfully` });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to save staff" });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStaff(id: string) {
    const ok = await confirm({
      title: "Delete Staff",
      message: "Are you sure you want to delete this staff member?",
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      // Mock delete
      setStaff(prev => prev.filter(s => s.id !== id));
      toast({ kind: "success", title: "Success", message: "Staff deleted successfully" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to delete staff" });
    }
  }

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setRole("staff");
    setBasicSalary("");
    setStatus("active");
    setEditingStaff(null);
    setPermissions({
      accounts: false,
      members: false,
      subscriptions_collect: false,
      subscriptions_approve: false,
      staff_management: false,
      reports: false,
      settings: false,
      events: false
    });
  };

  // User Access Management functions
  const openPermissionsModal = (userRole: any) => {
    setEditingUserRole(userRole);
    setEditingRole(userRole.role || 'staff');
    setPermissions(userRole.permissions || {
      accounts: false,
      members: false,
      subscriptions_collect: false,
      subscriptions_approve: false,
      staff_management: false,
      reports: false,
      settings: false,
      events: false
    });
    setIsPermissionsModalOpen(true);
  };

  const handleRoleChange = (newRole: string) => {
    setEditingRole(newRole);
    
    // Auto-set permissions based on role
    if (newRole === 'super_admin') {
      setPermissions({
        accounts: true,
        members: true,
        subscriptions_collect: true,
        subscriptions_approve: true,
        staff_management: true,
        reports: true,
        settings: true,
        events: true
      });
    } else if (newRole === 'co_admin') {
      setPermissions({
        accounts: true,
        members: true,
        subscriptions_collect: true,
        subscriptions_approve: true,
        staff_management: false,
        reports: true,
        settings: true,
        events: true
      });
    } else {
      // For staff and editor, keep current permissions or set defaults
      setPermissions(prev => ({
        accounts: false,
        members: false,
        subscriptions_collect: newRole === 'staff',
        subscriptions_approve: false,
        staff_management: false,
        reports: false,
        settings: false,
        events: false,
        ...prev // Keep any manually set permissions
      }));
    }
  };

  const handleActivateStaff = async (staffId: string) => {
    if (!supabase) return;
    
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ status: 'active' })
        .eq("user_id", staffId)
        .eq("masjid_id", tenantContext?.masjidId);

      if (error) throw error;

      // Update local state
      setUserRoles(prev => prev.map(ur => 
        ur.user_id === staffId 
          ? { ...ur, status: 'active' }
          : ur
      ));

      toast({ kind: "success", title: "Success", message: "Staff member activated successfully" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to activate staff member" });
    }
  };

  const handleDeactivateStaff = async (staffId: string) => {
    if (!supabase) return;
    
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ status: 'inactive' })
        .eq("user_id", staffId)
        .eq("masjid_id", tenantContext?.masjidId);

      if (error) throw error;

      // Update local state
      setUserRoles(prev => prev.map(ur => 
        ur.user_id === staffId 
          ? { ...ur, status: 'inactive' }
          : ur
      ));

      toast({ kind: "success", title: "Success", message: "Staff member deactivated successfully" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to deactivate staff member" });
    }
  };


  const handlePermissionChange = (permission: string, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: value
    }));
  };

  const savePermissions = async () => {
    if (!editingUserRole || !supabase) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ 
          permissions,
          role: editingRole
        })
        .eq("user_id", editingUserRole.user_id)
        .eq("masjid_id", tenantContext?.masjidId);

      if (error) throw error;

      // Update local state
      setUserRoles(prev => prev.map(ur => 
        ur.user_id === editingUserRole.user_id 
          ? { ...ur, permissions, role: editingRole }
          : ur
      ));

      setIsPermissionsModalOpen(false);
      setEditingUserRole(null);
      toast({ kind: "success", title: "Success", message: "Permissions and role updated successfully" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to update permissions" });
    }
  };

  const fetchStaffBalances = async () => {
    if (!tenantContext?.masjidId || !staff.length) return;

    try {
      const balances: {[key: string]: number} = {};
      
      for (const staffMember of staff) {
        if (staffMember.user_id) {
          // Fetch earned from accepted collections
          const { data: collections } = await supabase
            .from('subscription_collections')
            .select('commission_amount')
            .eq('collected_by_user_id', staffMember.user_id)
            .eq('masjid_id', tenantContext.masjidId)
            .eq('status', 'accepted');

          // Fetch paid from commission payments
          const { data: payments } = await supabase
            .from('collector_commission_payments')
            .select('amount')
            .eq('collector_user_id', staffMember.user_id)
            .eq('masjid_id', tenantContext.masjidId);

          const earned = collections?.reduce((sum, item) => sum + (item.commission_amount || 0), 0) || 0;
          const paid = payments?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
          
          balances[staffMember.user_id] = earned - paid;
        }
      }
      
      setStaffBalances(balances);
    } catch (err) {
      console.error('Failed to fetch staff balances:', err);
    }
  };

  const openStaffProfile = (staffMember: Staff) => {
    console.log("DEBUG: Opening staff profile for:", staffMember.name);
    setSelectedStaffProfile(staffMember);
    setShowProfileView(true);
    console.log("DEBUG: showProfileView set to true");
  };

  const closeStaffProfile = () => {
    setShowProfileView(false);
    setSelectedStaffProfile(null);
  };

  const handleProfileSave = (updatedStaff: Staff) => {
    // Update staff member safely
    const updatedStaffList = staff.map(s => 
      s.id === updatedStaff.id ? updatedStaff : s
    );
    setStaff(updatedStaffList);
    
    toast({ 
      kind: "success", 
      title: "Success", 
      message: "Staff profile updated successfully" 
    });
    
    closeStaffProfile();
  };

  const hasEligibleReplacement = async (currentUserId: string, masjidId: string) => {
    try {
      const { data: otherAdmins } = await supabase
        .from('user_roles')
        .select('*')
        .eq('masjid_id', masjidId)
        .neq('user_id', currentUserId)
        .in('role', ['super_admin', 'co_admin']);

      const eligibleReplacement = otherAdmins?.find(admin => {
        const parsedPermissions = parsePermissions(admin.permissions);
        return isSuperAdmin(parsedPermissions);
      });

      return !!eligibleReplacement;
    } catch (error) {
      console.error('Error checking eligible replacement:', error);
      return false;
    }
  };

  const [replacementCheck, setReplacementCheck] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const checkReplacementForCurrentAdmin = async () => {
      if (tenantContext?.userId && tenantContext?.masjidId) {
        const hasReplacement = await hasEligibleReplacement(tenantContext.userId, tenantContext.masjidId);
        setReplacementCheck({ [tenantContext.userId]: hasReplacement });
      }
    };

    checkReplacementForCurrentAdmin();
  }, [tenantContext?.userId, tenantContext?.masjidId]);

  const safeSelfRemoval = async (currentUserId: string, masjidId: string) => {
    // STEP 1: Fetch all other admin-level users for the same masjid
    const { data: otherAdmins, error: fetchError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('masjid_id', masjidId)
      .neq('user_id', currentUserId)
      .in('role', ['super_admin', 'co_admin']);

    if (fetchError) throw fetchError;

    // STEP 2: Find eligible replacement with FULL access only
    const eligibleReplacement = otherAdmins?.find(admin => {
      const parsedPermissions = parsePermissions(admin.permissions);
      return isSuperAdmin(parsedPermissions);
    });

    // STEP 3: Validate replacement exists (NO fallback)
    if (!eligibleReplacement) {
      throw new Error('Cannot remove yourself: No other admin with full app access exists');
    }

    // STEP 4: Promote replacement to super_admin FIRST
    const { error: promoteError } = await supabase
      .from('user_roles')
      .update({ 
        role: 'super_admin',
        permissions: {
          families: true,
          staff_management: true,
          subscriptions_collect: true,
          subscriptions_approve: true,
          accounts: true,
          reports: true,
          settings: true,
          events: true
        }
      })
      .eq('id', eligibleReplacement.id);

    if (promoteError) throw promoteError;

    // STEP 5: Remove current super admin
    const { error: removeError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', currentUserId)
      .eq('masjid_id', masjidId);

    if (removeError) throw removeError;

    return { success: true, promotedAdmin: eligibleReplacement };
  };

  const handleDeleteStaff = async (staffMember: Staff) => {
    // CRITICAL: Only current Super Admin can manage other Super Admins
    const currentUserIsSuperAdmin = tenantContext?.role === 'super_admin' || user?.role === 'super_admin';
    const isTargetSuperAdmin = staffMember.role === 'super_admin';
    const isCurrentUser = staffMember.user_id === user?.id || staffMember.user_id === tenantContext?.userId;

    // RULES:
    // 1. Cannot delete yourself (UNLESS another full-access admin exists)
    // 2. Only Super Admin can delete others
    // 3. Super Admin cannot delete other Super Admins
    if (isCurrentUser) {
      try {
        await safeSelfRemoval(staffMember.user_id, tenantContext?.masjidId);
        
        toast({ 
          kind: "success", 
          title: "SUCCESS", 
          message: "You have been removed and replacement admin promoted!" 
        });
        
        // Redirect to login
        router.push('/login');
        return;
      } catch (error) {
        toast({ 
          kind: "error", 
          title: "CANNOT REMOVE", 
          message: error.message || "Cannot remove yourself when no other admin with full app access exists!" 
        });
        return;
      }
    }

    if (!currentUserIsSuperAdmin) {
      toast({ 
        kind: "error", 
        title: "ACCESS DENIED", 
        message: "Only Super Admin can delete staff members!" 
      });
      return;
    }

    if (isTargetSuperAdmin) {
      toast({ 
        kind: "error", 
        title: "ACCESS DENIED", 
        message: "Super Admin accounts cannot be deleted!" 
      });
      return;
    }

    // Additional safety check
    if (staffMember.name.toLowerCase().includes('admin') || staffMember.email.includes('admin')) {
      toast({ 
        kind: "error", 
        title: "ACCESS DENIED", 
        message: "Admin accounts cannot be deleted!" 
      });
      return;
    }

    const ok = await confirm({
      title: "Delete Staff Member",
      message: `Are you sure you want to delete ${staffMember.name}? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });

    if (!ok) return;

    try {
      // Remove from staff list
      const updatedStaff = staff.filter(s => s.id !== staffMember.id);
      setStaff(updatedStaff);
      
      // Remove from balances
      const newBalances = { ...staffBalances };
      delete newBalances[staffMember.user_id || ''];
      setStaffBalances(newBalances);
      
      toast({ 
        kind: "success", 
        title: "Success", 
        message: `${staffMember.name} has been deleted successfully` 
      });
    } catch (err: any) {
      toast({ 
        kind: "error", 
        title: "Error", 
        message: err.message || "Failed to delete staff member" 
      });
    }
  };

  const removeUserAccess = async (userRole: any) => {
    const ok = await confirm({
      title: "Remove Access",
      message: `Are you sure you want to remove access for ${userRole.email}?`,
      confirmText: "Remove",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userRole.user_id)
        .eq("masjid_id", tenantContext?.masjidId);

      if (error) throw error;

      setUserRoles(prev => prev.filter(ur => ur.user_id !== userRole.user_id));
      toast({ kind: "success", title: "Success", message: "Access removed successfully" });
    } catch (err: any) {
      toast({ kind: "error", title: "Error", message: err.message || "Failed to remove access" });
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setInviteSubmitting(true);
  setInviteError('');
  setInviteMessage('');

  if (!tenantContext?.masjidId) {
    setInviteError("Masjid not loaded yet");
    setInviteSubmitting(false);
    return;
  }

  try {
    const response = await fetch('/admin/api/invite-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
        permissions: invitePermissions,
        commission_percent: parseFloat(inviteCommissionPercent),
        masjid_id: tenantContext?.masjidId
      }),
    });

    const data = await response.json();

    if (data.success) {
      // Handle the new token-based invitation system
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const inviteLink = data.invite_link || '';
      const invitationToken = data.invitationToken || '';
      const fullRegistrationLink = data.registrationLink || `${baseUrl}${inviteLink}`;
      const emailSent = data.emailSent || false;
      const warning = data.warning || null;
      const debugInfo = data.debugInfo || {};
      
      console.log('DEBUG: Invitation Response:', {
        inviteLink,
        invitationToken,
        emailSent,
        warning,
        debugInfo
      });
      
      if (emailSent) {
        setInviteMessage(`
          ✅ Invitation email sent successfully to ${inviteEmail}!<br/>
          📧 The user should receive the email shortly with the registration link.<br/>
          🔗 Registration Link: <a href="${fullRegistrationLink}" target="_blank" style="color: #059669; text-decoration: underline;">Click here to register</a><br/>
          💡 If they don't receive the email, they can use this link: <code style="background: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-size: 12px;">${fullRegistrationLink}</code><br/>
          📋 Invitation Token: ${invitationToken}<br/>
          📋 Resend Response: ${JSON.stringify(debugInfo.resendResponse || {})}
        `);
      } else {
        setInviteMessage(`
          ⚠️ ${warning || 'Email service not configured'}<br/>
          📧 Invitation created for ${inviteEmail}!<br/>
          � Registration Link: <a href="${fullRegistrationLink}" target="_blank" style="color: #059669; text-decoration: underline;">Click here to register</a><br/>
          💡 Copy this link: <code style="background: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-size: 12px;">${fullRegistrationLink}</code><br/>
          🎫 Invitation Token: ${invitationToken}<br/>
          🔍 Debug Info: <br/>
          • API Key exists: ${debugInfo.envHasKey ? '✅' : '❌'}<br/>
          • API Key length: ${debugInfo.envKeyLength || 0}<br/>
          • Invite Link: ${inviteLink}<br/>
          📋 To enable email sending: <br/>
          1. Get API key from https://resend.com<br/>
          2. Create .env.local file<br/>
          3. Add: RESEND_API_KEY=your_key_here<br/>
          4. Restart development server
        `);
      }
      
      setInviteEmail('');
      setInviteRole('staff');
      setInviteCommissionPercent('10');
      setInvitePermissions({
        accounts: false,
        members: false,
        subscriptions_collect: false,
        subscriptions_approve: false,
        staff_management: false,
        reports: false,
        settings: false,
        events: false
      });
    } else {
      setInviteError(data.error || 'Failed to send invitation');
    }
  } catch (err) {
    console.error('Invitation error:', err);
    setInviteError('Failed to send invitation. Please try again.');
  } finally {
    setInviteSubmitting(false);
  }
};

  const getPermissionLabel = (key: string) => {
    const labels: Record<string, string> = {
      accounts: "Accounts",
      members: "Members", 
      subscriptions_collect: "Collect Subscriptions",
      subscriptions_approve: "Approve Subscriptions",
      staff_management: "Staff Management",
      reports: "Reports",
      settings: "Settings"
    };
    return labels[key] || key;
  };

  // Classification logic for administrators vs employees
  const classifiedStaff = useMemo(() => {
    const administrators: Staff[] = [];
    const employees: Staff[] = [];

    (staff || []).forEach(staffMember => {
      // Salary-based classification:
      // Only salary === 0 → Administrator
      // salary > 0 → Employee
      // salary undefined/null → Employee (default)
      
      const salary = Number((staffMember.salary_amount ?? staffMember.basic_salary) ?? -1);

      if (salary === 0) {
        administrators.push(staffMember);
      } else {
        employees.push(staffMember);
      }
    });

    return { administrators, employees };
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const { administrators, employees } = classifiedStaff;
    const sourceList = activeTab === 'administrators' ? administrators : employees;
    
    let filtered = (sourceList || []).filter(staffMember => {
      const matchesSearch = staffMember.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           staffMember.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           staffMember.phone.includes(searchQuery);
      return matchesSearch;
    });

    return filtered;
  }, [classifiedStaff, activeTab, searchQuery]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-purple-100 text-purple-800";
      case "co_admin": return "bg-blue-100 text-blue-800";
      case "staff": return "bg-green-100 text-green-800";
      case "editor": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusColor = (status: string) => {
    return status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800";
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Early returns - moved to end after all hooks
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t.loading || "Loading..."}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!tenantContext?.permissions?.staff_management) {
    return <div>Access Denied</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-white border-r border-neutral-200 transform transition-transform duration-300 ease-in-out ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-neutral-200">
            <h1 className="text-2xl font-black text-neutral-900">MJM</h1>
            <p className="text-sm text-neutral-600">Mubeen Jummah Masjid</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
              <HomeIcon className="w-5 h-5" />
              <span>{t.dashboard}</span>
            </Link>
            {hasModulePermission(parsedPermissions, 'families') && (
              <Link href="/families" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
                <Users className="w-5 h-5" />
                <span>{t.families}</span>
              </Link>
            )}
            {hasModulePermission(parsedPermissions, 'accounts') && (
              <Link href="/accounts" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
                <CreditCard className="w-5 h-5" />
                <span>{t.accounts}</span>
              </Link>
            )}
            <Link href="/staff" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 bg-emerald-50 text-emerald-700 rounded-3xl font-bold transition-all border-2 border-emerald-200">
              <Briefcase className="w-5 h-5" />
              <span>{t.staff_management || "Staff Management"}</span>
            </Link>
            {hasModulePermission(parsedPermissions, 'settings') && (
              <Link href="/settings" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
                <Settings className="w-5 h-5" />
                <span>{t.settings}</span>
              </Link>
            )}
            {hasModulePermission(parsedPermissions, 'events') && (
              <Link href="/events" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 p-4 hover:bg-neutral-50 text-neutral-600 rounded-3xl font-bold transition-all">
                <Calendar className="w-5 h-5 text-amber-500" />
                <span>{t.events || "Events"}</span>
              </Link>
            )}
            <div className="flex items-center gap-4 p-4 opacity-40 text-neutral-600 rounded-3xl font-bold cursor-not-allowed">
              <HelpCircle className="w-5 h-5" />
              <span>Help & Support</span>
            </div>
          </nav>

          <button 
            onClick={handleLogout}
            className="m-4 flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 rounded-3xl font-bold transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-4 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-20 border-b border-neutral-200">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-neutral-600 hover:bg-neutral-50 rounded-3xl transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black text-neutral-900">{t.staff_management || "Staff Management"}</h1>
        </header>

        {/* View Toggle */}
        <div className="px-4 lg:px-6">
          <div className="flex space-x-2 bg-neutral-100 rounded-2xl p-1">
            <button 
              onClick={() => setActiveView('all')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-colors ${
                activeView === 'all' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All Staff ({staff.length})
            </button>
            <button 
              onClick={() => setActiveView('staff')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-colors ${
                activeView === 'staff' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Staff ({staff.filter(s => s.role === 'staff' || s.role === 'editor').length})
            </button>
            <button 
              onClick={() => setActiveView('admins')}
              className={`flex-1 py-2 px-4 rounded-xl font-medium transition-colors ${
                activeView === 'admins' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Admins ({staff.filter(s => s.role === 'super_admin' || s.role === 'co_admin').length})
            </button>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Total Staff</p>
                  <p className="text-2xl font-black text-neutral-900">{staff.length}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Active Staff</p>
                  <p className="text-2xl font-black text-emerald-600">{staff.filter(s => s.status === "active").length}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-neutral-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-600 mb-1">Total Salary</p>
                  <p className="text-2xl font-black text-neutral-900">
                    Rs. {staff.reduce((sum, s) => sum + s.basic_salary, 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Add Staff Button */}
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
              return undefined;
            }}
            className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Add Staff Member
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search staff members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Staff Tabs */}
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden">
            <div className="p-6 border-b border-neutral-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-neutral-900">Staff Management</h2>
                <div className="flex bg-neutral-100 rounded-xl p-1">
                  <button
                    onClick={() => setActiveTab('administrators')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'administrators'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Administrators ({classifiedStaff.administrators.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('employees')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === 'employees'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Employees ({classifiedStaff.employees.length})
                  </button>
                </div>
              </div>
            </div>
            
            {filteredStaff.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">
                  {searchQuery ? `No ${activeTab} found` : `No ${activeTab}`}
                </h3>
                <p className="text-sm text-neutral-600">
                  {searchQuery ? "Try a different search term" : `Add your first ${activeTab.slice(0, -1)} to get started`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Staff Member</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Role</th>
                      {activeTab === 'employees' && (
                        <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Basic Salary</th>
                      )}
                      {activeTab === 'employees' && (
                        <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Collection Access</th>
                      )}
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {(filteredStaff || []).map((staffMember) => {
                      console.log("DEBUG STAFF:", {
                        name: staffMember.name,
                        email: staffMember.email,
                        role: staffMember.role,
                        user_id: staffMember.user_id
                      });
                      
                      return (
                      <tr 
                        key={staffMember.id} 
                        className="hover:bg-neutral-50 cursor-pointer"
                        onClick={(e) => {
                          console.log("DEBUG: Table row clicked for:", staffMember.name);
                          e.preventDefault();
                          e.stopPropagation();
                          openStaffProfile(staffMember);
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                              <Users className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="ml-4">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  router.push(`/staff/employees/${staffMember.user_id || staffMember.id}`);
                                }}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-800 text-left"
                              >
                                {staffMember.name}
                              </button>
                              <div className="text-xs text-neutral-500">ID: {staffMember.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-neutral-900">{staffMember.email}</div>
                          <div className="text-xs text-neutral-500">{staffMember.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(staffMember.role)}`}>
                            {staffMember.role.replace('_', ' ')}
                          </span>
                        </td>
                        {activeTab === 'employees' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                            Rs. {(staffMember.salary_amount ?? staffMember.basic_salary ?? 0).toLocaleString()}
                          </td>
                        )}
                        {activeTab === 'employees' && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mr-3">
                                <Wallet className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-emerald-700">
                                  {staffMember.permissions?.subscriptions_collect ? (
                                    <span className="text-green-600">
                                      {(staffMember.commission_rate || 0)}% Commission
                                    </span>
                                  ) : (
                                    <span className="text-gray-500">No Access</span>
                                  )}
                                </div>
                                <div className="text-xs text-neutral-500">
                                  Rs. {(staffBalances[staffMember.user_id || ''] || 0).toLocaleString()} Balance
                                </div>
                              </div>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(staffMember.status)}`}>
                            {staffMember.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStaff(staffMember);
                                setName(staffMember.name);
                                setEmail(staffMember.email);
                                setPhone(staffMember.phone);
                                setRole(staffMember.role);
                                setBasicSalary(staffMember.basic_salary.toString());
                                setStatus(staffMember.status);
                                setIsModalOpen(true);
                              }}
                              className="text-emerald-600 hover:text-emerald-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {staffMember.status === 'active' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeactivateStaff(staffMember.user_id);
                                }}
                                className="text-amber-600 hover:text-amber-900"
                                title="Deactivate Staff Member"
                              >
                                <AlertCircle className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleActivateStaff(staffMember.user_id);
                                }}
                                className="text-green-600 hover:text-green-900"
                                title="Activate Staff Member"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            {(() => {
                              const isCurrentUser = staffMember.user_id === user?.id || staffMember.user_id === tenantContext?.userId;
                              const currentUserIsSuperAdmin = tenantContext?.role === 'super_admin' || user?.role === 'super_admin';
                              const hasReplacement = isCurrentUser && currentUserIsSuperAdmin ? replacementCheck[staffMember.user_id] : true;
                              
                              // Show delete button if:
                              // 1. Current user is super admin AND
                              // 2. Either deleting someone else (not super admin) OR deleting self with replacement
                              return (tenantContext?.role === 'super_admin' || user?.role === 'super_admin') && 
                                     (staffMember.role !== 'super_admin' || (isCurrentUser && hasReplacement));
                            })() && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteStaff(staffMember);
                                }}
                                className="text-red-600 hover:text-red-900"
                                title={staffMember.user_id === user?.id || staffMember.user_id === tenantContext?.userId ? 
                                  (replacementCheck[staffMember.user_id] ? "Delete Your Account" : "Cannot delete: No replacement admin with full access") : 
                                  "Delete Staff Member"}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

         {/* User Access Management */}
{canManageAccess && (
  <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden mt-8">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-black text-neutral-900">User Access Management</h2>
            </div>
            
            {userRoles.length === 0 ? (
              <div className="p-12 text-center">
                <Shield className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <h3 className="text-lg font-semibold text-neutral-900 mb-2">No user access found</h3>
                <p className="text-sm text-neutral-600">Users with access will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Permissions</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {userRoles.map((userRole) => (
                      <tr key={userRole.user_id} className="hover:bg-neutral-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          {userRole.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(userRole.role)}`}>
                            {userRole.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(userRole.permissions || {}).filter(([_, value]) => value).map(([key]) => (
                              <span key={key} className="inline-flex px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded-full">
                                {getPermissionLabel(key)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => openPermissionsModal(userRole)}
                              className="text-emerald-600 hover:text-emerald-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeUserAccess(userRole)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Invite User */}
        {canManageAccess && (
          <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden mt-8">
            <div className="p-6 border-b border-neutral-200">
              <h2 className="text-lg font-black text-neutral-900">Invite User</h2>
            </div>
            
            {inviteMessage && (
              <div className="p-4 m-6 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <Check className="w-5 h-5 text-green-600 mr-2 mt-1 flex-shrink-0" />
                  <div className="text-green-800 text-sm" dangerouslySetInnerHTML={{ __html: inviteMessage }} />
                </div>
              </div>
            )}
            
            {inviteError && (
              <div className="p-4 m-6 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-red-800">{inviteError}</span>
                </div>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleInviteSubmit(e); }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="staff">Staff</option>
                  <option value="editor">Editor</option>
                  <option value="co_admin">Co Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              {inviteRole === 'staff' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Commission Percent
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={inviteCommissionPercent}
                    onChange={(e) => setInviteCommissionPercent(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="10"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Permissions
                </label>
                <div className="space-y-2">
                  {Object.entries(invitePermissions).map(([key, value]) => (
                    <label key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setInvitePermissions(prev => ({
                          ...prev,
                          [key]: e.target.checked
                        }))}
                        className="w-4 h-4 text-emerald-600 border-neutral-300 rounded focus:ring-emerald-500 mr-2"
                      />
                      <span className="text-sm text-neutral-700 capitalize">
                        {key.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={inviteSubmitting}
                className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {inviteSubmitting ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          </div>
        )}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Add/Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-neutral-900">
                {editingStaff ? "Edit Staff" : "Add Staff Member"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="staff">Staff</option>
                  <option value="editor">Editor</option>
                  <option value="co_admin">Co Admin</option>
                  {/* Only Super Admin can create Super Admin */}
                  {(tenantContext?.role === 'super_admin' || user?.role === 'super_admin') && (
                    <option value="super_admin">Super Admin</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Basic Salary
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={basicSalary}
                  onChange={(e) => setBasicSalary(e.target.value)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Enter basic salary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-4 py-3 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Permissions Section */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  Permissions
                </label>
                <div className="space-y-2">
                  {[
                    'accounts',
                    'members', 
                    'subscriptions_collect',
                    'subscriptions_approve',
                    'staff_management',
                    'reports',
                    'settings',
                    'events'
                  ].map((key) => (
                    <label key={key} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[key as keyof typeof permissions]}
                        onChange={(e) => handlePermissionChange(key, e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-neutral-300 rounded focus:ring-emerald-500"
                        disabled={role === 'super_admin'}
                      />
                      <span className="text-sm font-medium text-neutral-700">
                        {getPermissionLabel(key)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-emerald-600 text-white rounded-3xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                {submitting ? "Saving..." : (editingStaff ? "Update" : "Add Staff")}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {isPermissionsModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-neutral-900">
                Edit Permissions - {editingUserRole?.email}
              </h2>
              <button 
                onClick={() => setIsPermissionsModalOpen(false)}
                className="p-2 hover:bg-neutral-50 rounded-3xl transition-colors"
              >
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Role Dropdown */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Role
                </label>
                <select
                  value={editingRole}
                  onChange={(e) => handleRoleChange(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="co_admin">Co Admin</option>
                  <option value="staff">Staff</option>
                  <option value="editor">Editor</option>
                </select>
              </div>

              {/* Permission Checkboxes */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-3">
                  Permissions
                </label>
                <div className="space-y-3">
                  {[
                    'accounts',
                    'members', 
                    'subscriptions_collect',
                    'subscriptions_approve',
                    'staff_management',
                    'reports',
                    'settings',
                    'events'
                  ].map((key) => (
                    <label key={key} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissions[key as keyof typeof permissions]}
                        onChange={(e) => handlePermissionChange(key, e.target.checked)}
                        className="w-4 h-4 text-emerald-600 border-neutral-300 rounded focus:ring-emerald-500"
                        disabled={editingRole === 'super_admin'}
                      />
                      <span className="text-sm font-medium text-neutral-700">
                        {getPermissionLabel(key)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setIsPermissionsModalOpen(false)}
                className="flex-1 py-3 bg-neutral-100 text-neutral-700 rounded-3xl font-medium hover:bg-neutral-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={savePermissions}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-3xl font-medium hover:bg-emerald-700 transition-colors"
              >
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Profile View - Modular Component */}
      {(() => { console.log("DEBUG: Rendering modal - showProfileView:", showProfileView, "selectedStaffProfile:", selectedStaffProfile?.name); return null; })()}
      {showProfileView && selectedStaffProfile && (
        <StaffProfile
          staff={selectedStaffProfile}
          staffBalances={staffBalances}
          onClose={closeStaffProfile}
          onSave={handleProfileSave}
          getStatusColor={getStatusColor}
          getPermissionLabel={getPermissionLabel}
        />
      )}
    </div>
  );
}
