/**
 * Date Math Engine for the Benefit Engine.
 *
 * Pure functions that calculate period boundaries (periodStart/periodEnd) for
 * each cadence type. All calculations use UTC to ensure consistency across
 * timezones and DST transitions.
 *
 * @module benefit-engine/date-math
 */

import type { ClaimingCadence, PeriodBoundary } from './types';

// ============================================================================
// Variable Amount Resolution
// ============================================================================

/**
 * Resolves the effective claiming amount for a specific period month,
 * supporting variable amounts (e.g., Amex Uber December $35 bonus).
 *
 * If `variableAmounts` contains an override for the given month (1-12),
 * that value is returned. Otherwise, falls back to `baseAmount`.
 *
 * @param baseAmount - Default per-period amount in cents (e.g., 1500 = $15)
 * @param variableAmounts - Nullable JSON map of month number → amount in cents
 * @param periodMonth - The 1-indexed month of the period (1 = January, 12 = December)
 * @returns Resolved amount in cents for this period
 *
 * @example
 * resolveClaimingAmount(1500, { "12": 3500 }, 12) // → 3500 (December override)
 * resolveClaimingAmount(1500, { "12": 3500 }, 6)  // → 1500 (default)
 * resolveClaimingAmount(1500, null, 12)            // → 1500 (no overrides)
 */
export function resolveClaimingAmount(
  baseAmount: number,
  variableAmounts: Record<string, number> | null | undefined,
  periodMonth: number
): number {
  if (variableAmounts && String(periodMonth) in variableAmounts) {
    return variableAmounts[String(periodMonth)];
  }
  return baseAmount;
}

// ============================================================================
// Constants
// ============================================================================

/** Quarter start months (0-indexed): Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct */
const QUARTER_START_MONTHS = [0, 3, 6, 9] as const;

/** Half-year start months (0-indexed): H1=Jan, H2=Jul */
const HALF_START_MONTHS = [0, 6] as const;

// ============================================================================
// Cadence Resolution
// ============================================================================

/**
 * Resolves the effective claiming cadence from a MasterBenefit's fields.
 *
 * Priority:
 * 1. If `claimingCadence` is set → use it directly
 * 2. Else, map `resetCadence` to a ClaimingCadence:
 *    - "Monthly"        → MONTHLY
 *    - "CalendarYear"   → FLEXIBLE_ANNUAL
 *    - "CardmemberYear" → FLEXIBLE_ANNUAL
 *    - "OneTime"        → ONE_TIME
 *    - other/null       → MONTHLY (safe default)
 *
 * @param claimingCadence - The claimingCadence field (may be null/undefined)
 * @param resetCadence - The resetCadence field (always present)
 * @returns Resolved ClaimingCadence value
 */
export function resolveCadence(
  claimingCadence: string | null | undefined,
  resetCadence: string
): ClaimingCadence {
  if (claimingCadence) {
    // Validate it's a known value; fall through to resetCadence mapping if not
    const upper = claimingCadence.toUpperCase();
    const validCadences: ClaimingCadence[] = [
      'MONTHLY',
      'QUARTERLY',
      'SEMI_ANNUAL',
      'FLEXIBLE_ANNUAL',
      'ONE_TIME',
    ];
    if (validCadences.includes(upper as ClaimingCadence)) {
      return upper as ClaimingCadence;
    }
  }

  // Fallback: map resetCadence to ClaimingCadence
  switch (resetCadence) {
    case 'Monthly':
      return 'MONTHLY';
    case 'CalendarYear':
      return 'FLEXIBLE_ANNUAL';
    case 'CardmemberYear':
      return 'FLEXIBLE_ANNUAL';
    case 'OneTime':
      return 'ONE_TIME';
    default:
      return 'MONTHLY';
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Returns the last day of the given month in UTC as end-of-day.
 * Handles leap years correctly (Date.UTC(year, month+1, 0) gives last day of month).
 */
function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
}

/** Returns the first day of the given month in UTC as start-of-day. */
function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

/** Returns the start-of-day in UTC for a given date. */
function startOfDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0, 0, 0, 0
    )
  );
}

/**
 * Normalizes a date for a specific year/month/day, handling cases where
 * the day doesn't exist in that month (e.g., Feb 29 in a non-leap year).
 * If the date rolls forward to the next month, uses the last day of the
 * intended month instead.
 */
function normalizeDate(year: number, month: number, day: number): Date {
  const candidate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  if (candidate.getUTCMonth() !== month) {
    // Rolled forward — use last day of intended month
    return new Date(Date.UTC(year, month + 1, 0, 0, 0, 0, 0));
  }
  return candidate;
}

