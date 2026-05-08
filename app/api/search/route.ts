import { createClient } from '@/utils/supabase/server';
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
    
    const body: SearchRequest = await request.json();
    const { filters = {}, pagination = {} } = body;
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;
    
    // Check if frontend provided masjidId
    const frontendMasjidId = body.masjidId;
    console.log('SEARCH FRONTEND DEBUG:', { frontendMasjidId });

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

    // Get user's masjid_id from user_roles - support auth_user_id, user_id, and email
    console.log('SEARCH USER DEBUG:', { userId: user.id, userEmail: user.email });
    
    let masjidId: string;
    let foundRole: any = null;
    
    // If frontend provided masjidId, verify user has access to it
    if (frontendMasjidId) {
      console.log('SEARCH USER DEBUG: Verifying frontend masjidId...');
      const { data: verification, error: verifyError } = await supabase
        .from('user_roles')
        .select('masjid_id')
        .or(`auth_user_id.eq.${user.id},user_id.eq.${user.id},email.eq.${user.email}`)
        .eq('masjid_id', frontendMasjidId)
        .maybeSingle();
        
      if (verification?.masjid_id) {
        masjidId = frontendMasjidId;
        foundRole = verification;
        console.log('SEARCH USER DEBUG: Frontend masjidId verified');
      } else {
        return NextResponse.json({ error: 'Invalid masjid context' }, { status: 403 });
      }
    } else {
      // Try auth_user_id first (most common pattern)
      let { data: userData, error: userError } = await supabase
        .from('user_roles')
        .select('masjid_id, role, email, verified, status')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (userData?.masjid_id) {
        foundRole = userData;
        console.log('SEARCH USER DEBUG: Found role via auth_user_id');
      }

      // If not found, try user_id (admin pattern)
      if (!foundRole) {
        console.log('SEARCH USER DEBUG: Trying user_id field...');
        const result = await supabase
          .from('user_roles')
          .select('masjid_id, role, email, verified, status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (result.data?.masjid_id) {
          foundRole = result.data;
          console.log('SEARCH USER DEBUG: Found role via user_id');
        }
      }

      // If still not found, try email with verified and status conditions
      if (!foundRole && user.email) {
        console.log('SEARCH USER DEBUG: Trying email lookup...');
        const emailResult = await supabase
          .from('user_roles')
          .select('masjid_id, role, email, verified, status')
          .eq('email', user.email)
          .eq('verified', true)
          .eq('status', 'active')
          .maybeSingle();
        if (emailResult.data?.masjid_id) {
          foundRole = emailResult.data;
          console.log('SEARCH USER DEBUG: Found role via email');
        }
      }

      if (!foundRole?.masjid_id) {
        return NextResponse.json({ error: 'Masjid context not found' }, { status: 400 });
      }
      
      masjidId = foundRole.masjid_id;
    }

    console.log('SEARCH USER DEBUG:', { 
      userId: user.id, 
      userEmail: user.email,
      finalMasjidId: masjidId,
      frontendMasjidId,
      foundRole: {
        masjid_id: foundRole?.masjid_id,
        role: foundRole?.role,
        email: foundRole?.email,
        verified: foundRole?.verified,
        status: foundRole?.status
      }
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
