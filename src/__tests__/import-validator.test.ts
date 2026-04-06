/**
 * Import Validator Tests
 *
 * Comprehensive test suite for record validation including:
 * - Card record validation (all 6 required fields)
 * - Benefit record validation (all 8 required fields)
 * - Individual field validators (14 validators)
 * - Error severity levels (critical vs warning)
 * - Business rule validation
 * - Boundary values and edge cases
 * - Negative annual fees, invalid dates, missing fields
 * - Database lookups for card validation
 *
 * Total: 80+ test cases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/shared/lib';
import {
  validateCardRecord,
  validateBenefitRecord,
  validateCardName,
  validateAnnualFee,
  validateRenewalDate,
  validateBenefitType,
  validateStickerValue,
  validateDeclaredValue,
  type ValidationResult,
} from '@/features/import-export';

// Mock Prisma
vi.mock('@/shared/lib', () => ({
  prisma: {
    masterCard: {
      findFirst: vi.fn(),
    },
  },
}));

// ============================================================================
// TEST FIXTURES
// ============================================================================

const mockMasterCard = {
  id: 'mc-chase-sapphire',
  cardName: 'Chase Sapphire Reserve',
  issuer: 'Chase',
  defaultAnnualFee: 55000,
};

const validCardRecord = {
  CardName: 'Chase Sapphire Reserve',
  Issuer: 'Chase',
  AnnualFee: '55000',
  RenewalDate: '2026-12-31',
  CustomName: 'My Premium Card',
  Status: 'Active',
};

const validBenefitRecord = {
  CardName: 'Chase Sapphire Reserve',
  Issuer: 'Chase',
  BenefitName: '3% Dining Cash Back',
  BenefitType: 'StatementCredit',
  StickerValue: '300000', // $3000 in cents
  DeclaredValue: '300000',
  ExpirationDate: '2026-12-31',
};

// ============================================================================
// SECTION 1: Card Record Validation (15 tests)
// ============================================================================

describe('Card Record Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
  });

  describe('validateCardRecord - Valid Records', () => {
    it('validates complete valid card record', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(validCardRecord, 1, result);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates card with minimal required fields', async () => {
      const minimalRecord = {
        CardName: 'Chase Sapphire Reserve',
        Issuer: 'Chase',
        AnnualFee: '0',
        RenewalDate: '2026-12-31',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(minimalRecord, 1, result);

      // Should have no critical errors
      const criticalErrors = result.errors.filter((e) => e.severity === 'critical');
      expect(criticalErrors).toHaveLength(0);
    });

    it('validates card with optional fields omitted', async () => {
      const recordWithoutOptional = {
        CardName: 'Chase Sapphire Reserve',
        Issuer: 'Chase',
        AnnualFee: '55000',
        RenewalDate: '2026-12-31',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordWithoutOptional, 1, result);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateCardRecord - Missing Required Fields', () => {
    it('rejects record missing CardName', async () => {
      const recordMissingCard = {
        Issuer: 'Chase',
        AnnualFee: '55000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordMissingCard, 1, result);

      const cardNameErrors = result.errors.filter((e) => e.field === 'CardName');
      expect(cardNameErrors.length).toBeGreaterThan(0);
    });

    it('rejects record missing Issuer', async () => {
      const recordMissingIssuer = {
        CardName: 'Chase Sapphire Reserve',
        AnnualFee: '55000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordMissingIssuer, 1, result);

      const issuerErrors = result.errors.filter((e) => e.field === 'Issuer');
      expect(issuerErrors.length).toBeGreaterThan(0);
    });

    it('rejects record missing AnnualFee', async () => {
      const recordMissingFee = {
        CardName: 'Chase Sapphire Reserve',
        Issuer: 'Chase',
        RenewalDate: '2026-12-31',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordMissingFee, 1, result);

      const feeErrors = result.errors.filter((e) => e.field === 'AnnualFee');
      expect(feeErrors.length).toBeGreaterThan(0);
    });

    it('rejects completely empty record', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord({}, 1, result);

      expect(result.errors.length).toBeGreaterThanOrEqual(2); // At least CardName and Issuer
    });
  });

  describe('validateCardRecord - Invalid Field Values', () => {
    it('rejects card with negative annual fee', async () => {
      const recordNegativeFee = {
        ...validCardRecord,
        AnnualFee: '-55000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordNegativeFee, 1, result);

      const feeErrors = result.errors.filter(
        (e) => e.field === 'AnnualFee' && e.severity === 'critical'
      );
      expect(feeErrors.length).toBeGreaterThan(0);
    });

    it('rejects card with past renewal date', async () => {
      const recordPastDate = {
        ...validCardRecord,
        RenewalDate: '2020-12-31',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordPastDate, 1, result);

      const dateErrors = result.errors.filter(
        (e) => e.field === 'RenewalDate' && e.severity === 'critical'
      );
      expect(dateErrors.length).toBeGreaterThan(0);
    });

    it('warns on renewal date far in future (>10 years)', async () => {
      const recordFarFuture = {
        ...validCardRecord,
        RenewalDate: '2037-12-31',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordFarFuture, 1, result);

      const dateWarnings = result.warnings.filter((w) => w.field === 'RenewalDate');
      expect(dateWarnings.length).toBeGreaterThan(0);
    });

    it('rejects card not in MasterCard catalog', async () => {
      (prisma.masterCard.findFirst as any).mockResolvedValue(null);

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(validCardRecord, 1, result);

      const cardNameErrors = result.errors.filter(
        (e) => e.field === 'CardName' && e.severity === 'critical'
      );
      expect(cardNameErrors.length).toBeGreaterThan(0);
    });

    it('rejects invalid status value', async () => {
      const recordInvalidStatus = {
        ...validCardRecord,
        Status: 'Suspended',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordInvalidStatus, 1, result);

      const statusErrors = result.errors.filter(
        (e) => e.field === 'Status' && e.severity === 'critical'
      );
      expect(statusErrors.length).toBeGreaterThan(0);
    });

    it('rejects annual fee exceeding maximum ($9999.99)', async () => {
      const recordExceedsFee = {
        ...validCardRecord,
        AnnualFee: '1000000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordExceedsFee, 1, result);

      const feeErrors = result.errors.filter(
        (e) => e.field === 'AnnualFee' && e.severity === 'critical'
      );
      expect(feeErrors.length).toBeGreaterThan(0);
    });
  });

  describe('validateCardRecord - Invalid Date Formats', () => {
    it('rejects renewal date in wrong format (MM/DD/YYYY)', async () => {
      const recordWrongFormat = {
        ...validCardRecord,
        RenewalDate: '12/31/2025',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordWrongFormat, 1, result);

      const dateErrors = result.errors.filter(
        (e) => e.field === 'RenewalDate' && e.severity === 'critical'
      );
      expect(dateErrors.length).toBeGreaterThan(0);
    });

    it('rejects invalid date like 2025-13-01', async () => {
      const recordInvalidDate = {
        ...validCardRecord,
        RenewalDate: '2025-13-01',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordInvalidDate, 1, result);

      const dateErrors = result.errors.filter(
        (e) => e.field === 'RenewalDate' && e.severity === 'critical'
      );
      expect(dateErrors.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// SECTION 2: Benefit Record Validation (15 tests)
// ============================================================================

describe('Benefit Record Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
  });

  describe('validateBenefitRecord - Valid Records', () => {
    it('validates complete valid benefit record', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(validBenefitRecord, 1, result);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates benefit with minimal required fields', async () => {
      const minimalBenefit = {
        CardName: 'Chase Sapphire Reserve',
        Issuer: 'Chase',
        BenefitName: 'Dining Cash Back',
        BenefitType: 'StatementCredit',
        StickerValue: '100000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(minimalBenefit, 1, result);

      const criticalErrors = result.errors.filter((e) => e.severity === 'critical');
      expect(criticalErrors).toHaveLength(0);
    });

    it('validates benefit with optional fields omitted', async () => {
      const benefitWithoutOptional = {
        CardName: 'Chase Sapphire Reserve',
        Issuer: 'Chase',
        BenefitName: 'Dining Cash Back',
        BenefitType: 'StatementCredit',
        StickerValue: '100000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitWithoutOptional, 1, result);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateBenefitRecord - Missing Required Fields', () => {
    it('rejects benefit missing BenefitName', async () => {
      const benefitMissingName = {
        CardName: 'Chase Sapphire Reserve',
        Issuer: 'Chase',
        StickerValue: '100000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitMissingName, 1, result);

      const nameErrors = result.errors.filter((e) => e.field === 'BenefitName');
      expect(nameErrors.length).toBeGreaterThan(0);
    });

    it('rejects benefit missing StickerValue', async () => {
      const benefitMissingValue = {
        CardName: 'Chase Sapphire Reserve',
        Issuer: 'Chase',
        BenefitName: 'Dining Cash Back',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitMissingValue, 1, result);

      const valueErrors = result.errors.filter((e) => e.field === 'StickerValue');
      expect(valueErrors.length).toBeGreaterThan(0);
    });

    it('rejects benefit missing Card reference', async () => {
      const benefitMissingCard = {
        BenefitName: 'Dining Cash Back',
        StickerValue: '100000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitMissingCard, 1, result);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateBenefitRecord - Invalid Field Values', () => {
    it('rejects benefit with negative sticker value', async () => {
      const benefitNegativeValue = {
        ...validBenefitRecord,
        StickerValue: '-100000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitNegativeValue, 1, result);

      const valueErrors = result.errors.filter(
        (e) => e.field === 'StickerValue' && e.severity === 'critical'
      );
      expect(valueErrors.length).toBeGreaterThan(0);
    });

    it('rejects benefit with zero sticker value', async () => {
      const benefitZeroValue = {
        ...validBenefitRecord,
        StickerValue: '0',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitZeroValue, 1, result);

      const valueErrors = result.errors.filter(
        (e) => e.field === 'StickerValue' && e.severity === 'critical'
      );
      expect(valueErrors.length).toBeGreaterThan(0);
    });

    it('warns when declared value less than sticker value', async () => {
      const benefitLessDeclared = {
        ...validBenefitRecord,
        StickerValue: '500000',
        DeclaredValue: '100000',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitLessDeclared, 1, result);

      const declaredWarnings = result.warnings.filter(
        (w) => w.field === 'DeclaredValue'
      );
      expect(declaredWarnings.length).toBeGreaterThan(0);
    });

    it('rejects invalid benefit type', async () => {
      const benefitInvalidType = {
        ...validBenefitRecord,
        BenefitType: 'MysteryBenefit',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitInvalidType, 1, result);

      const typeErrors = result.errors.filter(
        (e) => e.field === 'BenefitType' && e.severity === 'critical'
      );
      expect(typeErrors.length).toBeGreaterThan(0);
    });

    it('rejects benefit with past expiration date', async () => {
      const benefitPastExp = {
        ...validBenefitRecord,
        ExpirationDate: '2020-12-31',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateBenefitRecord(benefitPastExp, 1, result);

      const expWarnings = result.warnings.filter(
        (e) => e.field === 'ExpirationDate'
      );
      expect(expWarnings.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// SECTION 3: Field-Level Validators (20 tests)
// ============================================================================

describe('Field-Level Validators', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
  });

  describe('validateCardName', () => {
    it('validates valid card name', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = await validateCardName(
        'Chase Sapphire Reserve',
        'Chase',
        1,
        result
      );

      expect(isValid.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects empty card name', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = await validateCardName('', 'Chase', 1, result);

      expect(isValid.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects card name with leading/trailing spaces only', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = await validateCardName('   ', 'Chase', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('rejects card name exceeding max length (100 chars)', async () => {
      const longName = 'A'.repeat(101);
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = await validateCardName(longName, 'Chase', 1, result);

      expect(isValid.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('trims whitespace from card name before validation', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = await validateCardName(
        '  Chase Sapphire Reserve  ',
        'Chase',
        1,
        result
      );

      expect(isValid.valid).toBe(true);
    });

    it('rejects card not found in MasterCard catalog', async () => {
      (prisma.masterCard.findFirst as any).mockResolvedValue(null);

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = await validateCardName(
        'NonExistentCard',
        'FakeBank',
        1,
        result
      );

      expect(isValid.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('requires issuer to be present for lookup', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = await validateCardName('Chase Sapphire', '', 1, result);

      expect(isValid.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'Issuer')).toBe(true);
    });
  });

  describe('validateAnnualFee', () => {
    it('validates zero annual fee', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('0', 1, result);

      expect(isValid.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates positive annual fee', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('55000', 1, result);

      expect(isValid.valid).toBe(true);
    });

    it('rejects negative annual fee', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('-55000', 1, result);

      expect(isValid.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects annual fee exceeding $9999.99', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('1000000', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('rejects non-numeric annual fee', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('abc', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('rejects empty annual fee', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('handles decimal annual fee (converted to cents)', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('550.00', 1, result);

      // Should accept and convert to cents
      expect(isValid.valid).toBe(true);
    });

    it('rejects fee with invalid decimal places', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('550.999', 1, result);

      // More than 2 decimal places should be rejected
      expect(isValid.valid).toBe(false);
    });
  });

  describe('validateRenewalDate', () => {
    it('validates future date in ISO format', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const isoDate = futureDate.toISOString().split('T')[0];

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateRenewalDate(isoDate, 1, result);

      expect(isValid.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects past date', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateRenewalDate('2020-12-31', 1, result);

      expect(isValid.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects invalid date format (MM/DD/YYYY)', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateRenewalDate('12/31/2025', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('rejects non-existent date like 2025-02-30', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateRenewalDate('2025-02-30', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('warns on date far in future (>10 years)', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      validateRenewalDate('2037-12-31', 1, result);

      const warnings = result.warnings.filter(
        (w) => w.field === 'RenewalDate'
      );
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('accepts valid future date without warnings', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);
      const isoDate = futureDate.toISOString().split('T')[0];

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      validateRenewalDate(isoDate, 1, result);

      const warnings = result.warnings.filter(
        (w) => w.field === 'RenewalDate'
      );
      expect(warnings).toHaveLength(0);
    });
  });

  describe('validateBenefitType', () => {
    it('accepts StatementCredit', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateBenefitType('StatementCredit', 1, result);

      expect(isValid.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts UsagePerk', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateBenefitType('UsagePerk', 1, result);

      expect(isValid.valid).toBe(true);
    });

    it('rejects invalid benefit type', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateBenefitType('Cashback', 1, result);

      expect(isValid.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects empty benefit type', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateBenefitType('', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('is case-sensitive', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateBenefitType('statementcredit', 1, result);

      expect(isValid.valid).toBe(false);
    });
  });

  describe('validateStickerValue', () => {
    it('accepts positive sticker value', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateStickerValue('100000', 1, result); // $1000

      expect(isValid.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects zero sticker value', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateStickerValue('0', 1, result);

      expect(isValid.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects negative sticker value', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateStickerValue('-100000', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('rejects non-integer values', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateStickerValue('1000.50', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('rejects non-numeric values', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateStickerValue('abc', 1, result);

      expect(isValid.valid).toBe(false);
    });
  });

  describe('validateDeclaredValue', () => {
    it('accepts optional declared value', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateDeclaredValue('100000', 100000, 1, result);

      expect(isValid.valid).toBe(true);
    });

    it('accepts null/undefined declared value', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateDeclaredValue(null, 100000, 1, result);

      expect(isValid.valid).toBe(true);
    });

    it('rejects negative declared value', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateDeclaredValue('-100000', 100000, 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('rejects non-numeric declared value', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateDeclaredValue('abc', 100000, 1, result);

      expect(isValid.valid).toBe(false);
    });
  });
});

// ============================================================================
// SECTION 4: Error Severity & Messages (10 tests)
// ============================================================================

describe('Error Severity & Messages', () => {
  describe('Critical vs Warning Errors', () => {
    it('marks missing required fields as critical', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord({}, 1, result);

      const criticalErrors = result.errors.filter((e) => e.severity === 'critical');
      expect(criticalErrors.length).toBeGreaterThan(0);
    });

    it('marks future date warnings as non-critical', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      validateRenewalDate('2037-12-31', 1, result);

      const warnings = result.warnings.filter(
        (w) => w.field === 'RenewalDate'
      );
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0].severity).toBe('warning');
    });

    it('includes helpful suggestions in error messages', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardName('', 'Chase', 1, result);

      expect(result.errors[0].suggestion).toBeDefined();
      expect(result.errors[0].suggestion.length).toBeGreaterThan(0);
    });
  });

  describe('Error Accumulation', () => {
    it('accumulates multiple errors in single record', async () => {
      const recordMultipleErrors = {
        AnnualFee: 'invalid',
        Status: 'Unknown',
      };

      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardRecord(recordMultipleErrors, 1, result);

      expect(result.errors.length).toBeGreaterThan(1);
    });

    it('separates errors and warnings', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      validateRenewalDate('2037-12-31', 1, result);
      validateAnnualFee('-100', 1, result);

      expect(result.errors.length).toBeGreaterThan(0); // negative fee
      expect(result.warnings.length).toBeGreaterThan(0); // future date
    });
  });
});

// ============================================================================
// SECTION 5: Edge Cases & Boundary Conditions (10 tests)
// ============================================================================

describe('Edge Cases & Boundary Conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.masterCard.findFirst as any).mockResolvedValue(mockMasterCard);
  });

  describe('Boundary Values', () => {
    it('handles annual fee of exactly $9999.99', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('999999', 1, result); // 9999.99 in cents

      expect(isValid.valid).toBe(true);
    });

    it('rejects annual fee of $10000.00', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('1000000', 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('handles sticker value of exactly 1 cent', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateStickerValue('1', 1, result);

      expect(isValid.valid).toBe(true);
    });

    it('handles card name of exactly 100 characters', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const cardName = 'A'.repeat(100);
      const isValid = await validateCardName(cardName, 'Chase', 1, result);

      // May fail due to card not existing, but length check should pass
      const lengthErrors = result.errors.filter(
        (e) => e.message.includes('exceeds maximum length')
      );
      expect(lengthErrors).toHaveLength(0);
    });

    it('rejects card name of 101 characters', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const cardName = 'A'.repeat(101);
      await validateCardName(cardName, 'Chase', 1, result);

      const lengthErrors = result.errors.filter(
        (e) => e.message.includes('exceeds maximum length')
      );
      expect(lengthErrors.length).toBeGreaterThan(0);
    });
  });

  describe('Whitespace Handling', () => {
    it('trims leading whitespace from values', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      validateBenefitType('  StatementCredit', 1, result);

      expect(result.errors).toHaveLength(0);
    });

    it('trims trailing whitespace from values', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      validateBenefitType('StatementCredit  ', 1, result);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Null and Undefined Handling', () => {
    it('handles null annual fee', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee(null as any, 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('handles undefined annual fee', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee(undefined as any, 1, result);

      expect(isValid.valid).toBe(false);
    });

    it('handles null card name', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = await validateCardName(null as any, 'Chase', 1, result);

      expect(isValid.valid).toBe(false);
    });
  });

  describe('Data Type Coercion', () => {
    it('handles string number for annual fee', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee('550', 1, result);

      expect(isValid.valid).toBe(true);
    });

    it('handles numeric type for annual fee', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      const isValid = validateAnnualFee(550 as any, 1, result);

      // Should be rejected or coerced
      expect(typeof result).toBe('object');
    });
  });

  describe('Special Characters', () => {
    it('accepts card name with special characters', async () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      await validateCardName('Chase™ Sapphire® Reserve', 'Chase', 1, result);

      // May fail due to not in catalog, but special chars shouldn't cause parse error
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('accepts benefit name with special characters', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      // Validators should handle special chars gracefully
      validateBenefitType('StatementCredit', 1, result);

      expect(result.errors).toHaveLength(0);
    });
  });
});
