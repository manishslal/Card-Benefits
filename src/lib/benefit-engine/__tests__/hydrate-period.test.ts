/**
 * Unit tests for the hydratePeriodFields utility.
 *
 * Tests both engine-on and engine-off paths, MasterBenefit matching,
 * variable amount resolution, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mock setup — vi.mock calls are hoisted above all other code by Vitest
// ============================================================================

vi.mock('@/lib/feature-flags', () => ({
  featureFlags: {
    BENEFIT_ENGINE_ENABLED: false,
  },
}));

// Now import the function under test and the mocked module
import { hydratePeriodFields } from '../hydrate-period';
import { featureFlags } from '@/lib/feature-flags';

// ============================================================================
// Helpers
// ============================================================================

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

const MOCK_CARD = {
  renewalDate: utc(2025, 5, 15),
  createdAt: utc(2024, 3, 1),
};

const MOCK_MASTER_BENEFIT = {
  id: 'mb-uber-cash',
  name: '$200 Uber Cash',
  type: 'StatementCredit',
  stickerValue: 20000,
  resetCadence: 'ANNUAL',
  claimingCadence: 'MONTHLY',
  claimingAmount: 1500,
  claimingWindowEnd: null,
  variableAmounts: { '12': 3500 },
  isActive: true,
};

const MOCK_MASTER_BENEFIT_NO_VARIABLE = {
  id: 'mb-airline-credit',
  name: '$200 Airline Fee Credit',
  type: 'StatementCredit',
  stickerValue: 20000,
  resetCadence: 'ANNUAL',
  claimingCadence: 'FLEXIBLE_ANNUAL',
  claimingAmount: 20000,
  claimingWindowEnd: null,
  variableAmounts: null,
  isActive: true,
};

// Mock Prisma client for hydrate-period
const mockFindFirstMasterBenefit = vi.fn();
const mockFindUniqueUserCard = vi.fn();

const mockDb = {
  masterBenefit: { findFirst: mockFindFirstMasterBenefit },
  userCard: { findUnique: mockFindUniqueUserCard },
};

// ============================================================================
// Tests
// ============================================================================

describe('hydratePeriodFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset engine to OFF by default
    (featureFlags as any).BENEFIT_ENGINE_ENABLED = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Engine OFF
  // --------------------------------------------------------------------------
  describe('when BENEFIT_ENGINE_ENABLED = false', () => {
    it('returns all-null period fields', async () => {
      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        'Uber Cash',
        'Monthly'
      );

      expect(result.periodStart).toBeNull();
      expect(result.periodEnd).toBeNull();
      expect(result.periodStatus).toBeNull();
      expect(result.masterBenefitId).toBeNull();
      expect(result.resolvedResetCadence).toBe('Monthly');
      expect(result.effectiveStickerValue).toBeNull();
    });

    it('does not make any database calls', async () => {
      await hydratePeriodFields(
        mockDb as any,
        'card-1',
        'Uber Cash',
        'Monthly'
      );

      expect(mockFindFirstMasterBenefit).not.toHaveBeenCalled();
      expect(mockFindUniqueUserCard).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Engine ON — MasterBenefit match
  // --------------------------------------------------------------------------
  describe('when BENEFIT_ENGINE_ENABLED = true and MasterBenefit matches', () => {
    beforeEach(() => {
      (featureFlags as any).BENEFIT_ENGINE_ENABLED = true;
      mockFindFirstMasterBenefit.mockResolvedValue(MOCK_MASTER_BENEFIT);
      mockFindUniqueUserCard.mockResolvedValue(MOCK_CARD);
    });

    it('returns populated period fields with masterBenefitId', async () => {
      const refDate = utc(2026, 6, 15); // June 15, 2026
      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        '$200 Uber Cash',
        'Monthly',
        refDate
      );

      expect(result.periodStart).toBeTruthy();
      expect(result.periodEnd).toBeTruthy();
      expect(result.periodStatus).toBe('ACTIVE');
      expect(result.masterBenefitId).toBe('mb-uber-cash');
      expect(result.resolvedResetCadence).toBe('ANNUAL');
    });

    it('resolves variable amount for December (month 12)', async () => {
      const refDate = utc(2026, 12, 1); // December 1, 2026
      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        '$200 Uber Cash',
        'Monthly',
        refDate
      );

      // December override: $35 = 3500 cents
      expect(result.effectiveStickerValue).toBe(3500);
    });

    it('resolves default amount for non-December months', async () => {
      const refDate = utc(2026, 6, 1); // June 1, 2026
      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        '$200 Uber Cash',
        'Monthly',
        refDate
      );

      // Default: $15 = 1500 cents
      expect(result.effectiveStickerValue).toBe(1500);
    });

    it('returns null effectiveStickerValue when no claimingAmount', async () => {
      const noClaiming = { ...MOCK_MASTER_BENEFIT, claimingAmount: null };
      mockFindFirstMasterBenefit.mockResolvedValue(noClaiming);

      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        '$200 Uber Cash',
        'Monthly',
        utc(2026, 12, 1)
      );

      expect(result.effectiveStickerValue).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // Engine ON — MasterBenefit without variableAmounts
  // --------------------------------------------------------------------------
  describe('when MasterBenefit has no variableAmounts', () => {
    beforeEach(() => {
      (featureFlags as any).BENEFIT_ENGINE_ENABLED = true;
      mockFindFirstMasterBenefit.mockResolvedValue(MOCK_MASTER_BENEFIT_NO_VARIABLE);
      mockFindUniqueUserCard.mockResolvedValue(MOCK_CARD);
    });

    it('returns claimingAmount as effectiveStickerValue', async () => {
      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        '$200 Airline Fee Credit',
        'CalendarYear',
        utc(2026, 6, 1)
      );

      expect(result.effectiveStickerValue).toBe(20000);
      expect(result.masterBenefitId).toBe('mb-airline-credit');
    });
  });

  // --------------------------------------------------------------------------
  // Engine ON — No MasterBenefit match
  // --------------------------------------------------------------------------
  describe('when BENEFIT_ENGINE_ENABLED = true but no MasterBenefit match', () => {
    beforeEach(() => {
      (featureFlags as any).BENEFIT_ENGINE_ENABLED = true;
      mockFindFirstMasterBenefit.mockResolvedValue(null);
      mockFindUniqueUserCard.mockResolvedValue(MOCK_CARD);
    });

    it('still returns period fields based on fallback cadence', async () => {
      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        'Custom Benefit',
        'Monthly',
        utc(2026, 4, 8)
      );

      expect(result.periodStart).toBeTruthy();
      expect(result.periodEnd).toBeTruthy();
      expect(result.periodStatus).toBe('ACTIVE');
      expect(result.masterBenefitId).toBeNull();
      expect(result.resolvedResetCadence).toBe('Monthly');
      expect(result.effectiveStickerValue).toBeNull();
    });

    it('does not crash and uses card createdAt if renewalDate missing', async () => {
      mockFindUniqueUserCard.mockResolvedValue({ renewalDate: null, createdAt: utc(2024, 1, 1) });

      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        'Custom Benefit',
        'CardmemberYear',
        utc(2026, 4, 8)
      );

      expect(result.periodStart).toBeTruthy();
      expect(result.periodStatus).toBe('ACTIVE');
    });

    it('handles missing card gracefully', async () => {
      mockFindUniqueUserCard.mockResolvedValue(null);
      const refDate = utc(2026, 4, 8);

      const result = await hydratePeriodFields(
        mockDb as any,
        'nonexistent-card',
        'Custom Benefit',
        'Monthly',
        refDate
      );

      // Should still return valid period fields using refDate as fallback
      expect(result.periodStart).toBeTruthy();
      expect(result.periodStatus).toBe('ACTIVE');
    });
  });

  // --------------------------------------------------------------------------
  // Edge cases
  // --------------------------------------------------------------------------
  describe('edge cases', () => {
    beforeEach(() => {
      (featureFlags as any).BENEFIT_ENGINE_ENABLED = true;
    });

    it('handles OneTime cadence (no expiration)', async () => {
      mockFindFirstMasterBenefit.mockResolvedValue(null);
      mockFindUniqueUserCard.mockResolvedValue(MOCK_CARD);

      const result = await hydratePeriodFields(
        mockDb as any,
        'card-1',
        'Sign-up Bonus',
        'OneTime',
        utc(2026, 4, 8)
      );

      expect(result.periodStart).toBeTruthy();
      expect(result.periodEnd).toBeNull(); // ONE_TIME has no end
      expect(result.periodStatus).toBe('ACTIVE');
    });
  });
});
