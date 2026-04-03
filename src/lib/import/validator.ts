/**
 * Import validation engine
 *
 * Validates all imported record fields against:
 * - Type constraints (string, number, date)
 * - Business rules (positive fees, future dates)
 * - Catalog constraints (card must exist in MasterCard)
 * - Uniqueness constraints (benefit name per card)
 *
 * Supports severity levels:
 * - Critical: Blocking errors that prevent import
 * - Warning: Non-blocking issues the user can proceed with
 */

import { prisma } from '@/lib/prisma';
import { AppError, ERROR_CODES } from '@/lib/errors';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'warning';
  suggestion: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  normalizedData?: Record<string, any>;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Creates a validation error object
 */
function createError(
  field: string,
  message: string,
  suggestion: string,
  severity: 'critical' | 'warning' = 'critical'
): ValidationError {
  return { field, message, suggestion, severity };
}

/**
 * Parses a date string in ISO 8601 format (YYYY-MM-DD)
 * @returns Date or null if invalid
 */
function parseISODate(value: any): Date | null {
  if (typeof value !== 'string') return null;

  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(value)) return null;

  const date = new Date(value + 'T00:00:00Z');
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Normalizes monetary value from cents (integer)
 */
function parseMonetary(value: any): number | null {
  const num = Number(value);
  return Number.isSafeInteger(num) ? num : null;
}

// ============================================================================
// Field Validators
// ============================================================================

/**
 * Validates CardName field
 *
 * Edge cases:
 * - Empty string
 * - Card not in MasterCard catalog
 * - Partial matches (fuzzy matching not supported here)
 */
export async function validateCardName(
  cardName: any,
  issuer: any,
  _rowNumber: number,
  result: ValidationResult
): Promise<boolean> {
  if (!cardName || typeof cardName !== 'string') {
    result.errors.push(
      createError(
        'CardName',
        'Card name is required',
        'Provide the exact card name as it appears in the catalog'
      )
    );
    return false;
  }

  const trimmed = cardName.trim();
  if (!trimmed) {
    result.errors.push(
      createError(
        'CardName',
        'Card name cannot be empty',
        'Provide the exact card name'
      )
    );
    return false;
  }

  if (trimmed.length > 100) {
    result.errors.push(
      createError(
        'CardName',
        `Card name exceeds maximum length of 100 characters (got ${trimmed.length})`,
        'Use a shorter card name'
      )
    );
    return false;
  }

  // Check if card exists in catalog
  const issuerTrimmed = issuer && typeof issuer === 'string' ? issuer.trim() : '';
  if (!issuerTrimmed) {
    result.errors.push(
      createError(
        'Issuer',
        'Issuer is required to lookup card',
        'Provide the card issuer'
      )
    );
    return false;
  }

  const masterCard = await prisma.masterCard.findFirst({
    where: {
      name: trimmed,
      issuer: issuerTrimmed,
    },
  });

  if (!masterCard) {
    result.errors.push(
      createError(
        'CardName',
        `Card '${trimmed}' by '${issuerTrimmed}' not found in system catalog`,
        'Add this card to the system first via Admin panel, or use an existing card name'
      )
    );
    return false;
  }

  return true;
}

/**
 * Validates Issuer field
 */
export function validateIssuer(
  issuer: any,
  _rowNumber: number,
  result: ValidationResult
): boolean {
  if (!issuer || typeof issuer !== 'string') {
    result.errors.push(
      createError(
        'Issuer',
        'Issuer is required',
        'Provide the card issuer (e.g., Chase, Amex)'
      )
    );
    return false;
  }

  const trimmed = issuer.trim();
  if (!trimmed) {
    result.errors.push(
      createError('Issuer', 'Issuer cannot be empty', 'Provide the issuer name')
    );
    return false;
  }

  if (trimmed.length > 50) {
    result.errors.push(
      createError(
        'Issuer',
        `Issuer exceeds maximum length of 50 characters`,
        'Use a shorter issuer name'
      )
    );
    return false;
  }

  return true;
}

/**
 * Validates AnnualFee field
 *
 * Edge case #5: Negative annual fee
 */
