/**
 * format-period-range.ts
 *
 * Utility for formatting benefit period date ranges in a concise,
 * human-readable format for the dashboard UI.
 *
 * Formatting rules:
 * - Same year:  "Apr 1 – Apr 30"
 * - Cross-year: "Jan 1, 2026 – Jun 30, 2027"
 * - No end:     "From Apr 1" (ONE_TIME benefits)
 */

const SHORT_MONTH_DAY: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
};

const FULL_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
};

/**
 * Format a period boundary into a concise display string.
 *
 * @param start - Period start date (Date object or ISO string)
 * @param end   - Period end date (Date object, ISO string, or null for ONE_TIME)
 * @returns Formatted range string
 *
 * @example
 * formatPeriodRange('2026-04-01', '2026-04-30') → "Apr 1 – Apr 30"
 * formatPeriodRange('2026-01-01', '2027-06-30') → "Jan 1, 2026 – Jun 30, 2027"
 * formatPeriodRange('2026-04-01', null)         → "From Apr 1"
 */
export function formatPeriodRange(
  start: Date | string,
  end: Date | string | null | undefined
): string {
  const s = start instanceof Date ? start : new Date(start);

  if (!end) {
    return `From ${s.toLocaleDateString('en-US', SHORT_MONTH_DAY)}`;
  }

  const e = end instanceof Date ? end : new Date(end);

  if (s.getUTCFullYear() === e.getUTCFullYear()) {
    // Same year — omit the year for compactness
    const startStr = s.toLocaleDateString('en-US', SHORT_MONTH_DAY);
    const endStr = e.toLocaleDateString('en-US', SHORT_MONTH_DAY);
    return `${startStr} – ${endStr}`;
  }

  // Cross-year — include both years
  const startStr = s.toLocaleDateString('en-US', FULL_DATE);
  const endStr = e.toLocaleDateString('en-US', FULL_DATE);
  return `${startStr} – ${endStr}`;
}
