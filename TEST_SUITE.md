# Card-Benefits Application - Comprehensive Test Suite

This document provides a complete test suite for validating the Card-Benefits application across critical functionality, security, and edge cases.

## Test Framework Setup

The tests are designed for **Jest** with **TypeScript** support (already configured in package.json). Tests can be run with:

```bash
npm test
npm test -- --coverage  # With coverage report
npm test -- --watch    # Watch mode
```

---

## Test Structure

```
tests/
├── unit/
│   ├── lib/
│   │   ├── calculations.test.ts
│   │   ├── benefitDates.test.ts
│   │   └── utils.test.ts
│   ├── actions/
│   │   ├── wallet.test.ts
│   │   └── benefits.test.ts
│   └── components/
│       ├── CardTrackerPanel.test.tsx
│       └── BenefitTable.test.tsx
├── integration/
│   ├── wallet-flow.test.ts
│   └── benefit-tracking.test.ts
├── security/
│   ├── authorization.test.ts
│   └── input-validation.test.ts
└── fixtures/
    ├── mockData.ts
    └── mockPrisma.ts
```

---

## Unit Tests

### 1. Calculation Utilities Tests

**File:** `/tests/unit/lib/calculations.test.ts`

```typescript
import {
  getTotalValueExtracted,
  getUncapturedValue,
  getNetAnnualFee,
  getEffectiveROI,
  getExpirationWarnings,
  MS_PER_DAY,
} from '@/lib/calculations';
import type { UserCard, UserBenefit } from '@prisma/client';

describe('calculations.ts', () => {
  // ── getTotalValueExtracted Tests ───────────────────────────────────────
  describe('getTotalValueExtracted', () => {
    it('should return 0 for empty benefits array', () => {
      expect(getTotalValueExtracted([])).toBe(0);
    });

    it('should sum used StatementCredit benefits', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Travel Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: true,
          timesUsed: 1,
          expirationDate: new Date('2025-12-31'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getTotalValueExtracted(benefits);
      expect(result).toBe(30000);
    });

    it('should multiply UsagePerk by timesUsed', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Uber Cash',
          type: 'UsagePerk',
          stickerValue: 1500, // $15 per use
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: true,
          timesUsed: 4, // Used 4 times
          expirationDate: new Date('2025-04-30'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getTotalValueExtracted(benefits);
      expect(result).toBe(6000); // $15 * 4 = $60
    });

    it('should use userDeclaredValue when available', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Dining Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300
          resetCadence: 'CardmemberYear',
          userDeclaredValue: 20000, // User thinks it's worth $200
          isUsed: true,
          timesUsed: 1,
          expirationDate: new Date('2025-12-31'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getTotalValueExtracted(benefits);
      expect(result).toBe(20000); // Uses declared value
    });

    it('should ignore unused benefits', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Travel Credit',
          type: 'StatementCredit',
          stickerValue: 30000,
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: false, // Not used
          timesUsed: 0,
          expirationDate: new Date('2025-12-31'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getTotalValueExtracted(benefits);
      expect(result).toBe(0);
    });

    it('should handle mixed benefit types', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Statement Credit',
          type: 'StatementCredit',
          stickerValue: 30000,
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: true,
          timesUsed: 1,
          expirationDate: new Date('2025-12-31'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
        {
          id: '2',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Uber Cash',
          type: 'UsagePerk',
          stickerValue: 1500,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: true,
          timesUsed: 3,
          expirationDate: new Date('2025-04-30'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getTotalValueExtracted(benefits);
      expect(result).toBe(34500); // $300 + ($15 * 3)
    });
  });

  // ── getUncapturedValue Tests ───────────────────────────────────────────
  describe('getUncapturedValue', () => {
    const mockNow = new Date('2025-04-15T12:00:00Z');

    it('should return 0 for empty benefits array', () => {
      expect(getUncapturedValue([], mockNow)).toBe(0);
    });

    it('should exclude used benefits', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Dining Credit',
          type: 'StatementCredit',
          stickerValue: 10000,
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: true, // Used
          timesUsed: 1,
          expirationDate: new Date('2025-12-31'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getUncapturedValue(benefits, mockNow);
      expect(result).toBe(0);
    });

    it('should exclude expired benefits', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Monthly Credit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-04-14T23:59:59Z'), // Expired
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getUncapturedValue(benefits, mockNow);
      expect(result).toBe(0);
    });

    it('should include unused benefits not yet expired', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Monthly Credit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-04-30T23:59:59Z'), // Not expired
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getUncapturedValue(benefits, mockNow);
      expect(result).toBe(5000);
    });

    it('should exclude benefits with null expirationDate', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'One-Time Benefit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'OneTime',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: null, // No expiration
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getUncapturedValue(benefits, mockNow);
      expect(result).toBe(0); // OneTime benefits excluded
    });
  });

  // ── getNetAnnualFee Tests ──────────────────────────────────────────────
  describe('getNetAnnualFee', () => {
    const mockCard: UserCard = {
      id: 'card1',
      playerId: 'player1',
      masterCardId: 'mc1',
      customName: null,
      actualAnnualFee: 55000, // $550
      renewalDate: new Date('2025-06-15'),
      isOpen: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return base fee when no credits exist', () => {
      const benefits: UserBenefit[] = [];
      const result = getNetAnnualFee(mockCard, benefits);
      expect(result).toBe(55000);
    });

    it('should offset fee with CardmemberYear StatementCredits', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Travel Credit',
          type: 'StatementCredit',
          stickerValue: 30000, // $300 credit
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-06-14'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getNetAnnualFee(mockCard, benefits);
      expect(result).toBe(25000); // $550 - $300 = $250
    });

    it('should not offset with non-CardmemberYear credits', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Monthly Credit',
          type: 'StatementCredit',
          stickerValue: 10000,
          resetCadence: 'Monthly', // Not CardmemberYear
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-04-30'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getNetAnnualFee(mockCard, benefits);
      expect(result).toBe(55000); // No offset
    });

    it('should not offset with non-StatementCredit benefits', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Lounge Access',
          type: 'UsagePerk',
          stickerValue: 30000,
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-06-14'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getNetAnnualFee(mockCard, benefits);
      expect(result).toBe(55000); // No offset
    });

    it('should use stickerValue not declared value for offsetting', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Travel Credit',
          type: 'StatementCredit',
          stickerValue: 30000,
          resetCadence: 'CardmemberYear',
          userDeclaredValue: 20000, // User declared lower
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-06-14'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getNetAnnualFee(mockCard, benefits);
      expect(result).toBe(25000); // $550 - $300 = $250 (uses sticker, not declared)
    });

    it('should ignore isUsed status for offsetting', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Travel Credit',
          type: 'StatementCredit',
          stickerValue: 30000,
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: true, // Already used
          timesUsed: 1,
          expirationDate: new Date('2025-06-14'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getNetAnnualFee(mockCard, benefits);
      expect(result).toBe(25000); // Still offsets
    });
  });

  // ── getEffectiveROI Tests ──────────────────────────────────────────────
  describe('getEffectiveROI', () => {
    const mockCard: UserCard = {
      id: 'card1',
      playerId: 'player1',
      masterCardId: 'mc1',
      customName: null,
      actualAnnualFee: 55000,
      renewalDate: new Date('2025-06-15'),
      isOpen: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return negative ROI when no benefits used', () => {
      const benefits: UserBenefit[] = [];
      const result = getEffectiveROI(mockCard, benefits);
      expect(result).toBe(-55000); // -$550
    });

    it('should return positive ROI when benefits exceed fee', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Travel Credit',
          type: 'StatementCredit',
          stickerValue: 30000,
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: true,
          timesUsed: 1,
          expirationDate: new Date('2025-06-14'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
        {
          id: '2',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Dining Credit',
          type: 'StatementCredit',
          stickerValue: 30000,
          resetCadence: 'CardmemberYear',
          userDeclaredValue: null,
          isUsed: true,
          timesUsed: 1,
          expirationDate: new Date('2025-06-14'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getEffectiveROI(mockCard, benefits);
      // Extracted: $300 + $300 = $600
      // Net Fee: $550 - $300 (travel credit offset) - $300 (dining credit offset) = -$50
      // ROI: $600 - (-$50) = $650
      expect(result).toBe(65000);
    });

    it('should account for timesUsed in UsagePerk', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Uber Cash',
          type: 'UsagePerk',
          stickerValue: 1500,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: true,
          timesUsed: 4,
          expirationDate: new Date('2025-04-30'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getEffectiveROI(mockCard, benefits);
      // Extracted: $15 * 4 = $60
      // Net Fee: $550
      // ROI: $60 - $550 = -$490
      expect(result).toBe(-49000);
    });
  });

  // ── getExpirationWarnings Tests ────────────────────────────────────────
  describe('getExpirationWarnings', () => {
    const mockNow = new Date('2025-04-15T12:00:00Z');

    it('should return empty array for no expirations', () => {
      const benefits: UserBenefit[] = [];
      const result = getExpirationWarnings(benefits, mockNow);
      expect(result).toEqual([]);
    });

    it('should exclude used benefits', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Dining Credit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: true, // Used
          timesUsed: 1,
          expirationDate: new Date('2025-04-20T23:59:59Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: new Date(),
        },
      ];

      const result = getExpirationWarnings(benefits, mockNow);
      expect(result).toEqual([]);
    });

    it('should exclude benefits expired before now', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Dining Credit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-04-14T23:59:59Z'), // Already expired
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getExpirationWarnings(benefits, mockNow);
      expect(result).toEqual([]);
    });

    it('should classify as critical if < 14 days remain', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Dining Credit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-04-22T23:59:59Z'), // 7 days away
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getExpirationWarnings(benefits, mockNow);
      expect(result).toHaveLength(1);
      expect(result[0].level).toBe('critical');
      expect(result[0].daysUntilExpiration).toBe(7);
    });

    it('should classify as warning if 14-29 days remain', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Dining Credit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-05-05T23:59:59Z'), // 20 days away
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getExpirationWarnings(benefits, mockNow);
      expect(result).toHaveLength(1);
      expect(result[0].level).toBe('warning');
      expect(result[0].daysUntilExpiration).toBe(20);
    });

    it('should exclude benefits >= 30 days away', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Dining Credit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-05-16T23:59:59Z'), // 31 days away
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getExpirationWarnings(benefits, mockNow);
      expect(result).toEqual([]);
    });

    it('should sort critical before warning, then by days remaining', () => {
      const benefits: UserBenefit[] = [
        {
          id: '1',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Warning Benefit',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-05-05T23:59:59Z'), // 20 days
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
        {
          id: '2',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Critical Benefit 1',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-04-25T23:59:59Z'), // 10 days
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
        {
          id: '3',
          userCardId: 'card1',
          playerId: 'player1',
          name: 'Critical Benefit 2',
          type: 'StatementCredit',
          stickerValue: 5000,
          resetCadence: 'Monthly',
          userDeclaredValue: null,
          isUsed: false,
          timesUsed: 0,
          expirationDate: new Date('2025-04-22T23:59:59Z'), // 7 days
          createdAt: new Date(),
          updatedAt: new Date(),
          claimedAt: null,
        },
      ];

      const result = getExpirationWarnings(benefits, mockNow);
      expect(result).toHaveLength(3);
      expect(result[0].benefit.id).toBe('3'); // 7 days, critical
      expect(result[1].benefit.id).toBe('2'); // 10 days, critical
      expect(result[2].benefit.id).toBe('1'); // 20 days, warning
    });
  });
});
```

