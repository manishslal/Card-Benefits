/**
 * src/lib/custom-values/validation.ts
 *
 * Validation utilities for the Custom Values feature.
 * All functions throw AppError on validation failure for consistent error handling.
 *
 * Design:
 * - Client-side and server-side share validation logic
 * - Non-blocking warnings (client-side only) vs blocking errors (both)
 * - All monetary values in cents (integers)
 * - Max value: 999,999,999 cents ($9,999,999.99)
 */

import { AppError, ERROR_CODES } from '@/shared/lib';

/**
 * Maximum safe value in cents (upper bound for input validation)
 */
export const MAX_BENEFIT_VALUE_CENTS = 999_999_999;

/**
 * Warning threshold: values below 10% of sticker are flagged as unusually low
 */
export const LOW_VALUE_THRESHOLD_PERCENT = 0.10;

/**
 * Warning threshold: values above 150% of sticker require confirmation
 */
export const HIGH_VALUE_THRESHOLD_PERCENT = 1.50;

/**
 * Threshold for determining if a difference is "significant" (> 10%)
 */
export const SIGNIFICANT_DIFFERENCE_THRESHOLD = 0.10;

/**
 * Validates a benefit value input from the user.
 * Throws AppError if validation fails.
 *
 * Rules:
 * - Must be a number
 * - Must be non-negative (>= 0)
 * - Must be an integer (whole cents, no fractions)
 * - Must not exceed MAX_BENEFIT_VALUE_CENTS
 *
 * @param valueInCents - The value to validate (in cents)
 * @param fieldName - Name of field for error messages (e.g., 'valueInCents')
 * @throws {AppError} If validation fails
 *
 * @example
 * validateBenefitValue(25000, 'valueInCents'); // OK: $250.00
 * validateBenefitValue(-100, 'valueInCents');  // Throws: negative
 * validateBenefitValue(100.50, 'valueInCents'); // Throws: not integer
 */
export function validateBenefitValue(valueInCents: any, fieldName: string = 'valueInCents'): void {
  // Type check
  if (typeof valueInCents !== 'number') {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Value must be a number',
      received: typeof valueInCents,
    });
  }

  // Non-negative check
  if (valueInCents < 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Value cannot be negative',
      received: valueInCents,
    });
  }

  // Integer check
  if (!Number.isInteger(valueInCents)) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: 'Value must be whole cents (no fractions)',
      received: valueInCents,
    });
  }

  // Max value check
  if (valueInCents > MAX_BENEFIT_VALUE_CENTS) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: fieldName,
      reason: `Value cannot exceed $${(MAX_BENEFIT_VALUE_CENTS / 100).toFixed(2)}`,
      received: valueInCents,
      max: MAX_BENEFIT_VALUE_CENTS,
    });
  }
}

/**
 * Parses a currency string into cents (integer).
 * Handles multiple formats: "$250.00", "250", "25000", "250.5"
 *
 * @param input - Currency input string
 * @returns Value in cents, or null if parsing fails
 *
 * @example
 * parseCurrencyInput('$250.00')  // 25000
 * parseCurrencyInput('250')      // 25000
 * parseCurrencyInput('25000')    // 25000 (already in cents)
 * parseCurrencyInput('invalid')  // null
 */
export function parseCurrencyInput(input: string): number | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  // Remove common currency symbols and whitespace
  let cleaned = input.trim().replace(/[$€£¥₹\s]/g, '');

  // If empty after cleaning, invalid
  if (!cleaned) {
    return null;
  }

  // Check for multiple decimal points (invalid format like "25.05.00")
  const decimalCount = (cleaned.match(/\./g) || []).length;
  if (decimalCount > 1) {
    return null;
  }

  // Try to parse as number
  const parsed = parseFloat(cleaned);

  // Check if valid number
  if (isNaN(parsed)) {
    return null;
  }

  // Decide if input is already in cents (large number) or dollars
  // Heuristic: if > 1000, likely already in cents; otherwise in dollars
  let cents: number;
  if (parsed >= 1000) {
    // Probably already in cents
    cents = Math.round(parsed);

    // BUT: If this is a very large number (>=10M cents = $100K), it's suspicious.
    // Reject it as likely a data entry error or ambiguous user intent.
    if (parsed >= 10000000) {
      return null;
    }
  } else {
    // Probably in dollars, convert to cents
    cents = Math.round(parsed * 100);
  }

  // Validate the result
  try {
    validateBenefitValue(cents);
    return cents;
  } catch {
    return null;
  }
}

