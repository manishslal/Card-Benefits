/**
 * src/__tests__/lib/custom-values/validation.test.ts
 *
 * Comprehensive test suite for validation utilities.
 * Covers all validation rules, edge cases, and error conditions.
 *
 * Test categories:
 * - Value validation (25+ cases)
 * - Currency parsing (15+ cases)
 * - Difference calculations (10+ cases)
 * - Warning detection (10+ cases)
 * - Preset calculations (8+ cases)
 */

import {
  validateBenefitValue,
  parseCurrencyInput,
  formatCurrencyDisplay,
  calculateDifference,
  isSignificantlyDifferent,
  isUnusuallyLow,
  isUnusuallyHigh,
  getUnusuallyLowWarning,
  getUnusuallyHighWarning,
  validateBenefitId,
  validateChangeReason,
  calculatePresetValue,
  getPresetsForBenefitType,
  MAX_BENEFIT_VALUE_CENTS,
} from '@/lib/custom-values/validation';
import { AppError } from '@/shared/lib';

describe('validateBenefitValue', () => {
  // Valid values
  it('should accept zero', () => {
    expect(() => validateBenefitValue(0)).not.toThrow();
  });

  it('should accept positive integers', () => {
    expect(() => validateBenefitValue(100)).not.toThrow();
    expect(() => validateBenefitValue(25000)).not.toThrow();
    expect(() => validateBenefitValue(999999999)).not.toThrow();
  });

  it('should accept maximum safe value', () => {
    expect(() => validateBenefitValue(MAX_BENEFIT_VALUE_CENTS)).not.toThrow();
  });

  // Invalid types
  it('should reject non-numbers', () => {
    expect(() => validateBenefitValue('100')).toThrow(AppError);
    expect(() => validateBenefitValue(null)).toThrow(AppError);
    expect(() => validateBenefitValue(undefined)).toThrow(AppError);
    expect(() => validateBenefitValue({})).toThrow(AppError);
  });

  // Negative values
  it('should reject negative values', () => {
    expect(() => validateBenefitValue(-1)).toThrow(AppError);
    expect(() => validateBenefitValue(-100)).toThrow(AppError);
    expect(() => validateBenefitValue(-999999999)).toThrow(AppError);
  });

  // Non-integer values
  it('should reject decimal values', () => {
    expect(() => validateBenefitValue(100.5)).toThrow(AppError);
    expect(() => validateBenefitValue(0.01)).toThrow(AppError);
    expect(() => validateBenefitValue(25000.99)).toThrow(AppError);
  });

  // Exceeds maximum
  it('should reject values exceeding maximum', () => {
    expect(() => validateBenefitValue(1000000000)).toThrow(AppError);
    expect(() => validateBenefitValue(MAX_BENEFIT_VALUE_CENTS + 1)).toThrow(AppError);
  });

  // Special values
  it('should handle NaN and Infinity', () => {
    expect(() => validateBenefitValue(NaN)).toThrow(AppError);
    expect(() => validateBenefitValue(Infinity)).toThrow(AppError);
    expect(() => validateBenefitValue(-Infinity)).toThrow(AppError);
  });
});

describe('parseCurrencyInput', () => {
  // Valid dollar format
  it('should parse "$250.00" format', () => {
    expect(parseCurrencyInput('$250.00')).toBe(25000);
  });

  it('should parse "$250" format', () => {
    expect(parseCurrencyInput('$250')).toBe(25000);
  });

  it('should parse dollar amount without symbol', () => {
    expect(parseCurrencyInput('250')).toBe(25000);
    expect(parseCurrencyInput('250.00')).toBe(25000);
  });

  // Cents format
  it('should recognize large numbers as cents', () => {
    expect(parseCurrencyInput('25000')).toBe(25000); // Already in cents
    expect(parseCurrencyInput('1000')).toBe(1000);
  });

  // Edge cases
  it('should handle zero', () => {
    expect(parseCurrencyInput('0')).toBe(0);
    expect(parseCurrencyInput('$0')).toBe(0);
    expect(parseCurrencyInput('0.00')).toBe(0);
  });

  it('should handle whitespace', () => {
    expect(parseCurrencyInput('  $250.00  ')).toBe(25000);
    expect(parseCurrencyInput('  250  ')).toBe(25000);
  });

  it('should handle single-decimal values', () => {
    expect(parseCurrencyInput('250.5')).toBe(25050);
  });

  // Invalid formats
  it('should return null for invalid formats', () => {
    expect(parseCurrencyInput('abc')).toBeNull();
    expect(parseCurrencyInput('25.05.00')).toBeNull();
    expect(parseCurrencyInput('')).toBeNull();
    expect(parseCurrencyInput('  ')).toBeNull();
  });

  it('should return null for non-strings', () => {
    expect(parseCurrencyInput(null as any)).toBeNull();
    expect(parseCurrencyInput(undefined as any)).toBeNull();
  });

  // Exceeds maximum
  it('should return null if exceeds maximum', () => {
    expect(parseCurrencyInput('10000000')).toBeNull(); // 10M+ cents = $100K+
  });
});