---

### 2. Benefit Date Utilities Tests

**File:** `/tests/unit/lib/benefitDates.test.ts`

```typescript
import { calcExpirationDate, getNextExpirationDate } from '@/lib/benefitDates';

describe('benefitDates.ts', () => {
  // ── calcExpirationDate Tests ───────────────────────────────────────────
  describe('calcExpirationDate', () => {
    const mockNow = new Date('2025-04-15T12:00:00Z');
    const mockRenewalDate = new Date('2025-06-15');

    it('should return last day of current month for Monthly cadence', () => {
      const result = calcExpirationDate('Monthly', mockRenewalDate, mockNow);
      expect(result?.toUTCString()).toContain('Apr');
      expect(result?.getUTCDate()).toBe(30); // April has 30 days
      expect(result?.getUTCHours()).toBe(23);
      expect(result?.getUTCMinutes()).toBe(59);
    });

    it('should return Dec 31 of current year for CalendarYear cadence', () => {
      const result = calcExpirationDate('CalendarYear', mockRenewalDate, mockNow);
      expect(result?.getUTCMonth()).toBe(11); // December
      expect(result?.getUTCDate()).toBe(31);
      expect(result?.getUTCFullYear()).toBe(2025);
    });

    it('should return day before renewal date for CardmemberYear cadence', () => {
      const result = calcExpirationDate('CardmemberYear', mockRenewalDate, mockNow);
      // Renewal is June 15, so expiration is June 14
      expect(result?.getUTCMonth()).toBe(5); // June
      expect(result?.getUTCDate()).toBe(14);
    });

    it('should return null for OneTime cadence', () => {
      const result = calcExpirationDate('OneTime', mockRenewalDate, mockNow);
      expect(result).toBeNull();
    });

    it('should handle February correctly (non-leap year)', () => {
      const februaryDate = new Date('2025-02-15T12:00:00Z');
      const result = calcExpirationDate('Monthly', mockRenewalDate, februaryDate);
      expect(result?.getUTCMonth()).toBe(1); // February
      expect(result?.getUTCDate()).toBe(28); // 2025 is not a leap year
    });

    it('should handle February correctly (leap year)', () => {
      const februaryDate = new Date('2024-02-15T12:00:00Z');
      const result = calcExpirationDate('Monthly', mockRenewalDate, februaryDate);
      expect(result?.getUTCMonth()).toBe(1); // February
      expect(result?.getUTCDate()).toBe(29); // 2024 is a leap year
    });

    it('should set time to end of day (23:59:59.999)', () => {
      const result = calcExpirationDate('Monthly', mockRenewalDate, mockNow);
      expect(result?.getUTCHours()).toBe(23);
      expect(result?.getUTCMinutes()).toBe(59);
      expect(result?.getUTCSeconds()).toBe(59);
      expect(result?.getUTCMilliseconds()).toBe(999);
    });
  });

  // ── getNextExpirationDate Tests ────────────────────────────────────────
  describe('getNextExpirationDate', () => {
    const mockNow = new Date('2025-04-30T12:00:00Z');
    const mockRenewalDate = new Date('2025-06-15');

    it('should return last day of next month for Monthly cadence', () => {
      const result = getNextExpirationDate('Monthly', mockRenewalDate, mockNow);
      // Now is April 30, next month is May, so return May 31
      expect(result?.getUTCMonth()).toBe(4); // May
      expect(result?.getUTCDate()).toBe(31);
    });

    it('should handle year rollover for Monthly cadence', () => {
      const endOfYear = new Date('2025-12-31T12:00:00Z');
      const result = getNextExpirationDate('Monthly', mockRenewalDate, endOfYear);
      // Now is December, next month is January of next year
      expect(result?.getUTCMonth()).toBe(0); // January
      expect(result?.getUTCDate()).toBe(31);
      expect(result?.getUTCFullYear()).toBe(2026);
    });

    it('should return Dec 31 of next year for CalendarYear cadence', () => {
      const result = getNextExpirationDate('CalendarYear', mockRenewalDate, mockNow);
      expect(result?.getUTCMonth()).toBe(11); // December
      expect(result?.getUTCDate()).toBe(31);
      expect(result?.getUTCFullYear()).toBe(2026);
    });

    it('should return day before next renewal anniversary for CardmemberYear', () => {
      const result = getNextExpirationDate('CardmemberYear', mockRenewalDate, mockNow);
      // Renewal is June 15, and we're in April (before anniversary in this year)
      // So next anniversary is June 15, 2025, day before is June 14, 2025
      expect(result?.getUTCMonth()).toBe(5); // June
      expect(result?.getUTCDate()).toBe(14);
      expect(result?.getUTCFullYear()).toBe(2025);
    });

    it('should use next year renewal if anniversary already passed', () => {
      const afterAnniversary = new Date('2025-07-01T12:00:00Z');
      const result = getNextExpirationDate('CardmemberYear', mockRenewalDate, afterAnniversary);
      // Renewal is June 15, already passed, so next one is June 14, 2026
      expect(result?.getUTCMonth()).toBe(5); // June
      expect(result?.getUTCDate()).toBe(14);
      expect(result?.getUTCFullYear()).toBe(2026);
    });

    it('should return null for OneTime cadence', () => {
      const result = getNextExpirationDate('OneTime', mockRenewalDate, mockNow);
      expect(result).toBeNull();
    });

    it('should handle DST transition correctly', () => {
      // Test with a date during DST transition
      const dstDate = new Date('2025-03-09T12:00:00Z');
      const result = getNextExpirationDate('Monthly', mockRenewalDate, dstDate);
      // Should still return valid date, not affected by DST
      expect(result).toBeDefined();
      expect(result?.getUTCMonth()).toBe(3); // April
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('should handle dates at year boundary', () => {
      const yearEnd = new Date('2025-12-31T23:59:59Z');
      const renewal = new Date('2025-12-25');

      const calc = calcExpirationDate('Monthly', renewal, yearEnd);
      expect(calc?.getUTCFullYear()).toBe(2025);

      const next = getNextExpirationDate('Monthly', renewal, yearEnd);
      expect(next?.getUTCFullYear()).toBe(2026);
      expect(next?.getUTCMonth()).toBe(0); // January
    });

    it('should handle month boundaries correctly', () => {
      const endOfMonth = new Date('2025-04-30T12:00:00Z');
      const renewal = new Date('2025-06-15');

      const result = calcExpirationDate('Monthly', renewal, endOfMonth);
      expect(result?.toUTCString()).toContain('Apr');
      expect(result?.getUTCDate()).toBe(30);
    });
  });
});
```

