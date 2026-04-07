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
 */

/**
 * Reset cadence enum - mirrors Prisma schema
 */
export type ResetCadence = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';

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
  resetCadence: ResetCadence,
  referenceDate: Date = new Date()
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
