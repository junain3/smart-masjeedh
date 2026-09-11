/**
 * Natural Language Parser for Smart Search
 * Parses natural language queries into structured search filters
 * Non-destructive: only activates for recognized patterns, falls back to existing search
 */

export interface ParsedSmartQuery {
  isSmartQuery: boolean;
  filters: {
    gender?: string[];
    ageRange?: { min?: number; max?: number };
    isMoulavi?: boolean;
    isNewMuslim?: boolean;
    isForeignResident?: boolean;
    hasSpecialNeeds?: boolean;
    hasHealthIssue?: boolean;
    familyIsWidowHead?: boolean;
    hasVehicle?: boolean;
    vehicleType?: string[];
  };
  fallbackQuery?: string;
}

/**
 * Parse natural language query into structured filters
 * Returns isSmartQuery: false if no patterns recognized (fallback to existing search)
 */
export function parseNaturalLanguageQuery(query: string): ParsedSmartQuery {
  const trimmed = query.trim().toLowerCase();
  const filters: ParsedSmartQuery['filters'] = {};
  let hasSmartPattern = false;

  // Pattern 1: "Widows" or "Widow" - familyIsWidowHead
  if (trimmed.includes('widow') || trimmed.includes('widows')) {
    filters.familyIsWidowHead = true;
    hasSmartPattern = true;
  }

  // Pattern 2: "Moulavi" or "Moulavis" - isMoulavi
  if (trimmed.includes('moulavi') || trimmed.includes('moulavis')) {
    filters.isMoulavi = true;
    hasSmartPattern = true;
  }

  // Pattern 3: "New Muslim" or "New Muslims" - isNewMuslim
  if (trimmed.includes('new muslim') || trimmed.includes('new muslims')) {
    filters.isNewMuslim = true;
    hasSmartPattern = true;
  }

  // Pattern 4: "Foreign" or "Foreign Resident" - isForeignResident
  if (trimmed.includes('foreign') || trimmed.includes('foreign resident')) {
    filters.isForeignResident = true;
    hasSmartPattern = true;
  }

  // Pattern 5: "Special Needs" - hasSpecialNeeds
  if (trimmed.includes('special needs') || trimmed.includes('special need')) {
    filters.hasSpecialNeeds = true;
    hasSmartPattern = true;
  }

  // Pattern 6: "Health Issues" or "Health Problem" - hasHealthIssue
  if (trimmed.includes('health issue') || trimmed.includes('health problem') || trimmed.includes('sick') || trimmed.includes('ill')) {
    filters.hasHealthIssue = true;
    hasSmartPattern = true;
  }

  // Pattern 7: Vehicle ownership
  if (trimmed.includes('vehicle') || trimmed.includes('car') || trimmed.includes('bike') || trimmed.includes('van') || trimmed.includes('lorry') || trimmed.includes('tractor')) {
    filters.hasVehicle = true;
    hasSmartPattern = true;

    // Specific vehicle types
    const vehicleTypes: string[] = [];
    if (trimmed.includes('car')) vehicleTypes.push('car');
    if (trimmed.includes('bike') || trimmed.includes('motorcycle')) vehicleTypes.push('bike');
    if (trimmed.includes('van')) vehicleTypes.push('van');
    if (trimmed.includes('lorry') || trimmed.includes('truck')) vehicleTypes.push('lorry');
    if (trimmed.includes('tractor')) vehicleTypes.push('tractor');
    if (trimmed.includes('three wheeler') || trimmed.includes('three-wheeler') || trimmed.includes('auto')) vehicleTypes.push('three_wheeler');

    if (vehicleTypes.length > 0) {
      filters.vehicleType = vehicleTypes;
    }
  }

  // Pattern 8: Gender - "Male", "Female", "Men", "Women", "Boys", "Girls"
  if (trimmed.includes('male') || trimmed.includes('men') || trimmed.includes('boy')) {
    filters.gender = ['Male'];
    hasSmartPattern = true;
  }
  if (trimmed.includes('female') || trimmed.includes('women') || trimmed.includes('girl')) {
    filters.gender = ['Female'];
    hasSmartPattern = true;
  }

  // Pattern 9: Age patterns - "under 30", "above 25", "between 20 and 40", "30 years old"
  const ageUnderMatch = trimmed.match(/under\s+(\d+)/);
  if (ageUnderMatch) {
    const maxAge = parseInt(ageUnderMatch[1]);
    filters.ageRange = { max: maxAge };
    hasSmartPattern = true;
  }

  const ageAboveMatch = trimmed.match(/above\s+(\d+)/) || trimmed.match(/over\s+(\d+)/) || trimmed.match(/older than\s+(\d+)/);
  if (ageAboveMatch) {
    const minAge = parseInt(ageAboveMatch[1]);
    filters.ageRange = { ...filters.ageRange, min: minAge };
    hasSmartPattern = true;
  }

  const ageBetweenMatch = trimmed.match(/between\s+(\d+)\s+and\s+(\d+)/);
  if (ageBetweenMatch) {
    const minAge = parseInt(ageBetweenMatch[1]);
    const maxAge = parseInt(ageBetweenMatch[2]);
    filters.ageRange = { min: minAge, max: maxAge };
    hasSmartPattern = true;
  }

  const ageExactMatch = trimmed.match(/(\d+)\s+years?\s+old/) || trimmed.match(/age\s+(\d+)/);
  if (ageExactMatch) {
    const age = parseInt(ageExactMatch[1]);
    filters.ageRange = { min: age, max: age };
    hasSmartPattern = true;
  }

  // If no smart patterns detected, return fallback to existing search
  if (!hasSmartPattern) {
    return {
      isSmartQuery: false,
      filters: {},
      fallbackQuery: query
    };
  }

  return {
    isSmartQuery: true,
    filters,
    fallbackQuery: hasSmartPattern ? undefined : query
  };
}

