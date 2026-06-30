"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Briefcase,
  Calendar,
  Check,
  CreditCard,
  DollarSign,
  Edit2,
  HelpCircle,
  Home as HomeIcon,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getTenantContext } from "@/lib/tenant";
import { useAppToast } from "@/components/ToastProvider";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { hasModulePermission, isSuperAdmin, parsePermissions } from "@/lib/permissions-utils";

export const dynamic = "force-dynamic";

type AccessRole = "super_admin" | "co_admin" | "staff" | "editor";
type Status = "active" | "inactive";
type SectionKey = "directory" | "security";

type Permissions = {
  accounts: boolean;
  families: boolean;
  members: boolean;
  subscriptions_collect: boolean;
  subscriptions_approve: boolean;
  staff_management: boolean;
  reports: boolean;
  settings: boolean;
  events: boolean;
};

type Staff = {
  id: string;
  employee_id: string;
  name: string;
  phone: string;
  role: AccessRole;
  basic_salary: number;
  status: Status;
  created_at: string;
  masjid_id: string;
};

type UserRole = {
  id: string;
  user_id: string;
  email: string;
  role: AccessRole;
  permissions: Permissions;
  created_at?: string;
  status?: Status;
};

type StaffForm = {
  name: string;
  phone: string;
  role: AccessRole;
  basicSalary: string;
  status: Status;
};

type InviteForm = {
  email: string;
  role: AccessRole;
  commissionPercent: string;
  permissions: Permissions;
};

type InviteFeedback = {
  tone: "success" | "warning" | "error";
  message: string;
  link?: string;
  token?: string;
};

const DEFAULT_PERMISSIONS: Permissions = {
  accounts: false,
  families: false,
  members: false,
  subscriptions_collect: false,
  subscriptions_approve: false,
  staff_management: false,
  reports: false,
  settings: false,
  events: false,
};

