/**
 * Shared types for the Benefit Engine module.
 *
 * These types define the cadence system, period boundaries, and data shapes
 * used across date-math calculations and benefit auto-generation.
 */

// ============================================================================
// Cadence Types
// ============================================================================

/**
 * Claiming cadence values from MasterBenefit.claimingCadence.
 * Determines how frequently a benefit can be claimed within a reset period.
 */
export type ClaimingCadence =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'FLEXIBLE_ANNUAL'
  | 'ONE_TIME';

/**
 * Legacy reset cadence values from MasterBenefit.resetCadence.
 * Used as a fallback when claimingCadence is not set.
 */
export type ResetCadence =
  | 'Monthly'
  | 'CalendarYear'
  | 'CardmemberYear'
  | 'OneTime';

// ============================================================================
// Period Types
// ============================================================================

/**
 * Represents a calculated period boundary for a benefit.
 * periodEnd is null for ONE_TIME benefits that never expire.
 */
export interface PeriodBoundary {
  periodStart: Date;
  periodEnd: Date | null;
}

/**
 * Status of a UserBenefit period row.
 */
export type PeriodStatus = 'ACTIVE' | 'EXPIRED' | 'UPCOMING';

// ============================================================================
// Service Types
// ============================================================================

/**
 * Summary of a single generated benefit, returned to the caller
 * for logging and API response construction.
 */
export interface GeneratedBenefitSummary {
  name: string;
  masterBenefitId: string;
  periodStart: Date;
  periodEnd: Date | null;
}

/**
 * Result of the generateBenefitsForCard operation.
 */
export interface GenerateBenefitsResult {
  count: number;
  benefits: GeneratedBenefitSummary[];
}

// ============================================================================
// Cron Types
// ============================================================================

/**
 * Result summary from a cron rollover run.
 */
export interface CronRolloverResult {
  ok: boolean;
  expiredCount: number;
  generatedCount: number;
  skippedInactiveCard: number;
  skippedDeactivatedBenefit: number;
  skippedOneTime: number;
  processedAt: string;
  durationMs: number;
}
