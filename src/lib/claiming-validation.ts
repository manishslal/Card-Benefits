/**
 * claiming-validation.ts
 * 
 * High-level claiming validation functions for use in API routes.
 * Wraps the low-level utility functions with error handling and
 * standardized response formats.
 */

import {
  ClaimingCadence,
  getClaimingWindowBoundaries,
  validateClaimingAmount as validateAmount,
  isClaimingWindowOpen,
  daysUntilExpiration,
  getUrgencyLevel,
  UrgencyLevel,
} from './benefit-period-utils';
import {
  ClaimingErrorCode,
  createClaimingError,
  ClaimingError,
} from './claiming-errors';

/**
 * Comprehensive claiming limits info for API responses
 */
export interface ClaimingLimitsInfo {
  benefitId: string;
  benefitName?: string;
  cardName?: string;
  claimingCadence: ClaimingCadence;
  claimingWindowEnd: string | null;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  maxClaimableAmount: number;
  alreadyClaimedAmount: number;
  remainingAmount: number;
  daysUntilExpiration: number;
  hoursUntilExpiration: number;
  percentUtilized: number;
  isClaimingWindowOpen: boolean;
  warningLevel: UrgencyLevel;
  referenceDate: Date;
}

/**
 * Validate a benefit claim request.
 * 
 * Returns standardized error or success response.
 * 
 * @param claimingAmount - Max amount per period in cents
 * @param claimingCadence - The claiming cadence type
 * @param requestedAmount - Amount trying to claim in cents
 * @param usageRecords - Array of past usage records for this benefit
 * @param claimDate - Date of the claim
 * @param claimingWindowEnd - Optional custom window marker
 * @returns Success or error result
 * 
 * @throws ClaimingError if validation fails
 */
export function validateClaimingRequest(
  claimingAmount: number | null | undefined,
  claimingCadence: ClaimingCadence | null | undefined,
  requestedAmount: number,
  usageRecords: any[] = [],
  claimDate: Date = new Date(),
  claimingWindowEnd?: string | null
): {
  valid: boolean;
  error?: ClaimingError;
  details?: {
    remainingAmount: number;
    maxClaimable: number;
    alreadyClaimed: number;
    periodStart: Date;
    periodEnd: Date;
  };
} {
  // Validate using utility function
  const validation = validateAmount(
    claimingAmount,
    claimingCadence,
    requestedAmount,
    usageRecords,
    claimDate,
    claimingWindowEnd
  );

  if (!validation.valid) {
    const errorCode = validation.errorCode as ClaimingErrorCode;
    const error = createClaimingError(errorCode, {
      requestedAmount,
      maxClaimable: validation.maxClaimable,
      alreadyClaimed: validation.alreadyClaimed,
      remainingAmount: validation.remainingAmount,
    });

    return { valid: false, error };
  }

  const { periodStart, periodEnd } = getClaimingWindowBoundaries(
    claimingCadence,
    claimDate,
    claimingWindowEnd
  );

  return {
    valid: true,
    details: {
      remainingAmount: validation.remainingAmount,
      maxClaimable: validation.maxClaimable,
      alreadyClaimed: validation.alreadyClaimed,
      periodStart,
      periodEnd,
    },
  };
}

/**
 * Get detailed claiming limits for a benefit on a specific date.
 * 
 * Used by GET /api/benefits/claiming-limits endpoint and dashboard components.
 * 
 * @param benefitId - The benefit ID
 * @param claimingAmount - Max amount per period in cents
 * @param claimingCadence - The claiming cadence type
 * @param usageRecords - Array of past usage records
 * @param referenceDate - Date to calculate for (defaults to now)
 * @param claimingWindowEnd - Optional custom window marker
 * @param benefitName - Optional benefit name for display
 * @param cardName - Optional card name for display
 * @returns Complete claiming limits info
 */
export function getClaimingLimitsInfo(
  benefitId: string,
  claimingAmount: number | null | undefined,
  claimingCadence: ClaimingCadence | null | undefined,
  usageRecords: any[] = [],
  referenceDate: Date = new Date(),
  claimingWindowEnd?: string | null,
  benefitName?: string,
  cardName?: string
): ClaimingLimitsInfo | null {
  if (!claimingCadence) {
    return null;
  }

  const { periodStart, periodEnd, periodLabel } = getClaimingWindowBoundaries(
    claimingCadence,
    referenceDate,
    claimingWindowEnd
  );

  const maxClaimable = claimingAmount && claimingCadence ? Math.max(0, claimingAmount) : 0;

  // Sum already claimed in this period
  const alreadyClaimed = usageRecords
    .filter((record) => {
      const claimDate = new Date(record.usageDate || record.claimDate);
      return claimDate >= periodStart && claimDate <= periodEnd;
    })
    .reduce((sum, record) => {
      const amount = typeof record.usageAmount === 'number'
        ? record.usageAmount
        : typeof record.usageAmount === 'object' && 'toNumber' in record.usageAmount
        ? record.usageAmount.toNumber()
        : 0;
      return sum + amount;
    }, 0);

  const remaining = Math.max(0, maxClaimable - alreadyClaimed);

  const days = daysUntilExpiration(claimingCadence, referenceDate, claimingWindowEnd);
  const hours = Math.ceil((periodEnd.getTime() - referenceDate.getTime()) / (1000 * 60 * 60));

  const percentUtilized = maxClaimable > 0 ? (alreadyClaimed / maxClaimable) * 100 : 0;

  return {
    benefitId,
    benefitName,
    cardName,
    claimingCadence,
    claimingWindowEnd: claimingWindowEnd || null,
    periodStart,
    periodEnd,
    periodLabel,
    maxClaimableAmount: maxClaimable,
    alreadyClaimedAmount: alreadyClaimed,
    remainingAmount: remaining,
    daysUntilExpiration: days,
    hoursUntilExpiration: Math.max(0, hours),
    percentUtilized: Math.min(100, Math.max(0, percentUtilized)),
    isClaimingWindowOpen: isClaimingWindowOpen(claimingCadence, referenceDate, claimingWindowEnd),
    warningLevel: getUrgencyLevel(claimingCadence, referenceDate, claimingWindowEnd),
    referenceDate,
  };
}

/**
 * Format claiming amount for display (e.g., 1500 cents -> "$15.00")
 */
export function formatClaimingAmount(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

/**
 * Format claiming cadence for display
 */
export function formatClaimingCadence(cadence: ClaimingCadence | null | undefined): string {
  if (!cadence) return 'Not Configured';

  const labels: Record<ClaimingCadence, string> = {
    MONTHLY: 'Monthly',
    QUARTERLY: 'Quarterly',
    SEMI_ANNUAL: 'Semi-Annual',
    FLEXIBLE_ANNUAL: 'Flexible Annual',
    ONE_TIME: 'One-Time',
  };

  return labels[cadence] || cadence;
}

/**
 * Get display color for urgency level
 */
export function getUrgencyColor(level: UrgencyLevel): string {
  const colors: Record<UrgencyLevel, string> = {
    CRITICAL: '#dc2626', // red-600
    HIGH: '#ea580c', // orange-600
    MEDIUM: '#eab308', // yellow-400
    LOW: '#22c55e', // green-500
  };

  return colors[level] || colors.LOW;
}
