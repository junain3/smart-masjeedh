'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { parsePermissions, hasModulePermission, isSuperAdmin, ModulePermissions } from '@/lib/permissions-utils';
import { useSupabaseAuth } from '@/components/SupabaseAuthProvider';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredPermission?: keyof any;
  requireSuperAdmin?: boolean;
  fallback?: React.ReactNode;
}

export default function RouteGuard({ 
  children, 
  requiredPermission, 
  requireSuperAdmin = false,
  fallback = <div>No access</div>
}: RouteGuardProps) {
  const { user, loading: authLoading, tenantContext } = useSupabaseAuth();
  const router = useRouter();

  // Parse permissions
  const parsedPermissions = parsePermissions(tenantContext?.permissions || null);
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);

  // Show loading during auth
  if (authLoading) {
    return <div>Loading...</div>;
  }

  // Redirect if not authenticated
  if (!user) {
    router.push('/login');
    return null;
  }

  // Check super admin requirement
  if (requireSuperAdmin && !userIsSuperAdmin) {
    return fallback;
  }

  // Check specific permission requirement
  if (requiredPermission && !hasModulePermission(parsedPermissions, requiredPermission as keyof ModulePermissions)) {
    return fallback;
  }

  // Allow access
  return <>{children}</>;
}

// Hook for checking permissions programmatically
export function usePermissions() {
  const { tenantContext } = useSupabaseAuth();
  const parsedPermissions = parsePermissions(tenantContext?.permissions || null);
  const userIsSuperAdmin = isSuperAdmin(parsedPermissions);

  return {
    permissions: parsedPermissions,
    isSuperAdmin: userIsSuperAdmin,
    hasPermission: (permission: keyof any) => hasModulePermission(parsedPermissions, permission as keyof ModulePermissions),
    canAccess: (permission?: keyof any, requireSuper?: boolean) => {
      if (requireSuper && !userIsSuperAdmin) return false;
      if (permission && !hasModulePermission(parsedPermissions, permission as keyof ModulePermissions)) return false;
      return true;
    }
  };
}
