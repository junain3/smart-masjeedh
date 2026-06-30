"use client";

import { useMemo } from "react";
import { useSupabaseAuth } from "@/components/SupabaseAuthProvider";
import { deriveUIPermissions } from "@/lib/permissions";

export function usePermissions() {
  const { tenantContext, loading } = useSupabaseAuth();

  return useMemo(() => {
    return deriveUIPermissions(tenantContext, loading);
  }, [tenantContext, loading]);
}
