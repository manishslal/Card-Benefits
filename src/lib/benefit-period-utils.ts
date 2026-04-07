/**
 * benefit-period-utils.ts
 * 
 * Utility functions for calculating benefit period boundaries and managing
 * period-based benefit tracking. Handles multiple reset cadences:
 * - MONTHLY: 1st of each month to last day of month
 * - QUARTERLY: Calendar quarters (Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec)
 * - SEMI_ANNUAL: Half-years (Jan-Jun, Jul-Dec)
 * - ANNUAL: Card anniversary date
 * - CUSTOM: User-defined dates
 * 
 * PHASE 6C: Added claiming cadence support for enforcing benefit claiming limits
 * - MONTHLY: Fixed amount resets 1st of month, expires at month-end
 * - QUARTERLY: Fixed amount per quarter (with Amex Sept 18 split support)
 * - SEMI_ANNUAL: Fixed amount per half-year (H1/H2)
 * - FLEXIBLE_ANNUAL: Full amount available anytime during year
 * - ONE_TIME: Single claim only
 */

/**
 * Reset cadence enum - mirrors Prisma schema
 */
export type ResetCadence = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';

/**
 * Claiming cadence enum - Phase 6C: Controls how often a benefit can be claimed
 */
export type ClaimingCadence = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'FLEXIBLE_ANNUAL' | 'ONE_TIME';

/**
 * Urgency level for displaying benefit claiming status
 */
export type UrgencyLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Period boundary information
 */
export interface PeriodBoundaries {
  start: Date;
  end: Date;
}

/**
 * Gets the period boundaries (start and end dates) for a benefit period
 * containing the reference date.
 * 
 * All dates are handled in UTC to ensure consistent period calculations
 * across different timezones.
 * 
 * @param resetCadence - The benefit reset cadence type
 * @param cardAddedDate - When the card was added (used for annual anniversary)
 * @param referenceDate - Date to calculate period for (defaults to today)
 * @returns Object with start and end dates of the period
 * 
 * @example
 * // Monthly benefit on April 15, 2026
 * const boundaries = getPeriodBoundaries('MONTHLY', cardAddedDate, new Date('2026-04-15'));
 * // Returns { start: 2026-04-01, end: 2026-04-30T23:59:59.999Z }
 */
