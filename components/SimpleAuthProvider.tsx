
"use client";

// Re-export everything from UnifiedAppProvider for backward compatibility
export {
  UnifiedAppProvider as SimpleAuthProvider,
  useUnifiedApp,
  useAuth,
  useTenant,
} from "./UnifiedAppProvider";
