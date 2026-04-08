/**
 * Unit tests for the Date Math Engine.
 *
 * Covers all cadence types, leap years, mid-period additions,
 * boundary dates, anniversary edge cases, and next-period calculations.
 *
 * ≥40 test cases as required by the spec.
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePeriodForBenefit,
  calculateNextPeriod,
  resolveCadence,
} from '../date-math';

// ============================================================================
// Helper: create UTC dates concisely
// ============================================================================
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function utcEnd(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
}

/** Dummy renewal date used when cadence doesn't need it */
const DUMMY_RENEWAL = utc(2025, 1, 1);

// ============================================================================
// resolveCadence
// ============================================================================
describe('resolveCadence', () => {
  it('returns claimingCadence when it is a valid value', () => {
    expect(resolveCadence('MONTHLY', 'CalendarYear')).toBe('MONTHLY');
    expect(resolveCadence('QUARTERLY', 'Monthly')).toBe('QUARTERLY');
    expect(resolveCadence('SEMI_ANNUAL', 'Monthly')).toBe('SEMI_ANNUAL');
    expect(resolveCadence('FLEXIBLE_ANNUAL', 'Monthly')).toBe('FLEXIBLE_ANNUAL');
    expect(resolveCadence('ONE_TIME', 'Monthly')).toBe('ONE_TIME');
  });

  it('is case-insensitive for claimingCadence', () => {
    expect(resolveCadence('monthly', 'CalendarYear')).toBe('MONTHLY');
    expect(resolveCadence('Quarterly', 'Monthly')).toBe('QUARTERLY');
  });

  it('falls back to resetCadence mapping when claimingCadence is null', () => {
    expect(resolveCadence(null, 'Monthly')).toBe('MONTHLY');
    expect(resolveCadence(null, 'CalendarYear')).toBe('FLEXIBLE_ANNUAL');
    expect(resolveCadence(null, 'CardmemberYear')).toBe('FLEXIBLE_ANNUAL');
    expect(resolveCadence(null, 'OneTime')).toBe('ONE_TIME');
  });

  it('falls back to resetCadence mapping when claimingCadence is undefined', () => {
    expect(resolveCadence(undefined, 'Monthly')).toBe('MONTHLY');
  });

  it('falls back to resetCadence mapping when claimingCadence is invalid', () => {
    expect(resolveCadence('INVALID', 'Monthly')).toBe('MONTHLY');
    expect(resolveCadence('BIWEEKLY', 'CalendarYear')).toBe('FLEXIBLE_ANNUAL');
  });

  it('defaults to MONTHLY for unknown resetCadence', () => {
    expect(resolveCadence(null, 'UnknownCadence')).toBe('MONTHLY');
    expect(resolveCadence(null, '')).toBe('MONTHLY');
  });
});

// ============================================================================
// MONTHLY
// ============================================================================
describe('calculatePeriodForBenefit — MONTHLY', () => {
  it('calculates April 2026 period for a mid-month date', () => {
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2026, 4, 8), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 4, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 4, 30));
  });

  it('calculates January period (31-day month)', () => {
    const result = calculatePeriodForBenefit('MONTHLY', 'Monthly', utc(2026, 1, 15), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 1, 31));
  });

  it('calculates February period in a non-leap year (28 days)', () => {
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2026, 2, 15), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 2, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 2, 28));
  });

  it('calculates February period in a leap year (29 days)', () => {
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2028, 2, 15), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2028, 2, 1));
    expect(result.periodEnd).toEqual(utcEnd(2028, 2, 29));
  });

  it('handles first day of month', () => {
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2026, 3, 1), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 3, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 3, 31));
  });

  it('handles last day of month', () => {
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2026, 3, 31), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 3, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 3, 31));
  });

  it('handles December (year boundary)', () => {
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2026, 12, 25), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 12, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });

  it('handles explicit MONTHLY claimingCadence overriding CalendarYear resetCadence', () => {
    const result = calculatePeriodForBenefit('MONTHLY', 'CalendarYear', utc(2026, 6, 10), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 6, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 6, 30));
  });
});