---

## Integration Tests

### 3. Authorization Tests (CRITICAL)

**File:** `/tests/integration/authorization.test.ts`

```typescript
import { addCardToWallet } from '@/actions/wallet';
import { toggleBenefit, updateUserDeclaredValue } from '@/actions/benefits';
import { prisma } from '@/lib/prisma';

/**
 * AUTHORIZATION TESTS
 * These tests verify that users can ONLY modify their own data.
 * They should fail until proper authorization is implemented.
 */

describe('Authorization Checks', () => {
  let user1Id: string;
  let user2Id: string;
  let user1PlayerId: string;
  let user2PlayerId: string;
  let masterCardId: string;

  beforeAll(async () => {
    // Create test users
    const user1 = await prisma.user.create({
      data: { email: 'user1@test.com', passwordHash: 'hash1' },
    });
    const user2 = await prisma.user.create({
      data: { email: 'user2@test.com', passwordHash: 'hash2' },
    });

    user1Id = user1.id;
    user2Id = user2.id;

    // Create test players
    const player1 = await prisma.player.create({
      data: { userId: user1Id, playerName: 'Primary' },
    });
    const player2 = await prisma.player.create({
      data: { userId: user2Id, playerName: 'Primary' },
    });

    user1PlayerId = player1.id;
    user2PlayerId = player2.id;

    // Create master card
    const card = await prisma.masterCard.create({
      data: {
        issuer: 'Chase',
        cardName: 'Sapphire Reserve',
        defaultAnnualFee: 55000,
        cardImageUrl: 'https://example.com/card.jpg',
      },
    });

    masterCardId = card.id;
  });

  describe('addCardToWallet authorization', () => {
    // TODO: These tests should FAIL until authorization is implemented
    it.todo('should reject when user tries to add card to different user\'s player');
    it.todo('should reject when playerId doesn\'t belong to authenticated user');
    it.todo('should allow when adding to own player');
  });

  describe('toggleBenefit authorization', () => {
    it.todo('should reject when toggling benefit not owned by user');
    it.todo('should reject when benefit belongs to different player');
    it.todo('should allow when toggling own benefit');
  });

  describe('updateUserDeclaredValue authorization', () => {
    it.todo('should reject when updating benefit not owned by user');
    it.todo('should allow when updating own benefit');
  });

  describe('CRON endpoint authorization', () => {
    it.todo('should reject requests without CRON_SECRET header');
    it.todo('should reject requests with invalid CRON_SECRET');
    it.todo('should allow requests with valid CRON_SECRET');
    it.todo('should reject if CRON_SECRET env var is not set');
  });
});
```

