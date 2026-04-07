/**
 * Period Calculation Utilities
 * 
 * Handles period boundaries for monthly, quarterly, annual, and one-time benefits.
 * Supports cardmember year resets.
 */

import { addDays, addMonths, addQuarters, addYears, startOfDay, endOfDay } from 'date-fns';

export type ResetCadence = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONETIME';

export interface PeriodBoundaries {
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  isCurrentPeriod: boolean;
}

/**
 * Calculate period boundaries based on reset cadence and a reference date
 * @param cadence - Reset cadence type
 * @param referenceDate - Date to calculate period around (usually renewal date or today)
 * @param cardmemberYearStart - Card renewal/anniversary date (for annual resets)
 * @returns Period start and end dates
 */
export function calculatePeriodBoundaries(
  cadence: ResetCadence,
  referenceDate: Date = new Date(),
  cardmemberYearStart?: Date
): PeriodBoundaries {
  const today = new Date();
  const startDate = startOfDay(referenceDate);
  let endDate: Date;

  switch (cadence) {
    case 'MONTHLY': {
      // Start of month to end of month
      const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      endDate = endOfDay(addMonths(monthStart, 1));
      endDate.setDate(endDate.getDate() - 1); // Last day of current month
      break;
    }

    case 'QUARTERLY': {
      // Quarters: Jan-Mar, Apr-Jun, Jul-Sep, Oct-Dec
      const quarter = Math.floor(startDate.getMonth() / 3);
      const quarterStart = new Date(startDate.getFullYear(), quarter * 3, 1);
      endDate = endOfDay(addQuarters(quarterStart, 1));
      endDate.setDate(endDate.getDate() - 1);
      break;
    }

    case 'ANNUAL': {
      // Calendar year OR cardmember year
      let yearStart: Date;
      
      if (cardmemberYearStart) {
        // Use cardmember anniversary as year boundary
        yearStart = new Date(startDate.getFullYear(), cardmemberYearStart.getMonth(), cardmemberYearStart.getDate());
        if (yearStart < startDate) {
          yearStart = new Date(yearStart.getFullYear() + 1, cardmemberYearStart.getMonth(), cardmemberYearStart.getDate());
        }
      } else {
        // Use calendar year (Jan 1 - Dec 31)
        yearStart = new Date(startDate.getFullYear(), 0, 1);
        if (yearStart < startDate) {
          yearStart = new Date(yearStart.getFullYear() + 1, 0, 1);
        }
      }
      
      endDate = endOfDay(addYears(yearStart, 1));
      endDate.setDate(endDate.getDate() - 1);
      break;
    }

    case 'ONETIME': {
      // One-time benefits don't reset; use a far future date
      endDate = new Date('2099-12-31');
      break;
    }

    default:
      throw new Error(`Unknown cadence: ${cadence}`);
  }

  const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  const isCurrentPeriod = today >= startDate && today <= endDate;

  return {
    startDate,
    endDate,
    daysRemaining,
    isCurrentPeriod,
  };
}

/**
 * Get the current period for a benefit
 * @param cadence - Benefit reset cadence
 * @param cardmemberYearStart - Card renewal date (for annual resets)
 * @returns Current period boundaries
 */
export function getCurrentPeriod(
  cadence: ResetCadence,
  cardmemberYearStart?: Date
): PeriodBoundaries {
  return calculatePeriodBoundaries(cadence, new Date(), cardmemberYearStart);
}

/**
 * Get all periods for a benefit within a date range
 * @param cadence - Benefit reset cadence
 * @param fromDate - Start of range
 * @param toDate - End of range
 * @param cardmemberYearStart - Card renewal date (for annual resets)
 * @returns Array of period boundaries in chronological order
 */
export function getPeriodRange(
  cadence: ResetCadence,
  fromDate: Date,
  toDate: Date,
  cardmemberYearStart?: Date
): PeriodBoundaries[] {
  const periods: PeriodBoundaries[] = [];
  let current = new Date(fromDate);

  while (current <= toDate) {
    const period = calculatePeriodBoundaries(cadence, current, cardmemberYearStart);
    
    if (period.endDate >= fromDate && period.startDate <= toDate) {
      periods.push({
        ...period,
        startDate: period.startDate > fromDate ? period.startDate : fromDate,
        endDate: period.endDate < toDate ? period.endDate : toDate,
      });
    }

    // Move to next period
    switch (cadence) {
      case 'MONTHLY':
        current = addMonths(current, 1);
        break;
      case 'QUARTERLY':
        current = addQuarters(current, 1);
        break;
      case 'ANNUAL':
        current = addYears(current, 1);
        break;
      case 'ONETIME':
        current = toDate; // Only one period
        break;
    }

    if (period.endDate >= toDate) break;
  }

  return periods;
}

/**
 * Determine which period a date falls into
 * @param date - Date to check
 * @param cadence - Benefit reset cadence
 * @param cardmemberYearStart - Card renewal date
 * @returns Period boundaries containing the date
 */
export function getPeriodForDate(
  date: Date,
  cadence: ResetCadence,
  cardmemberYearStart?: Date
): PeriodBoundaries {
  let current = new Date(date);
  
  // Back up to find the period start
  switch (cadence) {
    case 'MONTHLY': {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      return calculatePeriodBoundaries(cadence, monthStart, cardmemberYearStart);
    }
    case 'QUARTERLY': {
      const quarter = Math.floor(current.getMonth() / 3);
      const quarterStart = new Date(current.getFullYear(), quarter * 3, 1);
      return calculatePeriodBoundaries(cadence, quarterStart, cardmemberYearStart);
    }
    case 'ANNUAL': {
      if (cardmemberYearStart) {
        let yearStart = new Date(current.getFullYear(), cardmemberYearStart.getMonth(), cardmemberYearStart.getDate());
        if (yearStart > current) {
          yearStart = new Date(yearStart.getFullYear() - 1, cardmemberYearStart.getMonth(), cardmemberYearStart.getDate());
        }
        return calculatePeriodBoundaries(cadence, yearStart, cardmemberYearStart);
      } else {
        const yearStart = new Date(current.getFullYear(), 0, 1);
        return calculatePeriodBoundaries(cadence, yearStart, cardmemberYearStart);
      }
    }
    case 'ONETIME':
      return calculatePeriodBoundaries(cadence, current, cardmemberYearStart);
  }
}

/**
 * Check if two dates are in the same period
 * @param date1 - First date
 * @param date2 - Second date
 * @param cadence - Benefit reset cadence
 * @returns true if dates are in the same period
 */
export function isSamePeriod(date1: Date, date2: Date, cadence: ResetCadence): boolean {
  const period1 = getPeriodForDate(date1, cadence);
  const period2 = getPeriodForDate(date2, cadence);
  
  return period1.startDate.getTime() === period2.startDate.getTime() &&
         period1.endDate.getTime() === period2.endDate.getTime();
}

/**
 * Get days remaining in current period
 * @param cadence - Benefit reset cadence
 * @param cardmemberYearStart - Card renewal date
 * @returns Number of days remaining
 */
export function daysRemainingInPeriod(
  cadence: ResetCadence,
  cardmemberYearStart?: Date
): number {
  const period = getCurrentPeriod(cadence, cardmemberYearStart);
  return period.daysRemaining;
}

/**
 * Determine urgency based on days remaining
 * @param daysRemaining - Days until period reset
 * @returns Urgency level
 */
export function getUrgencyLevel(daysRemaining: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (daysRemaining <= 7) return 'HIGH';
  if (daysRemaining <= 14) return 'MEDIUM';
  return 'LOW';
}
