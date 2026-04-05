/**
 * Input Validation Utilities
 *
 * Provides standardized validation functions for common data types.
 * All validation functions throw AppError on failure, making them suitable
 * for use in server actions where errors are caught and converted to responses.
 *
 * Usage:
 * ```typescript
 * export async function addCard(playerId: string, cardId: string) {
 *   try {
 *     validateString(playerId, 'playerId');
 *     validateString(cardId, 'cardId');
 *     // safe to proceed
 *   } catch (error) {
 *     if (error instanceof AppError) {
 *       return createErrorResponse(error.code, error.details);
 *     }
 *   }
 * }
 * ```
 */

import { ERROR_CODES, AppError } from './errors';

// ============================================================================
// Email Validation
// ============================================================================

/**
 * Validates email format
 *
 * Checks:
 * - String type and non-empty
 * - Basic email format (something@something.something)
 *
 * @throws {AppError} If email is invalid
 */
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_EMAIL, {
      field: 'email',
      reason: 'Email is required',
    });
  }

  // Basic email regex - checks for format, not RFC compliance
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new AppError(ERROR_CODES.VALIDATION_EMAIL, {
      field: 'email',
      reason: 'Invalid email format',
    });
  }
}

// ============================================================================
// Password Validation
// ============================================================================

/**
 * Validates password strength
 *
 * Requirements:
 * - At least 8 characters long
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one digit (0-9)
 *
 * @throws {AppError} If password doesn't meet requirements
 */
export function validatePassword(password: string): void {
  if (!password || typeof password !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_PASSWORD, {
      field: 'password',
      reason: 'Password is required',
    });
  }

  if (password.length < 8) {
    throw new AppError(ERROR_CODES.VALIDATION_PASSWORD, {
      field: 'password',
      reason: 'Password must be at least 8 characters',
    });
  }

  if (!/[A-Z]/.test(password)) {
    throw new AppError(ERROR_CODES.VALIDATION_PASSWORD, {
      field: 'password',
      reason: 'Password must contain uppercase letter',
    });
  }

  if (!/[a-z]/.test(password)) {
    throw new AppError(ERROR_CODES.VALIDATION_PASSWORD, {
      field: 'password',
      reason: 'Password must contain lowercase letter',
    });
  }

  if (!/[0-9]/.test(password)) {
    throw new AppError(ERROR_CODES.VALIDATION_PASSWORD, {
      field: 'password',
      reason: 'Password must contain number',
    });
  }
}

// ============================================================================
// String Validation
// ============================================================================

export interface StringValidationOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  allowEmpty?: boolean;
}

/**
 * Validates a string value
 *
 * @param value - The value to validate
 * @param fieldName - The field name (used in error messages)
 * @param options - Validation options (minLength, maxLength, pattern)
 * @returns The trimmed string value
 * @throws {AppError} If validation fails
 *
 * @example
 * ```typescript
 * const name = validateString(value, 'name', {
 *   minLength: 1,
 *   maxLength: 100,
 * });
 * ```
 */
export function validateString(
  value: any,
  fieldName: string,
  options?: StringValidationOptions,
): string {
  if (typeof value !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Must be a string',
    });
  }

  const trimmed = value.trim();

  if (!trimmed && !options?.allowEmpty) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Required field',
    });
  }

  if (options?.minLength && trimmed.length < options.minLength) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Minimum length is ${options.minLength}`,
    });
  }

  if (options?.maxLength && trimmed.length > options.maxLength) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Maximum length is ${options.maxLength}`,
    });
  }

  if (options?.pattern && !options.pattern.test(trimmed)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Invalid format',
    });
  }

  return trimmed;
}

// ============================================================================
// Number Validation
// ============================================================================

export interface NumberValidationOptions {
  min?: number;
  max?: number;
  integer?: boolean;
}

