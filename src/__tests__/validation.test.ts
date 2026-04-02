/**
 * Validation System Tests
 *
 * Comprehensive test coverage for all validation functions.
 * Tests normal cases, edge cases, and error conditions.
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validateString,
  validateNumber,
  validateDate,
  validateUUID,
  validateEnum,
  validateMonetaryValue,
} from '@/lib/validation';
import { AppError, ERROR_CODES } from '@/lib/errors';

// ============================================================================
// Email Validation Tests
// ============================================================================

describe('validateEmail', () => {
  it('accepts valid email addresses', () => {
    expect(() => validateEmail('user@example.com')).not.toThrow();
    expect(() => validateEmail('test.user@domain.co.uk')).not.toThrow();
    expect(() => validateEmail('user+tag@example.com')).not.toThrow();
    expect(() => validateEmail('user123@test-domain.com')).not.toThrow();
  });

  it('rejects empty email', () => {
    expect(() => validateEmail('')).toThrow(AppError);
  });

  it('rejects non-string email', () => {
    expect(() => validateEmail(null as any)).toThrow(AppError);
    expect(() => validateEmail(undefined as any)).toThrow(AppError);
    expect(() => validateEmail(123 as any)).toThrow(AppError);
  });

  it('rejects email without @ symbol', () => {
    expect(() => validateEmail('userexample.com')).toThrow(AppError);
  });

  it('rejects email without domain', () => {
    expect(() => validateEmail('user@')).toThrow(AppError);
  });

  it('rejects email without TLD', () => {
    expect(() => validateEmail('user@domain')).toThrow(AppError);
  });

  it('rejects email with spaces', () => {
    expect(() => validateEmail('user @example.com')).toThrow(AppError);
    expect(() => validateEmail('user@exam ple.com')).toThrow(AppError);
  });

  it('throws AppError with correct code', () => {
    try {
      validateEmail('invalid');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODES.VALIDATION_EMAIL);
    }
  });
});

// ============================================================================
// Password Validation Tests
// ============================================================================

describe('validatePassword', () => {
  it('accepts strong passwords', () => {
    expect(() => validatePassword('Password123')).not.toThrow();
    expect(() => validatePassword('SecurePass456')).not.toThrow();
    expect(() => validatePassword('MyPassword7890')).not.toThrow();
  });

  it('rejects empty password', () => {
    expect(() => validatePassword('')).toThrow(AppError);
  });

  it('rejects non-string password', () => {
    expect(() => validatePassword(null as any)).toThrow(AppError);
    expect(() => validatePassword(123 as any)).toThrow(AppError);
  });

  it('rejects passwords shorter than 8 characters', () => {
    expect(() => validatePassword('Pass1')).toThrow(AppError);
    expect(() => validatePassword('Pwd12')).toThrow(AppError);
  });

  it('rejects passwords without uppercase letter', () => {
    expect(() => validatePassword('password123')).toThrow(AppError);
  });

  it('rejects passwords without lowercase letter', () => {
    expect(() => validatePassword('PASSWORD123')).toThrow(AppError);
  });

  it('rejects passwords without digit', () => {
    expect(() => validatePassword('PasswordABC')).toThrow(AppError);
  });

  it('requires all four character types', () => {
    // Missing lowercase
    expect(() => validatePassword('PASSWORD123')).toThrow();
    // Missing uppercase
    expect(() => validatePassword('password123')).toThrow();
    // Missing digit
    expect(() => validatePassword('PasswordABC')).toThrow();
    // Missing uppercase, lowercase, and digit
    expect(() => validatePassword('ABCDEF')).toThrow();
  });

  it('throws AppError with correct code', () => {
    try {
      validatePassword('weak');
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(ERROR_CODES.VALIDATION_PASSWORD);
    }
  });

  it('provides helpful detail messages', () => {
    try {
      validatePassword('password123');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.details).toBeDefined();
      expect(appError.details?.reason).toContain('uppercase');
    }
  });
});

// ============================================================================
// String Validation Tests
// ============================================================================

describe('validateString', () => {
  it('accepts valid strings', () => {
    const result = validateString('hello', 'name');
    expect(result).toBe('hello');
  });

  it('trims whitespace', () => {
    const result = validateString('  hello  ', 'name');
    expect(result).toBe('hello');
  });

  it('rejects empty strings by default', () => {
    expect(() => validateString('', 'name')).toThrow();
    expect(() => validateString('   ', 'name')).toThrow();
  });

  it('allows empty strings with allowEmpty option', () => {
    const result = validateString('', 'name', { allowEmpty: true });
    expect(result).toBe('');
  });

  it('rejects non-string values', () => {
    expect(() => validateString(null, 'name')).toThrow();
    expect(() => validateString(123, 'name')).toThrow();
    expect(() => validateString({}, 'name')).toThrow();
  });

  it('enforces minimum length', () => {
    expect(() => validateString('hi', 'name', { minLength: 3 })).toThrow();
    expect(() => validateString('hello', 'name', { minLength: 3 })).not.toThrow();
  });

  it('enforces maximum length', () => {
    expect(() => validateString('hello world', 'name', { maxLength: 5 })).toThrow();
    expect(() => validateString('hello', 'name', { maxLength: 5 })).not.toThrow();
  });

  it('validates pattern/regex', () => {
    const phonePattern = /^\d{10}$/;
    expect(() => validateString('1234567890', 'phone', { pattern: phonePattern })).not.toThrow();
    expect(() => validateString('123456789', 'phone', { pattern: phonePattern })).toThrow();
  });

  it('applies all constraints together', () => {
    const opts = {
      minLength: 3,
      maxLength: 10,
      pattern: /^[a-z]+$/,
    };
    expect(() => validateString('hello', 'name', opts)).not.toThrow();
    expect(() => validateString('ab', 'name', opts)).toThrow(); // too short
    expect(() => validateString('abcdefghijk', 'name', opts)).toThrow(); // too long
    expect(() => validateString('Hello', 'name', opts)).toThrow(); // uppercase
  });

  it('throws with correct error code and field name', () => {
    try {
      validateString('', 'username');
      expect.fail('Should have thrown');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe(ERROR_CODES.VALIDATION_FIELD);
      expect(appError.details?.field).toBe('username');
    }
  });
});

// ============================================================================
// Number Validation Tests
// ============================================================================

describe('validateNumber', () => {
  it('accepts valid numbers', () => {
    expect(validateNumber(42, 'count')).toBe(42);
    expect(validateNumber(0, 'count')).toBe(0);
    expect(validateNumber(-100, 'count')).toBe(-100);
  });

  it('rejects non-numeric values', () => {
    expect(() => validateNumber('42', 'count')).toThrow();
    expect(() => validateNumber(null, 'count')).toThrow();
    expect(() => validateNumber(undefined, 'count')).toThrow();
  });

  it('rejects NaN', () => {
    expect(() => validateNumber(NaN, 'count')).toThrow();
  });

  it('enforces minimum value', () => {
    expect(() => validateNumber(5, 'count', { min: 10 })).toThrow();
    expect(() => validateNumber(10, 'count', { min: 10 })).not.toThrow();
    expect(() => validateNumber(15, 'count', { min: 10 })).not.toThrow();
  });

  it('enforces maximum value', () => {
    expect(() => validateNumber(15, 'count', { max: 10 })).toThrow();
    expect(() => validateNumber(10, 'count', { max: 10 })).not.toThrow();
    expect(() => validateNumber(5, 'count', { max: 10 })).not.toThrow();
  });

  it('validates integers', () => {
    expect(() => validateNumber(42, 'count', { integer: true })).not.toThrow();
    expect(() => validateNumber(42.5, 'count', { integer: true })).toThrow();
    expect(() => validateNumber(0, 'count', { integer: true })).not.toThrow();
  });

  it('enforces range with min and max', () => {
    const opts = { min: 0, max: 100 };
    expect(() => validateNumber(50, 'percent', opts)).not.toThrow();
    expect(() => validateNumber(-1, 'percent', opts)).toThrow();
    expect(() => validateNumber(101, 'percent', opts)).toThrow();
  });

  it('throws with correct error code', () => {
    try {
      validateNumber('not a number', 'value');
      expect.fail('Should have thrown');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe(ERROR_CODES.VALIDATION_FIELD);
    }
  });
});

// ============================================================================
// Date Validation Tests
// ============================================================================

describe('validateDate', () => {
  it('accepts Date objects', () => {
    const date = new Date('2025-12-31');
    expect(validateDate(date, 'expiry')).toEqual(date);
  });

  it('accepts ISO 8601 date strings', () => {
    const result = validateDate('2025-12-31', 'expiry');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2025);
  });

  it('rejects invalid date strings', () => {
    expect(() => validateDate('not-a-date', 'expiry')).toThrow();
    expect(() => validateDate('2025-13-01', 'expiry')).toThrow(); // invalid month
  });

  it('rejects non-date values', () => {
    expect(() => validateDate(123456789, 'expiry')).toThrow();
    expect(() => validateDate(null, 'expiry')).toThrow();
  });

  it('enforces minimum date', () => {
    const minDate = new Date('2025-01-01');
    expect(() => validateDate('2024-12-31', 'expiry', { minDate })).toThrow();
    expect(() => validateDate('2025-01-01', 'expiry', { minDate })).not.toThrow();
    expect(() => validateDate('2026-01-01', 'expiry', { minDate })).not.toThrow();
  });

  it('enforces maximum date', () => {
    const maxDate = new Date('2030-12-31');
    expect(() => validateDate('2031-01-01', 'expiry', { maxDate })).toThrow();
    expect(() => validateDate('2030-12-31', 'expiry', { maxDate })).not.toThrow();
    expect(() => validateDate('2020-01-01', 'expiry', { maxDate })).not.toThrow();
  });

  it('enforces date range', () => {
    const minDate = new Date('2025-01-01');
    const maxDate = new Date('2025-12-31');
    const opts = { minDate, maxDate };

    expect(() => validateDate('2024-12-31', 'expiry', opts)).toThrow();
    expect(() => validateDate('2025-06-15', 'expiry', opts)).not.toThrow();
    expect(() => validateDate('2026-01-01', 'expiry', opts)).toThrow();
  });

  it('throws with correct error code', () => {
    try {
      validateDate('invalid', 'date');
      expect.fail('Should have thrown');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe(ERROR_CODES.VALIDATION_FIELD);
    }
  });
});

// ============================================================================
// UUID Validation Tests
// ============================================================================

describe('validateUUID', () => {
  it('accepts valid UUIDs', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(() => validateUUID(uuid, 'id')).not.toThrow();
  });

  it('rejects invalid UUIDs', () => {
    expect(() => validateUUID('not-a-uuid', 'id')).toThrow();
    expect(() => validateUUID('550e8400-e29b-11d4-a716-446655440000', 'id')).toThrow(); // version 1, not 4
  });

  it('rejects non-string UUIDs', () => {
    expect(() => validateUUID(123, 'id')).toThrow();
    expect(() => validateUUID(null, 'id')).toThrow();
  });

  it('throws with correct error code', () => {
    try {
      validateUUID('invalid', 'id');
      expect.fail('Should have thrown');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe(ERROR_CODES.VALIDATION_FIELD);
    }
  });
});

// ============================================================================
// Enum Validation Tests
// ============================================================================

describe('validateEnum', () => {
  it('accepts allowed values', () => {
    expect(() => validateEnum('ANNUAL', 'cadence', ['ANNUAL', 'QUARTERLY', 'MONTHLY'])).not.toThrow();
    expect(() => validateEnum('MONTHLY', 'cadence', ['ANNUAL', 'QUARTERLY', 'MONTHLY'])).not.toThrow();
  });

  it('rejects disallowed values', () => {
    expect(() => validateEnum('WEEKLY', 'cadence', ['ANNUAL', 'QUARTERLY', 'MONTHLY'])).toThrow();
  });

  it('is case-sensitive', () => {
    expect(() => validateEnum('annual', 'cadence', ['ANNUAL', 'QUARTERLY', 'MONTHLY'])).toThrow();
  });

  it('rejects null and undefined', () => {
    expect(() => validateEnum(null, 'cadence', ['ANNUAL', 'QUARTERLY', 'MONTHLY'])).toThrow();
    expect(() => validateEnum(undefined, 'cadence', ['ANNUAL', 'QUARTERLY', 'MONTHLY'])).toThrow();
  });

  it('throws with correct error code', () => {
    try {
      validateEnum('INVALID', 'type', ['A', 'B', 'C']);
      expect.fail('Should have thrown');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe(ERROR_CODES.VALIDATION_FIELD);
      expect(appError.details?.reason).toContain('A, B, C');
    }
  });
});

// ============================================================================
// Monetary Value Validation Tests
// ============================================================================

describe('validateMonetaryValue', () => {
  it('accepts valid monetary values in cents', () => {
    expect(validateMonetaryValue(0, 'amount')).toBe(0);
    expect(validateMonetaryValue(1500, 'amount')).toBe(1500); // $15.00
    expect(validateMonetaryValue(999999, 'amount')).toBe(999999);
  });

  it('rejects non-integer values', () => {
    expect(() => validateMonetaryValue(15.5, 'amount')).toThrow();
    expect(() => validateMonetaryValue(NaN, 'amount')).toThrow();
  });

  it('rejects negative values', () => {
    expect(() => validateMonetaryValue(-100, 'amount')).toThrow();
  });

  it('rejects unsafe integers', () => {
    expect(() => validateMonetaryValue(Number.MAX_SAFE_INTEGER + 1, 'amount')).toThrow();
  });

  it('rejects non-numeric values', () => {
    expect(() => validateMonetaryValue('1500', 'amount')).toThrow();
    expect(() => validateMonetaryValue(null, 'amount')).toThrow();
  });

  it('throws with correct error code', () => {
    try {
      validateMonetaryValue(-50, 'amount');
      expect.fail('Should have thrown');
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe(ERROR_CODES.VALIDATION_FIELD);
    }
  });
});
