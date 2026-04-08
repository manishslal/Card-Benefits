/**
 * Benefit Engine — Public API.
 *
 * Barrel export for the benefit engine module. Import from here
 * rather than reaching into sub-modules.
 *
 * @module benefit-engine
 *
 * @example
 * import {
 *   calculatePeriodForBenefit,
 *   calculateNextPeriod,
 *   generateBenefitsForCard,
 * } from '@/lib/benefit-engine';
 */

// Date math engine
export {
  calculatePeriodForBenefit,
  calculateNextPeriod,
  resolveCadence,
  resolveClaimingAmount,
} from './date-math';

// Auto-generation service
export {
  generateBenefitsForCard,
  generateBenefitsForCardStandalone,
} from './generate-benefits';

// Period hydration utility
export {
  hydratePeriodFields,
} from './hydrate-period';

// Shared types
export type {
  ClaimingCadence,
  ResetCadence,
  PeriodBoundary,
  PeriodStatus,
  GeneratedBenefitSummary,
  GenerateBenefitsResult,
  CronRolloverResult,
} from './types';

export type { HydratedPeriodFields } from './hydrate-period';

// Re-export the ExpiredBenefitData interface for cron use
export type { ExpiredBenefitData } from './generate-benefits';
