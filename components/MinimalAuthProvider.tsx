
"use client";

// Re-export everything from UnifiedAppProvider for backward compatibility
export {
  UnifiedAppProvider as MinimalAuthProvider,
  useUnifiedApp,
  useAuth,
  useTenant,
} from "./UnifiedAppProvider";