export function getPeriodBoundaries(
  resetCadence: ResetCadence,
  cardAddedDate: Date,
  referenceDate: Date = new Date()
): PeriodBoundaries {
  // Convert to UTC dates for consistent calculations
  const ref = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  ));

  switch (resetCadence) {
    case 'MONTHLY': {
      // First day of current month to last day of month at 23:59:59
      const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
      const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'QUARTERLY': {
      // Quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
      const quarter = Math.floor(ref.getUTCMonth() / 3);
      const start = new Date(Date.UTC(ref.getUTCFullYear(), quarter * 3, 1));
      const end = new Date(Date.UTC(ref.getUTCFullYear(), (quarter + 1) * 3, 0));
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'SEMI_ANNUAL': {
      // H1: Jan 1 - Jun 30, H2: Jul 1 - Dec 31
      const isFirstHalf = ref.getUTCMonth() < 6;
      const start = new Date(Date.UTC(ref.getUTCFullYear(), isFirstHalf ? 0 : 6, 1));
      const end = new Date(Date.UTC(ref.getUTCFullYear(), isFirstHalf ? 6 : 12, 0));
      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'ANNUAL': {
      // Card anniversary date (month/day of card added date)
      const cardMonth = cardAddedDate.getUTCMonth();
      const cardDay = cardAddedDate.getUTCDate();
      const refYear = ref.getUTCFullYear();

      // Create anniversary date for this year
      const anniversary = new Date(Date.UTC(refYear, cardMonth, cardDay));

      // If reference date is before anniversary, use previous year's anniversary
      let start: Date, end: Date;
      if (ref < anniversary) {
        // Before anniversary: period is from previous year anniversary to this year anniversary - 1 day
        start = new Date(Date.UTC(refYear - 1, cardMonth, cardDay));
        end = new Date(Date.UTC(refYear, cardMonth, cardDay - 1));
      } else {
        // After anniversary: period is from this year anniversary to next year anniversary - 1 day
        start = new Date(Date.UTC(refYear, cardMonth, cardDay));
        end = new Date(Date.UTC(refYear + 1, cardMonth, cardDay - 1));
      }

      end.setUTCHours(23, 59, 59, 999);
      return { start, end };
    }

    case 'CUSTOM': {
      throw new Error('CUSTOM cadence periods must be retrieved from database');
    }

    default: {
      const _exhaust: never = resetCadence;
      return _exhaust;
    }
  }
}

/**
 * Calculates the amount available for a benefit period based on annual amount
 * and cadence type.
 * 
 * For MONTHLY: Divides annual amount by 12 (roughly)
 * For QUARTERLY: Divides annual amount by 4
 * For SEMI_ANNUAL: Divides annual amount by 2
 * For ANNUAL: Returns full annual amount
 * 
 * Note: Values are in cents (e.g., 15000 = $150.00)
 * 
 * @param annualAmountCents - Annual benefit amount in cents
 * @param resetCadence - The benefit reset cadence type
 * @param referenceDate - Optional date for period-specific calculations
 * @returns Amount available for this period in cents
 * 
 * @example
 * // $200 annual UberEats benefit, monthly cadence
 * const amount = calculateAmountPerPeriod(20000, 'MONTHLY');
 * // Returns approximately 1667 cents ($16.67 per month)
 */
export function calculateAmountPerPeriod(
  annualAmountCents: number,
  resetCadence: ResetCadence
): number {
  switch (resetCadence) {
    case 'MONTHLY': {
      // Most months get annual/12, but distribute remainder across year
      // Simple approach: annual/12 rounded
      return Math.round(annualAmountCents / 12);
    }

    case 'QUARTERLY': {
      return Math.round(annualAmountCents / 4);
    }

    case 'SEMI_ANNUAL': {
      return Math.round(annualAmountCents / 2);
    }

    case 'ANNUAL': {
      return annualAmountCents;
    }

    case 'CUSTOM': {
      throw new Error('CUSTOM cadence amounts must be retrieved from database');
    }

    default: {
      const _exhaust: never = resetCadence;
      return _exhaust;
    }
  }
}

/**
 * Returns array of available periods a user can claim for, going back
 * a specified number of months.
 * 
 * This is used to populate the period selector dropdown in the UI.
 * 
 * @param resetCadence - The benefit reset cadence type
 * @param cardAddedDate - When the card was added
 * @param monthsBack - How many months back to include (default: 12)
 * @returns Array of period boundaries, in reverse chronological order
 * 
 * @example
 * // Get available months for a monthly benefit
 * const periods = getAvailablePeriods('MONTHLY', cardAddedDate, 12);
 * // Returns last 12 month boundaries
 */
export function getAvailablePeriods(
  resetCadence: ResetCadence,
  cardAddedDate: Date,
  monthsBack: number = 12
): PeriodBoundaries[] {
  const periods: PeriodBoundaries[] = [];
  let currentDate = new Date();

  // Go back the specified number of periods
  for (let i = 0; i < monthsBack; i++) {
    try {
      const boundary = getPeriodBoundaries(resetCadence, cardAddedDate, currentDate);
      periods.push(boundary);

      // Move to previous period
      switch (resetCadence) {
        case 'MONTHLY':
          currentDate = new Date(Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth() - 1,
            1
          ));
          break;

        case 'QUARTERLY':
          currentDate = new Date(Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth() - 3,
            1
          ));
          break;

        case 'SEMI_ANNUAL':
          currentDate = new Date(Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth() - 6,
            1
          ));
          break;

        case 'ANNUAL':
          currentDate = new Date(Date.UTC(
            currentDate.getUTCFullYear() - 1,
            currentDate.getUTCMonth(),
            currentDate.getUTCDate()
          ));
          break;

        case 'CUSTOM':
          throw new Error('CUSTOM cadence iteration not supported');
      }
    } catch (e) {
      // Stop if we hit an error (e.g., CUSTOM cadence)
      break;
    }
  }

  return periods;
}

/**
 * Checks if a benefit period can still be claimed (hasn't expired based on
 * business rules).
 * 
 * Users can claim benefits up to 7 years in the past.
 * 
 * @param periodStart - Start date of the period
 * @param lookBackYears - How many years back claims are allowed (default: 7)
 * @returns true if period can still be claimed
 */