/**
 * Check if query should use smart search vs existing search
 * Smart search is opt-in: only activates if patterns are recognized
 */
export function shouldUseSmartSearch(query: string): boolean {
  const parsed = parseNaturalLanguageQuery(query);
  console.log('[shouldUseSmartSearch] query:', query, 'isSmartQuery:', parsed.isSmartQuery, 'filters:', parsed.filters);
  return parsed.isSmartQuery;
}

/**
 * Extract any remaining free text from smart query for additional filtering
 */
export function extractFreeTextFromSmartQuery(query: string): string {
  const trimmed = query.trim().toLowerCase();
  
  // Remove known smart patterns to get remaining text
  let remaining = trimmed
    .replace(/widow(s)?/gi, '')
    .replace(/moulavi(s)?/gi, '')
    .replace(/new muslim(s)?/gi, '')
    .replace(/foreign resident(s)?/gi, '')
    .replace(/foreign/gi, '')
    .replace(/special need(s)?/gi, '')
    .replace(/health issue(s)?/gi, '')
    .replace(/health problem/gi, '')
    .replace(/sick/gi, '')
    .replace(/ill/gi, '')
    .replace(/vehicle(s)?/gi, '')
    .replace(/car(s)?/gi, '')
    .replace(/bike(s)?/gi, '')
    .replace(/van(s)?/gi, '')
    .replace(/lorry/gi, '')
    .replace(/truck/gi, '')
    .replace(/tractor/gi, '')
    .replace(/three wheeler/gi, '')
    .replace(/three-wheeler/gi, '')
    .replace(/auto/gi, '')
    .replace(/male|men|boy/gi, '')
    .replace(/female|women|girl/gi, '')
    .replace(/under\s+\d+/gi, '')
    .replace(/above\s+\d+/gi, '')
    .replace(/over\s+\d+/gi, '')
    .replace(/older than\s+\d+/gi, '')
    .replace(/between\s+\d+\s+and\s+\d+/gi, '')
    .replace(/\d+\s+years?\s+old/gi, '')
    .replace(/age\s+\d+/gi, '')
    .trim();

  return remaining;
}
