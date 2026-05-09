import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

interface SearchFilters {
  gender?: string[];
  ageRange?: { min?: number; max?: number };
  birthYear?: { min?: number; max?: number };
  civilStatus?: string[];
  isMoulavi?: boolean;
  isNewMuslim?: boolean;
  isForeignResident?: boolean;
  hasSpecialNeeds?: boolean;
  hasHealthIssue?: boolean;
  familyIsWidowHead?: boolean;
}

interface SearchRequest {
  filters?: SearchFilters;
  pagination?: {
    page?: number;
    limit?: number;
  };
  masjidId?: string;
}

interface SearchResponse {
  success: boolean;
  data: {
    count: number;
    members: any[];
    families: any[];
  };
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
  appliedFilters: SearchFilters;
}

// Helper functions for DOB calculations
const calculateAgeRangeFromDob = (ageRange: { min?: number; max?: number }) => {
  const today = new Date();
  let oldestAllowedDob: Date | null = null;
  let youngestAllowedDob: Date | null = null;
  
  if (ageRange.max) {
    oldestAllowedDob = new Date(today.getFullYear() - ageRange.max, today.getMonth(), today.getDate());
  }
  
  if (ageRange.min) {
    youngestAllowedDob = new Date(today.getFullYear() - ageRange.min, today.getMonth(), today.getDate());
  }
  
  return { oldestAllowedDob, youngestAllowedDob };
};

const calculateDateRangeFromBirthYear = (birthYear: { min?: number; max?: number }) => {
  let minDob: Date | null = null;
  let maxDob: Date | null = null;
  
  if (birthYear.min) {
    minDob = new Date(birthYear.min, 0, 1);
  }
  
  if (birthYear.max) {
    maxDob = new Date(birthYear.max, 11, 31);
  }
  
  return { minDob, maxDob };
};

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    
    // Create admin client for user_roles lookup (bypasses RLS)
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body: SearchRequest = await request.json();
    const { filters = {}, pagination = {} } = body;
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;
    
    // Get bearer token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Use admin client for user_roles lookup (bypasses RLS)
    const { data: roleData, error: roleError } = await adminSupabase
  .from('user_roles')
  .select('masjid_id, role, email')
  .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
  .maybeSingle();

console.log('SEARCH ROLE LOOKUP:', {
  userId: user.id,
  email: user.email,
  roleData,
  roleError
});

if (roleError || !roleData?.masjid_id) {
  return NextResponse.json(
    { error: 'Masjid context not found' },
    { status: 403 }
  );
}

const resolvedMasjidId = roleData.masjid_id;

console.log('SEARCH RESOLVED MASJID:', {
  resolvedMasjidId
});

    // Build query with dynamic filters
    let query = supabase
      .from('members')
      .select(`
        id,
        name,
        relationship,
        dob,
        gender,
        civil_status,
        phone,
        education,
        occupation,
        is_moulavi,
        is_new_muslim,
        is_foreign_resident,
        foreign_country,
        foreign_contact,
        has_special_needs,
        special_needs_details,
        has_health_issue,
        health_details,
        family_id,
        families!inner (
          family_code,
          head_name,
          is_widow_head,
          address,
          phone as family_phone
        )
      `, { count: 'exact' })
      .eq('masjid_id', masjidId);

    // Apply filters dynamically
    if (filters.gender && filters.gender.length > 0) {
      query = query.in('gender', filters.gender);
    }

    // Age range filter using DOB
    if (filters.ageRange) {
      const { oldestAllowedDob, youngestAllowedDob } = calculateAgeRangeFromDob(filters.ageRange);
      
      if (oldestAllowedDob && youngestAllowedDob) {
        query = query.gte('dob', oldestAllowedDob.toISOString().split('T')[0])
                      .lte('dob', youngestAllowedDob.toISOString().split('T')[0]);
      } else if (oldestAllowedDob) {
        query = query.gte('dob', oldestAllowedDob.toISOString().split('T')[0]);
      } else if (youngestAllowedDob) {
        query = query.lte('dob', youngestAllowedDob.toISOString().split('T')[0]);
      }
    }

    // Birth year filter using DOB
    if (filters.birthYear) {
      const { minDob, maxDob } = calculateDateRangeFromBirthYear(filters.birthYear);
      
      if (minDob && maxDob) {
        query = query.gte('dob', minDob.toISOString().split('T')[0])
                      .lte('dob', maxDob.toISOString().split('T')[0]);
      } else if (minDob) {
        query = query.gte('dob', minDob.toISOString().split('T')[0]);
      } else if (maxDob) {
        query = query.lte('dob', maxDob.toISOString().split('T')[0]);
      }
    }

    // Civil status filter
    if (filters.civilStatus && filters.civilStatus.length > 0) {
      query = query.in('civil_status', filters.civilStatus);
    }

    // Boolean filters
    if (filters.isMoulavi !== undefined) {
      query = query.eq('is_moulavi', filters.isMoulavi);
    }

    if (filters.isNewMuslim !== undefined) {
      query = query.eq('is_new_muslim', filters.isNewMuslim);
    }

    if (filters.isForeignResident !== undefined) {
      query = query.eq('is_foreign_resident', filters.isForeignResident);
    }

    if (filters.hasSpecialNeeds !== undefined) {
      query = query.eq('has_special_needs', filters.hasSpecialNeeds);
    }

    if (filters.hasHealthIssue !== undefined) {
      query = query.eq('has_health_issue', filters.hasHealthIssue);
    }

    if (filters.familyIsWidowHead !== undefined) {
      query = query.eq('families.is_widow_head', filters.familyIsWidowHead);
    }

    // Apply pagination and ordering
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Search query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Extract families from nested data
    const families = new Map();
    const rows = (data || []) as any[];
    const members = rows.map(member => {
      const family = member.families;
      if (family && !families.has(family.family_code)) {
        families.set(family.family_code, family);
      }
      
      // Build member object without nested families
      return {
        id: member.id,
        name: member.name,
        relationship: member.relationship,
        dob: member.dob,
        gender: member.gender,
        civil_status: member.civil_status,
        phone: member.phone,
        education: member.education,
        occupation: member.occupation,
        is_moulavi: member.is_moulavi,
        is_new_muslim: member.is_new_muslim,
        is_foreign_resident: member.is_foreign_resident,
        foreign_country: member.foreign_country,
        foreign_contact: member.foreign_contact,
        has_special_needs: member.has_special_needs,
        special_needs_details: member.special_needs_details,
        has_health_issue: member.has_health_issue,
        health_details: member.health_details,
        family_id: member.family_id,
        family_code: family?.family_code || '',
        head_name: family?.head_name || '',
        address: family?.address || '',
        family_phone: family?.phone || ''
      };
    });

    const totalPages = Math.ceil((count || 0) / limit);

    const response: SearchResponse = {
      success: true,
      data: {
        count: count || 0,
        members,
        families: Array.from(families.values())
      },
      pagination: {
        page,
        limit,
        totalPages
      },
      appliedFilters: filters
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