export function canClaimPeriod(
  periodStart: Date,
  lookBackYears: number = 7
): boolean {
  const now = new Date();
  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - lookBackYears);

  return periodStart >= cutoffDate && periodStart <= now;
}

/**
 * Calculates the next period reset date.
 * 
 * @param resetCadence - The benefit reset cadence type
 * @param cardAddedDate - When the card was added (for annual resets)
 * @param fromDate - Date to calculate from (default: today)
 * @returns Date of the next period reset
 * 
 * @example
 * // When is the next monthly reset?
 * const nextReset = getNextPeriodReset('MONTHLY', cardAddedDate);
 * // Returns May 1, 2026 (if today is April 15, 2026)
 */
export function getNextPeriodReset(
  resetCadence: ResetCadence,
  cardAddedDate: Date,
  fromDate: Date = new Date()
): Date {
  const { end } = getPeriodBoundaries(resetCadence, cardAddedDate, fromDate);

  // Next reset is the day after the current period ends
  const nextReset = new Date(end);
  nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  nextReset.setUTCHours(0, 0, 0, 0);

  return nextReset;
}

/**
 * Calculates days remaining in the current period.
 * 
 * @param resetCadence - The benefit reset cadence type
 * @param cardAddedDate - When the card was added
 * @param fromDate - Date to calculate from (default: today)
 * @returns Number of days remaining in the period (including today)
 */
