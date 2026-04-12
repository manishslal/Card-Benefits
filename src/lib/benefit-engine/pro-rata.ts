/**
 * Pro-rata calculation for membership-style benefits.
 *
 * When a user activates a monthly membership credit mid-year (e.g., Walmart+ in April),
 * they miss the earlier months. This module calculates the remaining value.
 *
 * All monetary values are in **cents** (integer arithmetic only — no floats).
 */

// ============================================================================
// Types
// ============================================================================

export interface ProRataResult {
  /** Full annual value in cents */
  fullValue: number;
  /** Pro-rated remaining value in cents */
  proRataValue: number;
  /** Months remaining from claim date through December */
  monthsRemaining: number;
  /** Monthly rate in cents (from claimingAmount) */
  monthlyRate: number;
  /** Percentage of annual value usable (0-100) */
  percentUsable: number;
  /** Whether pro-rating was applied (false = full value returned) */
  isProRated: boolean;
}

export interface ProRataBenefitInput {
  /** Annual sticker value in cents (e.g., 15500 for $155 Walmart+) */
  stickerValue: number;
  /** Claiming cadence — pro-rata only applies to MONTHLY cadence */
  claimingCadence: string | null;
  /** Per-period claiming amount in cents (e.g., 1000 for $10/mo Uber One) */
  claimingAmount: number;
  /** Benefit name — used to identify membership-type benefits */
  name: string;
}

// ============================================================================
// Eligibility
// ============================================================================

/**
 * Determines if a benefit is a monthly membership type that qualifies for pro-rata.
 *
 * Criteria:
 * - Must have MONTHLY cadence
 * - Must have a positive claimingAmount (not unlimited/multiplier)
 */
export function isProRataEligible(benefit: ProRataBenefitInput): boolean {
  if (!benefit.claimingCadence) return false;

  const cadence = benefit.claimingCadence.toUpperCase();
  if (cadence !== 'MONTHLY') return false;
  if (benefit.claimingAmount <= 0) return false;

  return true;
}

// ============================================================================
// Calculation
// ============================================================================

/**
 * Calculate pro-rated value for a membership credit.
 *
 * @param benefit  - The benefit configuration
 * @param claimedAt - When the user activated/claimed this benefit (null = full year)
 * @returns ProRataResult with calculated values
 */
export function calculateProRata(
  benefit: ProRataBenefitInput,
  claimedAt: Date | null | undefined,
): ProRataResult {
  const fullValue = benefit.stickerValue;
  const monthlyRate = benefit.claimingAmount;

  // Non-eligible benefits always return full value, un-prorated.
  if (!isProRataEligible(benefit)) {
    return {
      fullValue,
      proRataValue: fullValue,
      monthsRemaining: 12,
      monthlyRate,
      percentUsable: 100,
      isProRated: false,
    };
  }

  // No claim date → assume January 1 → full year
  if (!claimedAt) {
    return {
      fullValue,
      proRataValue: fullValue,
      monthsRemaining: 12,
      monthlyRate,
      percentUsable: 100,
      isProRated: false,
    };
  }

  // Calculate months remaining from claim month through December.
  // Use UTC to avoid timezone shifts — ISO date-only strings are parsed as UTC.
  // claimMonth is 1-based (Jan = 1, Dec = 12).
  const claimMonth = claimedAt.getUTCMonth() + 1; // 1–12
  const monthsRemaining = 12 - (claimMonth - 1); // Jan → 12, Dec → 1
  const proRataValue = monthsRemaining * monthlyRate;
  const percentUsable = Math.round((monthsRemaining / 12) * 100);

  return {
    fullValue,
    proRataValue,
    monthsRemaining,
    monthlyRate,
    percentUsable,
    isProRated: monthsRemaining < 12,
  };
}
