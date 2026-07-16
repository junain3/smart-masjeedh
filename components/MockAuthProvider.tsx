
"use client";

// Re-export everything from UnifiedAppProvider for backward compatibility
export {
  UnifiedAppProvider as MockAuthProvider,
  useUnifiedApp,
  useAuth,
  useTenant,
  useUnifiedApp as useMockAuth,
} from "./UnifiedAppProvider";
