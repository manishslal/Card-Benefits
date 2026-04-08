/**
 * Period helper utilities for dashboard
 * Generates period options and calculates date ranges
 */

export type PeriodType = 'this-month' | 'this-quarter' | 'first-half' | 'full-year' | 'all-time';

/**
 * Get the current month name and year for display
 */
export function getCurrentMonthDisplay(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get current quarter info
 */
export function getCurrentQuarterInfo(): { quarter: number; year: number } {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  return { quarter, year: now.getFullYear() };
}

/**
 * Calculate date range for a given period type
 */
export function calculatePeriodDateRange(
  periodType: PeriodType
): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (periodType) {
    case 'this-month':
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };

    case 'this-quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        start: new Date(year, quarterStart, 1),
        end: new Date(year, quarterStart + 3, 0, 23, 59, 59, 999),
      };
    }

    case 'first-half':
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 6, 0, 23, 59, 59, 999),
      };

    case 'full-year':
      return {
        start: new Date(year, 0, 1),
        end: new Date(year, 11, 31, 23, 59, 59, 999),
      };

    case 'all-time':
      return {
        start: new Date(1970, 0, 1),
        end: new Date(2099, 11, 31, 23, 59, 59, 999),
      };

    default:
      // Default to this month
      return {
        start: new Date(year, month, 1),
        end: new Date(year, month + 1, 0, 23, 59, 59, 999),
      };
  }
}

/**
 * Get display label for period
 */
export function getPeriodDisplayLabel(periodType: PeriodType): string {
  const now = new Date();

  switch (periodType) {
    case 'this-month':
      return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    case 'this-quarter': {
      const quarter = Math.floor(now.getMonth() / 3) + 1;
      return `Q${quarter} ${now.getFullYear()}`;
    }

    case 'first-half':
      return `H1 ${now.getFullYear()}`;

    case 'full-year':
      return `${now.getFullYear()}`;

    case 'all-time':
      return 'All Time';

    default:
      return 'Unknown';
  }
}

/**
 * Check if a benefit's period overlaps with the selected period
 */
export function isPeriodInRange(
  benefitStart: Date,
  benefitEnd: Date,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  // Benefit period overlaps if it doesn't end before range starts and doesn't start after range ends
  return benefitEnd >= rangeStart && benefitStart <= rangeEnd;
}

/**
 * Calculate days until expiration
 */
export function calculateDaysUntilExpiration(expirationDate: Date): number {
  const now = new Date();
  const diffTime = expirationDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine if a benefit is expiring soon (within 7 days)
 */
export function isExpiringsoon(expirationDate: Date): boolean {
  const daysUntilExpiration = calculateDaysUntilExpiration(expirationDate);
  return daysUntilExpiration > 0 && daysUntilExpiration <= 7;
}

/**
 * Format a date range for display
 */
export function formatDateRange(start: Date, end: Date): string {
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }

  return `${startStr} - ${endStr}`;
}