// ============================================================================
// QUARTERLY
// ============================================================================
describe('calculatePeriodForBenefit — QUARTERLY', () => {
  it('calculates Q1 (January reference)', () => {
    const result = calculatePeriodForBenefit('QUARTERLY', 'Monthly', utc(2026, 1, 15), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 3, 31));
  });

  it('calculates Q2 (April reference, per spec example)', () => {
    const result = calculatePeriodForBenefit('QUARTERLY', 'Monthly', utc(2026, 4, 8), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 4, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 6, 30));
  });

  it('calculates Q3 (August reference)', () => {
    const result = calculatePeriodForBenefit('QUARTERLY', 'Monthly', utc(2026, 8, 22), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 7, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 9, 30));
  });

  it('calculates Q4 (November reference, per spec example)', () => {
    const result = calculatePeriodForBenefit('QUARTERLY', 'Monthly', utc(2026, 11, 22), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 10, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });

  it('handles first day of quarter (Q1 boundary)', () => {
    const result = calculatePeriodForBenefit('QUARTERLY', 'Monthly', utc(2026, 1, 1), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 3, 31));
  });

  it('handles last day of quarter (Q4 boundary)', () => {
    const result = calculatePeriodForBenefit('QUARTERLY', 'Monthly', utc(2026, 12, 31), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 10, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });
});

// ============================================================================
// SEMI_ANNUAL
// ============================================================================
describe('calculatePeriodForBenefit — SEMI_ANNUAL', () => {
  it('calculates H1 (April reference, per spec example)', () => {
    const result = calculatePeriodForBenefit('SEMI_ANNUAL', 'CalendarYear', utc(2026, 4, 8), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 6, 30));
  });

  it('calculates H2 (October reference)', () => {
    const result = calculatePeriodForBenefit('SEMI_ANNUAL', 'CalendarYear', utc(2026, 10, 15), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 7, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });

  it('handles boundary: June 30 is H1', () => {
    const result = calculatePeriodForBenefit('SEMI_ANNUAL', 'CalendarYear', utc(2026, 6, 30), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 6, 30));
  });

  it('handles boundary: July 1 is H2', () => {
    const result = calculatePeriodForBenefit('SEMI_ANNUAL', 'CalendarYear', utc(2026, 7, 1), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 7, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });

  it('handles custom window "0918" — H1 (before Sept 18)', () => {
    const result = calculatePeriodForBenefit(
      'SEMI_ANNUAL', 'CalendarYear', utc(2026, 5, 10), DUMMY_RENEWAL, '0918'
    );
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    // H1 ends day before Sept 18 = Sept 17
    expect(result.periodEnd).toEqual(utcEnd(2026, 9, 17));
  });

  it('handles custom window "0918" — H2 (Oct 5, per spec example)', () => {
    const result = calculatePeriodForBenefit(
      'SEMI_ANNUAL', 'CalendarYear', utc(2026, 10, 5), DUMMY_RENEWAL, '0918'
    );
    expect(result.periodStart).toEqual(utc(2026, 9, 18));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });

  it('handles custom window "0918" — boundary: Sept 17 is H1', () => {
    const result = calculatePeriodForBenefit(
      'SEMI_ANNUAL', 'CalendarYear', utc(2026, 9, 17), DUMMY_RENEWAL, '0918'
    );
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 9, 17));
  });

  it('handles custom window "0918" — boundary: Sept 18 is H2', () => {
    const result = calculatePeriodForBenefit(
      'SEMI_ANNUAL', 'CalendarYear', utc(2026, 9, 18), DUMMY_RENEWAL, '0918'
    );
    expect(result.periodStart).toEqual(utc(2026, 9, 18));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });
});