/**
 * Formats a value in cents for display to the user.
 * Returns string like "$250.00"
 *
 * @param valueInCents - Value in cents
 * @returns Formatted currency string
 *
 * @example
 * formatCurrencyDisplay(25000)  // "$250.00"
 * formatCurrencyDisplay(0)      // "$0.00"
 * formatCurrencyDisplay(12345)  // "$123.45"
 */
export function formatCurrencyDisplay(valueInCents: number): string {
  const dollars = valueInCents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

/**
 * Calculates the difference between two values (custom vs sticker).
 *
 * @param customValue - Custom value in cents
 * @param stickerValue - Sticker (master) value in cents
 * @returns Object with difference amount and percentage
 *
 * @example
 * calculateDifference(25000, 30000)
 * // { amount: -5000, percent: -0.1667 (≈ -16.67%) }
 */
export function calculateDifference(customValue: number, stickerValue: number) {
  const amount = customValue - stickerValue;

  // Calculate percentage: (custom - sticker) / sticker
  // Return 0 if sticker is 0 (edge case)
  const percent = stickerValue === 0 ? 0 : amount / stickerValue;

  return {
    amount,
    percent,
    percentDisplay: (percent * 100).toFixed(2), // For display: "-16.67%"
  };
}

/**
 * Determines if a difference is "significant" (exceeds 10% threshold).
 *
 * @param customValue - Custom value in cents
 * @param stickerValue - Sticker value in cents
 * @returns true if |difference| > 10%
 *
 * @example
 * isSignificantlyDifferent(25000, 30000)  // true: -16.67% > 10%
 * isSignificantlyDifferent(29000, 30000)  // false: -3.33% < 10%
 */
export function isSignificantlyDifferent(customValue: number, stickerValue: number): boolean {
  if (stickerValue === 0) {
    return customValue !== 0;
  }

  const diff = calculateDifference(customValue, stickerValue);
  // Use >= to include exactly 10% as NOT significant (test expects 27000 vs 30000 = false)
  return Math.abs(diff.percent) > SIGNIFICANT_DIFFERENCE_THRESHOLD;
}

/**
 * Checks if a value is unusually low compared to sticker (< 10%).
 * Used for client-side warnings (non-blocking).
 *
 * @param customValue - Custom value in cents
 * @param stickerValue - Sticker value in cents
 * @returns true if value is < 10% of sticker
 */
export function isUnusuallyLow(customValue: number, stickerValue: number): boolean {
  if (stickerValue === 0) {
    return false; // Can't compare if sticker is 0
  }

  const percentOfSticker = customValue / stickerValue;
  return percentOfSticker < LOW_VALUE_THRESHOLD_PERCENT;
}

/**
 * Checks if a value is unusually high compared to sticker (> 150%).
 * Used for client-side warnings and confirmation dialogs.
 *
 * @param customValue - Custom value in cents
 * @param stickerValue - Sticker value in cents
 * @returns true if value is > 150% of sticker
 */
export function isUnusuallyHigh(customValue: number, stickerValue: number): boolean {
  // If both are 0, not unusual
  if (stickerValue === 0 && customValue === 0) {
    return false;
  }

  // If sticker is 0 but custom is non-zero, it's unusual
  if (stickerValue === 0) {
    return true;
  }

  const percentOfSticker = customValue / stickerValue;
  return percentOfSticker > HIGH_VALUE_THRESHOLD_PERCENT;
}

/**
 * Gets the warning message for an unusually low value.
 *
 * @param customValue - Custom value in cents
 * @param stickerValue - Sticker value in cents
 * @returns Warning message or empty string if no warning
 */
export function getUnusuallyLowWarning(customValue: number, stickerValue: number): string {
  if (!isUnusuallyLow(customValue, stickerValue)) {
    return '';
  }

  const percentOfSticker = Math.round((customValue / stickerValue) * 100);
  return `This value seems very low (${percentOfSticker}% of the master value)`;
}

/**
 * Gets the warning message for an unusually high value.
 *
 * @param customValue - Custom value in cents
 * @param stickerValue - Sticker value in cents
 * @returns Warning message or empty string if no warning
 */
export function getUnusuallyHighWarning(customValue: number, stickerValue: number): string {
  if (!isUnusuallyHigh(customValue, stickerValue)) {
    return '';
  }

  if (stickerValue === 0) {
    return 'This value is higher than the master value';
  }

  const percentOfSticker = Math.round((customValue / stickerValue) * 100);
  return `This value seems very high (${percentOfSticker}% of the master value)`;
}

/**
 * Validates a benefit ID (UUID format).
 * This is a stricter validation than generic UUID validation.
 *
 * @param benefitId - The ID to validate
 * @throws {AppError} If invalid UUID format
 */
export function validateBenefitId(benefitId: any): void {
  if (!benefitId || typeof benefitId !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'benefitId',
      reason: 'Benefit ID is required and must be a string',
    });
  }

  // Trim and check for empty
  const trimmed = benefitId.trim();
  if (!trimmed) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'benefitId',
      reason: 'Benefit ID cannot be empty or whitespace',
      received: benefitId,
    });
  }

  // CUID format validation (used by Prisma's default ID generator)
  // Accept alphanumeric IDs with minimum length of 8 characters
  const cuidRegex = /^[a-z0-9]+$/i;
  if (!cuidRegex.test(trimmed) || trimmed.length < 8) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'benefitId',
      reason: 'Invalid benefit ID format',
      received: benefitId,
    });
  }
}

