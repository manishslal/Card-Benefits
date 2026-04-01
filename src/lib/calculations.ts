/**
 * calculations.ts
 *
 * Pure utility functions for computing card benefit metrics.
 * All monetary values are in cents (integers). No Prisma calls or side effects.
 */

import type { UserCard, UserBenefit } from '@prisma/client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Milliseconds in a single calendar day. Exported for use in tests. */
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Describes an unused benefit that is expiring within 30 days.
 * Used to surface actionable alerts to the user.
 */
export type ExpirationWarning = {
  benefit: UserBenefit;
  /** Number of full days remaining until expiration (Math.floor). */
  daysUntilExpiration: number;
  /** 'critical' if < 14 days remain; 'warning' if 14–29 days remain. */
  level: 'warning' | 'critical';
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the per-unit value of a benefit in cents.
 * Prefers the user's declared override over the sticker value.
 * Returns 0 when neither is set (covers UsagePerk with no declared value).
 */
function resolveUnitValue(benefit: UserBenefit): number {
  return benefit.userDeclaredValue ?? benefit.stickerValue;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Calculates the total cents of value the user has already extracted from
 * their benefits.
 *
 * @param userBenefits - All benefits associated with the user's card.
 * @returns Total extracted value in cents.
 */
export function getTotalValueExtracted(userBenefits: UserBenefit[]): number {
  return userBenefits.reduce((total, benefit) => {
    // Only count benefits the user has actually used.
    if (!benefit.isUsed) return total;

    let contributedValue: number;

    if (benefit.type === 'StatementCredit') {
      // Statement credits are one-shot: the full resolved value is the gain.
      contributedValue = resolveUnitValue(benefit);
    } else {
      // UsagePerk: each usage instance contributes the per-unit value.
      // timesUsed * 0 === 0 when the perk has no monetary value (e.g. lounge access).
      contributedValue = benefit.timesUsed * resolveUnitValue(benefit);
    }

    return total + contributedValue;
  }, 0);
}

/**
 * Calculates the total cents of value in benefits that have not yet been used
 * and have not expired. Represents money still on the table.
 *
 * @param userBenefits - All benefits associated with the user's card.
 * @returns Total uncaptured value in cents.
 */
export function getUncapturedValue(userBenefits: UserBenefit[]): number {
  const now = new Date();

  return userBenefits.reduce((total, benefit) => {
    // Skip benefits already used.
    if (benefit.isUsed) return total;

    // Skip benefits whose window has already closed.
    if (benefit.expirationDate !== null && benefit.expirationDate < now) {
      return total;
    }

    return total + resolveUnitValue(benefit);
  }, 0);
}

/**
 * Calculates the effective annual fee in cents after accounting for benefits
 * whose sticker value directly offsets the fee (CardmemberYear StatementCredits).
 *
 * The result can be negative, indicating the card generates net positive value
 * before factoring in spend-based rewards.
 *
 * @param userCard     - The user's card record (contains the actual annual fee).
 * @param userBenefits - All benefits associated with the user's card.
 * @returns Net annual fee in cents (may be negative).
 */
export function getNetAnnualFee(
  userCard: UserCard,
  userBenefits: UserBenefit[],
): number {
  // Treat a null actualAnnualFee as $0 (e.g. no-fee cards).
  const baseFee = userCard.actualAnnualFee ?? 0;

  // Sum the sticker value of all CardmemberYear StatementCredits.
  // These are the canonical fee-offsetting credits (e.g. Chase Sapphire Reserve
  // $300 travel credit). We use stickerValue — not the user override — because
  // we're measuring the card's advertised offset against the advertised fee.
  // isUsed is intentionally ignored: the offset represents potential value.
  const feeOffsets = userBenefits.reduce((sum, benefit) => {
    const isFeeOffsetCredit =
      benefit.type === 'StatementCredit' &&
      benefit.resetCadence === 'CardmemberYear';

    return isFeeOffsetCredit ? sum + benefit.stickerValue : sum;
  }, 0);

  return baseFee - feeOffsets;
}

/**
 * Calculates the user's effective return on investment for the card:
 *   value extracted  −  net annual fee
 *
 * A positive result means the user is ahead (they've recouped more than they
 * paid after offsets); a negative result means they are under-utilizing the card
 * or overpaying for it relative to benefits claimed so far.
 *
 * @param userCard     - The user's card record.
 * @param userBenefits - All benefits associated with the user's card.
 * @returns Effective ROI in cents.
 */
export function getEffectiveROI(
  userCard: UserCard,
  userBenefits: UserBenefit[],
): number {
  return (
    getTotalValueExtracted(userBenefits) -
    getNetAnnualFee(userCard, userBenefits)
  );
}

/**
 * Returns expiration warnings for unused benefits expiring within the next
 * 30 days. Results are sorted by urgency: critical entries first, then by
 * ascending days remaining.
 *
 * @param userBenefits - All benefits associated with the user's card.
 * @param now          - Reference point for "today". Defaults to `new Date()`.
 *                       Inject a fixed date in tests to make assertions deterministic.
 * @returns Array of ExpirationWarning objects; empty if none are expiring soon.
 */
export function getExpirationWarnings(
  userBenefits: UserBenefit[],
  now: Date = new Date(),
): ExpirationWarning[] {
  const WARN_THRESHOLD_DAYS = 30;
  const CRITICAL_THRESHOLD_DAYS = 14;

  const warnings: ExpirationWarning[] = [];

  for (const benefit of userBenefits) {
    // Only warn about benefits the user hasn't acted on yet.
    if (benefit.isUsed) continue;

    // Skip benefits with no expiration — they don't expire.
    if (benefit.expirationDate === null) continue;

    // Skip already-expired benefits (getUncapturedValue also excludes these).
    if (benefit.expirationDate < now) continue;

    const msRemaining = benefit.expirationDate.getTime() - now.getTime();
    const daysUntilExpiration = Math.floor(msRemaining / MS_PER_DAY);

    // Only surface benefits expiring within the warning window.
    if (daysUntilExpiration >= WARN_THRESHOLD_DAYS) continue;

    const level: ExpirationWarning['level'] =
      daysUntilExpiration < CRITICAL_THRESHOLD_DAYS ? 'critical' : 'warning';

    warnings.push({ benefit, daysUntilExpiration, level });
  }

  // Sort: critical before warning; within each level, sooner expiry first.
  warnings.sort((a, b) => {
    if (a.level !== b.level) {
      // 'critical' < 'warning' alphabetically so this puts critical first.
      return a.level === 'critical' ? -1 : 1;
    }
    return a.daysUntilExpiration - b.daysUntilExpiration;
  });

  return warnings;
}