export function getDaysRemainingInPeriod(
  resetCadence: ResetCadence,
  cardAddedDate: Date,
  fromDate: Date = new Date()
): number {
  const { end } = getPeriodBoundaries(resetCadence, cardAddedDate, fromDate);
  const now = new Date();

  // Calculate days between now and end of period
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Formats a period for display in UI.
 * 
 * @param boundary - Period start and end dates
 * @param resetCadence - The benefit reset cadence type
 * @returns Human-readable period label (e.g., "April 2026 (Monthly)")
 * 
 * @example
 * const label = formatPeriodLabel({ start: ..., end: ... }, 'MONTHLY');
 * // Returns "April 2026 (Monthly)"
 */
export function formatPeriodLabel(
  boundary: PeriodBoundaries,
  resetCadence: ResetCadence
): string {
  const { start } = boundary;
  const year = start.getUTCFullYear();

  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
  const month = months[start.getUTCMonth()];

  switch (resetCadence) {
    case 'MONTHLY':
      return `${month} ${year} (Monthly)`;

    case 'QUARTERLY': {
      const quarter = Math.floor(start.getUTCMonth() / 3) + 1;
      return `Q${quarter} ${year} (Quarterly)`;
    }

    case 'SEMI_ANNUAL': {
      const half = start.getUTCMonth() < 6 ? 'H1' : 'H2';
      return `${half} ${year} (Semi-Annual)`;
    }

    case 'ANNUAL': {
      const endMonth = months[boundary.end.getUTCMonth()];
      const endYear = boundary.end.getUTCFullYear();
      return `${month} ${year} - ${endMonth} ${endYear} (Annual)`;
    }

    case 'CUSTOM':
      return `Custom Period`;
  }
}

/**
 * Checks if two periods overlap or are identical
 * 
 * @param period1 - First period
 * @param period2 - Second period
 * @returns true if periods overlap
 */
export function periodsBoundariesOverlap(
  period1: PeriodBoundaries,
  period2: PeriodBoundaries
): boolean {
  return period1.start <= period2.end && period1.end >= period2.start;
}

// ============================================================================
// PHASE 6C: Claiming Cadence Functions
// ============================================================================

/**
 * Claiming window boundary information
 */
export interface ClaimingWindowBoundaries {
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

/**
 * Get the claiming window boundaries for a benefit on a specific date.
 * 
 * Handles special cases:
 * - Amex Sept 18 split (quarterly and semi-annual) when claimingWindowEnd === "0918"
 * - Leap year February (29 days in leap years)
 * - Month-end boundaries
 * 
 * @param claimingCadence - The claiming cadence type
 * @param referenceDate - Date to calculate period for (defaults to today UTC)
 * @param claimingWindowEnd - Optional custom window marker (e.g., "0918" for Sept 18)
 * @returns Object with period boundaries and label
 * 
 * @example
 * // Amex quarterly on March 29, 2026 (before Sept 18)
 * const window = getClaimingWindowBoundaries('QUARTERLY', new Date('2026-03-29'), '0918');
 * // Q4 for Amex: Returns boundaries for Jan 1 - Sept 17, 2026
 */
export function getClaimingWindowBoundaries(
  claimingCadence: ClaimingCadence | null | undefined,
  referenceDate: Date = new Date(),
  claimingWindowEnd?: string | null
): ClaimingWindowBoundaries {
  if (!claimingCadence) {
    throw new Error('claimingCadence is required');
  }

  // Normalize to UTC date
  const ref = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  ));

  switch (claimingCadence) {
    case 'MONTHLY': {
      // First day of month to last day of month at 23:59:59
      const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
      const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
      end.setUTCHours(23, 59, 59, 999);

      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
      const label = `${months[ref.getUTCMonth()]} ${ref.getUTCFullYear()}`;

      return { periodStart: start, periodEnd: end, periodLabel: label };
    }

    case 'QUARTERLY': {
      // Handle Amex Sept 18 split if claimingWindowEnd === "0918"
      const useAmexSplit = claimingWindowEnd === '0918';

      if (useAmexSplit) {
        // Amex quarters: Q1 (Sept 18-30), Q2 (Oct 1-Dec 31), Q3 (Jan 1-Mar 31), Q4 (Apr 1-Sept 17)
        const month = ref.getUTCMonth();
        const date = ref.getUTCDate();
        const year = ref.getUTCFullYear();

        let start: Date, end: Date, periodLabel: string;

        // Determine which Amex quarter we're in
        if (month === 8 && date >= 18) {
          // Sept 18 - Sept 30 (Q1)
          start = new Date(Date.UTC(year, 8, 18));
          end = new Date(Date.UTC(year, 8, 30));
          periodLabel = `Q1 ${year} (Amex)`;
        } else if (month >= 9 || month === 0 && date <= 0) {
          // Oct 1 - Dec 31 (Q2)
          if (month >= 9) {
            start = new Date(Date.UTC(year, 9, 1));
            end = new Date(Date.UTC(year + 1, 0, 0));
          } else {
            start = new Date(Date.UTC(year - 1, 9, 1));
            end = new Date(Date.UTC(year, 0, 0));
          }
          periodLabel = `Q2 ${month >= 9 ? year : year - 1} (Amex)`;
        } else if (month >= 0 && month < 3) {
          // Jan 1 - Mar 31 (Q3)
          start = new Date(Date.UTC(year, 0, 1));
          end = new Date(Date.UTC(year, 3, 0));
          periodLabel = `Q3 ${year} (Amex)`;
        } else {
          // Apr 1 - Sept 17 (Q4)
          start = new Date(Date.UTC(year, 3, 1));
          end = new Date(Date.UTC(year, 8, 17));
          periodLabel = `Q4 ${year} (Amex)`;
        }

        end.setUTCHours(23, 59, 59, 999);
        return { periodStart: start, periodEnd: end, periodLabel };
      } else {
        // Standard calendar quarters: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
        const quarter = Math.floor(ref.getUTCMonth() / 3);
        const start = new Date(Date.UTC(ref.getUTCFullYear(), quarter * 3, 1));
        const end = new Date(Date.UTC(ref.getUTCFullYear(), (quarter + 1) * 3, 0));
        end.setUTCHours(23, 59, 59, 999);
        const label = `Q${quarter + 1} ${ref.getUTCFullYear()}`;

        return { periodStart: start, periodEnd: end, periodLabel: label };
      }
    }

    case 'SEMI_ANNUAL': {
      // Handle Amex Sept 18 split if claimingWindowEnd === "0918"
      const useAmexSplit = claimingWindowEnd === '0918';

      if (useAmexSplit) {
        // Amex semi-annual: H1 (Jan 1-Sept 17), H2 (Sept 18-Dec 31)
        const month = ref.getUTCMonth();
        const date = ref.getUTCDate();
        const year = ref.getUTCFullYear();

        let start: Date, end: Date, periodLabel: string;

        if (month < 8 || (month === 8 && date < 18)) {
          // H1: Jan 1 - Sept 17
          start = new Date(Date.UTC(year, 0, 1));
          end = new Date(Date.UTC(year, 8, 17));
          periodLabel = `H1 ${year} (Amex)`;
        } else {
          // H2: Sept 18 - Dec 31
          start = new Date(Date.UTC(year, 8, 18));
          end = new Date(Date.UTC(year, 11, 31));
          periodLabel = `H2 ${year} (Amex)`;
        }

        end.setUTCHours(23, 59, 59, 999);
        return { periodStart: start, periodEnd: end, periodLabel };
      } else {
        // Standard semi-annual: H1 (Jan 1-Jun 30), H2 (Jul 1-Dec 31)
        const isFirstHalf = ref.getUTCMonth() < 6;
        const start = new Date(Date.UTC(ref.getUTCFullYear(), isFirstHalf ? 0 : 6, 1));
        const end = new Date(Date.UTC(ref.getUTCFullYear(), isFirstHalf ? 6 : 12, 0));
        end.setUTCHours(23, 59, 59, 999);
        const label = `H${isFirstHalf ? 1 : 2} ${ref.getUTCFullYear()}`;

        return { periodStart: start, periodEnd: end, periodLabel: label };
      }
    }

    case 'FLEXIBLE_ANNUAL': {
      // Full calendar year: Jan 1 - Dec 31
      const year = ref.getUTCFullYear();
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year, 11, 31));
      end.setUTCHours(23, 59, 59, 999);

      return {
        periodStart: start,
        periodEnd: end,
        periodLabel: `Full Year ${year}`,
      };
    }

    case 'ONE_TIME': {
      // ONE_TIME benefits have no expiration period
      // Return a very large window (1900-2100)
      const start = new Date(Date.UTC(1900, 0, 1));
      const end = new Date(Date.UTC(2100, 11, 31));
      end.setUTCHours(23, 59, 59, 999);

      return {
        periodStart: start,
        periodEnd: end,
        periodLabel: 'One-Time (No Expiration)',
      };
    }

    default: {
      const _exhaust: never = claimingCadence;
      throw new Error(`Unknown claiming cadence: ${_exhaust}`);
    }
  }
}

