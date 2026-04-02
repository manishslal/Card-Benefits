/**
 * Calculates the **initial** expirationDate for a UserBenefit based on its resetCadence.
 * Call this when a benefit is first created to set its current-window deadline.
 *
 * CRITICAL: All calculations use UTC to ensure consistency across timezones and DST transitions.
 * Dates are stored in UTC in the database and compared in UTC for expiration checks.
 *
 * - Monthly        → last millisecond of the current calendar month (UTC)
 * - CalendarYear   → Dec 31 of the current year, end of day (UTC)
 * - CardmemberYear → one day before the card's renewalDate anniversary (UTC), end of day
 * - OneTime        → null (never expires; user must manually claim)
 *
 * @see getNextExpirationDate — use this instead when bumping forward after a reset.
 * @param resetCadence - The benefit's reset frequency
 * @param renewalDate - The card's renewal date (stored in UTC)
 * @param now - Reference point; defaults to current UTC time
 */
export function calcExpirationDate(
  resetCadence: string,
  renewalDate: Date,
  now: Date = new Date()
): Date | null {
  switch (resetCadence) {
    case 'Monthly': {
      // Last day of the current month, 23:59:59.999 UTC
      // Using getUTCFullYear/getUTCMonth ensures DST-agnostic calculation
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      // New Date(year, month+1, 0) gives last day of current month in local time,
      // but we need UTC. Construct explicitly in UTC space:
      const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
      return lastDay;
    }

    case 'CalendarYear': {
      // Dec 31 of the current year, 23:59:59.999 UTC
      const year = now.getUTCFullYear();
      const dec31 = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      return dec31;
    }

    case 'CardmemberYear': {
      // The day BEFORE the renewal date in the current year
      // Extract month/day from renewalDate (already UTC), build candidate for this year
      const renewalMonth = renewalDate.getUTCMonth();
      const renewalDay = renewalDate.getUTCDate();
      const currentYear = now.getUTCFullYear();

      // Create candidate anniversary date for this year (at midnight UTC)
      const candidate = new Date(Date.UTC(currentYear, renewalMonth, renewalDay, 0, 0, 0, 0));

      // If anniversary has already passed this year, use next year
      let target = candidate;
      if (candidate <= now) {
        target = new Date(Date.UTC(currentYear + 1, renewalMonth, renewalDay, 0, 0, 0, 0));
      }

      // Subtract one day to get last day of current cardmember year, then set to end-of-day
      const dayBefore = new Date(target.getTime() - 24 * 60 * 60 * 1000);
      // Set to 23:59:59.999 UTC
      dayBefore.setUTCHours(23, 59, 59, 999);
      return dayBefore;
    }

    case 'OneTime':
    default:
      return null;
  }
}

/**
 * Calculates the **next** expirationDate for a UserBenefit after its current window has closed.
 * Call this during the cron reset job to set the fresh deadline for the newly opened period.
 *
 * CRITICAL: All calculations use UTC to ensure consistency across timezones and DST transitions.
 *
 * The key difference from `calcExpirationDate`:
 * - `calcExpirationDate` anchors to the *current* window (e.g. "end of this month").
 * - `getNextExpirationDate` bumps *forward* by one period (e.g. "end of next month"),
 *   so a benefit that just expired at 2025-03-31 gets a new deadline of 2025-04-30.
 *
 * Rules per cadence (all in UTC):
 * - Monthly        → last millisecond of the month *after* `now`'s month
 * - CalendarYear   → Dec 31 of `now.getUTCFullYear() + 1` (end of day)
 * - CardmemberYear → day before the next `renewalDate` anniversary that falls after `now`
 * - OneTime        → null (OneTime benefits are never automatically reset)
 *
 * @param resetCadence - The benefit's reset cadence string
 * @param renewalDate  - The card's anniversary date (stored in UTC)
 * @param now          - Reference point in UTC; defaults to current time
 * @returns The next expiration Date in UTC, or null for OneTime benefits
 *
 * @example Monthly: now = 2025-03-31T15:00Z → 2025-04-30T23:59:59.999Z
 * @example CalendarYear: now = 2025-12-31T15:00Z → 2026-12-31T23:59:59.999Z
 * @example CardmemberYear: renewalDate = 2024-06-15, now = 2025-07-01 → 2026-06-14T23:59:59.999Z
 */