// ============================================================================
// FLEXIBLE_ANNUAL — Calendar Year
// ============================================================================
describe('calculatePeriodForBenefit — FLEXIBLE_ANNUAL (CalendarYear)', () => {
  it('calculates full calendar year (per spec example)', () => {
    const result = calculatePeriodForBenefit(null, 'CalendarYear', utc(2026, 4, 8), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });

  it('calculates calendar year for Jan 1 reference', () => {
    const result = calculatePeriodForBenefit('FLEXIBLE_ANNUAL', 'CalendarYear', utc(2026, 1, 1), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });

  it('calculates calendar year for Dec 31 reference', () => {
    const result = calculatePeriodForBenefit(null, 'CalendarYear', utc(2026, 12, 31), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });
});

// ============================================================================
// FLEXIBLE_ANNUAL — CardmemberYear
// ============================================================================
describe('calculatePeriodForBenefit — FLEXIBLE_ANNUAL (CardmemberYear)', () => {
  it('calculates period when ref is before renewal anniversary (per spec example)', () => {
    // renewalDate = May 15, ref = April 8, 2026 → ref < 2026-05-15
    const renewal = utc(2024, 5, 15);
    const result = calculatePeriodForBenefit(null, 'CardmemberYear', utc(2026, 4, 8), renewal);
    expect(result.periodStart).toEqual(utc(2025, 5, 15));
    expect(result.periodEnd).toEqual(utcEnd(2026, 5, 14));
  });

  it('calculates period when ref is after renewal anniversary (per spec example)', () => {
    // renewalDate = May 15, ref = July 20, 2026 → ref >= 2026-05-15
    const renewal = utc(2024, 5, 15);
    const result = calculatePeriodForBenefit(null, 'CardmemberYear', utc(2026, 7, 20), renewal);
    expect(result.periodStart).toEqual(utc(2026, 5, 15));
    expect(result.periodEnd).toEqual(utcEnd(2027, 5, 14));
  });

  it('calculates period when ref is exactly on renewal anniversary', () => {
    const renewal = utc(2024, 5, 15);
    const result = calculatePeriodForBenefit(null, 'CardmemberYear', utc(2026, 5, 15), renewal);
    // ref >= candidate → current cycle starts at candidate
    expect(result.periodStart).toEqual(utc(2026, 5, 15));
    expect(result.periodEnd).toEqual(utcEnd(2027, 5, 14));
  });

  it('handles leap year renewal date (Feb 29) in a non-leap year', () => {
    // Renewal Feb 29 → in 2027 (non-leap), normalized to Feb 28
    const renewal = utc(2024, 2, 29);
    const result = calculatePeriodForBenefit(null, 'CardmemberYear', utc(2027, 6, 10), renewal);
    // Candidate 2027-02-28 (normalized); ref (Jun 10) >= candidate
    expect(result.periodStart).toEqual(utc(2027, 2, 28));
    // Next anniversary: 2028-02-29 (2028 is leap) → period ends Feb 28
    expect(result.periodEnd).toEqual(utcEnd(2028, 2, 28));
  });

  it('handles leap year renewal date (Feb 29) in a leap year', () => {
    const renewal = utc(2024, 2, 29);
    const result = calculatePeriodForBenefit(null, 'CardmemberYear', utc(2028, 1, 15), renewal);
    // Candidate 2028-02-29 (leap year, valid); ref (Jan 15) < candidate
    // Period starts from previous year: 2027-02-28 (normalized)
    expect(result.periodStart).toEqual(utc(2027, 2, 28));
    expect(result.periodEnd).toEqual(utcEnd(2028, 2, 28));
  });

  it('handles renewal on Dec 31', () => {
    const renewal = utc(2023, 12, 31);
    const result = calculatePeriodForBenefit(null, 'CardmemberYear', utc(2026, 6, 15), renewal);
    // Candidate 2026-12-31; ref (Jun 15) < candidate
    // Period starts: 2025-12-31
    expect(result.periodStart).toEqual(utc(2025, 12, 31));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 30));
  });

  it('handles renewal on Jan 1', () => {
    const renewal = utc(2023, 1, 1);
    const result = calculatePeriodForBenefit(null, 'CardmemberYear', utc(2026, 6, 15), renewal);
    // Candidate 2026-01-01; ref (Jun 15) >= candidate
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });
});

// ============================================================================
// ONE_TIME
// ============================================================================
describe('calculatePeriodForBenefit — ONE_TIME', () => {
  it('sets periodStart to reference date start-of-day and periodEnd to null', () => {
    const result = calculatePeriodForBenefit(null, 'OneTime', utc(2026, 4, 8), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 4, 8));
    expect(result.periodEnd).toBeNull();
  });

  it('works with explicit ONE_TIME claimingCadence', () => {
    const result = calculatePeriodForBenefit('ONE_TIME', 'OneTime', utc(2026, 7, 22), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 7, 22));
    expect(result.periodEnd).toBeNull();
  });

  it('strips time component from reference date', () => {
    const refWithTime = new Date(Date.UTC(2026, 3, 8, 14, 30, 45, 123));
    const result = calculatePeriodForBenefit(null, 'OneTime', refWithTime, DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 4, 8));
    expect(result.periodEnd).toBeNull();
  });
});