/**
 * Calculate remaining claimable amount for a period.
 * 
 * Takes into account:
 * - Max amount per period (from claimingAmount)
 * - Already claimed amounts in this period (from usageRecords)
 * - ONE_TIME enforcement (if already claimed once, remaining = 0)
 * 
 * @param claimingAmount - Max amount per period in cents
 * @param claimingCadence - The claiming cadence type
 * @param usageRecords - Array of usage records for this benefit
 * @param referenceDate - Date to calculate remaining for
 * @param claimingWindowEnd - Optional custom window marker
 * @returns Remaining claimable amount in cents
 * 
 * @example
 * // $15 monthly, $10 already claimed
 * const remaining = getClaimingLimitForPeriod(1500, 'MONTHLY', usageRecords, date);
 * // Returns 500 (cents) or $5.00
 */
export function getClaimingLimitForPeriod(
  claimingAmount: number | null | undefined,
  claimingCadence: ClaimingCadence | null | undefined,
  usageRecords: any[] = [],
  referenceDate: Date = new Date(),
  claimingWindowEnd?: string | null
): number {
  // If not configured, no limit
  if (!claimingCadence || claimingAmount === null || claimingAmount === undefined) {
    return 0;
  }

  // claimingAmount is already the per-period amount (not annual)
  const maxAmount = Math.max(0, claimingAmount);

  // ONE_TIME benefits can only be claimed once
  if (claimingCadence === 'ONE_TIME') {
    return usageRecords.length > 0 ? 0 : maxAmount;
  }

  // Get period boundaries to determine which records apply to this period
  const { periodStart, periodEnd } = getClaimingWindowBoundaries(
    claimingCadence,
    referenceDate,
    claimingWindowEnd
  );

  // Sum all claims within this period
  const alreadyClaimed = usageRecords
    .filter((record) => {
      const claimDate = new Date(record.usageDate || record.claimDate);
      return claimDate >= periodStart && claimDate <= periodEnd;
    })
    .reduce((sum, record) => {
      // Handle both number and Decimal types
      const amount = typeof record.usageAmount === 'number'
        ? record.usageAmount
        : typeof record.usageAmount === 'object' && 'toNumber' in record.usageAmount
        ? record.usageAmount.toNumber()
        : 0;
      return sum + amount;
    }, 0);

  return Math.max(0, maxAmount - alreadyClaimed);
}