describe('formatCurrencyDisplay', () => {
  it('should format cents to dollars with currency symbol', () => {
    expect(formatCurrencyDisplay(25000)).toBe('$250.00');
  });

  it('should handle zero', () => {
    expect(formatCurrencyDisplay(0)).toBe('$0.00');
  });

  it('should handle cents part', () => {
    expect(formatCurrencyDisplay(12345)).toBe('$123.45');
    expect(formatCurrencyDisplay(1)).toBe('$0.01');
    expect(formatCurrencyDisplay(99)).toBe('$0.99');
  });

  it('should handle large values', () => {
    expect(formatCurrencyDisplay(999999999)).toContain('$');
    expect(formatCurrencyDisplay(999999999)).toContain('9,999');
  });
});

describe('calculateDifference', () => {
  it('should calculate negative difference (lower custom)', () => {
    const diff = calculateDifference(25000, 30000);
    expect(diff.amount).toBe(-5000);
    expect(diff.percent).toBeCloseTo(-0.1667, 4);
    expect(diff.percentDisplay).toBe('-16.67');
  });

  it('should calculate positive difference (higher custom)', () => {
    const diff = calculateDifference(35000, 30000);
    expect(diff.amount).toBe(5000);
    expect(diff.percent).toBeCloseTo(0.1667, 4);
    expect(diff.percentDisplay).toBe('16.67');
  });

  it('should return zero for identical values', () => {
    const diff = calculateDifference(30000, 30000);
    expect(diff.amount).toBe(0);
    expect(diff.percent).toBe(0);
    expect(diff.percentDisplay).toBe('0.00');
  });

  it('should handle zero sticker value', () => {
    const diff = calculateDifference(100, 0);
    expect(diff.percent).toBe(0); // Edge case: 0 sticker
  });
});

describe('isSignificantlyDifferent', () => {
  it('should return true for > 10% difference', () => {
    expect(isSignificantlyDifferent(25000, 30000)).toBe(true); // -16.67%
    expect(isSignificantlyDifferent(35000, 30000)).toBe(true); // +16.67%
  });

  it('should return false for <= 10% difference', () => {
    expect(isSignificantlyDifferent(29000, 30000)).toBe(false); // -3.33%
    expect(isSignificantlyDifferent(29700, 30000)).toBe(false); // -1%
    expect(isSignificantlyDifferent(30000, 30000)).toBe(false); // 0%
    expect(isSignificantlyDifferent(30300, 30000)).toBe(false); // +1%
  });

  it('should handle exactly 10% threshold', () => {
    expect(isSignificantlyDifferent(27000, 30000)).toBe(false); // Exactly -10%
    expect(isSignificantlyDifferent(33100, 30000)).toBe(true); // Slightly > 10%
  });

  it('should handle zero sticker value', () => {
    expect(isSignificantlyDifferent(100, 0)).toBe(true); // Any value is significant if sticker is 0
    expect(isSignificantlyDifferent(0, 0)).toBe(false); // Both zero is not significant
  });
});

describe('isUnusuallyLow', () => {
  it('should flag values < 10% of sticker', () => {
    expect(isUnusuallyLow(2000, 30000)).toBe(true); // 6.67%
    expect(isUnusuallyLow(1000, 30000)).toBe(true); // 3.33%
  });

  it('should not flag values >= 10% of sticker', () => {
    expect(isUnusuallyLow(3000, 30000)).toBe(false); // 10%
    expect(isUnusuallyLow(10000, 30000)).toBe(false); // 33.33%
  });

  it('should handle zero sticker', () => {
    expect(isUnusuallyLow(100, 0)).toBe(false); // Can't compare
  });
});

