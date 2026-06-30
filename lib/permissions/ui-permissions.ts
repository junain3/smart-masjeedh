import { isSuperAdmin, parsePermissions } from "@/lib/permissions-utils";
import type { ModulePermissionMap, UIPermissions, AppRole, RoleGroup } from "@/lib/permissions/types";

type TenantLikeContext = {
  masjidId?: string | null;
  role?: AppRole | null;
  permissions?: string | Record<string, boolean> | null;
} | null;

function getRoleGroup(role: AppRole | null): RoleGroup | null {
  if (!role) return null;
  return role === "admin" || role === "super_admin" || role === "co_admin" ? "admin" : "staff";
}

function emptyPermissions(): ModulePermissionMap {
  return parsePermissions(null);
}

export function deriveUIPermissions(
  tenantContext: TenantLikeContext,
  loading = false
): UIPermissions {
  const rawPermissions = parsePermissions(tenantContext?.permissions || null);
  const role = tenantContext?.role || null;
  const roleGroup = getRoleGroup(role);
  const superAdmin = isSuperAdmin(rawPermissions) || role === "super_admin";
  const admin = superAdmin || roleGroup === "admin";
  const masjidId = tenantContext?.masjidId || null;

  if (!tenantContext) {
    return {
      loading,
      role: null,
      roleGroup: null,
      masjidId: null,
      isAdmin: false,
      isStaff: false,
      isSuperAdmin: false,
      canViewDashboard: false,
      canViewFamilies: false,
      canViewStaff: false,
      canEditStaff: false,
      canViewSalary: false,
      canPaySalary: false,
      canViewAccounts: false,
      canManageAccounts: false,
      canViewCollections: false,
      canManageCollections: false,
      canApproveCollections: false,
      canViewReports: false,
      canManageSettings: false,
      canViewEvents: false,
      canManageUserAccess: false,
      canInviteUsers: false,
      rawPermissions: emptyPermissions(),
    };
  }

  return {
    loading,
    role,
    roleGroup,
    masjidId,
    isAdmin: admin,
    isStaff: roleGroup === "staff",
    isSuperAdmin: superAdmin,
    canViewDashboard: true,
    canViewFamilies: admin || rawPermissions.families,
    canViewStaff: admin || rawPermissions.staff_management,
    canEditStaff: admin || rawPermissions.staff_management,
    canViewSalary: admin || rawPermissions.staff_management || rawPermissions.accounts,
    canPaySalary: admin || rawPermissions.staff_management || rawPermissions.accounts,
    canViewAccounts: admin || rawPermissions.accounts,
    canManageAccounts: admin || rawPermissions.accounts,
    canViewCollections:
      admin || rawPermissions.subscriptions_collect || rawPermissions.subscriptions_approve,
    canManageCollections: admin || rawPermissions.subscriptions_collect,
    canApproveCollections: admin || rawPermissions.subscriptions_approve,
    canViewReports: admin || rawPermissions.reports,
    canManageSettings: admin || rawPermissions.settings,
    canViewEvents: admin || rawPermissions.events,
    canManageUserAccess: admin,
    canInviteUsers: admin,
    rawPermissions,
  };
}