/**
 * Check if the claiming window is currently open.
 * 
 * For all cadences except FLEXIBLE_ANNUAL and ONE_TIME, the window stays open
 * throughout the period. Once the period ends, it's closed.
 * 
 * @param claimingCadence - The claiming cadence type
 * @param referenceDate - Date to check window for
 * @param claimingWindowEnd - Optional custom window marker
 * @returns true if the claiming window is currently open
 * 
 * @example
 * // Check if Jan benefit can still be claimed on Feb 1
 * const isOpen = isClaimingWindowOpen('MONTHLY', new Date('2026-02-01'));
 * // Returns false (January period has ended)
 */
export function isClaimingWindowOpen(
  claimingCadence: ClaimingCadence | null | undefined,
  referenceDate: Date = new Date(),
  claimingWindowEnd?: string | null
): boolean {
  if (!claimingCadence) {
    return false;
  }

  // FLEXIBLE_ANNUAL is always open within the year
  if (claimingCadence === 'FLEXIBLE_ANNUAL') {
    return true;
  }

  // ONE_TIME is always "open" (checked separately via claiming limit)
  if (claimingCadence === 'ONE_TIME') {
    return true;
  }

  // For other cadences, check if we're within the current period
  const { periodStart, periodEnd } = getClaimingWindowBoundaries(
    claimingCadence,
    referenceDate,
    claimingWindowEnd
  );

  return referenceDate >= periodStart && referenceDate <= periodEnd;
}

/**
 * Calculate days remaining until the period expires.
 * 
 * Returns the number of complete days remaining. Useful for displaying urgency.
 * For FLEXIBLE_ANNUAL, calculates days until Dec 31.
 * For ONE_TIME, returns 999 (no expiration).
 * 
 * @param claimingCadence - The claiming cadence type
 * @param referenceDate - Current date
 * @param claimingWindowEnd - Optional custom window marker
 * @returns Number of days remaining (0 if already expired)
 * 
 * @example
 * // How many days left in March?
 * const days = daysUntilExpiration('MONTHLY', new Date('2026-03-29'));
 * // Returns 2 (March 29-30)
 */
export function daysUntilExpiration(
  claimingCadence: ClaimingCadence | null | undefined,
  referenceDate: Date = new Date(),
  claimingWindowEnd?: string | null
): number {
  if (!claimingCadence) {
    return 0;
  }

  // ONE_TIME never expires
  if (claimingCadence === 'ONE_TIME') {
    return 999;
  }

  const { periodEnd } = getClaimingWindowBoundaries(
    claimingCadence,
    referenceDate,
    claimingWindowEnd
  );

  // Normalize reference date to start of day
  const ref = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  ));

  // Calculate days between ref and period end
  const diffTime = periodEnd.getTime() - ref.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Determine urgency level based on days remaining.
 * 
 * - CRITICAL (RED): < 7 days
 * - HIGH (ORANGE): 7-14 days
 * - MEDIUM (YELLOW): 14-30 days
 * - LOW (GREEN): > 30 days OR FLEXIBLE_ANNUAL
 * 
 * @param claimingCadence - The claiming cadence type
 * @param referenceDate - Current date
 * @param claimingWindowEnd - Optional custom window marker
 * @returns Urgency level
 * 
 * @example
 * // March 30 (1 day left in March)
 * const urgency = getUrgencyLevel('MONTHLY', new Date('2026-03-30'));
 * // Returns 'CRITICAL'
 */
export function getUrgencyLevel(
  claimingCadence: ClaimingCadence | null | undefined,
  referenceDate: Date = new Date(),
  claimingWindowEnd?: string | null
): UrgencyLevel {
  if (!claimingCadence) {
    return 'LOW';
  }

  // FLEXIBLE_ANNUAL is never urgent
  if (claimingCadence === 'FLEXIBLE_ANNUAL') {
    return 'LOW';
  }

  // ONE_TIME is not urgent (no expiration)
  if (claimingCadence === 'ONE_TIME') {
    return 'LOW';
  }

  const days = daysUntilExpiration(claimingCadence, referenceDate, claimingWindowEnd);

  if (days < 7) {
    return 'CRITICAL';
  } else if (days < 14) {
    return 'HIGH';
  } else if (days < 30) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
}