/**
 * Validates a number value
 *
 * @param value - The value to validate
 * @param fieldName - The field name (used in error messages)
 * @param options - Validation options (min, max, integer)
 * @returns The validated number
 * @throws {AppError} If validation fails
 *
 * @example
 * ```typescript
 * const cents = validateNumber(value, 'amount', {
 *   min: 0,
 *   max: 999999,
 *   integer: true,
 * });
 * ```
 */
export function validateNumber(
  value: any,
  fieldName: string,
  options?: NumberValidationOptions,
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Must be a number',
    });
  }

  if (options?.integer && !Number.isInteger(value)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Must be an integer',
    });
  }

  if (options?.min !== undefined && value < options.min) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Minimum value is ${options.min}`,
    });
  }

  if (options?.max !== undefined && value > options.max) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Maximum value is ${options.max}`,
    });
  }

  return value;
}

// ============================================================================
// Date Validation
// ============================================================================

export interface DateValidationOptions {
  minDate?: Date;
  maxDate?: Date;
}

/**
 * Validates a date value
 *
 * Accepts:
 * - Date objects
 * - ISO 8601 date strings (e.g., "2025-12-31")
 *
 * @param value - The value to validate
 * @param fieldName - The field name (used in error messages)
 * @param options - Validation options (minDate, maxDate)
 * @returns The validated Date object
 * @throws {AppError} If validation fails
 *
 * @example
 * ```typescript
 * const expiryDate = validateDate(value, 'expiryDate', {
 *   minDate: new Date(),
 *   maxDate: new Date('2030-12-31'),
 * });
 * ```
 */
export function validateDate(
  value: any,
  fieldName: string,
  options?: DateValidationOptions,
): Date {
  let date: Date;

  if (typeof value === 'string') {
    date = new Date(value);
  } else if (value instanceof Date) {
    date = value;
  } else {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Must be a valid date',
    });
  }

  if (isNaN(date.getTime())) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Invalid date format',
    });
  }

  if (options?.minDate && date < options.minDate) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Date must be after ${options.minDate.toISOString()}`,
    });
  }

  if (options?.maxDate && date > options.maxDate) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Date must be before ${options.maxDate.toISOString()}`,
    });
  }

  return date;
}

// ============================================================================
// UUID Validation
// ============================================================================

/**
 * Validates a UUID v4 format
 *
 * @param value - The value to validate
 * @param fieldName - The field name (used in error messages)
 * @throws {AppError} If validation fails
 *
 * @example
 * ```typescript
 * validateUUID(playerId, 'playerId');
 * ```
 */
export function validateUUID(value: any, fieldName: string): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (typeof value !== 'string' || !uuidRegex.test(value)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Invalid ID format',
    });
  }
}

// ============================================================================
// Enum Validation
// ============================================================================

/**
 * Validates that a value is one of the allowed enum values
 *
 * @param value - The value to validate
 * @param fieldName - The field name (used in error messages)
 * @param allowedValues - Array of allowed values
 * @throws {AppError} If validation fails
 *
 * @example
 * ```typescript
 * validateEnum(resetCadence, 'resetCadence', ['ANNUAL', 'QUARTERLY', 'MONTHLY']);
 * ```
 */
export function validateEnum(
  value: any,
  fieldName: string,
  allowedValues: readonly any[],
): void {
  if (!allowedValues.includes(value)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Must be one of: ${allowedValues.join(', ')}`,
    });
  }
}

// ============================================================================
// Safe Integer (Monetary) Validation
// ============================================================================

/**
 * Validates a monetary value in cents (integer format)
 *
 * Requirements:
 * - Must be a safe integer
 * - Must be non-negative
 * - Commonly used for price/value fields
 *
 * @param value - The value to validate (in cents)
 * @param fieldName - The field name (used in error messages)
 * @throws {AppError} If validation fails
 *
 * @example
 * ```typescript
 * const valueInCents = validateMonetaryValue(1500, 'amount'); // $15.00
 * ```
 */
export function validateMonetaryValue(value: any, fieldName: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Must be a non-negative whole number (cents)',
    });
  }

  return value;
}