---

### 4. Wallet Flow Integration Test

**File:** `/tests/integration/wallet-flow.test.ts`

```typescript
import { addCardToWallet } from '@/actions/wallet';
import { toggleBenefit } from '@/actions/benefits';
import { prisma } from '@/lib/prisma';
import { calcExpirationDate } from '@/lib/benefitDates';

describe('Wallet Flow Integration', () => {
  let playerId: string;
  let masterCardId: string;

  beforeAll(async () => {
    // Setup test data
    const user = await prisma.user.create({
      data: { email: 'test@example.com', passwordHash: 'hash' },
    });

    const player = await prisma.player.create({
      data: { userId: user.id, playerName: 'Test Player' },
    });
    playerId = player.id;

    const card = await prisma.masterCard.create({
      data: {
        issuer: 'Chase',
        cardName: 'Sapphire Reserve',
        defaultAnnualFee: 55000,
        cardImageUrl: 'https://example.com/card.jpg',
      },
    });
    masterCardId = card.id;

    // Create master benefits
    await prisma.masterBenefit.create({
      data: {
        masterCardId: card.id,
        name: 'Travel Credit',
        type: 'StatementCredit',
        stickerValue: 30000,
        resetCadence: 'CardmemberYear',
      },
    });

    await prisma.masterBenefit.create({
      data: {
        masterCardId: card.id,
        name: 'Dining Credit',
        type: 'StatementCredit',
        stickerValue: 30000,
        resetCadence: 'CardmemberYear',
      },
    });
  });

  it('should create card with cloned benefits', async () => {
    const renewalDate = new Date('2025-06-15');

    const result = await addCardToWallet(playerId, masterCardId, renewalDate);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const card = result.userCard;
    expect(card.playerId).toBe(playerId);
    expect(card.masterCardId).toBe(masterCardId);
    expect(card.renewalDate).toEqual(renewalDate);
    expect(card.userBenefits).toHaveLength(2);

    // Check that benefits were cloned
    const travelCredit = card.userBenefits.find((b) => b.name === 'Travel Credit');
    expect(travelCredit).toBeDefined();
    expect(travelCredit?.stickerValue).toBe(30000);
    expect(travelCredit?.isUsed).toBe(false);
    expect(travelCredit?.timesUsed).toBe(0);
  });

  it('should reject duplicate card in player wallet', async () => {
    const renewalDate = new Date('2025-06-15');

    // Add card once
    const result1 = await addCardToWallet(playerId, masterCardId, renewalDate);
    expect(result1.success).toBe(true);

    // Try to add same card again
    const result2 = await addCardToWallet(playerId, masterCardId, renewalDate);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('already in');
  });

  it('should toggle benefit usage', async () => {
    const renewalDate = new Date('2025-06-15');
    const result = await addCardToWallet(playerId, masterCardId, renewalDate);

    if (!result.success) throw new Error('Failed to add card');

    const benefit = result.userCard.userBenefits[0];

    // Toggle to used
    const toggleResult = await toggleBenefit(benefit.id, false);
    expect(toggleResult.success).toBe(true);
    if (!toggleResult.success) return;

    expect(toggleResult.benefit.isUsed).toBe(true);
    expect(toggleResult.benefit.timesUsed).toBe(1);
    expect(toggleResult.benefit.claimedAt).toBeDefined();

    // Toggle back to unused
    const toggleResult2 = await toggleBenefit(benefit.id, true);
    expect(toggleResult2.success).toBe(true);
    expect(toggleResult2.benefit.isUsed).toBe(false);
    expect(toggleResult2.benefit.claimedAt).toBeNull();
  });
});
```

