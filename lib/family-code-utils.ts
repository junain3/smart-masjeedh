/**
 * Utility functions for family code generation and parsing
 * Supports various formats: M1, M01, FM001, TH001, LMS01, etc.
 */

export interface ParsedFamilyCode {
  prefix: string;
  number: number;
  padding: number;
  isValid: boolean;
}

/**
 * Parse a family code into its prefix and numeric components
 * Examples:
 * - "M01" -> { prefix: "M", number: 1, padding: 2, isValid: true }
 * - "FM001" -> { prefix: "FM", number: 1, padding: 3, isValid: true }
 * - "M734" -> { prefix: "M", number: 734, padding: 3, isValid: true }
 * - "TH-100" -> { prefix: "TH-", number: 100, padding: 3, isValid: true }
 * - "invalid" -> { prefix: "", number: 0, padding: 0, isValid: false }
 */
export function parseFamilyCode(code: string): ParsedFamilyCode {
  if (!code || typeof code !== 'string') {
    return { prefix: "", number: 0, padding: 0, isValid: false };
  }

  const trimmedCode = code.trim();

  // Match pattern: any non-digit characters at the start (prefix), followed by digits at the end
  // This handles formats like M01, FM001, TH-100, LMS01, etc.
  const match = trimmedCode.match(/^([^\d]*)(\d+)$/);

  if (!match) {
    return { prefix: "", number: 0, padding: 0, isValid: false };
  }

  const prefix = match[1];
  const numberStr = match[2];
  const number = parseInt(numberStr, 10);
  const padding = numberStr.length;

  return {
    prefix,
    number,
    padding,
    isValid: true
  };
}

/**
 * Increment a family code while preserving its format
 * Examples:
 * - "M01" -> "M02"
 * - "FM009" -> "FM010"
 * - "FM099" -> "FM100"
 * - "M734" -> "M735"
 * - "TH-099" -> "TH-100"
 */
export function incrementFamilyCode(code: string): string | null {
  const parsed = parseFamilyCode(code);

  if (!parsed.isValid) {
    return null;
  }

  const incrementedNumber = parsed.number + 1;
  const paddedNumber = incrementedNumber.toString().padStart(parsed.padding, '0');

  return `${parsed.prefix}${paddedNumber}`;
}

/**
 * Generate the next family code based on the last code
 * If no code is provided or invalid, defaults to "M01"
 */
export function generateNextFamilyCode(lastCode?: string | null): string {
  if (!lastCode) {
    return "M01";
  }

  const nextCode = incrementFamilyCode(lastCode);
  return nextCode || "M01";
}

/**
 * Validate if a family code follows the expected pattern (prefix + digits)
 */
export function isValidFamilyCode(code: string): boolean {
  return parseFamilyCode(code).isValid;
}