/**
 * Validates a change reason string (max 255 characters).
 *
 * @param reason - The reason string to validate
 * @throws {AppError} If exceeds max length
 */
export function validateChangeReason(reason: any): void {
  if (reason === null || reason === undefined || reason === '') {
    // Empty reason is allowed
    return;
  }

  if (typeof reason !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'changeReason',
      reason: 'Reason must be a string',
      received: typeof reason,
    });
  }

  if (reason.length > 255) {
    throw new AppError(ERROR_CODES.VALIDATION_FIELD, {
      field: 'changeReason',
      reason: 'Reason cannot exceed 255 characters',
      received: reason.length,
      max: 255,
    });
  }
}

/**
 * Gets a presnt configuration based on benefit type.
 * Used to populate preset buttons in the UI.
 *
 * @param _benefitType - Type of benefit (e.g., 'StatementCredit', 'UsagePerk') - reserved for future customization
 * @returns Array of preset percentages
 */
export function getPresetsForBenefitType(_benefitType: string): number[] {
  // All benefit types use the same percentage presets
  // In future, this could be customized per type
  return [0.50, 0.75, 0.90, 1.0]; // 50%, 75%, 90%, 100% (master)
}

/**
 * Calculates preset value based on percentage.
 *
 * @param stickerValue - Sticker value in cents
 * @param percentageOfSticker - Percentage as decimal (0.5 = 50%)
 * @returns Preset value in cents
 *
 * @example
 * calculatePresetValue(30000, 0.75)  // 22500 (75% of $300)
 */
export function calculatePresetValue(
  stickerValue: number,
  percentageOfSticker: number
): number {
  return Math.round(stickerValue * percentageOfSticker);
}