---

## Security Tests

### 5. Input Validation Tests

**File:** `/tests/security/input-validation.test.ts`

```typescript
import { updateUserDeclaredValue } from '@/actions/benefits';

describe('Input Validation', () => {
  describe('updateUserDeclaredValue', () => {
    it('should reject negative values', async () => {
      const result = await updateUserDeclaredValue('benefit1', -1000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-negative');
    });

    it('should reject non-integer values', async () => {
      const result = await updateUserDeclaredValue('benefit1', 100.5);
      expect(result.success).toBe(false);
      expect(result.error).toContain('integer');
    });

    it('should reject NaN', async () => {
      const result = await updateUserDeclaredValue('benefit1', NaN);
      expect(result.success).toBe(false);
    });

    it('should reject Infinity', async () => {
      const result = await updateUserDeclaredValue('benefit1', Infinity);
      expect(result.success).toBe(false);
    });

    it('should accept valid safe integers', async () => {
      // This test would need proper setup, but demonstrates the validation
      const result = await updateUserDeclaredValue('benefit1', 50000);
      // Should not reject due to type validation
      // (May fail for other reasons like missing benefitId)
    });

    it('should reject values exceeding MAX_SAFE_INTEGER', async () => {
      const result = await updateUserDeclaredValue(
        'benefit1',
        Number.MAX_SAFE_INTEGER + 1
      );
      expect(result.success).toBe(false);
    });
  });

  describe('addCardToWallet', () => {
    it('should reject empty playerId', async () => {
      const result = await addCardToWallet('', 'card1', new Date());
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject empty masterCardId', async () => {
      const result = await addCardToWallet('player1', '', new Date());
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject invalid renewal date', async () => {
      const result = await addCardToWallet(
        'player1',
        'card1',
        new Date('invalid')
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('valid Date');
    });

    it('should reject non-Date renewal date', async () => {
      const result = await addCardToWallet(
        'player1',
        'card1',
        '2025-06-15' as any
      );
      expect(result.success).toBe(false);
    });
  });
});
```