export function getNextExpirationDate(
  resetCadence: string,
  renewalDate: Date,
  now: Date = new Date()
): Date | null {
  switch (resetCadence) {
    case 'Monthly': {
      // Last day of the month *after* now's month, 23:59:59.999 UTC
      // Using getUTCMonth/getUTCFullYear ensures DST-agnostic calculation
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      // month + 2 gives the month after now (since month+1 is next month, +2 is month after that)
      // Date.UTC(year, month+2, 0) gives the last day of month+1 at midnight UTC
      const lastDayOfNextMonth = new Date(Date.UTC(year, month + 2, 0, 23, 59, 59, 999));
      return lastDayOfNextMonth;
    }

    case 'CalendarYear': {
      // The current window expired on Dec 31 of this year,
      // so the next window closes on Dec 31 of next year (UTC).
      const year = now.getUTCFullYear();
      const dec31NextYear = new Date(Date.UTC(year + 1, 11, 31, 23, 59, 59, 999));
      return dec31NextYear;
    }

    case 'CardmemberYear': {
      // Build a candidate renewal date using the same month/day as the stored
      // renewalDate but in the current/next year. If that date is already in the past,
      // advance by one year so we always look forward.
      const renewalMonth = renewalDate.getUTCMonth();
      const renewalDay = renewalDate.getUTCDate();
      const currentYear = now.getUTCFullYear();

      // Create candidate anniversary date for this year (at midnight UTC)
      const candidate = new Date(Date.UTC(currentYear, renewalMonth, renewalDay, 0, 0, 0, 0));

      // If anniversary has already passed this year (or is exactly now), use next year's
      let target = candidate;
      if (candidate <= now) {
        target = new Date(Date.UTC(currentYear + 1, renewalMonth, renewalDay, 0, 0, 0, 0));
      }

      // The cardmember year ends the day *before* the next renewal anniversary
      // Subtract one day from target and set to end-of-day UTC
      const dayBeforeRenewal = new Date(target.getTime() - 24 * 60 * 60 * 1000);
      dayBeforeRenewal.setUTCHours(23, 59, 59, 999);
      return dayBeforeRenewal;
    }

    case 'OneTime':
    default:
      // OneTime benefits are never automatically reset; no future expiration applies.
      return null;
  }
}

/**
 * Check if a benefit has expired (in UTC).
 *
 * CRITICAL: Uses UTC comparison to ensure consistency across all timezones and DST transitions.
 * A null expirationDate represents a perpetual benefit that never expires.
 *
 * @param expirationDate - The benefit's expiration date (stored in UTC), or null for perpetual
 * @param now - Reference point in UTC; defaults to current time
 * @returns true if the benefit has expired, false if still valid or perpetual
 *
 * @example
 * const expired = isExpired(new Date('2025-01-15'), new Date('2025-01-20'));
 * // Returns: true (expiration date is in the past)
 */
export function isExpired(expirationDate: Date | null, now: Date = new Date()): boolean {
  if (expirationDate === null) {
    // Null expiration = perpetual benefit, never expires
    return false;
  }

  // Compare times directly: expirationDate < now in UTC
  return expirationDate.getTime() < now.getTime();
}

/**
 * Get the number of days remaining until a benefit expires (in UTC).
 *
 * CRITICAL: Uses UTC calculation to ensure consistency across all timezones and DST transitions.
 * Counts whole days remaining; fractional days are rounded up.
 *
 * @param expirationDate - The benefit's expiration date (stored in UTC), or null for perpetual
 * @param now - Reference point in UTC; defaults to current time
 * @returns Number of whole days remaining, or Infinity for perpetual benefits
 *
 * @example
 * // If now is 2025-01-20 12:00:00 UTC, and expiration is 2025-01-25 23:59:59 UTC
 * const days = getDaysUntilExpiration(expirationDate);
 * // Returns: 5 (rounds up partial days)
 *
 * @example
 * // Perpetual benefit
 * const days = getDaysUntilExpiration(null);
 * // Returns: Infinity
 */
export function getDaysUntilExpiration(expirationDate: Date | null, now: Date = new Date()): number {
  if (expirationDate === null) {
    // Perpetual benefit
    return Infinity;
  }

  // Calculate milliseconds until expiration
  const msRemaining = expirationDate.getTime() - now.getTime();

  // Convert to days and round up (Math.ceil) so a benefit expiring in 1 hour shows as "1 day remaining"
  const daysRemaining = msRemaining / (24 * 60 * 60 * 1000);
  return Math.ceil(daysRemaining);
}

/**
 * Format a date for display in the user's local timezone.
 *
 * The date is stored in UTC in the database, but we display it in the user's local timezone
 * so they see a date that matches their local calendar. This function converts from UTC
 * to local and formats as "Jan 15, 2025".
 *
 * NOTE: This is a client-side function and should only be called in browser contexts
 * where the user's timezone is available. For server-side code, store/use dates in UTC.
 *
 * @param date - The date to format (stored in UTC)
 * @returns Formatted string like "Jan 15, 2025", or "N/A" if date is null
 *
 * @example
 * const formatted = formatDateForUser(new Date('2025-01-15T23:59:59Z'));
 * // Returns: "Jan 15, 2025" (or "Jan 16, 2025" if user is in a timezone ahead of UTC)
 */
export function formatDateForUser(date: Date | null): string {
  if (!date) {
    return 'N/A';
  }

  // Use toLocaleDateString to display in user's browser timezone
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
