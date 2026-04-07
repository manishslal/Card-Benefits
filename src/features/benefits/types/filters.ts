/**
 * Type definitions for benefit filtering and status tracking.
 * Part of Phase 1: Dashboard Benefits Enhancement
 */

/**
 * Benefit status (derived, not stored)
 * Calculated from: isUsed, isExpired, resetCadence, expirationDate
 */
export type BenefitStatus = 'available' | 'expiring' | 'expired' | 'claimed';

/**
 * User-selected filter status
 */
export type FilterStatus = 'all' | 'active' | 'expiring' | 'expired' | 'claimed';

/**
 * Count statistics for filter bar
 */
export interface StatusCounts {
  all: number;
  active: number;
  expiring: number;
  expired: number;
  claimed: number;
}

/**
 * ResetIndicator props
 */
export interface ResetIndicatorProps {
  resetCadence: string;
  expirationDate: Date | string | null;
  isExpired?: boolean;
}

/**
 * StatusBadge props
 */
export interface BenefitStatusBadgeProps {
  status: BenefitStatus;
  showLabel?: boolean;
}

/**
 * FilterBar props
 */
export interface BenefitsFilterBarProps {
  selectedStatus: FilterStatus;
  onStatusChange: (status: FilterStatus) => void;
  counts: StatusCounts;
  disabled?: boolean;
}
