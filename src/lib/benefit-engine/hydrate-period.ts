/**
 * Shared utility for hydrating period fields on UserBenefit rows.
 *
 * Used by both the manual-add API route and the import committer to
 * populate periodStart, periodEnd, periodStatus, and masterBenefitId
 * when the benefit engine is enabled.
 *
 * @module benefit-engine/hydrate-period
 */

import { featureFlags } from '@/lib/feature-flags';
import { calculatePeriodForBenefit, resolveClaimingAmount } from './date-math';
import type { Prisma } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/**
 * Prisma transaction client or the global prisma client.
 * Accepts any object that has `masterBenefit` and `userCard` properties.
 */
type PrismaClient = {
  masterBenefit: {
    findFirst: (args: any) => Promise<any>;
  };
  userCard: {
    findUnique: (args: any) => Promise<any>;
  };
};

/**
 * Result of hydrating period fields for a benefit.
 * All fields are nullable to support legacy (non-engine) behavior.
 */
export interface HydratedPeriodFields {
  periodStart: Date | null;
  periodEnd: Date | null;
  periodStatus: string | null;
  masterBenefitId: string | null;
  resolvedResetCadence: string;
  /** The effective stickerValue for this period (may differ from catalog for variable-amount benefits) */
  effectiveStickerValue: number | null;
}

// ============================================================================
// Main Utility
// ============================================================================

/**
 * Looks up a matching MasterBenefit and calculates period fields for a
 * UserBenefit row. Returns null-valued fields when the engine is disabled
 * or no matching catalog entry is found.
 *
 * This function is designed to work inside or outside a Prisma transaction.
 *
 * @param db - Prisma client or transaction client
 * @param userCardId - The UserCard this benefit belongs to
 * @param benefitName - The benefit name to match against the MasterBenefit catalog
 * @param fallbackResetCadence - The resetCadence to use if no MasterBenefit is found
 * @param referenceDate - The date to calculate period for (defaults to now)
 * @returns Hydrated period fields ready to spread into a Prisma create/update
 *
 * @example
 * const fields = await hydratePeriodFields(tx, userCardId, 'Uber Cash', 'Monthly');
 * const benefit = await tx.userBenefit.create({
 *   data: { ...baseData, ...fields },
 * });
 */
export async function hydratePeriodFields(
  db: PrismaClient,
  userCardId: string,
  benefitName: string,
  fallbackResetCadence: string,
  referenceDate: Date = new Date()
): Promise<HydratedPeriodFields> {
  // When engine is disabled, return null fields (legacy behavior)
  if (!featureFlags.BENEFIT_ENGINE_ENABLED) {
    return {
      periodStart: null,
      periodEnd: null,
      periodStatus: null,
      masterBenefitId: null,
      resolvedResetCadence: fallbackResetCadence,
      effectiveStickerValue: null,
    };
  }

  // Look up matching MasterBenefit via the card's MasterCard relation
  const masterBenefit = await db.masterBenefit.findFirst({
    where: {
      masterCard: {
        userCards: { some: { id: userCardId } },
      },
      name: { equals: benefitName, mode: 'insensitive' } as Prisma.StringFilter,
      isActive: true,
    },
  });

  if (!masterBenefit) {
    // No catalog match — calculate period from fallback cadence only
    const card = await db.userCard.findUnique({
      where: { id: userCardId },
      select: { renewalDate: true, createdAt: true },
    });

    const renewalDate = card?.renewalDate || card?.createdAt || referenceDate;

    const period = calculatePeriodForBenefit(
      null, // no claimingCadence
      fallbackResetCadence,
      referenceDate,
      renewalDate,
      null
    );

    return {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodStatus: 'ACTIVE',
      masterBenefitId: null,
      resolvedResetCadence: fallbackResetCadence,
      effectiveStickerValue: null,
    };
  }

  // MasterBenefit found — calculate period with full catalog data
  const card = await db.userCard.findUnique({
    where: { id: userCardId },
    select: { renewalDate: true, createdAt: true },
  });

  const renewalDate = card?.renewalDate || card?.createdAt || referenceDate;
  const resolvedResetCadence = masterBenefit.resetCadence || fallbackResetCadence;

  const period = calculatePeriodForBenefit(
    masterBenefit.claimingCadence,
    resolvedResetCadence,
    referenceDate,
    renewalDate,
    masterBenefit.claimingWindowEnd
  );

  // Resolve variable amount for this period's month
  const periodMonth = period.periodStart.getUTCMonth() + 1; // 1-indexed
  const effectiveStickerValue = masterBenefit.claimingAmount
    ? resolveClaimingAmount(
        masterBenefit.claimingAmount,
        masterBenefit.variableAmounts as Record<string, number> | null,
        periodMonth
      )
    : null;

  return {
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    periodStatus: 'ACTIVE',
    masterBenefitId: masterBenefit.id,
    resolvedResetCadence,
    effectiveStickerValue,
  };
}
