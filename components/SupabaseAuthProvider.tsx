
"use client";

// Re-export everything from UnifiedAppProvider for backward compatibility
export {
  UnifiedAppProvider as SupabaseAuthProvider,
  useUnifiedApp,
  useAuth,
  useTenant,
  useUnifiedApp as useSupabaseAuth,
} from "./UnifiedAppProvider";