/**
 * Validate a claiming request amount.
 * 
 * Checks:
 * - Amount is positive
 * - Amount is integer (cents)
 * - Amount doesn't exceed period limit
 * - ONE_TIME not already claimed
 * - Window is open
 * 
 * @param claimingAmount - Max amount per period in cents
 * @param claimingCadence - The claiming cadence type
 * @param requestedAmount - Amount trying to claim in cents
 * @param usageRecords - Array of usage records
 * @param referenceDate - Date of claim
 * @param claimingWindowEnd - Optional custom window marker
 * @returns Validation result with error details if invalid
 * 
 * @example
 * // Try to claim $20 of $15 monthly benefit
 * const result = validateClaimingAmount(1500, 'MONTHLY', 2000, [], date);
 * // Returns { valid: false, error: 'CLAIMING_LIMIT_EXCEEDED', remainingAmount: 1500 }
 */
export function validateClaimingAmount(
  claimingAmount: number | null | undefined,
  claimingCadence: ClaimingCadence | null | undefined,
  requestedAmount: number,
  usageRecords: any[] = [],
  referenceDate: Date = new Date(),
  claimingWindowEnd?: string | null
): {
  valid: boolean;
  error?: string;
  errorCode?: string;
  remainingAmount: number;
  maxClaimable: number;
  alreadyClaimed: number;
} {
  // If benefit not configured
  if (!claimingCadence || claimingAmount === null || claimingAmount === undefined) {
    return {
      valid: false,
      error: 'Benefit is not configured for claiming',
      errorCode: 'BENEFIT_NOT_CONFIGURED',
      remainingAmount: 0,
      maxClaimable: 0,
      alreadyClaimed: 0,
    };
  }

  // Check amount is positive integer
  if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
    return {
      valid: false,
      error: 'Claiming amount must be a positive integer (cents)',
      errorCode: 'INVALID_CLAIMING_AMOUNT',
      remainingAmount: 0,
      maxClaimable: 0,
      alreadyClaimed: 0,
    };
  }

  // Check if window is open (except for ONE_TIME which is always "open")
  if (claimingCadence !== 'ONE_TIME' && !isClaimingWindowOpen(claimingCadence, referenceDate, claimingWindowEnd)) {
    return {
      valid: false,
      error: 'The claiming window for this period has closed',
      errorCode: 'CLAIMING_WINDOW_CLOSED',
      remainingAmount: 0,
      maxClaimable: 0,
      alreadyClaimed: 0,
    };
  }

  // Check ONE_TIME already claimed
  if (claimingCadence === 'ONE_TIME' && usageRecords.length > 0) {
    return {
      valid: false,
      error: 'This one-time benefit has already been claimed',
      errorCode: 'ALREADY_CLAIMED_ONE_TIME',
      remainingAmount: 0,
      maxClaimable: 0,
      alreadyClaimed: usageRecords[0]?.usageAmount || 0,
    };
  }

  // Calculate remaining limit
  const remaining = getClaimingLimitForPeriod(
    claimingAmount,
    claimingCadence,
    usageRecords,
    referenceDate,
    claimingWindowEnd
  );

  const maxClaimable = claimingAmount !== null && claimingAmount !== undefined ? Math.max(0, claimingAmount) : 0;

  // Sum already claimed in this period
  const { periodStart, periodEnd } = getClaimingWindowBoundaries(
    claimingCadence,
    referenceDate,
    claimingWindowEnd
  );

  const alreadyClaimed = usageRecords
    .filter((record) => {
      const claimDate = new Date(record.usageDate || record.claimDate);
      return claimDate >= periodStart && claimDate <= periodEnd;
    })
    .reduce((sum, record) => {
      const amount = typeof record.usageAmount === 'number'
        ? record.usageAmount
        : typeof record.usageAmount === 'object' && 'toNumber' in record.usageAmount
        ? record.usageAmount.toNumber()
        : 0;
      return sum + amount;
    }, 0);

  // Check if requested amount exceeds remaining
  if (requestedAmount > remaining) {
    return {
      valid: false,
      error: `Cannot claim ${requestedAmount} cents. Only ${remaining} cents available in this period.`,
      errorCode: 'CLAIMING_LIMIT_EXCEEDED',
      remainingAmount: remaining,
      maxClaimable,
      alreadyClaimed,
    };
  }

  return {
    valid: true,
    remainingAmount: remaining - requestedAmount,
    maxClaimable,
    alreadyClaimed,
  };
}

