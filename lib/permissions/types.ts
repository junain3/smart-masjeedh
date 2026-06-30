export type AppRole =
  | "admin"
  | "super_admin"
  | "co_admin"
  | "staff"
  | "editor"
  | string;

export type RoleGroup = "admin" | "staff";

export type ModulePermissionMap = {
  families: boolean;
  staff_management: boolean;
  subscriptions_collect: boolean;
  subscriptions_approve: boolean;
  accounts: boolean;
  reports: boolean;
  settings: boolean;
  events: boolean;
};

export type UIPermissions = {
  loading: boolean;
  role: AppRole | null;
  roleGroup: RoleGroup | null;
  masjidId: string | null;
  isAdmin: boolean;
  isStaff: boolean;
  isSuperAdmin: boolean;
  canViewDashboard: boolean;
  canViewFamilies: boolean;
  canViewStaff: boolean;
  canEditStaff: boolean;
  canViewSalary: boolean;
  canPaySalary: boolean;
  canViewAccounts: boolean;
  canManageAccounts: boolean;
  canViewCollections: boolean;
  canManageCollections: boolean;
  canApproveCollections: boolean;
  canViewReports: boolean;
  canManageSettings: boolean;
  canViewEvents: boolean;
  canManageUserAccess: boolean;
  canInviteUsers: boolean;
  rawPermissions: ModulePermissionMap;
};