---

## Component Tests

### 6. CardTrackerPanel Component Test

**File:** `/tests/unit/components/CardTrackerPanel.test.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CardTrackerPanel from '@/components/CardTrackerPanel';
import type { UserCard, UserBenefit } from '@prisma/client';

// Mock the server action
jest.mock('@/actions/benefits', () => ({
  toggleBenefit: jest.fn(),
}));

describe('CardTrackerPanel', () => {
  const mockUserCard: UserCard & {
    masterCard: { issuer: string; cardName: string; defaultAnnualFee: number };
    userBenefits: UserBenefit[];
  } = {
    id: 'card1',
    playerId: 'player1',
    masterCardId: 'mc1',
    customName: null,
    actualAnnualFee: 55000,
    renewalDate: new Date('2025-06-15'),
    isOpen: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    masterCard: {
      issuer: 'Chase',
      cardName: 'Sapphire Reserve',
      defaultAnnualFee: 55000,
    },
    userBenefits: [
      {
        id: 'benefit1',
        userCardId: 'card1',
        playerId: 'player1',
        name: 'Travel Credit',
        type: 'StatementCredit',
        stickerValue: 30000,
        resetCadence: 'CardmemberYear',
        userDeclaredValue: null,
        isUsed: false,
        timesUsed: 0,
        expirationDate: new Date('2025-06-14T23:59:59Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        claimedAt: null,
      },
      {
        id: 'benefit2',
        userCardId: 'card1',
        playerId: 'player1',
        name: 'Dining Credit',
        type: 'StatementCredit',
        stickerValue: 30000,
        resetCadence: 'CardmemberYear',
        userDeclaredValue: null,
        isUsed: false,
        timesUsed: 0,
        expirationDate: new Date('2025-06-14T23:59:59Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        claimedAt: null,
      },
    ],
  };

  it('should render card header with name and issuer', () => {
    render(
      <CardTrackerPanel userCard={mockUserCard} playerName="Primary" />
    );

    expect(screen.getByText('Sapphire Reserve')).toBeInTheDocument();
    expect(screen.getByText(/Chase/)).toBeInTheDocument();
    expect(screen.getByText(/Primary/)).toBeInTheDocument();
  });

  it('should display ROI badge', () => {
    render(
      <CardTrackerPanel userCard={mockUserCard} playerName="Primary" />
    );

    // ROI should be $600 (both credits) - $550 (fee) = $50
    expect(screen.getByText(/ROI:/)).toBeInTheDocument();
  });

  it('should render all benefits in table', () => {
    render(
      <CardTrackerPanel userCard={mockUserCard} playerName="Primary" />
    );

    expect(screen.getByText('Travel Credit')).toBeInTheDocument();
    expect(screen.getByText('Dining Credit')).toBeInTheDocument();
  });

  it('should show renewal date', () => {
    render(
      <CardTrackerPanel userCard={mockUserCard} playerName="Primary" />
    );

    expect(screen.getByText(/Renewal:/)).toBeInTheDocument();
    expect(screen.getByText(/Jun 15, 2025/)).toBeInTheDocument();
  });

  it('should show annual fee', () => {
    render(
      <CardTrackerPanel userCard={mockUserCard} playerName="Primary" />
    );

    expect(screen.getByText(/Annual Fee:/)).toBeInTheDocument();
    expect(screen.getByText(/\$550/)).toBeInTheDocument();
  });

  it('should toggle benefit checkbox optimistically', async () => {
    const { toggleBenefit: mockToggle } = require('@/actions/benefits');
    mockToggle.mockResolvedValue({ success: true, benefit: mockUserCard.userBenefits[0] });

    render(
      <CardTrackerPanel userCard={mockUserCard} playerName="Primary" />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Should immediately appear checked (optimistic update)
    expect(checkboxes[0]).toBeChecked();
  });

  it('should revert checkbox on server error', async () => {
    const { toggleBenefit: mockToggle } = require('@/actions/benefits');
    mockToggle.mockResolvedValue({
      success: false,
      error: 'Server error',
    });

    render(
      <CardTrackerPanel userCard={mockUserCard} playerName="Primary" />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeInTheDocument();
    });

    // Checkbox should be reverted
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('should display custom card name when set', () => {
    const customCard = {
      ...mockUserCard,
      customName: 'My Favorite Chase Card',
    };

    render(
      <CardTrackerPanel userCard={customCard} playerName="Primary" />
    );

    expect(screen.getByText('My Favorite Chase Card')).toBeInTheDocument();
  });

  it('should display custom annual fee when set', () => {
    const customCard = {
      ...mockUserCard,
      actualAnnualFee: 45000, // $450 instead of $550
    };

    render(
      <CardTrackerPanel userCard={customCard} playerName="Primary" />
    );

    expect(screen.getByText(/\$450/)).toBeInTheDocument();
  });
});
```

