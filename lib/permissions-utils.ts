// Permission utilities for Smart Masjeedh system

export interface UserPermissions {
  all?: boolean;
  families?: boolean;
  staff_management?: boolean;
  subscriptions_collect?: boolean;
  subscriptions_approve?: boolean;
  accounts?: boolean;
  reports?: boolean;
  settings?: boolean;
  events?: boolean;
}

export interface ModulePermissions {
  families: boolean;
  staff_management: boolean;
  subscriptions_collect: boolean;
  subscriptions_approve: boolean;
  accounts: boolean;
  reports: boolean;
  settings: boolean;
  events: boolean;
}

/**
 * Parse permissions from database and normalize them
 * Supports both JSON string and Record<string, boolean> formats
 */
export function parsePermissions(permissions: string | Record<string, boolean> | null): ModulePermissions {
  if (!permissions) {
    return {
      families: false,
      staff_management: false,
      subscriptions_collect: false,
      subscriptions_approve: false,
      accounts: false,
      reports: false,
      settings: false,
      events: false
    };
  }

  let parsed: any;
  try {
    if (typeof permissions === 'string') {
      parsed = JSON.parse(permissions);
    } else {
      parsed = permissions;
    }
  } catch (error) {
    console.error('Error parsing permissions:', error);
    return {
      families: false,
      staff_management: false,
      subscriptions_collect: false,
      subscriptions_approve: false,
      accounts: false,
      reports: false,
      settings: false,
      events: false
    };
  }
  
  // If all is true, grant all permissions
  if (parsed.all === true) {
    return {
      families: true,
      staff_management: true,
      subscriptions_collect: true,
      subscriptions_approve: true,
      accounts: true,
      reports: true,
      settings: true,
      events: true
    };
  }
  
  // Otherwise, use specific permissions
  return {
    families: parsed.families || false,
    staff_management: parsed.staff_management || false,
    subscriptions_collect: parsed.subscriptions_collect || false,
    subscriptions_approve: parsed.subscriptions_approve || false,
    accounts: parsed.accounts || false,
    reports: parsed.reports || false,
    settings: parsed.settings || false,
    events: parsed.events || false
  };
}

/**
 * Check if user has access to a specific module
 */
export function hasModulePermission(
  permissions: ModulePermissions, 
  module: keyof ModulePermissions
): boolean {
  return permissions[module] === true;
}

/**
 * Check if user is Super Admin (has all permissions)
 */
export function isSuperAdmin(permissions: ModulePermissions): boolean {
  return Object.values(permissions).every(permission => permission === true);
}

/**
 * Get permission label for display
 */
export function getPermissionLabel(key: string): string {
  const labels: Record<string, string> = {
    families: "Families",
    staff_management: "Staff Management", 
    subscriptions_collect: "Subscription Collection",
    subscriptions_approve: "Subscription Approval",
    accounts: "Accounts",
    reports: "Reports",
    settings: "Settings",
    events: "Events",
    all: "Super Admin"
  };
  return labels[key] || key;
}

/**
 * Get all available modules for permission management
 */
export function getAllModules(): Array<{key: keyof ModulePermissions, label: string}> {
  return [
    { key: 'families', label: 'Families' },
    { key: 'staff_management', label: 'Staff Management' },
    { key: 'subscriptions_collect', label: 'Subscription Collection' },
    { key: 'subscriptions_approve', label: 'Subscription Approval' },
    { key: 'accounts', label: 'Accounts' },
    { key: 'reports', label: 'Reports' },
    { key: 'settings', label: 'Settings' },
    { key: 'events', label: 'Events' }
  ];
}
