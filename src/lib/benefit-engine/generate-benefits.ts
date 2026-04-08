/**
 * Benefit Auto-Generation Service.
 *
 * Generates UserBenefit period rows for a newly added UserCard by querying
 * the MasterBenefit catalog and calculating period boundaries via the
 * date math engine.
 *
 * @module benefit-engine/generate-benefits
 */

import { prisma } from '@/shared/lib/prisma';
import { calculatePeriodForBenefit, resolveClaimingAmount } from './date-math';
import type { GenerateBenefitsResult, GeneratedBenefitSummary } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Prisma transaction client type.
 * Uses the same type as prisma.$transaction callback parameter.
 */
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Minimal UserCard shape required by the generation service.
 */
interface UserCardInput {
  id: string;
  masterCardId: string;
  renewalDate: Date;
}

// ============================================================================
// Core Service
// ============================================================================

/**
 * Generates UserBenefit period rows for a newly added UserCard.
 *
 * For each active, default MasterBenefit on the card's MasterCard, creates
 * one UserBenefit row representing the CURRENT period. Period boundaries
 * are calculated via the date math engine using the benefit's cadence.
 *
 * This function is designed to run inside an existing Prisma transaction
 * (from the card-add flow) to ensure atomicity.
 *
 * @param tx - Prisma transaction client
 * @param userCard - The newly created UserCard (id, masterCardId, renewalDate)
 * @param playerId - The player ID for ownership
 * @param referenceDate - When the card was added (defaults to now); used for period calculation
 * @returns Count of benefits created and summary of each
 *
 * @example
 * const result = await prisma.$transaction(async (tx) => {
 *   const card = await tx.userCard.create({ data: ... });
 *   const generated = await generateBenefitsForCard(tx, card, player.id);
 *   return { card, generated };
 * });
 */
export async function generateBenefitsForCard(
  tx: PrismaTransactionClient,
  userCard: UserCardInput,
  playerId: string,
  referenceDate: Date = new Date()
): Promise<GenerateBenefitsResult> {
  // 1. Query active, default MasterBenefits for this card
  const masterBenefits = await tx.masterBenefit.findMany({
    where: {
      masterCardId: userCard.masterCardId,
      isActive: true,
      isDefault: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (masterBenefits.length === 0) {
    console.info(
      `[benefit-engine] No active benefits configured for masterCardId=${userCard.masterCardId}`
    );
    return { count: 0, benefits: [] };
  }

  // 2. Build UserBenefit data for each MasterBenefit
  const benefitSummaries: GeneratedBenefitSummary[] = [];
  const createData = masterBenefits.map((mb) => {
    const period = calculatePeriodForBenefit(
      mb.claimingCadence,
      mb.resetCadence,
      referenceDate,
      userCard.renewalDate,
      mb.claimingWindowEnd
    );

    // Resolve per-period amount: use variableAmounts override if present
    // (e.g., Amex Uber December $35 instead of default $15)
    const periodMonth = period.periodStart.getUTCMonth() + 1; // 1-indexed
    const effectiveAmount = mb.claimingAmount
      ? resolveClaimingAmount(
          mb.claimingAmount,
          mb.variableAmounts as Record<string, number> | null,
          periodMonth
        )
      : mb.stickerValue;

    benefitSummaries.push({
      name: mb.name,
      masterBenefitId: mb.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    });

    return {
      userCardId: userCard.id,
      playerId: playerId,
      masterBenefitId: mb.id,
      name: mb.name,
      type: mb.type,
      stickerValue: effectiveAmount,
      resetCadence: mb.resetCadence,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodStatus: 'ACTIVE',
      isUsed: false,
      timesUsed: 0,
      claimedAt: null,
      expirationDate: period.periodEnd, // backward compat with existing queries
      status: 'ACTIVE',
    };
  });

  // 3. Batch insert with skipDuplicates for idempotency
  //    The unique constraint (userCardId, name, periodStart) prevents duplicates
  const result = await tx.userBenefit.createMany({
    data: createData,
    skipDuplicates: true,
  });

  console.info(
    `[benefit-engine] Generated ${result.count} benefits for userCardId=${userCard.id}`
  );

  return {
    count: result.count,
    benefits: benefitSummaries,
  };
}

// ============================================================================
// Standalone Variant (for use outside transactions)
// ============================================================================

/**
 * Standalone version of generateBenefitsForCard that creates its own transaction.
 *
 * Use this when calling from contexts where a transaction is not already open
 * (e.g., a one-off admin action or backfill script). For the card-add API route,
 * prefer the transactional version above.
 *
 * @param userCardId - The UserCard ID
 * @param masterCardId - The MasterCard template ID
 * @param playerId - The player ID for ownership
 * @param referenceDate - When the card was added (defaults to now)
 * @param renewalDate - Card anniversary date (defaults to 1 year from now)
 * @returns Count of benefits created and summary of each
 */
export async function generateBenefitsForCardStandalone(
  userCardId: string,
  masterCardId: string,
  playerId: string,
  referenceDate: Date = new Date(),
  renewalDate: Date = new Date(
    Date.UTC(
      new Date().getUTCFullYear() + 1,
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    )
  )
): Promise<GenerateBenefitsResult> {
  return prisma.$transaction(async (tx) => {
    return generateBenefitsForCard(
      tx,
      { id: userCardId, masterCardId, renewalDate },
      playerId,
      referenceDate
    );
  });
}

// ============================================================================
// Cron Helper: Process Expired Benefits
// ============================================================================

/**
 * Processes a batch of expired UserBenefit rows for the cron rollover job.
 *
 * For each expired benefit:
 * 1. Marks the current row as EXPIRED
 * 2. Calculates the next period boundaries
 * 3. Creates a new UserBenefit row for the next period
 *
 * Designed to be called in chunks by the cron handler for batch processing.
 *
 * @param tx - Prisma transaction client
 * @param expiredBenefitIds - IDs of UserBenefits to expire
 * @param benefitDataMap - Map of benefit ID → data needed for next period calculation
 * @returns Count of expired and generated rows
 */
export interface ExpiredBenefitData {
  id: string;
  userCardId: string;
  playerId: string;
  masterBenefitId: string | null;
  name: string;
  type: string;
  stickerValue: number;
  resetCadence: string;
  periodEnd: Date;
  // From joined relations
  renewalDate: Date;
  cardIsOpen: boolean;
  cardStatus: string;
  masterBenefitIsActive: boolean | null;
  masterBenefitClaimingCadence: string | null;
  masterBenefitClaimingWindowEnd: string | null;
}
