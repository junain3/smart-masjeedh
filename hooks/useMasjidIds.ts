import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Masjid = { id: string };

export function useMasjidIds() {
  const [masjids, setMasjids] = useState<Masjid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMasjids() {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('masjids').select('id');
        if (error) {
          console.error('Error fetching masjid ids:', error);
          setMasjids([]);
        } else {
          setMasjids(data || []);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        setMasjids([]);
      } finally {
        setLoading(false);
      }
    }

    fetchMasjids();
  }, []);

  return { masjids, loading };
}