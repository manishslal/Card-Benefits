/**
 * Benefit filtering and status determination utilities.
 * Part of Phase 1: Dashboard Benefits Enhancement
 * 
 * Provides functions to:
 * - Determine status for a single benefit (available/expiring/expired/claimed)
 * - Filter benefits by status
 * - Count benefits by status
 * - Determine urgency levels for reset indicators
 */

import { UserBenefit } from '@/types';
import { getDaysUntilExpiration, isExpired } from './benefitDates';
import type { BenefitStatus, FilterStatus } from '../types/filters';

/**
 * Determine the status of a benefit based on its properties.
 * 
 * Status determination logic:
 * 1. If benefit has been claimed (isUsed=true), status is 'claimed'
 * 2. If benefit has expired (expirationDate < now), status is 'expired'
 * 3. If benefit expires in ≤7 days, status is 'expiring'
 * 4. Otherwise, status is 'available'
 * 
 * @param benefit - The benefit to evaluate
 * @returns The determined status
 */
export function getStatusForBenefit(benefit: UserBenefit): BenefitStatus {
  // If marked as used, it's claimed
  if (benefit.isUsed) {
    return 'claimed';
  }

  // If expired, it's expired
  if (isExpired(benefit.expirationDate)) {
    return 'expired';
  }

  // If expiring soon (≤7 days), it's expiring
  const daysUntil = getDaysUntilExpiration(benefit.expirationDate);
  if (daysUntil !== Infinity && daysUntil <= 7) {
    return 'expiring';
  }

  // Otherwise, it's available
  return 'available';
}

/**
 * Filter an array of benefits by the given status.
 * 
 * Filter mappings:
 * - 'all': Returns all benefits (no filtering)
 * - 'active': Returns available + unclaimed benefits
 * - 'expiring': Returns benefits expiring soon (< 7 days)
 * - 'expired': Returns expired benefits
 * - 'claimed': Returns claimed benefits
 * 
 * @param benefits - Array of benefits to filter
 * @param status - Filter status to apply
 * @returns Filtered array of benefits
 */
export function filterBenefitsByStatus(
  benefits: UserBenefit[],
  status: FilterStatus
): UserBenefit[] {
  if (status === 'all') {
    return benefits;
  }

  return benefits.filter(benefit => {
    const benefitStatus = getStatusForBenefit(benefit);

    switch (status) {
      case 'active':
        // Active = available (not claimed, not expired, not expiring soon)
        return benefitStatus === 'available';

      case 'expiring':
        // Expiring = expiring soon
        return benefitStatus === 'expiring';

      case 'expired':
        // Expired = expired
        return benefitStatus === 'expired';

      case 'claimed':
        // Claimed = claimed
        return benefitStatus === 'claimed';

      default:
        return true;
    }
  });
}

/**
 * Count benefits by status.
 * 
 * Efficiently counts all benefits across all status categories.
 * 
 * @param benefits - Array of benefits to count
 * @returns Object with counts for each filter status
 */
export function countBenefitsByStatus(
  benefits: UserBenefit[]
): {
  all: number;
  active: number;
  expiring: number;
  expired: number;
  claimed: number;
} {
  const counts = {
    all: benefits.length,
    active: 0,
    expiring: 0,
    expired: 0,
    claimed: 0,
  };

  benefits.forEach(benefit => {
    const status = getStatusForBenefit(benefit);

    if (status === 'available') {
      counts.active += 1;
    } else if (status === 'expiring') {
      counts.expiring += 1;
    } else if (status === 'expired') {
      counts.expired += 1;
    } else if (status === 'claimed') {
      counts.claimed += 1;
    }
  });

  return counts;
}

/**
 * Check if a benefit is in an urgent state (< 3 days).
 * Used by ResetIndicator to show AlertCircle icon.
 * 
 * @param daysRemaining - Number of days until expiration
 * @returns true if urgent (< 3 days), false otherwise
 */
export function isUrgent(daysRemaining: number): boolean {
  return daysRemaining >= 0 && daysRemaining < 3;
}

/**
 * Check if a benefit is in a warning state (3-7 days).
 * Used by ResetIndicator to show warning color.
 * 
 * @param daysRemaining - Number of days until expiration
 * @returns true if warning (3-7 days), false otherwise
 */
export function isWarning(daysRemaining: number): boolean {
  return daysRemaining >= 3 && daysRemaining <= 7;
}

/**
 * Get the number of days until a benefit resets.
 * Wraps getDaysUntilExpiration for convenience in ResetIndicator.
 * 
 * @param benefit - The benefit to check
 * @returns Number of days until reset (Infinity for perpetual)
 */
export function getDaysUntilReset(benefit: UserBenefit): number {
  return getDaysUntilExpiration(benefit.expirationDate);
}

/**
 * Format a benefit's reset date for display.
 * Returns "Month Day" format (e.g., "March 15").
 * 
 * @param benefit - The benefit to format
 * @returns Formatted reset date string, or empty string if no expiration
 */
export function formatResetDate(benefit: UserBenefit): string {
  if (!benefit.expirationDate) {
    return '';
  }

  const date = benefit.expirationDate instanceof Date
    ? benefit.expirationDate
    : new Date(benefit.expirationDate);

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
  }).format(date);
}