const PERMISSION_ITEMS: Array<{ key: keyof Permissions; label: string }> = [
  { key: "accounts", label: "Accounts" },
  { key: "families", label: "Families" },
  { key: "members", label: "Members" },
  { key: "subscriptions_collect", label: "Collect Subscriptions" },
  { key: "subscriptions_approve", label: "Approve Subscriptions" },
  { key: "staff_management", label: "Staff Management" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
  { key: "events", label: "Events" },
];

function buildPermissionsForRole(role: AccessRole): Permissions {
  switch (role) {
    case "super_admin":
      return {
        accounts: true,
        families: true,
        members: true,
        subscriptions_collect: true,
        subscriptions_approve: true,
        staff_management: true,
        reports: true,
        settings: true,
        events: true,
      };
    case "co_admin":
      return {
        accounts: true,
        families: true,
        members: true,
        subscriptions_collect: true,
        subscriptions_approve: true,
        staff_management: true,
        reports: true,
        settings: false,
        events: true,
      };
    case "editor":
      return {
        ...DEFAULT_PERMISSIONS,
        families: true,
        members: true,
        reports: true,
        events: true,
      };
    case "staff":
    default:
      return {
        ...DEFAULT_PERMISSIONS,
        families: true,
        members: true,
        subscriptions_collect: true,
      };
  }
}

function normalizePermissions(value: Partial<Permissions> | null | undefined): Permissions {
  return { ...DEFAULT_PERMISSIONS, ...(value || {}) };
}

function createStaffForm(): StaffForm {
  return {
    name: "",
    phone: "",
    role: "staff",
    basicSalary: "",
    status: "active",
  };
}

function createInviteForm(role: AccessRole = "staff"): InviteForm {
  return {
    email: "",
    role,
    commissionPercent: "10",
    permissions: buildPermissionsForRole(role),
  };
}

function formatCurrency(value: number) {
  return `Rs. ${Number(value || 0).toLocaleString()}`;
}

function formatRole(role: string) {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRoleBadge(role: AccessRole) {
  if (role === "super_admin") return "bg-purple-100 text-purple-800 border-purple-200";
  if (role === "co_admin") return "bg-blue-100 text-blue-800 border-blue-200";
  if (role === "editor") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

function getStatusBadge(status: Status) {
  return status === "active"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-red-100 text-red-800 border-red-200";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return `${first}${last}`.toUpperCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function StaffPage() {
  const router = useRouter();
  const { toast, confirm } = useAppToast();
  const { user, loading: authLoading, tenantContext, signOut } = useSupabaseAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("directory");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [staff, setStaff] = useState<Staff[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [collectorProfiles, setCollectorProfiles] = useState<Record<string, number>>({});
  const [staffBalances, setStaffBalances] = useState<Record<string, number>>({});
  const [replacementCheck, setReplacementCheck] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState<StaffForm>(createStaffForm());
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [editingUserRole, setEditingUserRole] = useState<UserRole | null>(null);
  const [editingRole, setEditingRole] = useState<AccessRole>("staff");
  const [editingPermissions, setEditingPermissions] = useState<Permissions>(DEFAULT_PERMISSIONS);
  const [editingCommissionPercent, setEditingCommissionPercent] = useState("10");
  const [accessSubmitting, setAccessSubmitting] = useState(false);

  const [inviteForm, setInviteForm] = useState<InviteForm>(createInviteForm());
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteFeedback, setInviteFeedback] = useState<InviteFeedback | null>(null);

  const parsedPermissions = parsePermissions(tenantContext?.permissions || null);
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);
  const hasStaffAccess = hasModulePermission(parsedPermissions, "staff_management");
  const canManageAccess =
    tenantContext?.role === "super_admin" || tenantContext?.role === "co_admin";

  const superAdminRoles = useMemo(
    () => userRoles.filter((item) => item.role === "super_admin"),
    [userRoles]
  );

  const originalSuperAdminUserId = useMemo(() => {
    if (superAdminRoles.length === 0) return null;
    return [...superAdminRoles].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })[0]?.user_id || null;
  }, [superAdminRoles]);

  const filteredStaff = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((member) => {
      return (
        member.name.toLowerCase().includes(query) ||
        member.phone.toLowerCase().includes(query) ||
        formatRole(member.role).toLowerCase().includes(query)
      );
    });
  }, [searchQuery, staff]);

  const totalSalary = useMemo(
    () => staff.reduce((sum, item) => sum + Number(item.basic_salary || 0), 0),
    [staff]
  );

  const activeStaffCount = useMemo(
    () => staff.filter((item) => item.status === "active").length,
    [staff]
  );

  const activeAccessUsers = useMemo(
    () => userRoles.filter((item) => (item.status || "active") === "active").length,
    [userRoles]
  );

  const collectorsEnabledCount = useMemo(
    () => userRoles.filter((item) => item.permissions.subscriptions_collect).length,
    [userRoles]
  );

  const resolveTenant = async () => {
    const ctx = tenantContext || (await getTenantContext());
    if (!ctx?.masjidId) {
      throw new Error("Masjid context is not available. Please sign in again.");
    }
    return ctx;
  };

  const getProtectedAdminRemovalReason = (
    targetUserId?: string | null,
    targetRole?: string | null,
    action: "remove" | "role_change" = "remove"
  ) => {
    if (!targetUserId || targetRole !== "super_admin") return null;
    const isOriginalSuperAdmin = targetUserId === originalSuperAdminUserId;
    const isLastSuperAdmin = superAdminRoles.length <= 1;

    if (isOriginalSuperAdmin && isLastSuperAdmin) {
      return action === "role_change"
        ? "The original super admin cannot be demoted until another super admin is assigned."
        : "The original super admin cannot be removed until another super admin is assigned.";
    }

    if (isLastSuperAdmin) {
      return action === "role_change"
        ? "You cannot demote the last remaining super admin. Assign another super admin first."
        : "You cannot remove the last remaining super admin. Assign another super admin first.";
    }

    return null;
  };

  const loadBalances = async (masjidId: string, roles: UserRole[]) => {
    const userIds = roles.map((item) => item.user_id).filter(Boolean);
    if (userIds.length === 0) {
      setStaffBalances({});
      return;
    }

    const [{ data: collections, error: collectionsError }, { data: payments, error: paymentsError }] =
      await Promise.all([
        supabase
          .from("subscription_collections")
          .select("commission_amount, collected_by_user_id")
          .eq("masjid_id", masjidId)
          .eq("status", "accepted")
          .in("collected_by_user_id", userIds),
        supabase
          .from("collector_commission_payments")
          .select("amount, collector_user_id")
          .eq("masjid_id", masjidId)
          .in("collector_user_id", userIds),
      ]);

    if (collectionsError) throw collectionsError;
    if (paymentsError) throw paymentsError;

    const earned: Record<string, number> = {};
    const paid: Record<string, number> = {};

    (collections || []).forEach((item: any) => {
      if (!item.collected_by_user_id) return;
      earned[item.collected_by_user_id] =
        (earned[item.collected_by_user_id] || 0) + Number(item.commission_amount || 0);
    });

    (payments || []).forEach((item: any) => {
      if (!item.collector_user_id) return;
      paid[item.collector_user_id] =
        (paid[item.collector_user_id] || 0) + Number(item.amount || 0);
    });

    const balances: Record<string, number> = {};
    userIds.forEach((userId) => {
      balances[userId] = (earned[userId] || 0) - (paid[userId] || 0);
    });
    setStaffBalances(balances);
  };

  const loadPageData = async () => {
    setLoading(true);
    setPageError("");

    try {
      const ctx = await resolveTenant();

      const { data: employeeRows, error: employeeError } = await supabase
        .from("employees")
        .select("id, masjid_id, name, phone, role, monthly_salary, created_at")
        .eq("masjid_id", ctx.masjidId)
        .order("created_at", { ascending: false });

      if (employeeError) throw employeeError;

      const nextStaff: Staff[] = (employeeRows || []).map((row: any) => ({
        id: row.id,
        employee_id: row.id,
        name: row.name || "Unnamed Staff",
        phone: row.phone || "",
        role: (row.role || "staff") as AccessRole,
        basic_salary: Number(row.monthly_salary || 0),
        status: "active",
        created_at: row.created_at || new Date().toISOString(),
        masjid_id: row.masjid_id,
      }));

      setStaff(nextStaff);

      if (!canManageAccess) {
        setUserRoles([]);
        setCollectorProfiles({});
        setStaffBalances({});
        return;
      }

      const [{ data: accessRows, error: accessError }, { data: collectorRows, error: collectorError }] =
        await Promise.all([
          supabase
            .from("user_roles")
            .select("id, user_id, email, role, permissions, created_at")
            .eq("masjid_id", ctx.masjidId)
            .order("created_at", { ascending: false }),
          supabase
            .from("subscription_collector_profiles")
            .select("user_id, default_commission_percent")
            .eq("masjid_id", ctx.masjidId),
        ]);

      if (accessError) throw accessError;
      if (collectorError) throw collectorError;

      const nextUserRoles: UserRole[] = (accessRows || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        email: row.email || "No email",
        role: (row.role || "staff") as AccessRole,
        permissions: normalizePermissions(row.permissions),
        created_at: row.created_at,
        status: (row.status || "active") as Status,
      }));

      const nextCollectorProfiles: Record<string, number> = {};
      (collectorRows || []).forEach((row: any) => {
        if (!row.user_id) return;
        nextCollectorProfiles[row.user_id] = Number(row.default_commission_percent ?? 0);
      });

      setUserRoles(nextUserRoles);
      setCollectorProfiles(nextCollectorProfiles);
      await loadBalances(ctx.masjidId, nextUserRoles);
    } catch (error: any) {
      console.error("Failed to load page data:", error);
      setPageError(error.message || "Failed to load staff and access data.");
      toast({
        kind: "error",
        title: "Loading Failed",
        message: error.message || "Failed to load staff and access data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const hasEligibleReplacement = async (currentUserId: string, masjidId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role, permissions, user_id")
        .eq("masjid_id", masjidId)
        .neq("user_id", currentUserId)
        .in("role", ["super_admin", "co_admin"]);

      if (error) throw error;
      return !!(data || []).find((item: any) => isSuperAdmin(parsePermissions(item.permissions)));
    } catch (error) {
      console.error("Failed to check replacement admin:", error);
      return false;
    }
  };

  const safeSelfRemoval = async (currentUserId: string, masjidId: string) => {
    const protectedReason = getProtectedAdminRemovalReason(currentUserId, "super_admin");
    if (protectedReason) throw new Error(protectedReason);

    const { data, error } = await supabase
      .from("user_roles")
      .select("id, role, permissions, user_id")
      .eq("masjid_id", masjidId)
      .neq("user_id", currentUserId)
      .in("role", ["super_admin", "co_admin"]);

    if (error) throw error;

    const replacement = (data || []).find((item: any) => isSuperAdmin(parsePermissions(item.permissions)));
    if (!replacement) {
      throw new Error("You cannot remove yourself until another full-access admin is assigned.");
    }

    const { error: promoteError } = await supabase
      .from("user_roles")
      .update({ role: "super_admin", permissions: buildPermissionsForRole("super_admin") })
      .eq("id", replacement.id)
      .eq("masjid_id", masjidId);

    if (promoteError) throw promoteError;

    const { error: deleteError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", currentUserId)
      .eq("masjid_id", masjidId);

    if (deleteError) throw deleteError;
  };

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;
    void loadPageData();
  }, [user, tenantContext?.masjidId, canManageAccess]);

  useEffect(() => {
    const run = async () => {
      if (!tenantContext?.userId || !tenantContext?.masjidId) return;
      const hasReplacement = await hasEligibleReplacement(tenantContext.userId, tenantContext.masjidId);
      setReplacementCheck({ [tenantContext.userId]: hasReplacement });
    };
    void run();
  }, [tenantContext?.userId, tenantContext?.masjidId, userRoles]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

  const openCreateStaffModal = () => {
    setEditingStaff(null);
    setStaffForm(createStaffForm());
    setIsStaffModalOpen(true);
  };

  const openEditStaffModal = (member: Staff) => {
    setEditingStaff(member);
    setStaffForm({
      name: member.name,
      phone: member.phone,
      role: member.role,
      basicSalary: String(member.basic_salary),
      status: member.status,
    });
    setIsStaffModalOpen(true);
  };

  const closeStaffModal = () => {
    setEditingStaff(null);
    setStaffForm(createStaffForm());
    setIsStaffModalOpen(false);
  };

  const closePermissionsModal = () => {
    setEditingUserRole(null);
    setEditingRole("staff");
    setEditingPermissions(DEFAULT_PERMISSIONS);
    setEditingCommissionPercent("10");
    setIsPermissionsModalOpen(false);
  };

  const handleStaffSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const name = staffForm.name.trim();
    const phone = staffForm.phone.trim();
    const salary = Number(staffForm.basicSalary);

    if (!name) {
      toast({ kind: "error", title: "Validation Error", message: "Full name is required." });
      return;
    }

    if (!phone) {
      toast({ kind: "error", title: "Validation Error", message: "Phone number is required." });
      return;
    }

    if (!Number.isFinite(salary) || salary < 0) {
      toast({
        kind: "error",
        title: "Validation Error",
        message: "Basic salary must be a valid positive amount.",
      });
      return;
    }

    setStaffSubmitting(true);

    try {
      const ctx = await resolveTenant();

      if (editingStaff) {
        const { error } = await supabase
          .from("employees")
          .update({
            name,
            phone,
            role: staffForm.role,
            monthly_salary: salary,
          })
          .eq("id", editingStaff.id)
          .eq("masjid_id", ctx.masjidId);

        if (error) throw error;

        setStaff((prev) =>
          prev.map((item) =>
            item.id === editingStaff.id
              ? { ...item, name, phone, role: staffForm.role, basic_salary: salary, status: staffForm.status }
              : item
          )
        );

        toast({ kind: "success", title: "Staff Updated", message: "Staff record updated successfully." });
      } else {
        const { data, error } = await supabase
          .from("employees")
          .insert({
            masjid_id: ctx.masjidId,
            name,
            phone,
            role: staffForm.role,
            monthly_salary: salary,
          })
          .select("id, masjid_id, name, phone, role, monthly_salary, created_at")
          .single();

        if (error) throw error;

        setStaff((prev) => [
          {
            id: data.id,
            employee_id: data.id,
            name: data.name || name,
            phone: data.phone || phone,
            role: (data.role || staffForm.role) as AccessRole,
            basic_salary: Number(data.monthly_salary || salary),
            status: staffForm.status,
            created_at: data.created_at || new Date().toISOString(),
            masjid_id: data.masjid_id,
          },
          ...prev,
        ]);

        toast({ kind: "success", title: "Staff Added", message: "Staff record created successfully." });
      }

      closeStaffModal();
    } catch (error: any) {
      toast({ kind: "error", title: "Save Failed", message: error.message || "Failed to save staff." });
    } finally {
      setStaffSubmitting(false);
    }
  };

  const handleDeleteStaff = async (member: Staff) => {
    const ok = await confirm({
      title: "Delete Staff Record",
      message: `Are you sure you want to delete ${member.name}? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      const ctx = await resolveTenant();
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", member.id)
        .eq("masjid_id", ctx.masjidId);

      if (error) throw error;
      setStaff((prev) => prev.filter((item) => item.id !== member.id));
      toast({ kind: "success", title: "Staff Deleted", message: `${member.name} has been removed.` });
    } catch (error: any) {
      toast({ kind: "error", title: "Delete Failed", message: error.message || "Failed to delete staff." });
    }
  };

  const openPermissionsModal = (userRole: UserRole) => {
    setEditingUserRole(userRole);
    setEditingRole(userRole.role);
    setEditingPermissions(normalizePermissions(userRole.permissions));
    setEditingCommissionPercent(String(collectorProfiles[userRole.user_id] ?? 10));
    setIsPermissionsModalOpen(true);
  };

  const handleAccessRoleChange = (role: AccessRole) => {
    setEditingRole(role);
    setEditingPermissions(buildPermissionsForRole(role));
  };

  const savePermissions = async () => {
    if (!editingUserRole) return;

    const protectedReason =
      editingUserRole.role === "super_admin" && editingRole !== "super_admin"
        ? getProtectedAdminRemovalReason(editingUserRole.user_id, editingUserRole.role, "role_change")
        : null;

    if (protectedReason) {
      toast({ kind: "error", title: "Protected Super Admin", message: protectedReason });
      return;
    }

    const nextPermissions =
      editingRole === "super_admin" ? buildPermissionsForRole("super_admin") : editingPermissions;

    const commission = Number(editingCommissionPercent);
    if (nextPermissions.subscriptions_collect && (!Number.isFinite(commission) || commission < 0 || commission > 100)) {
      toast({
        kind: "error",
        title: "Validation Error",
        message: "Collection commission must be between 0 and 100.",
      });
      return;
    }

    setAccessSubmitting(true);

    try {
      const ctx = await resolveTenant();

      const { error } = await supabase
        .from("user_roles")
        .update({ role: editingRole, permissions: nextPermissions })
        .eq("user_id", editingUserRole.user_id)
        .eq("masjid_id", ctx.masjidId);

      if (error) throw error;

      if (nextPermissions.subscriptions_collect) {
        const { error: profileError } = await supabase
          .from("subscription_collector_profiles")
          .upsert(
            {
              masjid_id: ctx.masjidId,
              user_id: editingUserRole.user_id,
              default_commission_percent: commission,
            },
            { onConflict: "masjid_id,user_id" }
          );
        if (profileError) throw profileError;
        setCollectorProfiles((prev) => ({ ...prev, [editingUserRole.user_id]: commission }));
      }

      setUserRoles((prev) =>
        prev.map((item) =>
          item.user_id === editingUserRole.user_id
            ? { ...item, role: editingRole, permissions: nextPermissions }
            : item
        )
      );

      closePermissionsModal();
      toast({
        kind: "success",
        title: "Access Updated",
        message: "Role and permissions were updated successfully.",
      });
    } catch (error: any) {
      toast({ kind: "error", title: "Update Failed", message: error.message || "Failed to update access." });
    } finally {
      setAccessSubmitting(false);
    }
  };

  const updateAccessStatus = async (userId: string, status: Status) => {
    try {
      const ctx = await resolveTenant();
      const { error } = await supabase
        .from("user_roles")
        .update({ status })
        .eq("user_id", userId)
        .eq("masjid_id", ctx.masjidId);

      if (error) throw error;

      setUserRoles((prev) => prev.map((item) => (item.user_id === userId ? { ...item, status } : item)));
      toast({
        kind: "success",
        title: status === "active" ? "Access Activated" : "Access Deactivated",
        message: `User access is now ${status}.`,
      });
    } catch (error: any) {
      toast({
        kind: "error",
        title: "Status Update Failed",
        message: error.message || "Failed to update access status.",
      });
    }
  };

  const removeUserAccess = async (userRole: UserRole) => {
    const protectedReason = getProtectedAdminRemovalReason(userRole.user_id, userRole.role);
    if (protectedReason) {
      toast({ kind: "error", title: "Protected Super Admin", message: protectedReason });
      return;
    }

    const isCurrentUser = userRole.user_id === user?.id || userRole.user_id === tenantContext?.userId;
    const ok = await confirm({
      title: "Remove Access",
      message: `Are you sure you want to remove access for ${userRole.email}?`,
      confirmText: "Remove",
      cancelText: "Cancel",
    });
    if (!ok) return;

    try {
      const ctx = await resolveTenant();

      if (isCurrentUser && userRole.role === "super_admin") {
        await safeSelfRemoval(userRole.user_id, ctx.masjidId);
        toast({
          kind: "success",
          title: "Access Removed",
          message: "Your access was removed and another super admin was promoted.",
        });
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userRole.user_id)
        .eq("masjid_id", ctx.masjidId);

      if (error) throw error;

      setUserRoles((prev) => prev.filter((item) => item.user_id !== userRole.user_id));
      toast({ kind: "success", title: "Access Removed", message: "User access removed successfully." });
    } catch (error: any) {
      toast({ kind: "error", title: "Remove Failed", message: error.message || "Failed to remove access." });
    }
  };

  const handleInviteRoleChange = (role: AccessRole) => {
    setInviteForm((prev) => ({
      ...prev,
      role,
      permissions: buildPermissionsForRole(role),
    }));
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteError("");
    setInviteFeedback(null);

    const email = inviteForm.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setInviteError("Please enter a valid email address.");
      return;
    }

    const commission = Number(inviteForm.commissionPercent);
    if (
      inviteForm.permissions.subscriptions_collect &&
      (!Number.isFinite(commission) || commission < 0 || commission > 100)
    ) {
      setInviteError("Collection commission must be between 0 and 100.");
      return;
    }

    setInviteSubmitting(true);

    try {
      const ctx = await resolveTenant();
      const response = await fetch("/admin/api/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: inviteForm.role,
          permissions: inviteForm.permissions,
          commission_percent: inviteForm.permissions.subscriptions_collect ? commission : 0,
          masjid_id: ctx.masjidId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send invitation.");
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const inviteLink = data.invite_link ? `${origin}${data.invite_link}` : undefined;

      setInviteFeedback({
        tone: data.warning ? "warning" : "success",
        message: data.warning
          ? `Invitation created for ${email}. Email delivery reported a warning, so use the direct registration link below.`
          : `Invitation created successfully for ${email}.`,
        link: inviteLink,
        token: data.invitationToken,
      });

      setInviteForm(createInviteForm());
      toast({ kind: "success", title: "Invitation Sent", message: `Invitation prepared for ${email}.` });
    } catch (error: any) {
      setInviteError(error.message || "Failed to send invitation.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600" />
          <p className="text-sm font-medium text-neutral-600">Loading staff workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (!hasStaffAccess && !userIsSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <Shield className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h1 className="text-xl font-black text-neutral-900">Access Denied</h1>
          <p className="mt-2 text-sm text-neutral-600">
            You do not have permission to manage staff and access settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-neutral-200 bg-white transition-transform duration-300 lg:static ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-neutral-200 p-6">
            <h1 className="text-2xl font-black text-neutral-900">Masjid</h1>
            <p className="text-sm text-neutral-500">Staff & Management</p>
          </div>

          <nav className="flex-1 space-y-2 p-4">
            <Link href="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 rounded-3xl p-4 font-bold text-neutral-600 hover:bg-neutral-50">
              <HomeIcon className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            {hasModulePermission(parsedPermissions, "families") && (
              <Link href="/families" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 rounded-3xl p-4 font-bold text-neutral-600 hover:bg-neutral-50">
                <Users className="h-5 w-5" />
                <span>Families</span>
              </Link>
            )}
            {hasModulePermission(parsedPermissions, "accounts") && (
              <Link href="/accounts" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 rounded-3xl p-4 font-bold text-neutral-600 hover:bg-neutral-50">
                <CreditCard className="h-5 w-5" />
                <span>Accounts</span>
              </Link>
            )}
            <Link href="/staff" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
              <Briefcase className="h-5 w-5" />
              <span>Staff & Management</span>
            </Link>
            {hasModulePermission(parsedPermissions, "settings") && (
              <Link href="/settings" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 rounded-3xl p-4 font-bold text-neutral-600 hover:bg-neutral-50">
                <Settings className="h-5 w-5" />
                <span>Settings</span>
              </Link>
            )}
            {hasModulePermission(parsedPermissions, "events") && (
              <Link href="/events" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-4 rounded-3xl p-4 font-bold text-neutral-600 hover:bg-neutral-50">
                <Calendar className="h-5 w-5" />
                <span>Events</span>
              </Link>
            )}
            <div className="flex cursor-not-allowed items-center gap-4 rounded-3xl p-4 font-bold text-neutral-400">
              <HelpCircle className="h-5 w-5" />
              <span>Help & Support</span>
            </div>
          </nav>

          <button onClick={handleLogout} className="m-4 flex items-center gap-4 rounded-3xl p-4 font-bold text-red-600 hover:bg-red-50">
            <LogOut className="h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/90 px-4 py-4 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="rounded-2xl p-2 text-neutral-600 hover:bg-neutral-100 lg:hidden">
              <Menu className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-black text-neutral-900">Staff & Management</h1>
              <p className="text-sm text-neutral-500">Clean staff records and secure system access for your masjid.</p>
            </div>
          </div>
          <button onClick={() => void loadPageData()} className="rounded-2xl border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            Refresh
          </button>
        </header>

        <main className="flex-1 flex flex-col gap-6 p-4 md:p-6">
          {pageError && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Unable to load the latest data.</p>
                  <p className="mt-1">{pageError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-neutral-200 bg-white p-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setActiveSection("directory")}
                className={`flex-1 rounded-2xl px-4 py-3 text-left transition ${
                  activeSection === "directory" ? "bg-emerald-600 text-white" : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                <div className="text-sm font-black">Staff Directory</div>
                <div className={`text-xs ${activeSection === "directory" ? "text-emerald-100" : "text-neutral-500"}`}>
                  Employee records, salary overview, and staff list.
                </div>
              </button>
              {canManageAccess && (
                <button
                  onClick={() => setActiveSection("security")}
                  className={`flex-1 rounded-2xl px-4 py-3 text-left transition ${
                    activeSection === "security" ? "bg-emerald-600 text-white" : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  <div className="text-sm font-black">System Access & Security</div>
                  <div className={`text-xs ${activeSection === "security" ? "text-emerald-100" : "text-neutral-500"}`}>
                    User access, permissions, and invitation workflow.
                  </div>
                </button>
              )}
            </div>
          </div>

          {activeSection === "directory" && (
            <div className="flex flex-col gap-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-500">Total Staff</p>
                      <p className="mt-2 text-3xl font-black text-neutral-900">{staff.length}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                      <Users className="h-6 w-6" />
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-500">Active Staff</p>
                      <p className="mt-2 text-3xl font-black text-emerald-700">{activeStaffCount}</p>
                    </div>
                    <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                      <Shield className="h-6 w-6" />
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-500">Total Salary</p>
                      <p className="mt-2 text-3xl font-black text-neutral-900">{formatCurrency(totalSalary)}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                      <DollarSign className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>

              <section className="rounded-3xl border border-neutral-200 bg-white">
                <div className="flex flex-col gap-4 border-b border-neutral-200 p-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-neutral-900">Staff Directory</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Manage staff records separately from platform login access.
                    </p>
                  </div>
                  <button onClick={openCreateStaffModal} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
                    <Plus className="h-4 w-4" />
                    Add Staff Member
                  </button>
                </div>

                <div className="p-6">
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, phone number, or role"
                      className="w-full rounded-3xl border border-neutral-200 bg-neutral-50 py-4 pl-12 pr-4 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    />
                  </div>

                  {filteredStaff.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-14 text-center">
                      <Users className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
                      <h3 className="text-lg font-bold text-neutral-900">
                        {searchQuery ? "No matching staff records" : "No staff records yet"}
                      </h3>
                      <p className="mt-2 text-sm text-neutral-500">
                        {searchQuery ? "Try a different keyword." : "Create your first staff record to get started."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-3xl border border-neutral-200">
                      <table className="min-w-full divide-y divide-neutral-200">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Name</th>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Role</th>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Basic Salary</th>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200 bg-white">
                          {filteredStaff.map((member) => (
                            <tr key={member.id} className="hover:bg-neutral-50">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-4">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">
                                    {initials(member.name)}
                                  </div>
                                  <div>
                                    <button onClick={() => router.push(`/staff/${member.employee_id}`)} className="text-left text-sm font-bold text-emerald-700 hover:text-emerald-900 hover:underline">
                                      {member.name}
                                    </button>
                                    <p className="text-xs text-neutral-500">{member.phone || "No phone number"}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getRoleBadge(member.role)}`}>
                                  {formatRole(member.role)}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-neutral-900">{formatCurrency(member.basic_salary)}</td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadge(member.status)}`}>
                                  {formatRole(member.status)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => openEditStaffModal(member)} className="rounded-xl p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800" title="Edit staff">
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => void handleDeleteStaff(member)} className="rounded-xl p-2 text-red-600 hover:bg-red-50 hover:text-red-800" title="Delete staff">
                                    <Trash2 className="h-4 w-4" />
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
              </section>
            </div>
          )}

          {activeSection === "security" && canManageAccess && (
            <div className="flex flex-col gap-6">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-500">Users With Access</p>
                      <p className="mt-2 text-3xl font-black text-neutral-900">{userRoles.length}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                      <Shield className="h-6 w-6" />
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-500">Active Access</p>
                      <p className="mt-2 text-3xl font-black text-emerald-700">{activeAccessUsers}</p>
                    </div>
                    <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
                      <Check className="h-6 w-6" />
                    </div>
                  </div>
                </div>
                <div className="rounded-3xl border border-neutral-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-neutral-500">Collectors Enabled</p>
                      <p className="mt-2 text-3xl font-black text-neutral-900">{collectorsEnabledCount}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                      <Wallet className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <section className="rounded-3xl border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-200 p-6">
                    <h2 className="text-xl font-black text-neutral-900">User Access Management</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Keep login roles and permissions isolated from employee records.
                    </p>
                  </div>

                  <div className="p-6">
                    {userRoles.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-14 text-center">
                        <Shield className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
                        <h3 className="text-lg font-bold text-neutral-900">No user access records</h3>
                        <p className="mt-2 text-sm text-neutral-500">Invited and active users will appear here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-3xl border border-neutral-200">
                        <table className="min-w-full divide-y divide-neutral-200">
                          <thead className="bg-neutral-50">
                            <tr>
                              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Email</th>
                              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Role</th>
                              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Collection Commission (%)</th>
                              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Permissions</th>
                              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Status</th>
                              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-neutral-500">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-200 bg-white">
                            {userRoles.map((item) => {
                              const protectedReason = getProtectedAdminRemovalReason(item.user_id, item.role);
                              const currentStatus = item.status || "active";
                              const isCurrentUser = item.user_id === user?.id || item.user_id === tenantContext?.userId;
                              const selfRemovalBlocked =
                                isCurrentUser &&
                                item.role === "super_admin" &&
                                !replacementCheck[item.user_id] &&
                                !protectedReason;

                              return (
                                <tr key={item.user_id} className="hover:bg-neutral-50">
                                  <td className="px-6 py-4 text-sm font-medium text-neutral-900">{item.email}</td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getRoleBadge(item.role)}`}>
                                      {formatRole(item.role)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-sm font-semibold text-neutral-900">
                                    {item.permissions.subscriptions_collect ? `${collectorProfiles[item.user_id] ?? 10}%` : "—"}
                                    {item.permissions.subscriptions_collect && (
                                      <div className="mt-1 text-xs font-medium text-neutral-500">
                                        Balance: {formatCurrency(staffBalances[item.user_id] || 0)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1.5">
                                      {Object.entries(item.permissions)
                                        .filter(([, value]) => value)
                                        .map(([key]) => (
                                          <span key={key} className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                                            {PERMISSION_ITEMS.find((entry) => entry.key === key)?.label || key}
                                          </span>
                                        ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadge(currentStatus)}`}>
                                      {formatRole(currentStatus)}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => openPermissionsModal(item)} className="rounded-xl p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800" title="Edit role and permissions">
                                        <Edit2 className="h-4 w-4" />
                                      </button>
                                      {currentStatus === "active" ? (
                                        <button onClick={() => void updateAccessStatus(item.user_id, "inactive")} className="rounded-xl p-2 text-amber-600 hover:bg-amber-50 hover:text-amber-800" title="Deactivate access">
                                          <AlertCircle className="h-4 w-4" />
                                        </button>
                                      ) : (
                                        <button onClick={() => void updateAccessStatus(item.user_id, "active")} className="rounded-xl p-2 text-green-600 hover:bg-green-50 hover:text-green-800" title="Activate access">
                                          <Check className="h-4 w-4" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() => void removeUserAccess(item)}
                                        disabled={!!protectedReason || selfRemovalBlocked}
                                        title={protectedReason || (selfRemovalBlocked ? "Assign another full-access admin before removing your own access." : "Remove access")}
                                        className="rounded-xl p-2 text-red-600 hover:bg-red-50 hover:text-red-800 disabled:cursor-not-allowed disabled:text-neutral-300 disabled:hover:bg-transparent"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
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
                </section>

                <section className="rounded-3xl border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-200 p-6">
                    <h2 className="text-xl font-black text-neutral-900">Invite User</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Invite a user and configure the correct permissions before they log in.
                    </p>
                  </div>

                  <div className="p-6">
                    {inviteFeedback && (
                      <div className={`mb-5 rounded-2xl border p-4 text-sm ${
                        inviteFeedback.tone === "error"
                          ? "border-red-200 bg-red-50 text-red-800"
                          : inviteFeedback.tone === "warning"
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }`}>
                        <p className="font-semibold">{inviteFeedback.message}</p>
                        {inviteFeedback.link && (
                          <a href={inviteFeedback.link} target="_blank" rel="noreferrer" className="mt-2 block break-all font-medium underline">
                            {inviteFeedback.link}
                          </a>
                        )}
                        {inviteFeedback.token && (
                          <p className="mt-2 break-all text-xs">Invitation Token: {inviteFeedback.token}</p>
                        )}
                      </div>
                    )}

                    {inviteError && (
                      <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        {inviteError}
                      </div>
                    )}

                    <form onSubmit={handleInviteSubmit} className="space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-neutral-700">Email Address</label>
                        <input
                          type="email"
                          value={inviteForm.email}
                          onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                          placeholder="user@example.com"
                          className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-semibold text-neutral-700">Role</label>
                        <select
                          value={inviteForm.role}
                          onChange={(e) => handleInviteRoleChange(e.target.value as AccessRole)}
                          className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="staff">Staff</option>
                          <option value="editor">Editor</option>
                          <option value="co_admin">Co Admin</option>
                          {(tenantContext?.role === "super_admin" || user?.role === "super_admin") && (
                            <option value="super_admin">Super Admin</option>
                          )}
                        </select>
                      </div>

                      {inviteForm.permissions.subscriptions_collect && (
                        <div>
                          <label className="mb-2 block text-sm font-semibold text-neutral-700">Collection Commission (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={inviteForm.commissionPercent}
                            onChange={(e) => setInviteForm((prev) => ({ ...prev, commissionPercent: e.target.value }))}
                            placeholder="10"
                            className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </div>
                      )}

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <label className="block text-sm font-semibold text-neutral-700">Permissions</label>
                          <span className="text-xs text-neutral-500">Role selection updates the default permission set.</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {PERMISSION_ITEMS.map((item) => (
                            <label key={item.key} className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-3 py-3 text-sm text-neutral-700">
                              <input
                                type="checkbox"
                                checked={inviteForm.permissions[item.key]}
                                onChange={(e) =>
                                  setInviteForm((prev) => ({
                                    ...prev,
                                    permissions: { ...prev.permissions, [item.key]: e.target.checked },
                                  }))
                                }
                                disabled={inviteForm.role === "super_admin"}
                                className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="font-medium">{item.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button type="submit" disabled={inviteSubmitting} className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {inviteSubmitting ? "Sending Invitation..." : "Send Invitation"}
                      </button>
                    </form>
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-neutral-900">{editingStaff ? "Edit Staff Member" : "Add Staff Member"}</h2>
                <p className="text-sm text-neutral-500">Employee information stays separate from login permissions.</p>
              </div>
              <button onClick={closeStaffModal} className="rounded-2xl p-2 text-neutral-500 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-700">Full Name</label>
                <input
                  type="text"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter full name"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-700">Phone Number</label>
                <input
                  type="tel"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-neutral-700">Role</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, role: e.target.value as AccessRole }))}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="staff">Staff</option>
                    <option value="editor">Editor</option>
                    <option value="co_admin">Co Admin</option>
                    {(tenantContext?.role === "super_admin" || user?.role === "super_admin") && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-neutral-700">Status</label>
                  <select
                    value={staffForm.status}
                    onChange={(e) => setStaffForm((prev) => ({ ...prev, status: e.target.value as Status }))}
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-700">Basic Salary</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={staffForm.basicSalary}
                  onChange={(e) => setStaffForm((prev) => ({ ...prev, basicSalary: e.target.value }))}
                  placeholder="Enter monthly salary"
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeStaffModal} className="flex-1 rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-200">
                  Cancel
                </button>
                <button type="submit" disabled={staffSubmitting} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {staffSubmitting ? "Saving..." : editingStaff ? "Update Staff" : "Create Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPermissionsModalOpen && editingUserRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-neutral-900">Edit User Access</h2>
                <p className="text-sm text-neutral-500">{editingUserRole.email}</p>
              </div>
              <button onClick={closePermissionsModal} className="rounded-2xl p-2 text-neutral-500 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-700">Role</label>
                <select
                  value={editingRole}
                  onChange={(e) => handleAccessRoleChange(e.target.value as AccessRole)}
                  className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="staff">Staff</option>
                  <option value="editor">Editor</option>
                  <option value="co_admin">Co Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label className="block text-sm font-semibold text-neutral-700">Permissions</label>
                  <span className="text-xs text-neutral-500">Permissions reset to the role default when the role changes.</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {PERMISSION_ITEMS.map((item) => (
                    <label key={item.key} className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-3 py-3 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={editingPermissions[item.key]}
                        onChange={(e) => setEditingPermissions((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                        disabled={editingRole === "super_admin"}
                        className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-medium">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {editingPermissions.subscriptions_collect && (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-neutral-700">Collection Commission (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={editingCommissionPercent}
                    onChange={(e) => setEditingCommissionPercent(e.target.value)}
                    placeholder="10"
                    className="w-full rounded-2xl border border-neutral-200 px-4 py-3 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={closePermissionsModal} className="flex-1 rounded-2xl bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-200">
                  Cancel
                </button>
                <button type="button" onClick={() => void savePermissions()} disabled={accessSubmitting} className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {accessSubmitting ? "Saving..." : "Save Access"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