export function validateAnnualFee(
  fee: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: number } {
  // Empty/null is allowed (uses default)
  if (fee === null || fee === '' || fee === undefined) {
    return { valid: true, value: undefined };
  }

  const numeric = parseMonetary(fee);
  if (numeric === null) {
    result.errors.push(
      createError(
        'AnnualFee',
        `Annual fee must be numeric, got '${fee}'`,
        'Enter a number in cents (e.g., 55000 for $550)'
      )
    );
    return { valid: false };
  }

  // Edge case: negative fee
  if (numeric < 0) {
    result.errors.push(
      createError(
        'AnnualFee',
        `Annual fee must be non-negative (got ${numeric} cents)`,
        `Did you mean ${Math.abs(numeric)}? Or use 0 if this card has no fee`
      )
    );
    return { valid: false };
  }

  // Sanity check: max fee
  if (numeric > 999999999) {
    result.errors.push(
      createError(
        'AnnualFee',
        `Annual fee exceeds maximum (${numeric} cents = $${(numeric / 100).toFixed(2)})`,
        'Check that the fee is reasonable'
      )
    );
    return { valid: false };
  }

  return { valid: true, value: numeric };
}

/**
 * Validates RenewalDate field
 *
 * Edge case #4: Invalid date format
 * Edge case #6: Past renewal date
 */
export function validateRenewalDate(
  date: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: Date } {
  if (!date || typeof date !== 'string') {
    result.errors.push(
      createError(
        'RenewalDate',
        'Renewal date is required',
        'Use ISO 8601 format: YYYY-MM-DD (e.g., 2025-12-31)'
      )
    );
    return { valid: false };
  }

  const parsed = parseISODate(date);
  if (!parsed) {
    result.errors.push(
      createError(
        'RenewalDate',
        `Renewal date is not valid ISO 8601 format. Got '${date}'`,
        'Use format YYYY-MM-DD (e.g., 2025-12-31). Not MM/DD/YYYY or DD/MM/YYYY'
      )
    );
    return { valid: false };
  }

  // Must be future date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsed <= today) {
    result.errors.push(
      createError(
        'RenewalDate',
        `Renewal date must be in future (got '${date}', today is '${today.toISOString().split('T')[0]}')`,
        'This card appears to be closed or expired. Mark Status as Inactive if no longer in use'
      )
    );
    return { valid: false };
  }

  // Warn if very far in future (>10 years)
  const tenYearsLater = new Date();
  tenYearsLater.setFullYear(tenYearsLater.getFullYear() + 10);
  if (parsed > tenYearsLater) {
    result.warnings.push(
      createError(
        'RenewalDate',
        `Renewal date is very far in future (${date}). Is this a typo?`,
        'Check that the year is correct',
        'warning'
      )
    );
  }

  return { valid: true, value: parsed };
}

/**
 * Validates CustomName field
 */
