/**
 * Calculates the **initial** expirationDate for a UserBenefit based on its resetCadence.
 * Call this when a benefit is first created to set its current-window deadline.
 *
 * - Monthly        → last millisecond of the current calendar month
 * - CalendarYear   → Dec 31 of the current year (end of day)
 * - CardmemberYear → one day before the card's renewalDate (end of day)
 * - OneTime        → null (never expires; user must manually claim)
 *
 * @see getNextExpirationDate — use this instead when bumping forward after a reset.
 */
export function calcExpirationDate(
  resetCadence: string,
  renewalDate: Date,
  now: Date = new Date()
): Date | null {
  switch (resetCadence) {
    case 'Monthly': {
      // Last day of the current month, end of day in local time
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      lastDay.setHours(23, 59, 59, 999);
      return lastDay;
    }

    case 'CalendarYear': {
      // Dec 31 of the current year, end of day
      const dec31 = new Date(now.getFullYear(), 11, 31);
      dec31.setHours(23, 59, 59, 999);
      return dec31;
    }

    case 'CardmemberYear': {
      // The day BEFORE the renewal date — i.e., the last day of the current cardmember year
      const dayBefore = new Date(renewalDate);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(23, 59, 59, 999);
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
 * The key difference from `calcExpirationDate`:
 * - `calcExpirationDate` anchors to the *current* window (e.g. "end of this month").
 * - `getNextExpirationDate` bumps *forward* by one period (e.g. "end of next month"),
 *   so a benefit that just expired at 2025-03-31 gets a new deadline of 2025-04-30.
 *
 * Rules per cadence:
 * - Monthly        → last millisecond of the month *after* `now`'s month
 * - CalendarYear   → Dec 31 of `now.getFullYear() + 1` (end of day)
 * - CardmemberYear → day before the next `renewalDate` anniversary that falls after `now`
 * - OneTime        → null (OneTime benefits are never automatically reset)
 *
 * @param resetCadence - The benefit's reset cadence string
 * @param renewalDate  - The card's anniversary date (used only for CardmemberYear)
 * @param now          - Reference point; defaults to the current date/time
 * @returns The next expiration Date, or null for OneTime benefits
 *
 * @example Monthly: now = 2025-03-31 → 2025-04-30T23:59:59.999
 * @example CalendarYear: now = 2025-12-31 → 2026-12-31T23:59:59.999
 * @example CardmemberYear: renewalDate = 2024-06-15, now = 2025-07-01 → 2026-06-14T23:59:59.999
 */
export function getNextExpirationDate(
  resetCadence: string,
  renewalDate: Date,
  now: Date = new Date()
): Date | null {
  switch (resetCadence) {
    case 'Monthly': {
      // `new Date(year, month + 2, 0)` gives day 0 of (month+2),
      // which is the last day of (month+1) — i.e., the month after `now`.
      // This correctly handles variable-length months and December roll-over.
      const lastDayOfNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 2,
        0
      );
      lastDayOfNextMonth.setHours(23, 59, 59, 999);
      return lastDayOfNextMonth;
    }

    case 'CalendarYear': {
      // The current window expired on Dec 31 of this year,
      // so the next window closes on Dec 31 of next year.
      const dec31NextYear = new Date(now.getFullYear() + 1, 11, 31);
      dec31NextYear.setHours(23, 59, 59, 999);
      return dec31NextYear;
    }

    case 'CardmemberYear': {
      // Build a candidate renewal date using the same month/day as the stored
      // renewalDate but in the current year. If that date is already in the past
      // (or exactly now), advance by one year so we always look forward.
      const candidate = new Date(
        now.getFullYear(),
        renewalDate.getMonth(),
        renewalDate.getDate()
      );

      if (candidate <= now) {
        // The anniversary for this year has already passed — use next year's.
        candidate.setFullYear(candidate.getFullYear() + 1);
      }

      // The cardmember year ends the day *before* the next renewal anniversary.
      const dayBeforeRenewal = new Date(candidate);
      dayBeforeRenewal.setDate(dayBeforeRenewal.getDate() - 1);
      dayBeforeRenewal.setHours(23, 59, 59, 999);
      return dayBeforeRenewal;
    }

    case 'OneTime':
    default:
      // OneTime benefits are never automatically reset; no future expiration applies.
      return null;
  }
}