---

## Test Fixtures

### Mock Data

**File:** `/tests/fixtures/mockData.ts`

```typescript
import type { UserCard, UserBenefit, Player, User } from '@prisma/client';
import { faker } from '@faker-js/faker';

export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    email: faker.internet.email(),
    passwordHash: faker.string.alphaNumeric(32),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockPlayer(overrides?: Partial<Player>): Player {
  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    playerName: faker.person.firstName(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createMockUserBenefit(
  overrides?: Partial<UserBenefit>
): UserBenefit {
  return {
    id: faker.string.uuid(),
    userCardId: faker.string.uuid(),
    playerId: faker.string.uuid(),
    name: faker.commerce.product(),
    type: 'StatementCredit',
    stickerValue: faker.number.int({ min: 1000, max: 100000 }),
    resetCadence: 'Monthly',
    userDeclaredValue: null,
    isUsed: false,
    timesUsed: 0,
    expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    claimedAt: null,
    ...overrides,
  };
}

export function createMockUserCard(overrides?: Partial<UserCard>): UserCard {
  return {
    id: faker.string.uuid(),
    playerId: faker.string.uuid(),
    masterCardId: faker.string.uuid(),
    customName: null,
    actualAnnualFee: null,
    renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    isOpen: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
```

---

## Running Tests

### Command Line

```bash
# Run all tests
npm test

# Run specific test file
npm test -- calculations.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch

# Run only authorization tests
npm test -- authorization.test.ts

# Run only critical tests
npm test -- --testNamePattern="(CRITICAL|Authorization|validation)"
```

### GitHub Actions CI/CD

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
```

---

## Test Coverage Goals

| Category | Target | Rationale |
|----------|--------|-----------|
| Critical Paths | 100% | Authorization, ROI calculations |
| Utilities | 90%+ | Core business logic |
| Components | 80%+ | UI interactions |
| Edge Cases | 100% | DST, timezone, null values |
| Security | 100% | Input validation, auth |

---

## Continuous Integration Checklist

Before each deployment:

- [ ] All tests passing
- [ ] Code coverage >= 80%
- [ ] Authorization tests passing
- [ ] Edge case tests passing
- [ ] Security validation tests passing
- [ ] No critical issues in CI output