/**
 * Parses a claimingWindowEnd string (e.g., "0918") into month (0-indexed) and day.
 * Returns null if the string is invalid.
 */
function parseWindowEnd(claimingWindowEnd: string): { month: number; day: number } | null {
  if (!claimingWindowEnd || claimingWindowEnd.length !== 4) {
    return null;
  }
  const monthStr = claimingWindowEnd.slice(0, 2);
  const dayStr = claimingWindowEnd.slice(2, 4);
  const month = parseInt(monthStr, 10) - 1; // Convert to 0-indexed
  const day = parseInt(dayStr, 10);
  if (isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) {
    return null;
  }
  return { month, day };
}

/**
 * Returns the quarter index (0–3) for a given 0-indexed month.
 */
function getQuarter(month: number): number {
  return Math.floor(month / 3);
}

// ============================================================================
// Primary API
// ============================================================================

/**
 * Calculates the periodStart and periodEnd for a benefit based on its cadence.
 *
 * This is the primary entry point for determining period boundaries. It uses
 * `claimingCadence` as the primary cadence source and falls back to `resetCadence`
 * if claimingCadence is not configured.
 *
 * All dates are calculated and returned in UTC.
 *
 * @param claimingCadence - MONTHLY | QUARTERLY | SEMI_ANNUAL | FLEXIBLE_ANNUAL | ONE_TIME (may be null)
 * @param resetCadence - CalendarYear | CardmemberYear | Monthly | OneTime (always present)
 * @param referenceDate - The date to calculate for (card add date or "today")
 * @param renewalDate - Card renewal/anniversary date (required for CardmemberYear cadence)
 * @param claimingWindowEnd - Optional custom window marker (e.g., "0918" for Amex Saks Sept 18 split)
 * @returns Period boundaries { periodStart, periodEnd } where periodEnd is null for ONE_TIME
 *
 * @example
 * // Monthly benefit, ref = April 8, 2026
 * calculatePeriodForBenefit(null, 'Monthly', new Date('2026-04-08'), renewalDate)
 * // → { periodStart: 2026-04-01, periodEnd: 2026-04-30 }
 *
 * @example
 * // CardmemberYear, renewal May 15, ref = April 8, 2026
 * calculatePeriodForBenefit(null, 'CardmemberYear', new Date('2026-04-08'), new Date('2024-05-15'))
 * // → { periodStart: 2025-05-15, periodEnd: 2026-05-14 }
 */
export function calculatePeriodForBenefit(
  claimingCadence: string | null | undefined,
  resetCadence: string,
  referenceDate: Date,
  renewalDate: Date,
  claimingWindowEnd?: string | null
): PeriodBoundary {
  const cadence = resolveCadence(claimingCadence, resetCadence);
  return calculatePeriodByCadence(cadence, resetCadence, referenceDate, renewalDate, claimingWindowEnd);
}

/**
 * Calculates the next period boundaries after the current period ends.
 * Used by the cron job to create new UserBenefit rows for the next period.
 *
 * The next period starts immediately after the current periodEnd (first day of next period).
 *
 * @param currentPeriodEnd - The end date of the current (expiring) period
 * @param claimingCadence - Resolved cadence (may be null, falls back to resetCadence)
 * @param resetCadence - Legacy cadence field
 * @param renewalDate - Card renewal/anniversary date
 * @param claimingWindowEnd - Optional custom window marker
 * @returns Next period boundaries, or { periodStart, periodEnd: null } for ONE_TIME (cron should skip)
 *
 * @example
 * // Monthly: current period ends April 30 → next period is May 1–31
 * calculateNextPeriod(new Date('2026-04-30T23:59:59.999Z'), null, 'Monthly', renewalDate)
 * // → { periodStart: 2026-05-01, periodEnd: 2026-05-31 }
 */
export function calculateNextPeriod(
  currentPeriodEnd: Date,
  claimingCadence: string | null | undefined,
  resetCadence: string,
  renewalDate: Date,
  claimingWindowEnd?: string | null
): PeriodBoundary {
  const cadence = resolveCadence(claimingCadence, resetCadence);

  if (cadence === 'ONE_TIME') {
    // ONE_TIME benefits never have a next period
    return {
      periodStart: startOfDay(currentPeriodEnd),
      periodEnd: null,
    };
  }

  // The next period's reference date is the day after the current period ends
  const nextDay = new Date(currentPeriodEnd.getTime() + 1); // 1ms after end
  return calculatePeriodByCadence(cadence, resetCadence, nextDay, renewalDate, claimingWindowEnd);
}

