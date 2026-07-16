
"use client";

// Re-export everything from UnifiedAppProvider for backward compatibility
export {
  UnifiedAppProvider as CleanAuthProvider,
  useUnifiedApp,
  useAuth,
  useTenant,
} from "./UnifiedAppProvider";
