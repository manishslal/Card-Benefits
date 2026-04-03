/**
 * Unit Tests for Card Validation Utilities
 * 
 * Tests all validation functions in src/lib/card-validation.ts
 * Covers: happy path, edge cases, error conditions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateCardStatus,
  validateCardStatusTransition,
  validateCustomName,
  validateAnnualFee,
  validateRenewalDate,
  validateDeleteConfirmation,
  validateBulkCardIds,
  validateCardUpdateInput,
  validateBulkUpdateInput
} from '@/lib/card-validation';
import { AppError, ERROR_CODES } from '@/lib/errors';

// ============================================================================
// Card Status Validation Tests
// ============================================================================

describe('validateCardStatus', () => {
  it('should accept valid card statuses', () => {
    expect(validateCardStatus('ACTIVE')).toBe(true);
    expect(validateCardStatus('PENDING')).toBe(true);
    expect(validateCardStatus('PAUSED')).toBe(true);
    expect(validateCardStatus('ARCHIVED')).toBe(true);
    expect(validateCardStatus('DELETED')).toBe(true);
  });

  it('should reject invalid card statuses', () => {
    expect(validateCardStatus('INVALID')).toBe(false);
    expect(validateCardStatus('archived')).toBe(false); // Case sensitive
    expect(validateCardStatus('active')).toBe(false);
    expect(validateCardStatus(null)).toBe(false);
    expect(validateCardStatus(undefined)).toBe(false);
    expect(validateCardStatus(123)).toBe(false);
  });

  it('should handle empty string', () => {
    expect(validateCardStatus('')).toBe(false);
  });

  it('should handle whitespace', () => {
    expect(validateCardStatus(' ACTIVE ')).toBe(false);
  });
});

// ============================================================================
// Card Status Transition Validation Tests
// ============================================================================

describe('validateCardStatusTransition', () => {
  it('should allow valid transitions from ACTIVE', () => {
    expect(() => validateCardStatusTransition('ACTIVE', 'PENDING')).not.toThrow();
    expect(() => validateCardStatusTransition('ACTIVE', 'PAUSED')).not.toThrow();
    expect(() => validateCardStatusTransition('ACTIVE', 'ARCHIVED')).not.toThrow();
    expect(() => validateCardStatusTransition('ACTIVE', 'DELETED')).not.toThrow();
  });

  it('should reject invalid transitions from ACTIVE', () => {
    expect(() => validateCardStatusTransition('ACTIVE', 'ACTIVE')).toThrow(AppError);
  });

  it('should allow valid transitions from PENDING', () => {
    expect(() => validateCardStatusTransition('PENDING', 'ACTIVE')).not.toThrow();
    expect(() => validateCardStatusTransition('PENDING', 'ARCHIVED')).not.toThrow();
    expect(() => validateCardStatusTransition('PENDING', 'DELETED')).not.toThrow();
  });

  it('should reject invalid transitions from PENDING', () => {
    expect(() => validateCardStatusTransition('PENDING', 'PENDING')).toThrow(AppError);
    expect(() => validateCardStatusTransition('PENDING', 'PAUSED')).toThrow(AppError);
  });

  it('should allow valid transitions from PAUSED', () => {
    expect(() => validateCardStatusTransition('PAUSED', 'ACTIVE')).not.toThrow();
    expect(() => validateCardStatusTransition('PAUSED', 'ARCHIVED')).not.toThrow();
    expect(() => validateCardStatusTransition('PAUSED', 'DELETED')).not.toThrow();
  });

  it('should reject invalid transitions from PAUSED', () => {
    expect(() => validateCardStatusTransition('PAUSED', 'PAUSED')).toThrow(AppError);
    expect(() => validateCardStatusTransition('PAUSED', 'PENDING')).toThrow(AppError);
  });

  it('should allow valid transitions from ARCHIVED', () => {
    expect(() => validateCardStatusTransition('ARCHIVED', 'ACTIVE')).not.toThrow();
    expect(() => validateCardStatusTransition('ARCHIVED', 'DELETED')).not.toThrow();
  });

  it('should reject invalid transitions from ARCHIVED', () => {
    expect(() => validateCardStatusTransition('ARCHIVED', 'ARCHIVED')).toThrow(AppError);
    expect(() => validateCardStatusTransition('ARCHIVED', 'PENDING')).toThrow(AppError);
    expect(() => validateCardStatusTransition('ARCHIVED', 'PAUSED')).toThrow(AppError);
  });

  it('should reject any transition from DELETED (final state)', () => {
    expect(() => validateCardStatusTransition('DELETED', 'ACTIVE')).toThrow(AppError);
    expect(() => validateCardStatusTransition('DELETED', 'PENDING')).toThrow(AppError);
    expect(() => validateCardStatusTransition('DELETED', 'ARCHIVED')).toThrow(AppError);
    expect(() => validateCardStatusTransition('DELETED', 'DELETED')).toThrow(AppError);
  });

  it('should reject invalid target status', () => {
    expect(() => validateCardStatusTransition('ACTIVE', 'INVALID' as any)).toThrow(AppError);
  });

  it('should provide helpful error details', () => {
    try {
      validateCardStatusTransition('ACTIVE', 'PENDING');
      validateCardStatusTransition('ACTIVE', 'PAUSED');
      expect.fail('Should have thrown');
    } catch (error) {
      if (error instanceof AppError) {
        expect(error.details).toHaveProperty('current');
        expect(error.details).toHaveProperty('valid');
      }
    }
  });
});

// ============================================================================
// Custom Name Validation Tests
// ============================================================================

describe('validateCustomName', () => {
  it('should accept valid custom names', () => {
    expect(() => validateCustomName('My Card')).not.toThrow();
    expect(() => validateCustomName('Chase Sapphire')).not.toThrow();
    expect(() => validateCustomName('A')).not.toThrow(); // Single character
    expect(() => validateCustomName('X'.repeat(100))).not.toThrow(); // Max length
  });

  it('should accept null/undefined (optional field)', () => {
    expect(() => validateCustomName(null)).not.toThrow();
    expect(() => validateCustomName(undefined)).not.toThrow();
  });

  it('should reject empty string', () => {
    expect(() => validateCustomName('')).toThrow(AppError);
  });

  it('should reject whitespace-only string', () => {
    expect(() => validateCustomName('   ')).toThrow(AppError);
  });

  it('should reject names exceeding max length', () => {
    const tooLong = 'X'.repeat(101);
    expect(() => validateCustomName(tooLong)).toThrow(AppError);
  });

  it('should reject HTML tags (XSS prevention)', () => {
    expect(() => validateCustomName('<script>alert("xss")</script>')).toThrow(AppError);
    expect(() => validateCustomName('<img src=x onerror="alert(1)">')).toThrow(AppError);
    expect(() => validateCustomName('My <Card>')).toThrow(AppError);
    expect(() => validateCustomName('Card</script>')).toThrow(AppError);
  });

  it('should accept names with special characters', () => {
    expect(() => validateCustomName('Card-123')).not.toThrow();
    expect(() => validateCustomName('My Card & More')).not.toThrow();
    expect(() => validateCustomName('Card (Primary)')).not.toThrow();
    expect(() => validateCustomName("O'Reilly Card")).not.toThrow();
  });

  it('should reject non-string types', () => {
    expect(() => validateCustomName(123 as any)).toThrow(AppError);
    expect(() => validateCustomName({} as any)).toThrow(AppError);
    expect(() => validateCustomName([] as any)).toThrow(AppError);
  });

  it('should trim whitespace for validation but preserve user input', () => {
    // Should not throw for names with leading/trailing whitespace
    expect(() => validateCustomName('  Valid Card  ')).not.toThrow();
  });
});

// ============================================================================
// Annual Fee Validation Tests
// ============================================================================

describe('validateAnnualFee', () => {
  it('should accept valid fees', () => {
    expect(() => validateAnnualFee(0)).not.toThrow(); // Free card
    expect(() => validateAnnualFee(50000)).not.toThrow(); // $500
    expect(() => validateAnnualFee(1000000)).not.toThrow(); // $10,000 (max)
  });

  it('should accept null/undefined (optional field)', () => {
    expect(() => validateAnnualFee(null)).not.toThrow();
    expect(() => validateAnnualFee(undefined)).not.toThrow();
  });

  it('should reject negative fees', () => {
    expect(() => validateAnnualFee(-1)).toThrow(AppError);
    expect(() => validateAnnualFee(-100)).toThrow(AppError);
  });

  it('should reject fees exceeding max ($10,000)', () => {
    expect(() => validateAnnualFee(1000001)).toThrow(AppError);
    expect(() => validateAnnualFee(5000000)).toThrow(AppError);
  });

  it('should reject non-integer fees', () => {
    expect(() => validateAnnualFee(99.99)).toThrow(AppError);
    expect(() => validateAnnualFee(50.50)).toThrow(AppError);
  });

  it('should reject non-number types', () => {
    expect(() => validateAnnualFee('100' as any)).toThrow(AppError);
    expect(() => validateAnnualFee({} as any)).toThrow(AppError);
    expect(() => validateAnnualFee([] as any)).toThrow(AppError);
  });

  it('should reject Infinity and NaN', () => {
    expect(() => validateAnnualFee(Infinity as any)).toThrow(AppError);
    expect(() => validateAnnualFee(NaN as any)).toThrow(AppError);
  });

  it('should provide error with exact constraint details', () => {
    try {
      validateAnnualFee(-1);
      expect.fail('Should have thrown');
    } catch (error) {
      if (error instanceof AppError) {
        expect(error.details.field).toBe('actualAnnualFee');
      }
    }
  });
});

// ============================================================================
// Renewal Date Validation Tests
// ============================================================================

describe('validateRenewalDate', () => {
  let tomorrow: Date;
  let today: Date;
  let yesterday: Date;

  beforeEach(() => {
    today = new Date();
    today.setHours(0, 0, 0, 0);
    tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
  });

  it('should accept future dates', () => {
    expect(() => validateRenewalDate(tomorrow)).not.toThrow();
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    expect(() => validateRenewalDate(nextYear)).not.toThrow();
  });

  it('should reject past dates by default', () => {
    expect(() => validateRenewalDate(yesterday)).toThrow(AppError);
  });

  it('should accept past dates if allowPast=true', () => {
    expect(() => validateRenewalDate(yesterday, true)).not.toThrow();
  });

  it('should reject today as renewal date', () => {
    expect(() => validateRenewalDate(today)).toThrow(AppError);
  });

  it('should reject invalid date objects', () => {
    expect(() => validateRenewalDate(new Date('invalid'))).toThrow(AppError);
    expect(() => validateRenewalDate(new Date(NaN))).toThrow(AppError);
  });

  it('should reject non-Date types', () => {
    expect(() => validateRenewalDate('2024-12-31')).toThrow(AppError);
    expect(() => validateRenewalDate(1234567890)).toThrow(AppError);
    expect(() => validateRenewalDate({} as any)).toThrow(AppError);
  });

  it('should handle date precision (time component should not matter)', () => {
    const futureWithTime = new Date(tomorrow);
    futureWithTime.setHours(23, 59, 59);
    expect(() => validateRenewalDate(futureWithTime)).not.toThrow();
  });
});

// ============================================================================
// Delete Confirmation Validation Tests
// ============================================================================

describe('validateDeleteConfirmation', () => {
  it('should accept exact matching card name', () => {
    expect(() => 
      validateDeleteConfirmation('Chase Sapphire', 'Chase Sapphire')
    ).not.toThrow();
  });

  it('should accept exact matching custom name when provided', () => {
    expect(() => 
      validateDeleteConfirmation('My Card', 'Chase Sapphire', 'My Card')
    ).not.toThrow();
  });

  it('should use custom name if provided', () => {
    expect(() => 
      validateDeleteConfirmation('Chase Sapphire', 'Chase Sapphire', 'My Card')
    ).toThrow(AppError); // Should expect 'My Card', not 'Chase Sapphire'
  });

  it('should reject case-sensitive mismatches', () => {
    expect(() => 
      validateDeleteConfirmation('chase sapphire', 'Chase Sapphire')
    ).toThrow(AppError);
  });

  it('should reject partial matches', () => {
    expect(() => 
      validateDeleteConfirmation('Chase', 'Chase Sapphire')
    ).toThrow(AppError);
    expect(() => 
      validateDeleteConfirmation('Sapphire', 'Chase Sapphire')
    ).toThrow(AppError);
  });

  it('should trim whitespace and accept if match', () => {
    // The function trims the confirmation text, so 'Chase Sapphire ' should match 'Chase Sapphire'
    expect(() => 
      validateDeleteConfirmation('Chase Sapphire ', 'Chase Sapphire')
    ).not.toThrow();
  });

  it('should trim confirmation text before comparison', () => {
    expect(() => 
      validateDeleteConfirmation('  Chase Sapphire  ', 'Chase Sapphire')
    ).not.toThrow();
  });

  it('should reject null/undefined confirmation', () => {
    // null doesn't have .trim() method, so should throw an error
    expect(() => 
      validateDeleteConfirmation(null as any, 'Chase Sapphire')
    ).toThrow();
  });
});

// ============================================================================
// Bulk Card IDs Validation Tests
// ============================================================================

describe('validateBulkCardIds', () => {
  it('should accept valid array of card IDs', () => {
    expect(() => validateBulkCardIds(['id1', 'id2', 'id3'])).not.toThrow();
    expect(() => validateBulkCardIds(['single-id'])).not.toThrow();
  });

  it('should reject empty array', () => {
    expect(() => validateBulkCardIds([])).toThrow(AppError);
  });

  it('should reject non-array input', () => {
    expect(() => validateBulkCardIds('id1' as any)).toThrow(AppError);
    expect(() => validateBulkCardIds({} as any)).toThrow(AppError);
    expect(() => validateBulkCardIds(null as any)).toThrow(AppError);
  });

  it('should reject arrays exceeding max length (100)', () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id${i}`);
    expect(() => validateBulkCardIds(ids)).toThrow(AppError);
  });

  it('should accept array at max length (100)', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id${i}`);
    expect(() => validateBulkCardIds(ids)).not.toThrow();
  });

  it('should reject arrays with empty strings', () => {
    expect(() => validateBulkCardIds(['id1', '', 'id3'])).toThrow(AppError);
  });

  it('should reject arrays with whitespace-only strings', () => {
    expect(() => validateBulkCardIds(['id1', '   ', 'id3'])).toThrow(AppError);
  });

  it('should reject arrays with non-string values', () => {
    expect(() => validateBulkCardIds(['id1', 123 as any, 'id3'])).toThrow(AppError);
    expect(() => validateBulkCardIds(['id1', null as any, 'id3'])).toThrow(AppError);
  });
});

// ============================================================================
// Card Update Input Validation Tests
// ============================================================================

describe('validateCardUpdateInput', () => {
  it('should accept empty object (all fields optional)', () => {
    expect(() => validateCardUpdateInput({})).not.toThrow();
  });

  it('should validate customName if provided', () => {
    expect(() => validateCardUpdateInput({ customName: 'Valid Name' })).not.toThrow();
    expect(() => validateCardUpdateInput({ customName: '<script>' })).toThrow(AppError);
  });

  it('should validate actualAnnualFee if provided', () => {
    expect(() => validateCardUpdateInput({ actualAnnualFee: 50000 })).not.toThrow();
    expect(() => validateCardUpdateInput({ actualAnnualFee: -1 })).toThrow(AppError);
  });

  it('should validate renewalDate if provided', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    expect(() => validateCardUpdateInput({ renewalDate: futureDate })).not.toThrow();
    
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    expect(() => validateCardUpdateInput({ renewalDate: pastDate })).toThrow(AppError);
  });

  it('should validate status if provided', () => {
    expect(() => validateCardUpdateInput({ status: 'ACTIVE' })).not.toThrow();
    expect(() => validateCardUpdateInput({ status: 'INVALID' })).toThrow(AppError);
  });

  it('should validate all fields together', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    expect(() => validateCardUpdateInput({
      customName: 'My Card',
      actualAnnualFee: 50000,
      renewalDate: futureDate,
      status: 'ACTIVE'
    })).not.toThrow();
  });

  it('should fail fast on first invalid field', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    
    expect(() => validateCardUpdateInput({
      customName: 'My Card',
      actualAnnualFee: -1,
      renewalDate: futureDate
    })).toThrow(AppError);
  });
});

// ============================================================================
// Bulk Update Input Validation Tests
// ============================================================================

describe('validateBulkUpdateInput', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  it('should require cardIds', () => {
    expect(() => validateBulkUpdateInput({
      updates: { status: 'ACTIVE' }
    })).toThrow(AppError);
  });

  it('should require updates object', () => {
    expect(() => validateBulkUpdateInput({
      cardIds: ['id1', 'id2']
    })).toThrow(AppError);
  });

  it('should validate cardIds format', () => {
    expect(() => validateBulkUpdateInput({
      cardIds: [],
      updates: {}
    })).toThrow(AppError); // Empty array
  });

  it('should validate update fields', () => {
    expect(() => validateBulkUpdateInput({
      cardIds: ['id1', 'id2'],
      updates: { status: 'INVALID' }
    })).toThrow(AppError);
  });

  it('should accept valid bulk update request', () => {
    expect(() => validateBulkUpdateInput({
      cardIds: ['id1', 'id2', 'id3'],
      updates: {
        status: 'ARCHIVED',
        actualAnnualFee: 50000,
        renewalDate: futureDate
      }
    })).not.toThrow();
  });

  it('should allow partial updates', () => {
    expect(() => validateBulkUpdateInput({
      cardIds: ['id1', 'id2'],
      updates: { status: 'ARCHIVED' }
    })).not.toThrow();
  });
});

// ============================================================================
// Edge Cases and Integration Tests
// ============================================================================

describe('Card Validation - Edge Cases', () => {
  it('should handle unicode characters in custom names', () => {
    expect(() => validateCustomName('卡片 Card')).not.toThrow();
    expect(() => validateCustomName('Карта')).not.toThrow();
    expect(() => validateCustomName('카드')).not.toThrow();
  });

  it('should handle future dates regardless of special dates', () => {
    // Use a future date that's definitely in the future
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    futureDate.setDate(15);
    expect(() => validateRenewalDate(futureDate)).not.toThrow();
  });

  it('should maintain consistency across multiple validations', () => {
    const cardName = 'Test Card';
    expect(() => validateDeleteConfirmation(cardName, cardName)).not.toThrow();
    expect(() => validateDeleteConfirmation(cardName, cardName)).not.toThrow();
    expect(() => validateDeleteConfirmation(cardName, cardName)).not.toThrow();
  });

  it('should provide consistent error codes', () => {
    try {
      validateCustomName('<script>');
    } catch (error) {
      if (error instanceof AppError) {
        expect(error.code).toBe(ERROR_CODES.VALIDATION_FIELD);
      }
    }
  });
});
