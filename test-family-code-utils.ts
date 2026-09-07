/**
 * Quick test script for family code utilities
 * Run with: npx tsx test-family-code-utils.ts
 */

import { parseFamilyCode, incrementFamilyCode, generateNextFamilyCode } from './lib/family-code-utils';

const testCases = [
  { input: 'M01', expectedPrefix: 'M', expectedNumber: 1, expectedPadding: 2, expectedNext: 'M02' },
  { input: 'FM001', expectedPrefix: 'FM', expectedNumber: 1, expectedPadding: 3, expectedNext: 'FM002' },
  { input: 'FM009', expectedPrefix: 'FM', expectedNumber: 9, expectedPadding: 3, expectedNext: 'FM010' },
  { input: 'FM099', expectedPrefix: 'FM', expectedNumber: 99, expectedPadding: 3, expectedNext: 'FM100' },
  { input: 'M734', expectedPrefix: 'M', expectedNumber: 734, expectedPadding: 3, expectedNext: 'M735' },
  { input: 'TH001', expectedPrefix: 'TH', expectedNumber: 1, expectedPadding: 3, expectedNext: 'TH002' },
  { input: 'LMS01', expectedPrefix: 'LMS', expectedNumber: 1, expectedPadding: 2, expectedNext: 'LMS02' },
  { input: 'TH-100', expectedPrefix: 'TH-', expectedNumber: 100, expectedPadding: 3, expectedNext: 'TH-101' },
  { input: 'M1', expectedPrefix: 'M', expectedNumber: 1, expectedPadding: 1, expectedNext: 'M2' },
];

console.log('Testing Family Code Utilities\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const parsed = parseFamilyCode(test.input);
  const next = incrementFamilyCode(test.input);
  
  const prefixMatch = parsed.prefix === test.expectedPrefix;
  const numberMatch = parsed.number === test.expectedNumber;
  const paddingMatch = parsed.padding === test.expectedPadding;
  const nextMatch = next === test.expectedNext;
  
  const allMatch = prefixMatch && numberMatch && paddingMatch && nextMatch;
  
  if (allMatch) {
    passed++;
    console.log(`✓ Test ${index + 1}: ${test.input} -> ${test.expectedNext}`);
  } else {
    failed++;
    console.log(`✗ Test ${index + 1}: ${test.input}`);
    if (!prefixMatch) console.log(`  Prefix mismatch: expected "${test.expectedPrefix}", got "${parsed.prefix}"`);
    if (!numberMatch) console.log(`  Number mismatch: expected ${test.expectedNumber}, got ${parsed.number}`);
    if (!paddingMatch) console.log(`  Padding mismatch: expected ${test.expectedPadding}, got ${parsed.padding}`);
    if (!nextMatch) console.log(`  Next code mismatch: expected "${test.expectedNext}", got "${next}"`);
  }
});

// Test default behavior
const defaultNext = generateNextFamilyCode(null);
const defaultNext2 = generateNextFamilyCode(undefined);
const defaultNext3 = generateNextFamilyCode('');

console.log(`\nDefault behavior tests:`);
if (defaultNext === 'M01' && defaultNext2 === 'M01' && defaultNext3 === 'M01') {
  passed++;
  console.log(`✓ Default to M01 when no code provided`);
} else {
  failed++;
  console.log(`✗ Default behavior failed`);
}

// Test invalid codes
const invalidCodes = ['invalid', '123', '', 'ABC'];
console.log(`\nInvalid code tests:`);
let invalidPassed = 0;
invalidCodes.forEach((code) => {
  const parsed = parseFamilyCode(code);
  const next = incrementFamilyCode(code);
  if (!parsed.isValid && next === null) {
    invalidPassed++;
    console.log(`✓ "${code}" correctly identified as invalid`);
  } else {
    console.log(`✗ "${code}" incorrectly handled`);
  }
});
passed += invalidPassed;

console.log(`\n${'='.repeat(50)}`);
console.log(`Total: ${testCases.length + 1 + invalidCodes.length} tests`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`${'='.repeat(50)}`);

if (failed === 0) {
  console.log('\n✓ All tests passed!');
} else {
  console.log('\n✗ Some tests failed');
  process.exit(1);
}
