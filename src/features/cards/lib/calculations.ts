/**
 * calculations.ts - Consolidated card calculations module
 * 
 * Merged from:
 * - src/lib/calculations.ts (benefit/ROI calculations)
 * - src/lib/card-calculations.ts (card renewal/status calculations)
 * 
 * Pure utility functions for computing card benefit metrics.
 * All monetary values are in cents (integers). No Prisma calls or side effects.
 */

import type { UserBenefit as PrismaUserBenefit, Player as PrismaPlayer } from '@prisma/client';
import { CardDisplayModel, RenewalStatus, RENEWAL_THRESHOLDS } from '@/features/cards/types';
import { featureFlags } from '@/lib/feature-flags';

// Re-export Prisma types for use throughout the application
export type { PrismaUserBenefit as UserBenefit };

// ---------------------------------------------------------------------------
// Types (from calculations.ts)
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
// Helpers (from calculations.ts)
// ---------------------------------------------------------------------------

/**
 * Resolves the per-unit value of a benefit in cents.
 * Prefers the user's declared override over the sticker value.
 * Returns 0 when neither is set (covers UsagePerk with no declared value).
 */
export function resolveUnitValue(benefit: UserBenefit): number {
  return benefit.userDeclaredValue ?? benefit.stickerValue;
}

/**
 * When the benefit engine is enabled, filters a benefit array to only
 * ACTIVE-period rows for engine-managed benefits.  Legacy benefits
 * (no masterBenefitId) pass through unchanged.
 *
 * When the engine is OFF the array is returned as-is.
 */
function filterToActivePeriod(benefits: PrismaUserBenefit[]): PrismaUserBenefit[] {
  if (!featureFlags.BENEFIT_ENGINE_ENABLED) return benefits;

  return benefits.filter((b) => {
    if (b.masterBenefitId) {
      // Engine-managed: only keep ACTIVE period rows
      return b.periodStatus === 'ACTIVE';
    }
    // Legacy benefit: always include
    return true;
  });
}

// ---------------------------------------------------------------------------
// Benefit Value Calculations (from calculations.ts)
// ---------------------------------------------------------------------------

/**
 * Calculates the total cents of value the user has already extracted from
 * their benefits.
 *
 * @param userBenefits - All benefits associated with the user's card.
 * @returns Total extracted value in cents.
 */
