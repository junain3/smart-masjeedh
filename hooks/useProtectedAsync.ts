"use client";

import { useState, useCallback, useRef } from "react";

interface UseProtectedAsyncOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  onFinally?: () => void;
  timeoutMs?: number;
}

/**
 * A hook for protected async operations that ensures loading states
 * are always released and operations don't get stuck in infinite loading.
 * 
 * Features:
 * - Automatic loading state management with try/catch/finally
 * - Timeout protection to prevent infinite loading
 * - Stale operation detection (ignores results if component unmounted)
 * - Optimistic state preservation (doesn't overwrite on error)
 * 
 * @param options Configuration options for the protected operation
 */
export function useProtectedAsync(options: UseProtectedAsyncOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);
  const operationIdRef = useRef(0);

  const {
    onSuccess,
    onError,
    onFinally,
    timeoutMs = 30000, // Default 30 second timeout
  } = options;

  const execute = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      operationName: string = "async operation"
    ): Promise<T | null> => {
      const currentOperationId = ++operationIdRef.current;
      
      // Reset error state
      setError(null);
      setIsLoading(true);

      // Set up timeout
      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Operation "${operationName}" timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      try {
        // Race between the operation and the timeout
        const result = await Promise.race([operation(), timeoutPromise]);

        // Clear timeout
        clearTimeout(timeoutHandle);

        // Check if this is still the current operation (not stale)
        if (!isMountedRef.current || currentOperationId !== operationIdRef.current) {
          console.log(`[useProtectedAsync] Ignoring stale result from "${operationName}"`);
          return null;
        }

        // Success callback
        if (onSuccess) {
          onSuccess(result);
        }

        setError(null);
        return result;
      } catch (err) {
        // Clear timeout
        clearTimeout(timeoutHandle);

        // Check if this is still the current operation
        if (!isMountedRef.current || currentOperationId !== operationIdRef.current) {
          console.log(`[useProtectedAsync] Ignoring stale error from "${operationName}"`);
          return null;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        console.error(`[useProtectedAsync] Operation "${operationName}" failed:`, error);

        // Error callback
        if (onError) {
          onError(error);
        }

        setError(error);
        return null;
      } finally {
        // Always release loading state
        if (isMountedRef.current && currentOperationId === operationIdRef.current) {
          setIsLoading(false);
        }

        // Finally callback
        if (onFinally) {
          onFinally();
        }
      }
    },
    [onSuccess, onError, onFinally, timeoutMs]
  );

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    isMountedRef.current = false;
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    error,
    execute,
    cleanup,
  };
}

/**
 * A simpler version for basic protected operations without callbacks
 */
export function useSimpleProtectedAsync() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const isMountedRef = useRef(true);

  const execute = useCallback(
    async <T,>(operation: () => Promise<T>, timeoutMs: number = 30000): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      try {
        const result = await Promise.race([operation(), timeoutPromise]);
        clearTimeout(timeoutHandle);
        
        if (!isMountedRef.current) {
          return null;
        }

        setError(null);
        return result;
      } catch (err) {
        clearTimeout(timeoutHandle);
        
        if (!isMountedRef.current) {
          return null;
        }

        const error = err instanceof Error ? err : new Error(String(err));
        console.error("[useSimpleProtectedAsync] Operation failed:", error);
        setError(error);
        return null;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  return {
    isLoading,
    error,
    execute,
  };
}
