/**
 * Fuzzy matching utilities for typo tolerance in search
 * Provides simple similarity scoring and string matching
 */

/**
 * Calculate Levenshtein distance between two strings
 * Measures minimum number of single-character edits to change one string to another
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(
          dp[i - 1][j],    // deletion
          dp[i][j - 1],    // insertion
          dp[i - 1][j - 1] // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0 to 1)
 * 1 = exact match, 0 = completely different
 */
export function similarityScore(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);
  
  if (maxLength === 0) return 1;
  return 1 - (distance / maxLength);
}

/**
 * Check if two strings are similar enough (threshold-based)
 * Default threshold: 0.7 (70% similarity)
 */
export function isSimilar(str1: string, str2: string, threshold: number = 0.7): boolean {
  return similarityScore(str1, str2) >= threshold;
}

/**
 * Find best match from a list of candidates
 * Returns the candidate with highest similarity score above threshold
 */
export function findBestMatch(query: string, candidates: string[], threshold: number = 0.7): string | null {
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = similarityScore(query, candidate);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/**
 * Common typo corrections for search terms
 */
export const TYPO_CORRECTIONS: Record<string, string> = {
  'gels': 'girls',
  'gurl': 'girl',
  'gurls': 'girls',
  'gril': 'girl',
  'grils': 'girls',
  'boi': 'boy',
  'bois': 'boys',
  'men': 'men',
  'man': 'man',
  'wimen': 'women',
  'wman': 'woman',
  'wmn': 'women',
  'widow': 'widow',
  'widows': 'widows',
  'moulavi': 'moulavi',
  'moulavis': 'moulavi',
  'muslim': 'muslim',
  'muslims': 'muslim',
  'vehical': 'vehicle',
  'vechicle': 'vehicle',
  'vechile': 'vehicle',
  'studant': 'student',
  'studen': 'student',
  'studnt': 'student',
  'stdent': 'student',
  'stuent': 'student',
  'techer': 'teacher',
  'teachr': 'teacher',
  'teacer': 'teacher',
  'docter': 'doctor',
  'doctr': 'doctor',
  'docotr': 'doctor',
  'enginer': 'engineer',
  'enginr': 'engineer',
  'enginerr': 'engineer',
  'famly': 'family',
  'famil': 'family',
  'famili': 'family',
  'membr': 'member',
  'memb': 'member',
  'memebr': 'member',
  'peple': 'people',
  'peopl': 'people',
  'pepole': 'people',
  'childrn': 'children',
  'chidren': 'children',
  'childern': 'children',
  'adres': 'address',
  'adress': 'address',
  'addres': 'address',
  'phne': 'phone',
  'phon': 'phone',
  'phoen': 'phone',
  'numbr': 'number',
  'nmber': 'number',
  'numberr': 'number',
  'car': 'car',
  'cars': 'car',
  'bike': 'bike',
  'bikes': 'bike',
  'van': 'van',
  'vans': 'van',
  'lorry': 'lorry',
  'lorries': 'lorry',
  'truck': 'lorry',
  'trucks': 'lorry',
  'tractor': 'tractor',
  'tractors': 'tractor',
  'special': 'special',
  'needs': 'needs',
  'health': 'health',
  'issue': 'issue',
  'issues': 'issue',
  'problem': 'problem',
  'problems': 'problem',
  'sick': 'sick',
  'ill': 'ill',
  'foreign': 'foreign',
  'resident': 'resident',
  'residents': 'resident',
};

/**
 * Apply typo correction to a query term
 */
export function correctTypo(term: string): string {
  const lowerTerm = term.toLowerCase();
  
  // Direct lookup
  if (TYPO_CORRECTIONS[lowerTerm]) {
    return TYPO_CORRECTIONS[lowerTerm];
  }

  // Fuzzy match against correction keys
  const keys = Object.keys(TYPO_CORRECTIONS);
  const bestMatch = findBestMatch(lowerTerm, keys, 0.8);
  
  if (bestMatch) {
    return TYPO_CORRECTIONS[bestMatch];
  }

  return term;
}

/**
 * Apply typo corrections to an entire query
 */
export function correctQueryTypos(query: string): string {
  const words = query.split(/\s+/);
  const correctedWords = words.map(word => correctTypo(word));
  return correctedWords.join(' ');
}