export function getTotalValueExtracted(userBenefits: PrismaUserBenefit[]): number {
  // When engine is enabled, only sum values from ACTIVE period rows
  const activeBenefits = filterToActivePeriod(userBenefits);

  return activeBenefits.reduce((total, benefit) => {
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
  // When engine is enabled, only consider ACTIVE period rows
  const activeBenefits = filterToActivePeriod(userBenefits);

  return activeBenefits.reduce((total, benefit) => {
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
  // When engine is enabled, only consider ACTIVE period rows to avoid
  // double-counting offsets across multiple period rows.
  const activeBenefits = filterToActivePeriod(userBenefits);
  const feeOffsets = activeBenefits.reduce((sum, benefit) => {
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

  // When engine is enabled, only warn about ACTIVE period rows
  const activeBenefits = filterToActivePeriod(userBenefits);

  const warnings: ExpirationWarning[] = [];

  for (const benefit of activeBenefits) {
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
// Household-level aggregation functions (from calculations.ts)
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
  // Use a Set to track unique benefit identifiers
  const activeBenefits = new Set<string>();
  const now = new Date();

  // Handle edge case: empty or null player array
  if (!players || players.length === 0) {
    return 0;
  }

  const engineEnabled = featureFlags.BENEFIT_ENGINE_ENABLED;

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

        if (engineEnabled && benefit.masterBenefitId) {
          // ENGINE PATH: Only count ACTIVE period rows, dedup by
          // composite key cardId:masterBenefitId to avoid cross-card dedup
          // (two cards with the same MasterBenefit are independent benefits)
          if (benefit.periodStatus === 'ACTIVE') {
            activeBenefits.add(`${card.id}:${benefit.masterBenefitId}`);
          }
        } else {
          // LEGACY PATH: Original behavior — dedup by benefit id
          const isPerpetual = benefit.expirationDate === null;
          const isNotExpired =
            benefit.expirationDate !== null &&
            benefit.expirationDate > now;

          if (isPerpetual || isNotExpired) {
            activeBenefits.add(benefit.id);
          }
        }
      });
    });
  });

  return activeBenefits.size;
}

// ---------------------------------------------------------------------------
// Card Renewal & Status Functions (from card-calculations.ts)
// ---------------------------------------------------------------------------

/**
 * Calculate effective annual fee for a card
 * Returns the override fee if set, otherwise uses the default fee
 * 
 * @param defaultFee - Default annual fee in cents from MasterCard
 * @param overrideFee - User's override fee in cents (null = use default)
 * @returns Effective annual fee in cents
 */
export function getEffectiveAnnualFee(
  defaultFee: number,
  overrideFee: number | null | undefined
): number {
  return overrideFee ?? defaultFee;
}

/**
 * Calculate number of days until card renewal
 * Returns positive number if renewal is in future, negative if overdue
 * 
 * @param renewalDate - Card anniversary date
 * @returns Number of days until renewal (negative = overdue)
 */
export function getDaysUntilRenewal(renewalDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const renewal = new Date(renewalDate);
  renewal.setHours(0, 0, 0, 0);

  const diff = renewal.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Determine renewal status based on days until renewal
 * Used for color-coding and visual indicators
 * 
 * @param daysUntilRenewal - Days until renewal (can be negative)
 * @returns Renewal status indicator
 */
export function getRenewalStatus(daysUntilRenewal: number): RenewalStatus {
  if (daysUntilRenewal < RENEWAL_THRESHOLDS.overdue) {
    return 'Overdue';
  }
  if (daysUntilRenewal <= RENEWAL_THRESHOLDS.dueSoon) {
    return 'DueNow';
  }
  if (daysUntilRenewal <= RENEWAL_THRESHOLDS.approaching) {
    return 'DueSoon';
  }
  return 'Safe';
}

/**
 * Format days until renewal as human-readable text
 * Examples: "Renews in 45 days", "Renewed 2 days ago"
 * 
 * @param daysUntilRenewal - Days until renewal
 * @returns Formatted renewal countdown text
 */
export function formatRenewalCountdown(daysUntilRenewal: number): string {
  if (daysUntilRenewal > 365) {
    const years = Math.floor(daysUntilRenewal / 365);
    return `Renews in ${years} year${years === 1 ? '' : 's'}`;
  }

  if (daysUntilRenewal > 0) {
    return `Renews in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}`;
  }

  if (daysUntilRenewal === 0) {
    return 'Renews today';
  }

  const daysAgo = Math.abs(daysUntilRenewal);
  return `Renewed ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
}

/**
 * Get CSS class for renewal status badge color
 * Used for consistent styling across components
 * 
 * @param renewalStatus - Renewal status indicator
 * @returns CSS class name for badge color
 */
export function getRenewalStatusColor(renewalStatus: RenewalStatus): string {
  switch (renewalStatus) {
    case 'DueNow':
      return 'bg-red-100 text-red-800'; // Red = urgent
    case 'DueSoon':
      return 'bg-yellow-100 text-yellow-800'; // Yellow = approaching
    case 'Coming':
      return 'bg-blue-100 text-blue-800'; // Blue = neutral
    case 'Safe':
      return 'bg-green-100 text-green-800'; // Green = safe
    case 'Overdue':
      return 'bg-red-200 text-red-900'; // Dark red = overdue
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get CSS class for card status badge
 * Used for consistent status indicators
 * 
 * @param status - Card status
 * @returns CSS class name for status badge
 */
export function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'PENDING':
      return 'bg-blue-100 text-blue-800';
    case 'PAUSED':
      return 'bg-yellow-100 text-yellow-800';
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-800';
    case 'DELETED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get human-readable status label
 * 
 * @param status - Card status
 * @returns Human-readable label
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'Active';
    case 'PENDING':
      return 'Pending';
    case 'PAUSED':
      return 'Paused';
    case 'ARCHIVED':
      return 'Archived';
    case 'DELETED':
      return 'Deleted';
    default:
      return 'Unknown';
  }
}

/**
 * Calculate Card ROI percentage
 * ROI = (Annual Benefits Value - Annual Fee) / Annual Fee * 100
 * Falls back to simple value calculation if fee is $0
 * 
 * @param annualBenefitsValue - Total annual benefits value in cents
 * @param annualFee - Annual fee in cents
 * @returns ROI percentage
 */
export function calculateCardROI(
  annualBenefitsValue: number,
  annualFee: number
): number {
  if (annualFee === 0) {
    // For cards with no fee, show the full value as a percentage (e.g., $300 value = 300%)
    // This is non-standard but makes sense in the context
    return annualBenefitsValue > 0 ? 100 : 0;
  }

  const roi = ((annualBenefitsValue - annualFee) / annualFee) * 100;
  return Math.round(roi * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate wallet-wide ROI percentage
 * Average ROI across all active cards
 * 
 * @param cards - Array of card display models (active cards only)
 * @returns Wallet ROI percentage
 */
export function calculateWalletROI(cards: CardDisplayModel[]): number {
  if (cards.length === 0) return 0;

  const totalROI = cards.reduce((sum, card) => sum + card.cardROI, 0);
  const avgROI = totalROI / cards.length;
  return Math.round(avgROI * 100) / 100;
}

/**
 * Format currency value for display
 * Converts cents to dollars with 2 decimal places
 * 
 * @param cents - Amount in cents
 * @param includeSymbol - Whether to include $ symbol (default: true)
 * @returns Formatted currency string
 */
export function formatCurrency(cents: number, includeSymbol: boolean = true): string {
  const dollars = cents / 100;
  const formatted = dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return includeSymbol ? `$${formatted}` : formatted;
}

/**
 * Format percentage value for display
 * 
 * @param value - Percentage value (e.g., 12.5 for 12.5%)
 * @param decimalPlaces - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimalPlaces: number = 1): string {
  return `${value.toFixed(decimalPlaces)}%`;
}

/**
 * Calculate benefits summary stats from a list of benefits
 * 
 * @param benefits - Array of user benefits
 * @returns Summary statistics
 */
export function calculateBenefitsSummary(
  benefits: Array<{
    stickerValue: number;
    isUsed: boolean;
    expirationDate: Date | null;
  }>
): {
  unclaimed: number;
  claimed: number;
  total: number;
  count: number;
  activeCount: number;
  expiredCount: number;
} {
  const now = new Date();

  let claimed = 0;
  let unclaimed = 0;
  let activeCount = 0;
  let expiredCount = 0;

  for (const benefit of benefits) {
    const isExpired = benefit.expirationDate && benefit.expirationDate < now;

    if (benefit.isUsed) {
      claimed += benefit.stickerValue;
    } else {
      unclaimed += benefit.stickerValue;
    }

    if (isExpired) {
      expiredCount++;
    } else {
      activeCount++;
    }
  }

  return {
    unclaimed,
    claimed,
    total: claimed + unclaimed,
    count: benefits.length,
    activeCount,
    expiredCount
  };
}

/**
 * Determine if a card should be included in ROI calculations
 * Only ACTIVE and PENDING cards contribute to ROI
 * 
 * @param status - Card status
 * @returns True if card should be included in ROI
 */
export function cardContributesToROI(status: string): boolean {
  return status === 'ACTIVE' || status === 'PENDING';
}

/**
 * Get renewal status tooltip text
 * Provides context about renewal urgency
 * 
 * @param renewalStatus - Renewal status indicator
 * @param daysUntilRenewal - Days until renewal
 * @returns Tooltip text
 */
export function getRenewalStatusTooltip(
  renewalStatus: RenewalStatus,
  daysUntilRenewal: number
): string {
  const day = Math.abs(daysUntilRenewal);
  const dayLabel = day === 1 ? 'day' : 'days';

  switch (renewalStatus) {
    case 'Overdue':
      return `This card renewal is ${day} ${dayLabel} overdue. Consider archiving if card is closed.`;
    case 'DueNow':
      return `Card renews within the next 30 days. Be prepared for the annual fee.`;
    case 'DueSoon':
      return `Card renews in ${daysUntilRenewal} days. Plan your renewal decision.`;
    case 'Safe':
      return `Card renewal is at least 60 days away.`;
    default:
      return '';
  }
}

/**
 * Calculate card impact on household ROI if archived
 * Shows how household ROI would change if this card is archived
 * 
 * @param cardROI - This card's ROI percentage
 * @param walletROI - Current wallet ROI percentage
 * @param cardValue - This card's annual value in cents
 * @param totalWalletValue - Total wallet value in cents
 * @returns Estimated impact on wallet ROI
 */
export function calculateArchiveROIImpact(
  cardROI: number,
  walletROI: number,
  cardValue: number,
  totalWalletValue: number
): number {
  if (totalWalletValue === 0) return 0;

  // Simplified calculation: proportion of value times impact
  const cardProportion = cardValue / totalWalletValue;
  const impact = cardProportion * (cardROI - walletROI);
  return Math.round(impact * 100) / 100;
}
