
"use client";

// Re-export everything from UnifiedAppProvider for backward compatibility
export {
  UnifiedAppProvider as AuthProvider,
  useUnifiedApp,
  useAuth,
  useTenant,
} from "./UnifiedAppProvider";
