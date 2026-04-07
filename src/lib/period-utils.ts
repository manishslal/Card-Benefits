/**
 * QA-003: Timezone-aware utility functions for period calculations
 * All calculations use UTC to ensure consistent behavior across timezones
 */

/**
 * Calculate UTC start and end dates for a given period
 * @param cadence - The reset cadence (MONTHLY, QUARTERLY, ANNUAL, CARDMEMBER_YEAR, ONE_TIME)
 * @param limitToMonths - How many periods to generate
 * @returns Array of {start, end} dates in UTC
 */
export function calculatePeriods(
  cadence: string,
  limitToMonths: number = 12
): Array<{ start: Date; end: Date }> {
  const periods: Array<{ start: Date; end: Date }> = [];
  const now = new Date(); // Already UTC in JavaScript

  // Get UTC components
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth(); // 0-11

  for (let i = 0; i < limitToMonths; i++) {
    let periodStart: Date;
    let periodEnd: Date;

    switch (cadence) {
      case 'MONTHLY':
        // First day of the month
        periodStart = new Date(Date.UTC(utcYear, utcMonth - i, 1));
        // Last day of the month at 23:59:59.999 UTC
        periodEnd = new Date(Date.UTC(utcYear, utcMonth - i + 1, 0, 23, 59, 59, 999));
        break;

      case 'QUARTERLY':
        // Calculate which quarter we're in
        const monthsBack = i * 3;
        const targetMonth = utcMonth - monthsBack;
        let quarterYear = utcYear;
        let quarterMonth = targetMonth;

        // Handle year boundary
        while (quarterMonth < 0) {
          quarterMonth += 12;
          quarterYear -= 1;
        }

        const quarter = Math.floor(quarterMonth / 3);
        const quarterStartMonth = quarter * 3;
        periodStart = new Date(Date.UTC(quarterYear, quarterStartMonth, 1));
        periodEnd = new Date(Date.UTC(quarterYear, quarterStartMonth + 3, 0, 23, 59, 59, 999));
        break;

      case 'ANNUAL':
      case 'CARDMEMBER_YEAR':
        // Assumes calendar year (Jan 1 - Dec 31)
        // Each iteration is one year back
        periodStart = new Date(Date.UTC(utcYear - i, 0, 1));
        periodEnd = new Date(Date.UTC(utcYear - i, 11, 31, 23, 59, 59, 999));
        break;

      case 'ONE_TIME':
        // One-time benefits have no reset, return a single period
        periodStart = new Date(Date.UTC(1970, 0, 1));
        periodEnd = new Date(Date.UTC(2099, 11, 31, 23, 59, 59, 999));
        return [{ start: periodStart, end: periodEnd }];

      default:
        // Default to monthly
        periodStart = new Date(Date.UTC(utcYear, utcMonth - i, 1));
        periodEnd = new Date(Date.UTC(utcYear, utcMonth - i + 1, 0, 23, 59, 59, 999));
    }

    periods.push({ start: periodStart, end: periodEnd });
  }

  return periods;
}

/**
 * Get the current period start and end dates based on cadence (UTC)
 * @param cadence - The reset cadence
 * @returns { start: Date, end: Date } in UTC
 */
export function getCurrentPeriod(cadence: string): { start: Date; end: Date } {
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth(); // 0-11

  let start: Date;
  let end: Date;

  switch (cadence) {
    case 'MONTHLY':
      start = new Date(Date.UTC(utcYear, utcMonth, 1));
      end = new Date(Date.UTC(utcYear, utcMonth + 1, 0, 23, 59, 59, 999));
      break;

    case 'QUARTERLY':
      const quarter = Math.floor(utcMonth / 3);
      const quarterStart = quarter * 3;
      start = new Date(Date.UTC(utcYear, quarterStart, 1));
      end = new Date(Date.UTC(utcYear, quarterStart + 3, 0, 23, 59, 59, 999));
      break;

    case 'ANNUAL':
    case 'CARDMEMBER_YEAR':
      start = new Date(Date.UTC(utcYear, 0, 1));
      end = new Date(Date.UTC(utcYear, 11, 31, 23, 59, 59, 999));
      break;

    case 'ONE_TIME':
      start = new Date(Date.UTC(1970, 0, 1));
      end = new Date(Date.UTC(2099, 11, 31, 23, 59, 59, 999));
      break;

    default:
      start = new Date(Date.UTC(utcYear, utcMonth, 1));
      end = new Date(Date.UTC(utcYear, utcMonth + 1, 0, 23, 59, 59, 999));
  }

  return { start, end };
}

/**
 * Check if a date falls within a period (both UTC)
 * @param date - The date to check
 * @param periodStart - Period start date (UTC)
 * @param periodEnd - Period end date (UTC)
 * @returns true if date is within period
 */
export function isDateInPeriod(date: Date, periodStart: Date, periodEnd: Date): boolean {
  return date >= periodStart && date <= periodEnd;
}