// ============================================================================
// Cadence-Specific Calculations
// ============================================================================

/**
 * Dispatches to cadence-specific period calculation logic.
 * Internal function called by both calculatePeriodForBenefit and calculateNextPeriod.
 */
function calculatePeriodByCadence(
  cadence: ClaimingCadence,
  resetCadence: string,
  referenceDate: Date,
  renewalDate: Date,
  claimingWindowEnd?: string | null
): PeriodBoundary {
  switch (cadence) {
    case 'MONTHLY':
      return calculateMonthlyPeriod(referenceDate);
    case 'QUARTERLY':
      return calculateQuarterlyPeriod(referenceDate);
    case 'SEMI_ANNUAL':
      return calculateSemiAnnualPeriod(referenceDate, claimingWindowEnd);
    case 'FLEXIBLE_ANNUAL':
      return calculateFlexibleAnnualPeriod(referenceDate, resetCadence, renewalDate);
    case 'ONE_TIME':
      return calculateOneTimePeriod(referenceDate);
    default: {
      // Exhaustive check — if we reach here, treat as monthly (safe default)
      const _exhaustive: never = cadence;
      void _exhaustive;
      return calculateMonthlyPeriod(referenceDate);
    }
  }
}

/**
 * MONTHLY period: 1st of month to last day of month.
 *
 * Example (ref = April 8, 2026):
 *   periodStart = 2026-04-01T00:00:00.000Z
 *   periodEnd   = 2026-04-30T23:59:59.999Z
 */
function calculateMonthlyPeriod(referenceDate: Date): PeriodBoundary {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  return {
    periodStart: startOfMonth(year, month),
    periodEnd: endOfMonth(year, month),
  };
}

/**
 * QUARTERLY period: 1st of quarter's first month to last day of quarter's last month.
 *
 * Q1: Jan 1 – Mar 31
 * Q2: Apr 1 – Jun 30
 * Q3: Jul 1 – Sep 30
 * Q4: Oct 1 – Dec 31
 *
 * Example (ref = April 8, 2026 → Q2):
 *   periodStart = 2026-04-01T00:00:00.000Z
 *   periodEnd   = 2026-06-30T23:59:59.999Z
 */
function calculateQuarterlyPeriod(referenceDate: Date): PeriodBoundary {
  const year = referenceDate.getUTCFullYear();
  const quarter = getQuarter(referenceDate.getUTCMonth());
  const quarterStartMonth = QUARTER_START_MONTHS[quarter];
  const quarterEndMonth = quarterStartMonth + 2;
  return {
    periodStart: startOfMonth(year, quarterStartMonth),
    periodEnd: endOfMonth(year, quarterEndMonth),
  };
}

/**
 * SEMI_ANNUAL period: H1 (Jan 1 – Jun 30) or H2 (Jul 1 – Dec 31).
 *
 * If claimingWindowEnd is set (e.g., "0918" for Amex Saks Sept 18 split):
 *   H1: Jan 1 – (window day - 1)
 *   H2: window day – Dec 31
 *
 * Example standard (ref = April 8, 2026 → H1):
 *   periodStart = 2026-01-01T00:00:00.000Z
 *   periodEnd   = 2026-06-30T23:59:59.999Z
 *
 * Example custom (claimingWindowEnd="0918", ref = Oct 5, 2026 → H2):
 *   periodStart = 2026-09-18T00:00:00.000Z
 *   periodEnd   = 2026-12-31T23:59:59.999Z
 */
