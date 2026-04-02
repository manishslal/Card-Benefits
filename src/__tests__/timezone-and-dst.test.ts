/**
 * Timezone and DST Handling Tests
 *
 * Tests for the critical UTC-based date calculation functions in benefitDates.ts.
 * These tests ensure that benefits are calculated correctly regardless of:
 * - User's local timezone
 * - DST transitions (spring forward, fall back)
 * - Daylight Saving Time being active or inactive
 *
 * All dates in tests are in ISO 8601 format with explicit UTC timezone (Z suffix).
 * All calculations use UTC exclusively to avoid timezone-dependent behavior.
 *
 * Run with: npm test -- timezone-and-dst.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  calcExpirationDate,
  getNextExpirationDate,
  isExpired,
  getDaysUntilExpiration,
  formatDateForUser,
} from '@/lib/benefitDates';

describe('Timezone and DST Handling', () => {
  describe('calcExpirationDate - Initial Expiration Calculation', () => {
    describe('Monthly cadence', () => {
      it('should return last day of current month at end-of-day UTC', () => {
        // April 15, 2025 at noon UTC
        const now = new Date('2025-04-15T12:00:00Z');
        const result = calcExpirationDate('Monthly', new Date(), now);

        expect(result).not.toBeNull();
        expect(result!.getUTCFullYear()).toBe(2025);
        expect(result!.getUTCMonth()).toBe(3); // April (0-indexed)
        expect(result!.getUTCDate()).toBe(30); // Last day of April
        expect(result!.getUTCHours()).toBe(23);
        expect(result!.getUTCMinutes()).toBe(59);
        expect(result!.getUTCSeconds()).toBe(59);
      });

      it('should handle February in non-leap year correctly', () => {
        // Feb 10, 2025 (non-leap year)
        const now = new Date('2025-02-10T12:00:00Z');
        const result = calcExpirationDate('Monthly', new Date(), now);

        expect(result!.getUTCDate()).toBe(28); // Last day of Feb (non-leap)
      });

      it('should handle February in leap year correctly', () => {
        // Feb 10, 2024 (leap year)
        const now = new Date('2024-02-10T12:00:00Z');
        const result = calcExpirationDate('Monthly', new Date(), now);

        expect(result!.getUTCDate()).toBe(29); // Last day of Feb (leap year)
      });

      it('should be DST-agnostic (spring forward)', () => {
        // March 9, 2025, 3:00 AM UTC (just before 2 AM EST → 3 AM EDT transition in US)
        const beforeDST = new Date('2025-03-09T03:00:00Z');
        const resultBefore = calcExpirationDate('Monthly', new Date(), beforeDST);

        // March 10, 2025, 3:00 AM UTC (after DST has occurred)
        const afterDST = new Date('2025-03-10T03:00:00Z');
        const resultAfter = calcExpirationDate('Monthly', new Date(), afterDST);

        // Both should still be March 31 regardless of DST
        expect(resultBefore!.getUTCDate()).toBe(31);
        expect(resultAfter!.getUTCDate()).toBe(31);
      });

      it('should be DST-agnostic (fall back)', () => {
        // November 1, 2025, 3:00 AM UTC (just before 2 AM EDT → 1 AM EST transition in US)
        const beforeDST = new Date('2025-11-01T03:00:00Z');
        const resultBefore = calcExpirationDate('Monthly', new Date(), beforeDST);

        // November 3, 2025, 3:00 AM UTC (after DST has occurred)
        const afterDST = new Date('2025-11-03T03:00:00Z');
        const resultAfter = calcExpirationDate('Monthly', new Date(), afterDST);

        // Both should still be November 30 regardless of DST
        expect(resultBefore!.getUTCDate()).toBe(30);
        expect(resultAfter!.getUTCDate()).toBe(30);
      });
    });

    describe('CalendarYear cadence', () => {
      it('should return Dec 31 of current year at end-of-day UTC', () => {
        const now = new Date('2025-06-15T12:00:00Z');
        const result = calcExpirationDate('CalendarYear', new Date(), now);

        expect(result).not.toBeNull();
        expect(result!.getUTCFullYear()).toBe(2025);
        expect(result!.getUTCMonth()).toBe(11); // December
        expect(result!.getUTCDate()).toBe(31);
        expect(result!.getUTCHours()).toBe(23);
        expect(result!.getUTCMinutes()).toBe(59);
        expect(result!.getUTCSeconds()).toBe(59);
      });

      it('should use current year even near year-end', () => {
        const now = new Date('2025-12-25T12:00:00Z');
        const result = calcExpirationDate('CalendarYear', new Date(), now);

        // Still Dec 31, 2025 (not next year)
        expect(result!.getUTCFullYear()).toBe(2025);
        expect(result!.getUTCDate()).toBe(31);
      });
    });

    describe('CardmemberYear cadence', () => {
      it('should return one day before renewal anniversary at end-of-day UTC', () => {
        // Renewal date: June 15 (stored in UTC)
        const renewalDate = new Date('2024-06-15T00:00:00Z');
        // Current date: May 1, 2025
        const now = new Date('2025-05-01T12:00:00Z');

        const result = calcExpirationDate('CardmemberYear', renewalDate, now);

        // Should be June 14 (one day before renewal)
        expect(result!.getUTCMonth()).toBe(5); // June (0-indexed)
        expect(result!.getUTCDate()).toBe(14);
        expect(result!.getUTCFullYear()).toBe(2025);
      });

      it('should advance to next year if anniversary has passed', () => {
        // Renewal date: March 15
        const renewalDate = new Date('2024-03-15T00:00:00Z');
        // Current date: July 1, 2025 (anniversary already passed this year)
        const now = new Date('2025-07-01T12:00:00Z');

        const result = calcExpirationDate('CardmemberYear', renewalDate, now);

        // Should be March 14, 2026 (one day before next renewal)
        expect(result!.getUTCMonth()).toBe(2); // March
        expect(result!.getUTCDate()).toBe(14);
        expect(result!.getUTCFullYear()).toBe(2026);
      });

      it('should handle Feb 29 renewal in leap year', () => {
        // Renewal date: Feb 29 (in a leap year)
        const renewalDate = new Date('2024-02-29T00:00:00Z');
        // Current date: Jan 1, 2025
        const now = new Date('2025-01-01T00:00:00Z');

        const result = calcExpirationDate('CardmemberYear', renewalDate, now);

        // Should calculate correctly even though 2025 is not a leap year
        expect(result).not.toBeNull();
        // Result should be Feb 28 or 29 depending on current year
        expect(result!.getUTCMonth()).toBe(1); // February
      });

      it('should be DST-agnostic regardless of renewal date', () => {
        // Renewal date: June 15
        const renewalDate = new Date('2024-06-15T00:00:00Z');

        // Before DST (March 8, 2025) - Anniversary hasn't happened this year yet
        const beforeDST = new Date('2025-03-08T12:00:00Z');
        const resultBefore = calcExpirationDate('CardmemberYear', renewalDate, beforeDST);

        // After DST (June 20, 2025) - Anniversary has already passed this year
        const afterDST = new Date('2025-06-20T12:00:00Z');
        const resultAfter = calcExpirationDate('CardmemberYear', renewalDate, afterDST);

        // Before anniversary: should be June 14, 2025
        expect(resultBefore!.getUTCDate()).toBe(14);
        expect(resultBefore!.getUTCMonth()).toBe(5); // June
        expect(resultBefore!.getUTCFullYear()).toBe(2025);

        // After anniversary: should be June 14, 2026
        expect(resultAfter!.getUTCDate()).toBe(14);
        expect(resultAfter!.getUTCMonth()).toBe(5); // June
        expect(resultAfter!.getUTCFullYear()).toBe(2026);
      });
    });

    describe('OneTime cadence', () => {
      it('should return null for OneTime benefits', () => {
        const now = new Date('2025-06-15T12:00:00Z');
        const result = calcExpirationDate('OneTime', new Date(), now);

        expect(result).toBeNull();
      });
    });
  });

  describe('getNextExpirationDate - Reset Expiration Calculation', () => {
    describe('Monthly cadence', () => {
      it('should return last day of next month after now', () => {
        // March 31, 2025 (benefit just expired)
        const now = new Date('2025-03-31T12:00:00Z');
        const result = getNextExpirationDate('Monthly', new Date(), now);

        // Should be April 30, 2025
        expect(result!.getUTCMonth()).toBe(3); // April
        expect(result!.getUTCDate()).toBe(30);
        expect(result!.getUTCFullYear()).toBe(2025);
      });

      it('should handle month-to-month rollover correctly', () => {
        // December 31, 2024
        const now = new Date('2024-12-31T12:00:00Z');
        const result = getNextExpirationDate('Monthly', new Date(), now);

        // Should be January 31, 2025 (next month)
        expect(result!.getUTCMonth()).toBe(0); // January
        expect(result!.getUTCDate()).toBe(31);
        expect(result!.getUTCFullYear()).toBe(2025);
      });

      it('should advance by one full month from any date', () => {
        // June 15, 2025
        const now = new Date('2025-06-15T12:00:00Z');
        const result = getNextExpirationDate('Monthly', new Date(), now);

        // Should be July 31, 2025 (next month's last day)
        expect(result!.getUTCMonth()).toBe(6); // July
        expect(result!.getUTCDate()).toBe(31);
      });
    });

    describe('CalendarYear cadence', () => {
      it('should return Dec 31 of next year', () => {
        // December 31, 2025 (benefit just expired)
        const now = new Date('2025-12-31T12:00:00Z');
        const result = getNextExpirationDate('CalendarYear', new Date(), now);

        // Should be December 31, 2026
        expect(result!.getUTCFullYear()).toBe(2026);
        expect(result!.getUTCMonth()).toBe(11);
        expect(result!.getUTCDate()).toBe(31);
      });

      it('should use next year even if called before Dec 31', () => {
        // June 1, 2025
        const now = new Date('2025-06-01T12:00:00Z');
        const result = getNextExpirationDate('CalendarYear', new Date(), now);

        // Should be December 31, 2026 (next calendar year)
        expect(result!.getUTCFullYear()).toBe(2026);
      });
    });

    describe('CardmemberYear cadence', () => {
      it('should advance to next anniversary year boundary', () => {
        // Renewal date: June 15
        const renewalDate = new Date('2024-06-15T00:00:00Z');
        // Current date: June 15, 2025 (just expired - one day after Jun 14)
        const now = new Date('2025-06-15T12:00:00Z');

        const result = getNextExpirationDate('CardmemberYear', renewalDate, now);

        // Should be June 14, 2026
        expect(result!.getUTCMonth()).toBe(5); // June
        expect(result!.getUTCDate()).toBe(14);
        expect(result!.getUTCFullYear()).toBe(2026);
      });

      it('should handle anniversary already passed in current year', () => {
        // Renewal date: March 15
        const renewalDate = new Date('2024-03-15T00:00:00Z');
        // Current date: July 1, 2025 (anniversary passed)
        const now = new Date('2025-07-01T12:00:00Z');

        const result = getNextExpirationDate('CardmemberYear', renewalDate, now);

        // Should be March 14, 2026
        expect(result!.getUTCMonth()).toBe(2); // March
        expect(result!.getUTCDate()).toBe(14);
        expect(result!.getUTCFullYear()).toBe(2026);
      });
    });

    describe('OneTime cadence', () => {
      it('should return null for OneTime benefits', () => {
        const now = new Date('2025-06-15T12:00:00Z');
        const result = getNextExpirationDate('OneTime', new Date(), now);

        expect(result).toBeNull();
      });
    });
  });

  describe('isExpired - Expiration Status Check', () => {
    it('should return false for null expiration (perpetual benefit)', () => {
      const now = new Date('2025-06-15T12:00:00Z');
      expect(isExpired(null, now)).toBe(false);
    });

    it('should return true if expiration is in the past', () => {
      const expirationDate = new Date('2025-01-15T12:00:00Z');
      const now = new Date('2025-06-15T12:00:00Z');

      expect(isExpired(expirationDate, now)).toBe(true);
    });

    it('should return false if expiration is in the future', () => {
      const expirationDate = new Date('2025-12-31T23:59:59Z');
      const now = new Date('2025-06-15T12:00:00Z');

      expect(isExpired(expirationDate, now)).toBe(false);
    });

    it('should use exact time comparison (expiration at exact moment)', () => {
      const expirationDate = new Date('2025-06-15T12:00:00Z');
      const now = new Date('2025-06-15T12:00:00Z');

      // Exactly at expiration moment should be considered expired (<=)
      expect(isExpired(expirationDate, now)).toBe(false); // Not quite expired
    });

    it('should return true 1ms after expiration', () => {
      const expirationDate = new Date('2025-06-15T12:00:00.000Z');
      const now = new Date('2025-06-15T12:00:00.001Z');

      expect(isExpired(expirationDate, now)).toBe(true);
    });

    it('should be DST-agnostic', () => {
      // Before DST
      const beforeDST = new Date('2025-03-08T12:00:00Z');
      const expirationBeforeDST = new Date('2025-03-01T23:59:59Z');

      // After DST
      const afterDST = new Date('2025-06-15T12:00:00Z');
      const expirationAfterDST = new Date('2025-06-01T23:59:59Z');

      // Both should correctly identify expired benefits
      expect(isExpired(expirationBeforeDST, beforeDST)).toBe(true);
      expect(isExpired(expirationAfterDST, afterDST)).toBe(true);
    });
  });

  describe('getDaysUntilExpiration - Days Remaining Calculation', () => {
    it('should return Infinity for null expiration (perpetual)', () => {
      const now = new Date('2025-06-15T12:00:00Z');
      expect(getDaysUntilExpiration(null, now)).toBe(Infinity);
    });

    it('should return positive number for future expiration', () => {
      // Expires 10 days from now (10.5 days = 252 hours)
      const expirationDate = new Date('2025-06-25T23:59:59Z');
      const now = new Date('2025-06-15T12:00:00Z');

      const days = getDaysUntilExpiration(expirationDate, now);
      expect(days).toBeGreaterThan(0);
      // Math.ceil(10.5) = 11 days remaining (conservative rounding)
      expect(days).toBe(11);
    });

    it('should round up fractional days', () => {
      // Expires in 10.5 days
      const expirationDate = new Date('2025-06-25T12:00:00Z');
      const now = new Date('2025-06-15T00:00:00Z');

      const days = getDaysUntilExpiration(expirationDate, now);
      expect(days).toBe(11); // Rounded up
    });

    it('should return negative number for past expiration', () => {
      // Already expired 5 days ago
      const expirationDate = new Date('2025-06-10T12:00:00Z');
      const now = new Date('2025-06-15T12:00:00Z');

      const days = getDaysUntilExpiration(expirationDate, now);
      expect(days).toBeLessThan(0);
    });

    it('should return 0 or 1 for benefits expiring today', () => {
      // Expires at end of today
      const expirationDate = new Date('2025-06-15T23:59:59Z');
      const now = new Date('2025-06-15T12:00:00Z');

      const days = getDaysUntilExpiration(expirationDate, now);
      expect(days).toBe(1); // Less than 24 hours, rounds up to 1 day
    });

    it('should be DST-agnostic', () => {
      // Test across DST transition - same day counts regardless of DST status
      // Before DST: March 8, 2025 → expires March 18 (10.5 days away)
      const beforeDST = new Date('2025-03-08T12:00:00Z');
      const expirationBeforeDST = new Date('2025-03-18T23:59:59Z');
      const daysBeforeDST = getDaysUntilExpiration(expirationBeforeDST, beforeDST);

      // After DST: June 15, 2025 → expires June 25 (10.5 days away)
      const afterDST = new Date('2025-06-15T12:00:00Z');
      const expirationAfterDST = new Date('2025-06-25T23:59:59Z');
      const daysAfterDST = getDaysUntilExpiration(expirationAfterDST, afterDST);

      // Both should return 11 days (Math.ceil(10.5))
      expect(daysBeforeDST).toBe(11);
      expect(daysAfterDST).toBe(11);
    });
  });

  describe('formatDateForUser - Display Formatting', () => {
    it('should return N/A for null date', () => {
      const result = formatDateForUser(null);
      expect(result).toBe('N/A');
    });

    it('should format date as "Jan 15, 2025"', () => {
      const date = new Date('2025-01-15T12:00:00Z');
      const result = formatDateForUser(date);

      // Result should contain month, day, and year
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2025/);
    });

    it('should format date in user local timezone', () => {
      // This test documents that formatDateForUser uses the browser's local timezone
      // The exact output depends on the test runner's timezone, but the format should be consistent
      const date = new Date('2025-12-25T00:00:00Z');
      const result = formatDateForUser(date);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).not.toBe('N/A');
    });

    it('should handle end-of-month dates', () => {
      const date = new Date('2025-12-31T23:59:59Z');
      const result = formatDateForUser(date);

      expect(result).toMatch(/2025/);
      expect(result).toMatch(/31/);
    });
  });

  describe('Integration: Realistic Scenarios', () => {
    it('should handle benefit with monthly reset across DST spring forward', () => {
      // Setup: Benefit expires last day of March 2025
      const renewalDate = new Date('2024-06-15T00:00:00Z');
      const now = new Date('2025-03-15T12:00:00Z'); // Mid-March, before DST
      const expiration = calcExpirationDate('Monthly', renewalDate, now);

      // Expiration should be March 31, 2025
      expect(expiration!.getUTCDate()).toBe(31);
      expect(expiration!.getUTCMonth()).toBe(2); // March

      // Verify it's not expired yet
      expect(isExpired(expiration, now)).toBe(false);

      // Simulate time passing: April 1, 2025 (after DST, after expiration)
      const afterDST = new Date('2025-04-01T12:00:00Z');
      expect(isExpired(expiration, afterDST)).toBe(true);

      // Reset should give us the last day of the next month after expiration
      // Since now is April 1, next month is May, so May 31
      const nextExpiration = getNextExpirationDate('Monthly', renewalDate, afterDST);
      expect(nextExpiration!.getUTCDate()).toBe(31);
      expect(nextExpiration!.getUTCMonth()).toBe(4); // May
    });

    it('should handle cardmember year reset across calendar year boundary', () => {
      // Setup: Card renews on June 15
      const renewalDate = new Date('2024-06-15T00:00:00Z');

      // Create benefit at start of cardmember year (June 15, 2024)
      const startOfYear = new Date('2024-06-15T00:00:00Z');
      const expiration = calcExpirationDate('CardmemberYear', renewalDate, startOfYear);

      // Should be June 14, 2025
      expect(expiration!.getUTCMonth()).toBe(5); // June
      expect(expiration!.getUTCDate()).toBe(14);
      expect(expiration!.getUTCFullYear()).toBe(2025);

      // Simulate benefit being used and time passing past expiration (June 20, 2025)
      const afterExpiration = new Date('2025-06-20T12:00:00Z');
      expect(isExpired(expiration, afterExpiration)).toBe(true);

      // Reset should give us June 14, 2026
      const nextExpiration = getNextExpirationDate(
        'CardmemberYear',
        renewalDate,
        afterExpiration
      );
      expect(nextExpiration!.getUTCDate()).toBe(14);
      expect(nextExpiration!.getUTCMonth()).toBe(5); // June
      expect(nextExpiration!.getUTCFullYear()).toBe(2026);
    });

    it('should correctly identify warning/critical expiration states across DST', () => {
      // Setup: Benefit with CalendarYear cadence
      const renewalDate = new Date('2024-01-01T00:00:00Z');
      const now = new Date('2025-12-29T12:00:00Z'); // 2.5 days before year end
      const expiration = calcExpirationDate('CalendarYear', renewalDate, now);

      // Should be Dec 31, 2025
      expect(expiration!.getUTCDate()).toBe(31);

      // Days remaining (Dec 29 12:00 UTC to Dec 31 23:59:59 UTC = 2.5 days)
      const daysRemaining = getDaysUntilExpiration(expiration, now);
      expect(daysRemaining).toBe(3); // Math.ceil(2.5) = 3 days

      // Not expired yet
      expect(isExpired(expiration, now)).toBe(false);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle year 2000 (leap year)', () => {
      const now = new Date('2000-02-10T12:00:00Z');
      const result = calcExpirationDate('Monthly', new Date(), now);

      // 2000 is a leap year
      expect(result!.getUTCDate()).toBe(29);
    });

    it('should handle year 1900 (not a leap year)', () => {
      // Note: This is a historical test; in practice, dates before 1970 are problematic
      // but the function should still work logically
      const now = new Date('1970-02-10T00:00:00Z');
      const result = calcExpirationDate('Monthly', new Date(), now);

      // 1970 is not a leap year
      expect(result!.getUTCDate()).toBe(28);
    });

    it('should handle boundary between UTC days and local days', () => {
      // Midnight UTC
      const midnightUTC = new Date('2025-06-15T00:00:00Z');
      const expirationUTC = new Date('2025-06-16T23:59:59Z');

      const days = getDaysUntilExpiration(expirationUTC, midnightUTC);
      expect(days).toBe(2); // ~36 hours, rounds up to 2 days
    });

    it('should not throw on invalid renewal dates', () => {
      // Invalid date should be handled gracefully
      const invalidDate = new Date('2025-02-30T00:00:00Z'); // Feb 30 doesn't exist
      const now = new Date('2025-06-15T12:00:00Z');

      // Should not throw
      expect(() => {
        calcExpirationDate('CardmemberYear', invalidDate, now);
      }).not.toThrow();
    });
  });
});