// ============================================================================
// calculateNextPeriod — MONTHLY
// ============================================================================
describe('calculateNextPeriod — MONTHLY', () => {
  it('advances from April to May', () => {
    const result = calculateNextPeriod(utcEnd(2026, 4, 30), null, 'Monthly', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 5, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 5, 31));
  });

  it('advances from December to January (year boundary)', () => {
    const result = calculateNextPeriod(utcEnd(2026, 12, 31), null, 'Monthly', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2027, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2027, 1, 31));
  });

  it('advances from January to February in a leap year', () => {
    const result = calculateNextPeriod(utcEnd(2028, 1, 31), null, 'Monthly', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2028, 2, 1));
    expect(result.periodEnd).toEqual(utcEnd(2028, 2, 29));
  });

  it('advances from January to February in a non-leap year', () => {
    const result = calculateNextPeriod(utcEnd(2026, 1, 31), null, 'Monthly', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 2, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 2, 28));
  });
});

// ============================================================================
// calculateNextPeriod — QUARTERLY
// ============================================================================
describe('calculateNextPeriod — QUARTERLY', () => {
  it('advances from Q2 to Q3', () => {
    const result = calculateNextPeriod(utcEnd(2026, 6, 30), 'QUARTERLY', 'Monthly', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 7, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 9, 30));
  });

  it('advances from Q4 to Q1 next year', () => {
    const result = calculateNextPeriod(utcEnd(2026, 12, 31), 'QUARTERLY', 'Monthly', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2027, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2027, 3, 31));
  });
});

// ============================================================================
// calculateNextPeriod — SEMI_ANNUAL
// ============================================================================
describe('calculateNextPeriod — SEMI_ANNUAL', () => {
  it('advances from H1 to H2 (standard)', () => {
    const result = calculateNextPeriod(utcEnd(2026, 6, 30), 'SEMI_ANNUAL', 'CalendarYear', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 7, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });

  it('advances from H2 to H1 next year (standard)', () => {
    const result = calculateNextPeriod(utcEnd(2026, 12, 31), 'SEMI_ANNUAL', 'CalendarYear', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2027, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2027, 6, 30));
  });

  it('advances from H1 to H2 with custom window "0918"', () => {
    const result = calculateNextPeriod(
      utcEnd(2026, 9, 17), 'SEMI_ANNUAL', 'CalendarYear', DUMMY_RENEWAL, '0918'
    );
    expect(result.periodStart).toEqual(utc(2026, 9, 18));
    expect(result.periodEnd).toEqual(utcEnd(2026, 12, 31));
  });
});

// ============================================================================
// calculateNextPeriod — FLEXIBLE_ANNUAL
// ============================================================================
describe('calculateNextPeriod — FLEXIBLE_ANNUAL', () => {
  it('advances calendar year from 2026 to 2027', () => {
    const result = calculateNextPeriod(utcEnd(2026, 12, 31), null, 'CalendarYear', DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2027, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2027, 12, 31));
  });

  it('advances cardmember year from one anniversary to the next', () => {
    const renewal = utc(2024, 5, 15);
    // Current period ends May 14, 2026 → next starts May 15, 2026
    const result = calculateNextPeriod(utcEnd(2026, 5, 14), null, 'CardmemberYear', renewal);
    expect(result.periodStart).toEqual(utc(2026, 5, 15));
    expect(result.periodEnd).toEqual(utcEnd(2027, 5, 14));
  });
});