export function validateCustomName(
  name: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: string } {
  // Optional field
  if (!name || typeof name !== 'string') {
    return { valid: true, value: undefined };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: true, value: undefined };
  }

  if (trimmed.length > 100) {
    result.errors.push(
      createError(
        'CustomName',
        `Custom name exceeds maximum length of 100 characters`,
        'Use a shorter nickname'
      )
    );
    return { valid: false };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validates Status field
 */
export function validateStatus(
  status: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: string } {
  // Optional field, defaults to 'Active'
  if (!status || typeof status !== 'string') {
    return { valid: true, value: 'Active' };
  }

  const trimmed = status.trim();
  if (!trimmed) {
    return { valid: true, value: 'Active' };
  }

  const valid = ['Active', 'Inactive'].includes(trimmed);
  if (!valid) {
    result.errors.push(
      createError(
        'Status',
        `Status must be 'Active' or 'Inactive', got '${trimmed}'`,
        `Use either 'Active' or 'Inactive'`
      )
    );
    return { valid: false };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validates BenefitName field
 */
export function validateBenefitName(
  name: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: string } {
  if (!name || typeof name !== 'string') {
    result.errors.push(
      createError(
        'BenefitName',
        'Benefit name is required',
        'Provide the benefit name'
      )
    );
    return { valid: false };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    result.errors.push(
      createError(
        'BenefitName',
        'Benefit name cannot be empty',
        'Provide the benefit name'
      )
    );
    return { valid: false };
  }

  if (trimmed.length > 150) {
    result.errors.push(
      createError(
        'BenefitName',
        `Benefit name exceeds maximum length of 150 characters`,
        'Use a shorter name'
      )
    );
    return { valid: false };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validates BenefitType field
 */
export function validateBenefitType(
  type: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: string } {
  if (!type || typeof type !== 'string') {
    result.errors.push(
      createError(
        'BenefitType',
        'Benefit type is required',
        "Use 'StatementCredit' or 'UsagePerk'"
      )
    );
    return { valid: false };
  }

  const trimmed = type.trim();
  const valid = ['StatementCredit', 'UsagePerk'].includes(trimmed);
  if (!valid) {
    result.errors.push(
      createError(
        'BenefitType',
        `Benefit type must be 'StatementCredit' or 'UsagePerk', got '${trimmed}'`,
        "Use exactly 'StatementCredit' or 'UsagePerk'"
      )
    );
    return { valid: false };
  }

  return { valid: true, value: trimmed };
}

/**
 * Validates StickerValue field
 */
export function validateStickerValue(
  value: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: number } {
  const numeric = parseMonetary(value);
  if (numeric === null) {
    result.errors.push(
      createError(
        'StickerValue',
        `Sticker value must be numeric, got '${value}'`,
        'Enter a number in cents (e.g., 30000 for $300)'
      )
    );
    return { valid: false };
  }

  if (numeric <= 0) {
    result.errors.push(
      createError(
        'StickerValue',
        `Sticker value must be positive (got ${numeric} cents)`,
        'Enter a positive value'
      )
    );
    return { valid: false };
  }

  if (numeric > 999999999) {
    result.errors.push(
      createError(
        'StickerValue',
        `Sticker value exceeds maximum`,
        'Check that the value is reasonable'
      )
    );
    return { valid: false };
  }

  return { valid: true, value: numeric };
}

/**
 * Validates DeclaredValue field
 */
export function validateDeclaredValue(
  value: any,
  stickerValue: number,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: number } {
  // Optional field, defaults to stickerValue
  if (value === null || value === '' || value === undefined) {
    return { valid: true, value: stickerValue };
  }

  const numeric = parseMonetary(value);
  if (numeric === null) {
    result.errors.push(
      createError(
        'DeclaredValue',
        `Declared value must be numeric, got '${value}'`,
        'Enter a number in cents or leave blank'
      )
    );
    return { valid: false };
  }

  if (numeric < 0) {
    result.errors.push(
      createError(
        'DeclaredValue',
        `Declared value must be non-negative`,
        'Enter a positive value or 0'
      )
    );
    return { valid: false };
  }

  if (numeric < stickerValue) {
    result.warnings.push(
      createError(
        'DeclaredValue',
        `Declared value is less than sticker value (${numeric} < ${stickerValue})`,
        'You can continue, but verify this is intentional',
        'warning'
      )
    );
  }

  return { valid: true, value: numeric };
}

/**
 * Validates ExpirationDate field
 */
export function validateExpirationDate(
  date: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: Date } {
  // Optional field
  if (!date || typeof date !== 'string') {
    return { valid: true, value: undefined };
  }

  const trimmed = date.trim();
  if (!trimmed) {
    return { valid: true, value: undefined };
  }

  const parsed = parseISODate(trimmed);
  if (!parsed) {
    result.errors.push(
      createError(
        'ExpirationDate',
        `Expiration date is not valid ISO 8601 format. Got '${trimmed}'`,
        'Use format YYYY-MM-DD or leave blank'
      )
    );
    return { valid: false };
  }

  // Warn if past date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (parsed < today) {
    result.warnings.push(
      createError(
        'ExpirationDate',
        `Expiration date is in the past (${trimmed})`,
        'Mark as Claimed/Inactive or update to current year',
        'warning'
      )
    );
  }

  return { valid: true, value: parsed };
}

/**
 * Validates Usage field
 */
export function validateUsage(
  usage: any,
  _rowNumber: number,
  result: ValidationResult
): { valid: boolean; value?: string } {
  // Optional, defaults to 'Unused'
  if (!usage || typeof usage !== 'string') {
    return { valid: true, value: 'Unused' };
  }

  const trimmed = usage.trim();
  if (!trimmed) {
    return { valid: true, value: 'Unused' };
  }

  const valid = ['Claimed', 'Unused'].includes(trimmed);
  if (!valid) {
    result.errors.push(
      createError(
        'Usage',
        `Usage must be 'Claimed' or 'Unused', got '${trimmed}'`,
        "Use either 'Claimed' or 'Unused'"
      )
    );
    return { valid: false };
  }

  return { valid: true, value: trimmed };
}

// ============================================================================
// Main Validation Functions
// ============================================================================

/**
 * Validates a card import record
 *
 * Required fields: CardName, Issuer, RenewalDate
 * Optional fields: AnnualFee, CustomName, Status
 */
export async function validateCardRecord(
  row: Record<string, any>,
  rowNumber: number,
  _mapping?: Record<string, { systemField: string }>
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    normalizedData: {},
  };

  // Validate required fields
  const cardNameValid = await validateCardName(
    row.CardName,
    row.Issuer,
    rowNumber,
    result
  );
  validateIssuer(row.Issuer, rowNumber, result);

  if (!cardNameValid || result.errors.length > 0) {
    result.valid = false;
    return result;
  }

  const renewalDateRes = validateRenewalDate(row.RenewalDate, rowNumber, result);
  if (!renewalDateRes.valid) {
    result.valid = false;
    return result;
  }

  // Validate optional fields
  const annualFeeRes = validateAnnualFee(row.AnnualFee, rowNumber, result);
  const customNameRes = validateCustomName(row.CustomName, rowNumber, result);
  const statusRes = validateStatus(row.Status, rowNumber, result);

  // Build normalized data
  result.normalizedData = {
    recordType: 'Card',
    cardName: row.CardName?.trim(),
    issuer: row.Issuer?.trim(),
    annualFee: annualFeeRes.value,
    renewalDate: renewalDateRes.value,
    customName: customNameRes.value,
    status: statusRes.value,
  };

  result.valid = result.errors.length === 0;
  return result;
}

/**
 * Validates a benefit import record
 *
 * Required fields: CardName, Issuer, BenefitName, BenefitType, StickerValue
 * Optional fields: DeclaredValue, ExpirationDate, Usage
 */
export async function validateBenefitRecord(
  row: Record<string, any>,
  rowNumber: number,
  _mapping?: Record<string, { systemField: string }>
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    normalizedData: {},
  };

  // Validate card fields (to link benefit to card)
  const cardNameValid = await validateCardName(
    row.CardName,
    row.Issuer,
    rowNumber,
    result
  );
  validateIssuer(row.Issuer, rowNumber, result);

  if (!cardNameValid || result.errors.length > 0) {
    result.valid = false;
    return result;
  }

  // Validate benefit fields
  const benefitNameRes = validateBenefitName(row.BenefitName, rowNumber, result);
  const benefitTypeRes = validateBenefitType(row.BenefitType, rowNumber, result);
  const stickerValueRes = validateStickerValue(row.StickerValue, rowNumber, result);

  if (
    !benefitNameRes.valid ||
    !benefitTypeRes.valid ||
    !stickerValueRes.valid ||
    result.errors.length > 0
  ) {
    result.valid = false;
    return result;
  }

  // Validate optional fields
  const declaredValueRes = validateDeclaredValue(
    row.DeclaredValue,
    stickerValueRes.value!,
    rowNumber,
    result
  );
  const expirationDateRes = validateExpirationDate(
    row.ExpirationDate,
    rowNumber,
    result
  );
  const usageRes = validateUsage(row.Usage, rowNumber, result);

  // Build normalized data
  result.normalizedData = {
    recordType: 'Benefit',
    cardName: row.CardName?.trim(),
    issuer: row.Issuer?.trim(),
    benefitName: benefitNameRes.value,
    benefitType: benefitTypeRes.value,
    stickerValue: stickerValueRes.value,
    declaredValue: declaredValueRes.value,
    expirationDate: expirationDateRes.value,
    usage: usageRes.value,
  };

  result.valid = result.errors.length === 0;
  return result;
}

export type { ValidationError, ValidationResult };
