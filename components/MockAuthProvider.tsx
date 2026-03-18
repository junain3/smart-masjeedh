"use client";

// Backward compatibility bridge over SupabaseAuthProvider
export { useSupabaseAuth as useMockAuth } from "./SupabaseAuthProvider";
export { SupabaseAuthProvider as MockAuthProvider } from "./SupabaseAuthProvider";
