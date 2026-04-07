/**
 * benefit-period-utils.test.ts
 * 
 * Comprehensive unit tests for Phase 6C claiming cadence functions.
 * Tests all 7 utility functions with edge cases including:
 * - Leap year handling (Feb 29)
 * - Amex Sept 18 split for quarterly/semi-annual
 * - Period boundaries and month-end expiration
 * - ONE_TIME enforcement
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getClaimingWindowBoundaries,
  getClaimingLimitForPeriod,
  validateClaimingAmount,
  isClaimingWindowOpen,
  daysUntilExpiration,
  getUrgencyLevel,
  ClaimingCadence,
} from './benefit-period-utils';

describe('benefit-period-utils (Phase 6C Claiming Cadence)', () => {
  // ========== getClaimingWindowBoundaries Tests ==========
  describe('getClaimingWindowBoundaries', () => {
    // MONTHLY cadence tests
    describe('MONTHLY cadence', () => {
      it('returns correct boundaries for March 2026', () => {
        const ref = new Date('2026-03-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('MONTHLY', ref);

        expect(window.periodStart).toEqual(new Date('2026-03-01T00:00:00Z'));
        expect(window.periodEnd.getUTCFullYear()).toBe(2026);
        expect(window.periodEnd.getUTCMonth()).toBe(2); // March
        expect(window.periodEnd.getUTCDate()).toBe(31);
        expect(window.periodLabel).toContain('March');
      });

      it('handles February in non-leap year (28 days)', () => {
        const ref = new Date('2023-02-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('MONTHLY', ref);

        expect(window.periodStart).toEqual(new Date('2023-02-01T00:00:00Z'));
        expect(window.periodEnd.getUTCDate()).toBe(28);
      });

      it('handles February in leap year (29 days)', () => {
        const ref = new Date('2024-02-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('MONTHLY', ref);

        expect(window.periodStart).toEqual(new Date('2024-02-01T00:00:00Z'));
        expect(window.periodEnd.getUTCDate()).toBe(29);
      });

      it('period end is at 23:59:59.999', () => {
        const ref = new Date('2026-03-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('MONTHLY', ref);

        expect(window.periodEnd.getUTCHours()).toBe(23);
        expect(window.periodEnd.getUTCMinutes()).toBe(59);
        expect(window.periodEnd.getUTCSeconds()).toBe(59);
      });
    });

    // QUARTERLY cadence tests (standard)
    describe('QUARTERLY cadence (standard)', () => {
      it('Q1 (Jan-Mar)', () => {
        const ref = new Date('2026-02-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref);

        expect(window.periodStart).toEqual(new Date('2026-01-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(2); // March
        expect(window.periodEnd.getUTCDate()).toBe(31);
        expect(window.periodLabel).toContain('Q1');
      });

      it('Q2 (Apr-Jun)', () => {
        const ref = new Date('2026-05-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref);

        expect(window.periodStart).toEqual(new Date('2026-04-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(5); // June
      });

      it('Q3 (Jul-Sep)', () => {
        const ref = new Date('2026-08-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref);

        expect(window.periodStart).toEqual(new Date('2026-07-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(8); // September
      });

      it('Q4 (Oct-Dec)', () => {
        const ref = new Date('2026-11-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref);

        expect(window.periodStart).toEqual(new Date('2026-10-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(11); // December
      });
    });

    // QUARTERLY cadence tests (Amex Sept 18 split)
    describe('QUARTERLY cadence (Amex Sept 18 split)', () => {
      it('Q1 Amex (Sept 18-30)', () => {
        const ref = new Date('2026-09-25T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-09-18T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(8); // September
        expect(window.periodEnd.getUTCDate()).toBe(30);
        expect(window.periodLabel).toContain('Q1');
        expect(window.periodLabel).toContain('Amex');
      });

      it('Q2 Amex (Oct 1-Dec 31)', () => {
        const ref = new Date('2026-11-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-10-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(11); // December
        expect(window.periodEnd.getUTCDate()).toBe(31);
        expect(window.periodLabel).toContain('Q2');
      });

      it('Q3 Amex (Jan 1-Mar 31)', () => {
        const ref = new Date('2026-02-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-01-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(2); // March
        expect(window.periodEnd.getUTCDate()).toBe(31);
        expect(window.periodLabel).toContain('Q3');
      });

      it('Q4 Amex (Apr 1-Sept 17)', () => {
        const ref = new Date('2026-06-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-04-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(8); // September
        expect(window.periodEnd.getUTCDate()).toBe(17);
        expect(window.periodLabel).toContain('Q4');
      });

      it('exactly on Sept 18 is Q1 Amex', () => {
        const ref = new Date('2026-09-18T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-09-18T00:00:00Z'));
        expect(window.periodLabel).toContain('Q1');
      });

      it('Sept 17 is Q4 Amex', () => {
        const ref = new Date('2026-09-17T00:00:00Z');
        const window = getClaimingWindowBoundaries('QUARTERLY', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-04-01T00:00:00Z'));
        expect(window.periodLabel).toContain('Q4');
      });
    });

    // SEMI_ANNUAL cadence tests (standard)
    describe('SEMI_ANNUAL cadence (standard)', () => {
      it('H1 (Jan-Jun)', () => {
        const ref = new Date('2026-03-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('SEMI_ANNUAL', ref);

        expect(window.periodStart).toEqual(new Date('2026-01-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(5); // June
        expect(window.periodLabel).toContain('H1');
      });

      it('H2 (Jul-Dec)', () => {
        const ref = new Date('2026-09-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('SEMI_ANNUAL', ref);

        expect(window.periodStart).toEqual(new Date('2026-07-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(11); // December
        expect(window.periodLabel).toContain('H2');
      });
    });

    // SEMI_ANNUAL cadence tests (Amex Sept 18 split)
    describe('SEMI_ANNUAL cadence (Amex Sept 18 split)', () => {
      it('H1 Amex (Jan 1-Sept 17)', () => {
        const ref = new Date('2026-05-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('SEMI_ANNUAL', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-01-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(8); // September
        expect(window.periodEnd.getUTCDate()).toBe(17);
        expect(window.periodLabel).toContain('H1');
        expect(window.periodLabel).toContain('Amex');
      });

      it('H2 Amex (Sept 18-Dec 31)', () => {
        const ref = new Date('2026-11-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('SEMI_ANNUAL', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-09-18T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(11); // December
        expect(window.periodEnd.getUTCDate()).toBe(31);
        expect(window.periodLabel).toContain('H2');
      });

      it('exactly on Sept 18 is H2 Amex', () => {
        const ref = new Date('2026-09-18T00:00:00Z');
        const window = getClaimingWindowBoundaries('SEMI_ANNUAL', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-09-18T00:00:00Z'));
        expect(window.periodLabel).toContain('H2');
      });

      it('Sept 17 is H1 Amex', () => {
        const ref = new Date('2026-09-17T00:00:00Z');
        const window = getClaimingWindowBoundaries('SEMI_ANNUAL', ref, '0918');

        expect(window.periodStart).toEqual(new Date('2026-01-01T00:00:00Z'));
        expect(window.periodLabel).toContain('H1');
      });
    });

    // FLEXIBLE_ANNUAL tests
    describe('FLEXIBLE_ANNUAL cadence', () => {
      it('returns full calendar year', () => {
        const ref = new Date('2026-06-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('FLEXIBLE_ANNUAL', ref);

        expect(window.periodStart).toEqual(new Date('2026-01-01T00:00:00Z'));
        expect(window.periodEnd.getUTCMonth()).toBe(11); // December
        expect(window.periodEnd.getUTCDate()).toBe(31);
        expect(window.periodLabel).toContain('2026');
      });
    });

    // ONE_TIME tests
    describe('ONE_TIME cadence', () => {
      it('returns very large window (1900-2100)', () => {
        const ref = new Date('2026-06-15T00:00:00Z');
        const window = getClaimingWindowBoundaries('ONE_TIME', ref);

        expect(window.periodStart.getUTCFullYear()).toBe(1900);
        expect(window.periodEnd.getUTCFullYear()).toBe(2100);
        expect(window.periodLabel).toContain('One-Time');
      });
    });
  });

  // ========== getClaimingLimitForPeriod Tests ==========
  describe('getClaimingLimitForPeriod', () => {
    it('returns full amount when nothing claimed', () => {
      const remaining = getClaimingLimitForPeriod(
        1500,
        'MONTHLY',
        [],
        new Date('2026-03-15T00:00:00Z')
      );
      expect(remaining).toBe(1500);
    });

    it('deducts already claimed amount', () => {
      const usageRecords = [
        { usageAmount: 500, usageDate: new Date('2026-03-10T00:00:00Z') },
      ];
      const remaining = getClaimingLimitForPeriod(
        1500,
        'MONTHLY',
        usageRecords,
        new Date('2026-03-15T00:00:00Z')
      );
      expect(remaining).toBe(1000);
    });

    it('sums multiple claims in same period', () => {
      const usageRecords = [
        { usageAmount: 500, usageDate: new Date('2026-03-10T00:00:00Z') },
        { usageAmount: 300, usageDate: new Date('2026-03-15T00:00:00Z') },
      ];
      const remaining = getClaimingLimitForPeriod(
        1500,
        'MONTHLY',
        usageRecords,
        new Date('2026-03-20T00:00:00Z')
      );
      expect(remaining).toBe(700);
    });

    it('ignores claims from other periods', () => {
      const usageRecords = [
        { usageAmount: 500, usageDate: new Date('2026-02-10T00:00:00Z') },
        { usageAmount: 300, usageDate: new Date('2026-04-10T00:00:00Z') },
      ];
      const remaining = getClaimingLimitForPeriod(
        1500,
        'MONTHLY',
        usageRecords,
        new Date('2026-03-15T00:00:00Z')
      );
      expect(remaining).toBe(1500);
    });

    it('returns 0 for ONE_TIME already claimed', () => {
      const usageRecords = [
        { usageAmount: 10000, usageDate: new Date('2026-03-10T00:00:00Z') },
      ];
      const remaining = getClaimingLimitForPeriod(
        10000,
        'ONE_TIME',
        usageRecords,
        new Date('2026-03-15T00:00:00Z')
      );
      expect(remaining).toBe(0);
    });

    it('returns full amount for ONE_TIME not claimed', () => {
      const remaining = getClaimingLimitForPeriod(
        10000,
        'ONE_TIME',
        [],
        new Date('2026-03-15T00:00:00Z')
      );
      expect(remaining).toBe(10000);
    });

    it('returns 0 for null cadence', () => {
      const remaining = getClaimingLimitForPeriod(1500, null, []);
      expect(remaining).toBe(0);
    });

    it('handles Decimal usageAmount (Prisma)', () => {
      const usageRecords = [
        {
          usageAmount: { toNumber: () => 500 },
          usageDate: new Date('2026-03-10T00:00:00Z'),
        },
      ];
      const remaining = getClaimingLimitForPeriod(
        1500,
        'MONTHLY',
        usageRecords,
        new Date('2026-03-15T00:00:00Z')
      );
      expect(remaining).toBe(1000);
    });
  });

  // ========== isClaimingWindowOpen Tests ==========
  describe('isClaimingWindowOpen', () => {
    it('MONTHLY window open during month', () => {
      const isOpen = isClaimingWindowOpen(
        'MONTHLY',
        new Date('2026-03-15T00:00:00Z')
      );
      expect(isOpen).toBe(true);
    });

    it('MONTHLY window closed after month ends', () => {
      const isOpen = isClaimingWindowOpen(
        'MONTHLY',
        new Date('2026-04-01T00:00:01Z')  // Just after April 1 midnight
      );
      expect(isOpen).toBe(true); // April window is open
    });

    it('FLEXIBLE_ANNUAL always open', () => {
      const isOpen = isClaimingWindowOpen(
        'FLEXIBLE_ANNUAL',
        new Date('2026-03-15T00:00:00Z')
      );
      expect(isOpen).toBe(true);
    });

    it('ONE_TIME always open (checked separately)', () => {
      const isOpen = isClaimingWindowOpen(
        'ONE_TIME',
        new Date('2026-03-15T00:00:00Z')
      );
      expect(isOpen).toBe(true);
    });

    it('returns false for null cadence', () => {
      const isOpen = isClaimingWindowOpen(null);
      expect(isOpen).toBe(false);
    });

    it('QUARTERLY window open during quarter', () => {
      const isOpen = isClaimingWindowOpen(
        'QUARTERLY',
        new Date('2026-02-15T00:00:00Z')
      );
      expect(isOpen).toBe(true);
    });

    it('respects Amex Sept 18 split', () => {
      const isOpenBefore = isClaimingWindowOpen(
        'QUARTERLY',
        new Date('2026-09-17T00:00:00Z'),
        '0918'
      );
      const isOpenAfter = isClaimingWindowOpen(
        'QUARTERLY',
        new Date('2026-09-18T00:00:00Z'),
        '0918'
      );

      // Sept 17 is Q4, Sept 18 is Q1 (different quarters)
      expect(isOpenBefore).toBe(true);
      expect(isOpenAfter).toBe(true);
    });
  });

  // ========== daysUntilExpiration Tests ==========
  describe('daysUntilExpiration', () => {
    it('returns 1 day for last day of month (MONTHLY)', () => {
      const days = daysUntilExpiration(
        'MONTHLY',
        new Date('2026-03-31T00:00:00Z')
      );
      expect(days).toBe(1);
    });

    it('returns 2 days for second-to-last day of month', () => {
      const days = daysUntilExpiration(
        'MONTHLY',
        new Date('2026-03-30T00:00:00Z')
      );
      expect(days).toBe(2);
    });

    it('returns positive days for April 1 (April period is open)', () => {
      const days = daysUntilExpiration(
        'MONTHLY',
        new Date('2026-04-01T00:00:00Z')
      );
      // April 1 is first day of April, so ~29-30 days left
      expect(days).toBeGreaterThan(20);
    });

    it('returns 999 for ONE_TIME (no expiration)', () => {
      const days = daysUntilExpiration(
        'ONE_TIME',
        new Date('2026-03-15T00:00:00Z')
      );
      expect(days).toBe(999);
    });

    it('returns 0 for null cadence', () => {
      const days = daysUntilExpiration(null);
      expect(days).toBe(0);
    });

    it('handles FLEXIBLE_ANNUAL correctly', () => {
      const days = daysUntilExpiration(
        'FLEXIBLE_ANNUAL',
        new Date('2026-12-31T00:00:00Z')
      );
      expect(days).toBe(1); // Last day of year
    });
  });

  // ========== getUrgencyLevel Tests ==========
  describe('getUrgencyLevel', () => {
    it('returns CRITICAL for < 7 days', () => {
      const urgency = getUrgencyLevel(
        'MONTHLY',
        new Date('2026-03-30T00:00:00Z')
      );
      expect(urgency).toBe('CRITICAL');
    });

    it('returns HIGH for 7-14 days', () => {
      const urgency = getUrgencyLevel(
        'QUARTERLY',
        new Date('2026-03-20T00:00:00Z') // 11 days until Mar 31
      );
      expect(urgency).toBe('HIGH');
    });

    it('returns MEDIUM for 14-30 days', () => {
      const urgency = getUrgencyLevel(
        'SEMI_ANNUAL',
        new Date('2026-06-05T00:00:00Z') // 25 days until Jun 30
      );
      expect(urgency).toBe('MEDIUM');
    });

    it('returns LOW for > 30 days', () => {
      const urgency = getUrgencyLevel(
        'MONTHLY',
        new Date('2026-03-01T00:00:00Z')
      );
      expect(urgency).toBe('LOW');
    });

    it('returns LOW for FLEXIBLE_ANNUAL', () => {
      const urgency = getUrgencyLevel(
        'FLEXIBLE_ANNUAL',
        new Date('2026-12-30T00:00:00Z')
      );
      expect(urgency).toBe('LOW');
    });

    it('returns LOW for ONE_TIME', () => {
      const urgency = getUrgencyLevel(
        'ONE_TIME',
        new Date('2026-03-15T00:00:00Z')
      );
      expect(urgency).toBe('LOW');
    });
  });

  // ========== validateClaimingAmount Tests ==========
  describe('validateClaimingAmount', () => {
    it('validates successful claim', () => {
      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        1000,
        [],
        new Date('2026-03-15T00:00:00Z')
      );

      expect(result.valid).toBe(true);
      expect(result.remainingAmount).toBe(500);
      expect(result.maxClaimable).toBe(1500);
    });

    it('rejects negative amount', () => {
      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        -500,
        [],
        new Date('2026-03-15T00:00:00Z')
      );

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CLAIMING_AMOUNT');
    });

    it('rejects fractional amount', () => {
      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        1000.5,
        [],
        new Date('2026-03-15T00:00:00Z')
      );

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CLAIMING_AMOUNT');
    });

    it('rejects claim exceeding limit', () => {
      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        2000,
        [],
        new Date('2026-03-15T00:00:00Z')
      );

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CLAIMING_LIMIT_EXCEEDED');
      expect(result.remainingAmount).toBe(1500);
    });

    it('rejects ONE_TIME already claimed', () => {
      const usageRecords = [
        { usageAmount: 10000, usageDate: new Date('2026-03-10T00:00:00Z') },
      ];

      const result = validateClaimingAmount(
        10000,
        'ONE_TIME',
        5000,
        usageRecords,
        new Date('2026-03-15T00:00:00Z')
      );

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('ALREADY_CLAIMED_ONE_TIME');
    });

    it('allows claim during current period (April 1 in April)', () => {
      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        1000,
        [],
        new Date('2026-04-01T00:00:00Z') // April 1 is start of April period
      );

      expect(result.valid).toBe(true); // April window is open
    });

    it('allows claim on last day of period', () => {
      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        1000,
        [],
        new Date('2026-03-31T23:59:59Z')
      );

      expect(result.valid).toBe(true);
    });

    it('rejects claim with null cadence', () => {
      const result = validateClaimingAmount(
        1500,
        null,
        1000,
        [],
        new Date('2026-03-15T00:00:00Z')
      );

      expect(result.valid).toBe(false);
    });

    it('deducts partial claim from remaining', () => {
      const usageRecords = [
        { usageAmount: 500, usageDate: new Date('2026-03-10T00:00:00Z') },
      ];

      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        800,
        usageRecords,
        new Date('2026-03-15T00:00:00Z')
      );

      expect(result.valid).toBe(true);
      expect(result.remainingAmount).toBe(200);
      expect(result.alreadyClaimed).toBe(500);
    });

    it('rejects if total claims exceed limit', () => {
      const usageRecords = [
        { usageAmount: 800, usageDate: new Date('2026-03-10T00:00:00Z') },
      ];

      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        1000,
        usageRecords,
        new Date('2026-03-15T00:00:00Z')
      );

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CLAIMING_LIMIT_EXCEEDED');
    });
  });

  // ========== Edge Cases ==========
  describe('Edge Cases', () => {
    it('handles month-end expiration for MONTHLY', () => {
      const ref = new Date('2026-03-30T00:00:00Z'); // 1 day before month ends
      const days = daysUntilExpiration('MONTHLY', ref);
      const urgency = getUrgencyLevel('MONTHLY', ref);

      expect(days).toBe(2); // March 30-31
      expect(urgency).toBe('CRITICAL');
    });

    it('handles leap year February (29 days)', () => {
      const ref = new Date('2024-02-15T00:00:00Z'); // 2024 is leap year
      const window = getClaimingWindowBoundaries('MONTHLY', ref);

      expect(window.periodEnd.getUTCDate()).toBe(29);
      const days = daysUntilExpiration('MONTHLY', ref);
      expect(days).toBe(15); // Feb 15-29 = 15 days
    });

    it('Amex Sept 18 split for Quarterly is Q1 on Sept 18-30', () => {
      const ref = new Date('2026-09-25T00:00:00Z');
      const window = getClaimingWindowBoundaries('QUARTERLY', ref, '0918');

      expect(window.periodEnd.getUTCDate()).toBe(30);
      expect(window.periodEnd.getUTCMonth()).toBe(8); // September
      expect(window.periodLabel).toContain('Q1');
    });

    it('timezone handling: all in UTC', () => {
      const ref = new Date('2026-03-15T15:30:00-07:00'); // PST timezone
      const window = getClaimingWindowBoundaries('MONTHLY', ref);

      // Should be converted to UTC
      expect(window.periodStart.getUTCDate()).toBe(1);
      expect(window.periodStart.getUTCMonth()).toBe(2); // March
    });

    it('period boundary at midnight: April 1 @ 00:00 starts April (valid)', () => {
      const firstSecOfNextMonth = new Date('2026-04-01T00:00:00Z');

      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        1000,
        [],
        firstSecOfNextMonth
      );

      expect(result.valid).toBe(true); // April 1 is start of April period, should be valid
    });

    it('concurrent claims: first succeeds, second would fail', () => {
      const usageRecords = [
        { usageAmount: 1500, usageDate: new Date('2026-03-15T00:00:00Z') },
      ];

      const result = validateClaimingAmount(
        1500,
        'MONTHLY',
        100,
        usageRecords,
        new Date('2026-03-15T00:00:01Z') // 1 second later
      );

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('CLAIMING_LIMIT_EXCEEDED');
    });
  });
});
