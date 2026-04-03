/**
 * Card Calculation Utilities
 * 
 * Helper functions for calculating card metrics, ROI, renewal countdowns, etc.
 */

import { CardDisplayModel, RenewalStatus, RENEWAL_THRESHOLDS } from '@/types/card-management';

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