function calculateSemiAnnualPeriod(
  referenceDate: Date,
  claimingWindowEnd?: string | null
): PeriodBoundary {
  const year = referenceDate.getUTCFullYear();

  // Custom window split (e.g., Amex Saks "0918" = Sep 18)
  const window = claimingWindowEnd ? parseWindowEnd(claimingWindowEnd) : null;

  if (window) {
    const splitDate = normalizeDate(year, window.month, window.day);
    const refTime = referenceDate.getTime();
    const splitTime = splitDate.getTime();

    if (refTime < splitTime) {
      // H1: Jan 1 to day before split
      const dayBeforeSplit = new Date(splitTime - 24 * 60 * 60 * 1000);
      return {
        periodStart: startOfMonth(year, 0), // Jan 1
        periodEnd: new Date(
          Date.UTC(
            dayBeforeSplit.getUTCFullYear(),
            dayBeforeSplit.getUTCMonth(),
            dayBeforeSplit.getUTCDate(),
            23, 59, 59, 999
          )
        ),
      };
    } else {
      // H2: split date to Dec 31
      return {
        periodStart: new Date(
          Date.UTC(splitDate.getUTCFullYear(), splitDate.getUTCMonth(), splitDate.getUTCDate(), 0, 0, 0, 0)
        ),
        periodEnd: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
      };
    }
  }

  // Standard half-year split
  const month = referenceDate.getUTCMonth();
  if (month < 6) {
    // H1: Jan 1 – Jun 30
    return {
      periodStart: startOfMonth(year, HALF_START_MONTHS[0]),
      periodEnd: endOfMonth(year, 5), // June
    };
  } else {
    // H2: Jul 1 – Dec 31
    return {
      periodStart: startOfMonth(year, HALF_START_MONTHS[1]),
      periodEnd: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
  }
}

/**
 * FLEXIBLE_ANNUAL period: Calendar year or cardmember anniversary year.
 *
 * Calendar Year (resetCadence = "CalendarYear"):
 *   periodStart = Jan 1, periodEnd = Dec 31
 *
 * Cardmember Year (resetCadence = "CardmemberYear"):
 *   periodStart = renewal anniversary in current cycle
 *   periodEnd = day before next anniversary
 *
 * Example Calendar (ref = April 8, 2026):
 *   periodStart = 2026-01-01T00:00:00.000Z
 *   periodEnd   = 2026-12-31T23:59:59.999Z
 *
 * Example Cardmember (renewal May 15, ref = April 8, 2026):
 *   periodStart = 2025-05-15T00:00:00.000Z
 *   periodEnd   = 2026-05-14T23:59:59.999Z
 */
function calculateFlexibleAnnualPeriod(
  referenceDate: Date,
  resetCadence: string,
  renewalDate: Date
): PeriodBoundary {
  if (resetCadence === 'CardmemberYear') {
    return calculateCardmemberYearPeriod(referenceDate, renewalDate);
  }

  // Calendar Year (CalendarYear, ANNUAL, or any other resetCadence)
  const year = referenceDate.getUTCFullYear();
  return {
    periodStart: new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)),
    periodEnd: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
  };
}

/**
 * Cardmember year period calculation.
 *
 * Algorithm:
 * 1. Get month/day from renewalDate (e.g., May 15)
 * 2. Build candidate = (ref's year, renewal month, renewal day) — normalized for leap years
 * 3. If ref >= candidate: period = candidate → (candidate + 1 year - 1 day)
 * 4. If ref < candidate: period = (candidate - 1 year) → (candidate - 1 day)
 */
function calculateCardmemberYearPeriod(
  referenceDate: Date,
  renewalDate: Date
): PeriodBoundary {
  const renewalMonth = renewalDate.getUTCMonth();
  const renewalDay = renewalDate.getUTCDate();
  const refYear = referenceDate.getUTCFullYear();

  // Build candidate anniversary in ref's year, normalized for leap year edge cases
  const candidate = normalizeDate(refYear, renewalMonth, renewalDay);

  let periodStart: Date;
  let nextAnniversary: Date;

  if (referenceDate.getTime() >= candidate.getTime()) {
    // Reference is on or after this year's anniversary → current cycle starts at candidate
    periodStart = new Date(
      Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(), 0, 0, 0, 0)
    );
    nextAnniversary = normalizeDate(refYear + 1, renewalMonth, renewalDay);
  } else {
    // Reference is before this year's anniversary → current cycle started last year
    periodStart = normalizeDate(refYear - 1, renewalMonth, renewalDay);
    periodStart = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate(), 0, 0, 0, 0)
    );
    nextAnniversary = candidate;
  }

  // Period ends the day before the next anniversary, at end of day
  const dayBeforeNext = new Date(nextAnniversary.getTime() - 24 * 60 * 60 * 1000);
  const periodEnd = new Date(
    Date.UTC(
      dayBeforeNext.getUTCFullYear(),
      dayBeforeNext.getUTCMonth(),
      dayBeforeNext.getUTCDate(),
      23, 59, 59, 999
    )
  );

  return { periodStart, periodEnd };
}

/**
 * ONE_TIME period: starts at reference date, never expires.
 *
 * Example (ref = April 8, 2026):
 *   periodStart = 2026-04-08T00:00:00.000Z
 *   periodEnd   = null
 */
function calculateOneTimePeriod(referenceDate: Date): PeriodBoundary {
  return {
    periodStart: startOfDay(referenceDate),
    periodEnd: null,
  };
}
