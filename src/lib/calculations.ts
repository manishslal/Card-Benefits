/**
 * calculations.ts
 *
 * Pure utility functions for computing card benefit metrics.
 * All monetary values are in cents (integers). No Prisma calls or side effects.
 */

import type { UserBenefit as PrismaUserBenefit, Player as PrismaPlayer } from '@prisma/client';

// Re-export Prisma types for use throughout the application
export type { PrismaUserBenefit as UserBenefit };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * MasterCard represents the card product definition (e.g., Chase Sapphire Reserve).
 */
export type MasterCard = {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
};

/**
 * UserCard represents a card instance owned by a user.
 * Includes both Prisma base fields and necessary relations (masterCard, userBenefits).
 */
export type UserCard = {
  id: string;
  playerId: string;
  masterCardId: string;
  customName: string | null;
  actualAnnualFee: number | null;
  renewalDate: Date;
  isOpen: boolean;
  createdAt: Date;
  updatedAt: Date;
  masterCard: MasterCard;
  userBenefits: PrismaUserBenefit[];
};

/**
 * Extended Player type that includes the userCards relation.
 * This is the type that should be used for functions accepting players,
 * ensuring all userCards data (including masterCard and userBenefits) is available.
 */
export type Player = PrismaPlayer & {
  userCards: UserCard[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Milliseconds in a single calendar day. Exported for use in tests. */
export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Describes an unused benefit that is expiring within 30 days.
 * Used to surface actionable alerts to the user.
 */
export type ExpirationWarning = {
  benefit: PrismaUserBenefit;
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
export function resolveUnitValue(benefit: UserBenefit): number {
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
export function getTotalValueExtracted(userBenefits: PrismaUserBenefit[]): number {
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
export function getUncapturedValue(userBenefits: PrismaUserBenefit[]): number {
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
  userBenefits: PrismaUserBenefit[],
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
  userBenefits: PrismaUserBenefit[],
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
  userBenefits: PrismaUserBenefit[],
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

// ---------------------------------------------------------------------------
// Household-level aggregation functions
// ---------------------------------------------------------------------------

/**
 * Calculates the total household ROI by summing effective ROI across all players.
 * ROI for each player = (total value extracted from their cards) - (total net annual fees)
 *
 * @param players - Array of all players in the household.
 * @returns Total household ROI in cents.
 *
 * @example
 * getHouseholdROI([
 *   { userCards: [{ actualAnnualFee: 50000, userBenefits: [...] }], ...},
 *   { userCards: [{ actualAnnualFee: 0, userBenefits: [...] }], ...}
 * ]) => total ROI across both players
 */
export function getHouseholdROI(players: Player[]): number {
  // Handle edge case: empty or null player array
  if (!players || players.length === 0) {
    return 0;
  }

  return players.reduce((total, player) => {
    // Handle null player references safely
    if (!player || !player.userCards) {
      return total;
    }

    // Sum ROI across all cards for this player
    const playerROI = player.userCards.reduce((playerTotal, card) => {
      if (!card || !card.userBenefits) {
        return playerTotal;
      }

      // Calculate ROI for this card: extracted value - net annual fee
      const extractedValue = getTotalValueExtracted(card.userBenefits);
      const netFee = getNetAnnualFee(card, card.userBenefits);
      const cardROI = extractedValue - netFee;

      return playerTotal + cardROI;
    }, 0);

    return total + playerROI;
  }, 0);
}

/**
 * Calculates total value captured (used benefits) across all players' cards.
 * Sums the resolved value of all benefits marked as isUsed.
 *
 * Uses the centralized getTotalValueExtracted function to ensure consistent logic
 * across all benefit value calculations.
 *
 * @param players - Array of all players in the household.
 * @returns Total captured value in cents (only benefits marked as used).
 *
 * @example
 * getHouseholdTotalCaptured([
 *   { userCards: [{ userBenefits: [{ isUsed: true, stickerValue: 5000 }] }] }
 * ]) => 5000 (in cents)
 */
export function getHouseholdTotalCaptured(players: Player[]): number {
  // Handle edge case: empty or null player array
  if (!players || players.length === 0) {
    return 0;
  }

  return players.reduce((total, player) => {
    // Handle null player references safely
    if (!player || !player.userCards) {
      return total;
    }

    // Sum captured value across all cards for this player
    const playerCaptured = player.userCards.reduce((playerTotal, card) => {
      if (!card || !card.userBenefits) {
        return playerTotal;
      }

      // Use the centralized function for consistent benefit value extraction
      return playerTotal + getTotalValueExtracted(card.userBenefits);
    }, 0);

    return total + playerCaptured;
  }, 0);
}

/**
 * Counts unique active benefits across all players' cards.
 * A benefit is considered "active" if:
 * - It has NOT been used (isUsed === false), AND
 * - It is either perpetual (expirationDate === null) OR not yet expired
 *
 * Returns a count of unique benefit IDs to avoid double-counting if multiple
 * players hold the same benefit definition.
 *
 * @param players - Array of all players in the household.
 * @returns Count of unique active (unclaimed) benefits across all players.
 *
 * @example
 * getHouseholdActiveCount([
 *   { userCards: [{ userBenefits: [{ id: 'b1', isUsed: false, expirationDate: null }] }] },
 *   { userCards: [{ userBenefits: [{ id: 'b2', isUsed: false, expirationDate: tomorrow }] }] }
 * ]) => 2 unique active benefits
 */
export function getHouseholdActiveCount(players: Player[]): number {
  // Use a Set to track unique benefit IDs (in case multiple players have same benefits)
  const activeBenefits = new Set<string>();
  const now = new Date();

  // Handle edge case: empty or null player array
  if (!players || players.length === 0) {
    return 0;
  }

  players.forEach((player) => {
    // Handle null player references safely
    if (!player || !player.userCards) {
      return;
    }

    player.userCards.forEach((card) => {
      // Handle null card references safely
      if (!card || !card.userBenefits) {
        return;
      }

      card.userBenefits.forEach((benefit) => {
        // Handle null benefit references safely
        if (!benefit) {
          return;
        }

        // Skip already-used benefits; we only count unclaimed benefits
        if (benefit.isUsed) {
          return;
        }

        // Include benefit if perpetual (null expirationDate) OR not yet expired
        const isPerpetual = benefit.expirationDate === null;
        const isNotExpired =
          benefit.expirationDate !== null &&
          benefit.expirationDate > now;

        if (isPerpetual || isNotExpired) {
          activeBenefits.add(benefit.id);
        }
      });
    });
  });

  return activeBenefits.size;
}