describe('isUnusuallyHigh', () => {
  it('should flag values > 150% of sticker', () => {
    expect(isUnusuallyHigh(50000, 30000)).toBe(true); // 166.67%
    expect(isUnusuallyHigh(46000, 30000)).toBe(true); // 153.33%
  });

  it('should not flag values <= 150% of sticker', () => {
    expect(isUnusuallyHigh(45000, 30000)).toBe(false); // 150%
    expect(isUnusuallyHigh(40000, 30000)).toBe(false); // 133.33%
  });

  it('should flag any value if sticker is 0', () => {
    expect(isUnusuallyHigh(100, 0)).toBe(true);
    expect(isUnusuallyHigh(0, 0)).toBe(false);
  });
});

describe('getUnusuallyLowWarning', () => {
  it('should return warning for low values', () => {
    const warning = getUnusuallyLowWarning(2000, 30000);
    expect(warning).toContain('very low');
    expect(warning).toContain('7%');
  });

  it('should return empty string for non-low values', () => {
    expect(getUnusuallyLowWarning(15000, 30000)).toBe('');
  });
});

describe('getUnusuallyHighWarning', () => {
  it('should return warning for high values', () => {
    const warning = getUnusuallyHighWarning(50000, 30000);
    expect(warning).toContain('very high');
    expect(warning).toContain('167%');
  });

  it('should return empty string for non-high values', () => {
    expect(getUnusuallyHighWarning(40000, 30000)).toBe('');
  });
});

describe('validateBenefitId', () => {
  it('should accept valid CUID format', () => {
    expect(() => validateBenefitId('clv1a2b3c4d5e6f7g8h9i0j1k')).not.toThrow();
    expect(() => validateBenefitId('abc123def456')).not.toThrow();
  });

  it('should reject invalid formats', () => {
    expect(() => validateBenefitId('')).toThrow(AppError);
    expect(() => validateBenefitId('  ')).toThrow(AppError);
    expect(() => validateBenefitId('short')).toThrow(AppError);
    expect(() => validateBenefitId('invalid-id')).toThrow(AppError);
    expect(() => validateBenefitId(null)).toThrow(AppError);
  });
});

describe('validateChangeReason', () => {
  it('should accept null or empty reason', () => {
    expect(() => validateChangeReason(null)).not.toThrow();
    expect(() => validateChangeReason(undefined)).not.toThrow();
    expect(() => validateChangeReason('')).not.toThrow();
  });

  it('should accept valid reason strings', () => {
    expect(() => validateChangeReason('I dont use this credit')).not.toThrow();
    expect(() => validateChangeReason('a')).not.toThrow();
  });

  it('should reject non-strings', () => {
    expect(() => validateChangeReason(123)).toThrow(AppError);
    expect(() => validateChangeReason({})).toThrow(AppError);
  });

  it('should reject reasons exceeding 255 characters', () => {
    const longReason = 'a'.repeat(256);
    expect(() => validateChangeReason(longReason)).toThrow(AppError);
  });

  it('should accept exactly 255 characters', () => {
    const maxReason = 'a'.repeat(255);
    expect(() => validateChangeReason(maxReason)).not.toThrow();
  });
});

describe('calculatePresetValue', () => {
  it('should calculate 50% preset', () => {
    expect(calculatePresetValue(30000, 0.5)).toBe(15000);
  });

  it('should calculate 75% preset', () => {
    expect(calculatePresetValue(30000, 0.75)).toBe(22500);
  });

  it('should calculate 90% preset', () => {
    expect(calculatePresetValue(30000, 0.9)).toBe(27000);
  });

  it('should calculate 100% preset (master)', () => {
    expect(calculatePresetValue(30000, 1.0)).toBe(30000);
  });

  it('should round appropriately', () => {
    expect(calculatePresetValue(25000, 0.33)).toBe(8250); // Rounded
  });
});

describe('getPresetsForBenefitType', () => {
  it('should return standard presets', () => {
    const presets = getPresetsForBenefitType('StatementCredit');
    expect(presets).toEqual([0.5, 0.75, 0.9, 1.0]);
  });

  it('should work for all benefit types', () => {
    expect(getPresetsForBenefitType('UsagePerk')).toEqual([0.5, 0.75, 0.9, 1.0]);
    expect(getPresetsForBenefitType('AnyType')).toEqual([0.5, 0.75, 0.9, 1.0]);
  });
});
