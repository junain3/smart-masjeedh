import useSWR, { SWRConfiguration, mutate } from 'swr';
import { supabase } from './supabase';

export const useSupabaseSWR = <T = any>(
  key: string | null | false,
  fetcher: () => Promise<T>,
  config?: SWRConfiguration<T>
) => {
  const { data, error, isLoading, mutate: swrMutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    ...config,
  });

  return {
    data,
    error,
    isLoading,
    mutate: swrMutate,
  };
};

// Helper to mutate all keys related to a specific prefix
export const mutateSupabaseKeys = (prefix: string) => {
  mutate(key => {
    if (typeof key === 'string') {
      return key.startsWith(prefix);
    }
    return false;
  });
};