// ============================================================================
// calculateNextPeriod — ONE_TIME
// ============================================================================
describe('calculateNextPeriod — ONE_TIME', () => {
  it('returns null periodEnd (no next period)', () => {
    const result = calculateNextPeriod(utc(2026, 4, 8), null, 'OneTime', DUMMY_RENEWAL);
    expect(result.periodEnd).toBeNull();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================
describe('Edge cases', () => {
  it('handles Feb 28 in a leap year (not last day)', () => {
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2028, 2, 28), DUMMY_RENEWAL);
    // Feb 28 is still in February — should return Feb period with 29 days
    expect(result.periodStart).toEqual(utc(2028, 2, 1));
    expect(result.periodEnd).toEqual(utcEnd(2028, 2, 29));
  });

  it('handles Feb 29 in a leap year (last day)', () => {
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2028, 2, 29), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2028, 2, 1));
    expect(result.periodEnd).toEqual(utcEnd(2028, 2, 29));
  });

  it('mid-month card add gets full period (EC-1)', () => {
    // User adds card April 15 → still gets April 1-30 period
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2026, 4, 15), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2026, 4, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 4, 30));
  });

  it('handles renewal date on March 31 (month with 31 days)', () => {
    const renewal = utc(2023, 3, 31);
    const result = calculatePeriodForBenefit(null, 'CardmemberYear', utc(2026, 4, 15), renewal);
    // Candidate 2026-03-31; ref (Apr 15) >= candidate
    expect(result.periodStart).toEqual(utc(2026, 3, 31));
    expect(result.periodEnd).toEqual(utcEnd(2027, 3, 30));
  });

  it('null claimingWindowEnd for SEMI_ANNUAL uses standard split', () => {
    const result = calculatePeriodForBenefit('SEMI_ANNUAL', 'CalendarYear', utc(2026, 3, 1), DUMMY_RENEWAL, null);
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 6, 30));
  });

  it('empty string claimingWindowEnd is treated as no window', () => {
    const result = calculatePeriodForBenefit('SEMI_ANNUAL', 'CalendarYear', utc(2026, 3, 1), DUMMY_RENEWAL, '');
    expect(result.periodStart).toEqual(utc(2026, 1, 1));
    expect(result.periodEnd).toEqual(utcEnd(2026, 6, 30));
  });

  it('handles year 2100 (non-leap century year)', () => {
    // 2100 is NOT a leap year (divisible by 100 but not 400)
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2100, 2, 15), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2100, 2, 1));
    expect(result.periodEnd).toEqual(utcEnd(2100, 2, 28));
  });

  it('handles year 2000 (leap century year)', () => {
    // 2000 IS a leap year (divisible by 400)
    const result = calculatePeriodForBenefit(null, 'Monthly', utc(2000, 2, 15), DUMMY_RENEWAL);
    expect(result.periodStart).toEqual(utc(2000, 2, 1));
    expect(result.periodEnd).toEqual(utcEnd(2000, 2, 29));
  });
});

// ============================================================================
// resolveClaimingAmount (Sprint 1 — cat-4)
// ============================================================================
describe('resolveClaimingAmount', () => {
  // Import dynamically to test alongside existing tests
  let resolveClaimingAmount: typeof import('../date-math').resolveClaimingAmount;

  beforeAll(async () => {
    const mod = await import('../date-math');
    resolveClaimingAmount = mod.resolveClaimingAmount;
  });

  it('returns override amount when variableAmounts has matching month', () => {
    expect(resolveClaimingAmount(1500, { '12': 3500 }, 12)).toBe(3500);
  });

  it('returns base amount when variableAmounts has no matching month', () => {
    expect(resolveClaimingAmount(1500, { '12': 3500 }, 6)).toBe(1500);
  });

  it('returns base amount when variableAmounts is null', () => {
    expect(resolveClaimingAmount(1500, null, 12)).toBe(1500);
  });

  it('returns base amount when variableAmounts is undefined', () => {
    expect(resolveClaimingAmount(1500, undefined, 12)).toBe(1500);
  });

  it('returns base amount when variableAmounts is empty object', () => {
    expect(resolveClaimingAmount(1500, {}, 6)).toBe(1500);
  });

  it('handles multiple overrides correctly', () => {
    const overrides = { '1': 2000, '6': 2500, '12': 3500 };
    expect(resolveClaimingAmount(1500, overrides, 1)).toBe(2000);
    expect(resolveClaimingAmount(1500, overrides, 6)).toBe(2500);
    expect(resolveClaimingAmount(1500, overrides, 12)).toBe(3500);
    expect(resolveClaimingAmount(1500, overrides, 3)).toBe(1500); // no override
  });

  it('handles month boundary values (1 and 12)', () => {
    expect(resolveClaimingAmount(1000, { '1': 500 }, 1)).toBe(500);
    expect(resolveClaimingAmount(1000, { '12': 999 }, 12)).toBe(999);
  });
});
