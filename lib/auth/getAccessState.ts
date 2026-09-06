import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export interface AccessState {
  hasAccess: boolean;
  reason?: 'deleted' | 'no_user_role' | 'masjid_deleted' | 'active';
  userId?: string;
  masjidId?: string;
  deletedBy?: string;
  deletedReason?: string;
  deletedAt?: string;
}

/**
 * Server-side access state check using Supabase admin client
 * Checks if user has active access based on user_roles and masjids status
 */
export async function getAccessState(): Promise<AccessState> {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { hasAccess: false, reason: 'no_user_role' };
  }

  // Check user_roles status with deletion metadata
  const { data: userRole, error: roleError } = await supabase
    .from('user_roles')
    .select('masjid_id, status, deleted_at, deleted_by, deleted_reason')
    .eq('auth_user_id', user.id)
    .single();

  if (roleError || !userRole) {
    return { hasAccess: false, reason: 'no_user_role', userId: user.id };
  }

  // Check if user role is deleted
  if (userRole.status === 'deleted') {
    return { 
      hasAccess: false, 
      reason: 'deleted', 
      userId: user.id, 
      masjidId: userRole.masjid_id,
      deletedBy: userRole.deleted_by || undefined,
      deletedReason: userRole.deleted_reason || undefined,
      deletedAt: userRole.deleted_at || undefined
    };
  }

  // Check if masjid is deleted with deletion metadata
  const { data: masjid, error: masjidError } = await supabase
    .from('masjids')
    .select('status, deleted_at, deleted_by, deleted_reason')
    .eq('id', userRole.masjid_id)
    .single();

  if (masjidError || !masjid) {
    return { hasAccess: false, reason: 'masjid_deleted', userId: user.id, masjidId: userRole.masjid_id };
  }

  if (masjid.status === 'deleted') {
    return { 
      hasAccess: false, 
      reason: 'masjid_deleted', 
      userId: user.id, 
      masjidId: userRole.masjid_id,
      deletedBy: masjid.deleted_by || undefined,
      deletedReason: masjid.deleted_reason || undefined,
      deletedAt: masjid.deleted_at || undefined
    };
  }

  return { 
    hasAccess: true, 
    reason: 'active', 
    userId: user.id, 
    masjidId: userRole.masjid_id 
  };
}
