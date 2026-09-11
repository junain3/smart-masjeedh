import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { parseNaturalLanguageQuery, extractFreeTextFromSmartQuery } from '@/lib/natural-language-parser';
import { correctQueryTypos } from '@/lib/fuzzy-match';

interface SmartSearchRequest {
  query: string;
  masjidId?: string;
  limit?: number;
}

interface SmartSearchResponse {
  success: boolean;
  isSmartQuery: boolean;
  data: {
    members: any[];
    families: any[];
    count: number;
  };
  appliedFilters: any;
  originalQuery: string;
  correctedQuery?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    
    // Create admin client for user_roles lookup (bypasses RLS)
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const body: SmartSearchRequest = await request.json();
    const { query, limit = 50 } = body;
    
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

    if (roleError || !roleData?.masjid_id) {
      return NextResponse.json(
        { error: 'Masjid context not found' },
        { status: 403 }
      );
    }

    const masjidId = body.masjidId || roleData.masjid_id;

    // Apply typo correction
    const correctedQuery = correctQueryTypos(query);
    
    // Parse natural language query
    const parsed = parseNaturalLanguageQuery(correctedQuery);
    
    console.log('SMART SEARCH:', {
      originalQuery: query,
      correctedQuery,
      filters: parsed.filters,
      isSmartQuery: parsed.isSmartQuery
    });

    // Extract any remaining free text for additional filtering
    const freeText = extractFreeTextFromSmartQuery(correctedQuery);

    // Build query with smart filters
    let memberQuery = supabase
      .from('members')
      .select(`
        id,
        name,
        relationship,
        dob,
        age,
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
        masjid_id,
        family_id,
        families!inner (
          family_code,
          head_name,
          is_widow_head,
          address,
          family_phone:phone,
          masjid_id
        )
      `, { count: 'exact' })
      .eq('masjid_id', masjidId)
      .not('status', 'in', '("Moved Out","Left","Deceased","Inactive","Transferred")');

    // Apply smart filters
    if (parsed.filters.gender && parsed.filters.gender.length > 0) {
      memberQuery = memberQuery.in('gender', parsed.filters.gender);
    }

    if (parsed.filters.ageRange) {
      if (parsed.filters.ageRange.min !== undefined) {
        memberQuery = memberQuery.gte('age', parsed.filters.ageRange.min);
      }
      if (parsed.filters.ageRange.max !== undefined) {
        memberQuery = memberQuery.lte('age', parsed.filters.ageRange.max);
      }
    }

    if (parsed.filters.isMoulavi !== undefined) {
      memberQuery = memberQuery.eq('is_moulavi', parsed.filters.isMoulavi);
    }

    if (parsed.filters.isNewMuslim !== undefined) {
      memberQuery = memberQuery.eq('is_new_muslim', parsed.filters.isNewMuslim);
    }

    if (parsed.filters.isForeignResident !== undefined) {
      memberQuery = memberQuery.eq('is_foreign_resident', parsed.filters.isForeignResident);
    }

    if (parsed.filters.hasSpecialNeeds !== undefined) {
      memberQuery = memberQuery.eq('has_special_needs', parsed.filters.hasSpecialNeeds);
    }

    if (parsed.filters.hasHealthIssue !== undefined) {
      memberQuery = memberQuery.eq('has_health_issue', parsed.filters.hasHealthIssue);
    }

    if (parsed.filters.familyIsWidowHead !== undefined) {
      memberQuery = memberQuery.eq('families.is_widow_head', parsed.filters.familyIsWidowHead);
    }

    // Vehicle filtering - need to query families table for vehicle ownership
    if (parsed.filters.hasVehicle) {
      // This requires a separate query or RPC since vehicle info is in families table
      // For now, we'll note this limitation
      console.log('Vehicle filter requested - requires families table query');
    }

    // Apply free text search if any remaining text (always apply for any non-empty text)
    if (freeText && freeText.length > 0) {
      memberQuery = memberQuery.or(
        `name.ilike.%${freeText}%,phone.ilike.%${freeText}%,nic.ilike.%${freeText}%`
      );
    }

    // Apply ordering and limit
    memberQuery = memberQuery
      .order('name', { ascending: true })
      .range(0, limit - 1);

    // Execute query
    const { data: memberData, error: memberError, count } = await memberQuery as any;

    if (memberError) {
      console.error('Smart search query error:', memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    // Extract families from nested data
    const families = new Map();
    const members = (memberData || []).map((member: any) => {
      const family = member.families;
      if (family && !families.has(family.family_code)) {
        families.set(family.family_code, family);
      }
      
      return {
        id: member.id,
        name: member.name,
        relationship: member.relationship,
        dob: member.dob,
        age: member.age,
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
        masjid_id: member.masjid_id,
        family_id: member.family_id,
        family_code: family?.family_code,
        family_head_name: family?.head_name,
        family_is_widow_head: family?.is_widow_head,
        family_address: family?.address,
        family_phone: family?.family_phone
      };
    });

    const response: SmartSearchResponse = {
      success: true,
      isSmartQuery: true, // Always true now since we search for all queries
      data: {
        members,
        families: Array.from(families.values()),
        count: count || 0
      },
      appliedFilters: parsed.filters,
      originalQuery: query,
      correctedQuery: correctedQuery !== query ? correctedQuery : undefined
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Smart search API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
