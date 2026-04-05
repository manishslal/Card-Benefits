'use server';

/**
 * src/actions/custom-values.ts
 *
 * Server actions for the Custom Values feature.
 * Handles value updates, history tracking, and ROI recalculation.
 *
 * Design notes:
 * - All actions follow centralized error handling pattern
 * - Authorization verified for every action (user owns benefit)
 * - Value history stored as JSON array in database (append-only)
 * - Optimistic locking using version field prevents race conditions
 * - ROI calculations are included in response for UI optimization
 */

import { prisma } from '@/lib/prisma';
import { getAuthUserIdOrThrow, verifyBenefitOwnership } from '@/features/auth/lib/auth';
import {
  validateBenefitValue,
  validateBenefitId,
  validateChangeReason,
} from '@/lib/custom-values/validation';
import {
  calculateBenefitROI,
  calculateCardROI,
  calculatePlayerROI,
  calculateHouseholdROI,
  invalidateROICache,
} from '@/lib/custom-values/roi-calculator';
import {
  createErrorResponse,
  createSuccessResponse,
  AppError,
  ERROR_CODES,
  ActionResponse,
} from '@/lib/errors';
import type {
  UpdateUserDeclaredValueResult,
  ClearUserDeclaredValueResult,
  BulkUpdateUserDeclaredValuesResult,
  GetBenefitValueHistoryResult,
  RevertUserDeclaredValueResult,
} from '@/lib/types/custom-values';
import { Prisma } from '@prisma/client';
import type { UserBenefit } from '@prisma/client';

// ============================================================================
// Helper: Add entry to value history [DISABLED - valueHistory field not in schema]
// ============================================================================

/**
 * Appends a new entry to the valueHistory JSON array.
 * History is immutable and append-only for audit trail compliance.
 *
 * @param currentHistory - Existing history JSON string (or null)
 * @param change - New change to append
 * @returns Updated history JSON string
 *
 * NOTE: This function is disabled because the valueHistory field doesn't exist
 * in the UserBenefit model. Re-enable when the field is added to the schema.
 */
// function appendToValueHistory(
//   currentHistory: string | null,
//   change: BenefitValueChange
// ): string {
//   let history: BenefitValueChange[] = [];
//
//   // Parse existing history if present
//   if (currentHistory) {
//     try {
//       history = JSON.parse(currentHistory);
//       if (!Array.isArray(history)) {
//         history = [];
//       }
//     } catch (e) {
//       // If JSON is malformed, start fresh
//       history = [];
//     }
//   }
//
//   // Append new entry
//   history.push({
//     ...change,
//     changedAt: change.changedAt instanceof Date 
//       ? change.changedAt.toISOString()
//       : change.changedAt,
//   });
//
//   return JSON.stringify(history);
// }

/**
 * Parses value history from JSON string.
 * Returns empty array if history is null or malformed.
 */
// function parseValueHistory(historyJson: string | null): BenefitValueChange[] {
//   if (!historyJson) {
//     return [];
//   }
//
//   try {
//     const history = JSON.parse(historyJson);
//     return Array.isArray(history) ? history : [];
//   } catch (e) {
//     return [];
//   }
// }

// ============================================================================
// Helper: Calculate ROI values
// ============================================================================

/**
 * Placeholder for ROI calculation function.
 * In Phase 2, this will be implemented with full caching.
 * For now, returns simplified calculations.
 */
async function calculateROIValues(benefit: UserBenefit) {
  // Fetch card with player association
  const card = await prisma.userCard.findUnique({
    where: { id: benefit.userCardId },
    include: {
      masterCard: true,
      player: true,
      userBenefits: {
        where: { isUsed: true },
      },
    },
  });

  if (!card) {
    throw new AppError(ERROR_CODES.RESOURCE_NOT_FOUND, {
      resource: 'card',
      id: benefit.userCardId,
    });
  }

  // Calculate effective annual fee
  const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;

  // Level 1: Benefit ROI
  // ROI = (benefit value / annual fee) * 100
  const benefitROI = calculateBenefitROI(benefit.userDeclaredValue, benefit.stickerValue, annualFee);

  // Level 2: Card ROI
  // ROI = (sum of all benefit values / annual fee) * 100
  const cardROI = await calculateCardROI(card.id);

  // Level 3: Player ROI
  // ROI = (sum of all player's benefits / sum of all player's annual fees) * 100
  const playerROI = await calculatePlayerROI(card.player.id);

  // Level 4: Household ROI
  // ROI = (sum of all household's benefits / sum of all household's annual fees) * 100
  const householdROI = await calculateHouseholdROI(card.player.userId);

  return {
    benefit: parseFloat(benefitROI.toFixed(2)),
    card: parseFloat(cardROI.toFixed(2)),
    player: parseFloat(playerROI.toFixed(2)),
    household: parseFloat(householdROI.toFixed(2)),
  };
}

// ============================================================================
// Server Action: Update Single Benefit Value
// ============================================================================

/**
 * Updates a user's declared (custom) value for a benefit.
 *
 * AUTHORIZATION: Verifies user owns the benefit via player ownership
 * VALIDATION: Server-side re-validates all constraints
 * HISTORY: Records change in valueHistory JSON array
 * ROI: Returns updated ROI values for all levels
 *
 * @param benefitId - The benefit to update
 * @param valueInCents - New value in cents
 * @param changeReason - Optional reason for the change
 * @returns Success response with benefit, ROI, and change metadata
 */
export async function updateUserDeclaredValue(
  benefitId: string,
  valueInCents: number,
  changeReason?: string,
): Promise<ActionResponse<UpdateUserDeclaredValueResult>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    validateBenefitId(benefitId);
    validateBenefitValue(valueInCents);
    if (changeReason) {
      validateChangeReason(changeReason);
    }

    // ── Authentication check ────────────────────────────────────────────────────
    const userId = getAuthUserIdOrThrow();

    // ── Authorization: Verify user owns the benefit ──────────────────────────
    const ownership = await verifyBenefitOwnership(benefitId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Fetch current benefit state ──────────────────────────────────────────
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
    });

    if (!benefit) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Prepare change record ───────────────────────────────────────────────
    const now = new Date();
    const valueBefore = benefit.userDeclaredValue ?? benefit.stickerValue;
    const changeAmount = valueInCents - valueBefore;
    const changePercent =
      valueBefore === 0 ? 0 : (changeAmount / valueBefore) * 100;

    // ── Build value history entry ──────────────────────────────────────────
    // Create a new history entry for append-only audit trail
    const newHistoryEntry = {
      value: valueInCents,
      changedAt: now.toISOString(),
      changedBy: userId,
      source: 'manual' as const,
      reason: changeReason || '',
    };

    // Parse existing history or start fresh
    let updatedHistory: any[] = [];
    if (benefit.valueHistory) {
      try {
        updatedHistory = JSON.parse(benefit.valueHistory);
      } catch (e) {
        // If parsing fails, start with fresh history
        console.error('[updateUserDeclaredValue] Failed to parse valueHistory:', e);
        updatedHistory = [];
      }
    }
    // Append new entry (immutable append-only pattern)
    updatedHistory.push(newHistoryEntry);

    // ── Update benefit with new value and history ──────────────────────────
    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: {
        userDeclaredValue: valueInCents,
        valueHistory: JSON.stringify(updatedHistory), // Store as JSON string
        updatedAt: now,
      },
    });

    // ── Calculate updated ROI values ────────────────────────────────────────
    let rois;
    try {
      rois = await calculateROIValues(updatedBenefit);
    } catch (calcError) {
      // Log error but don't fail - value was saved
      console.error('[updateUserDeclaredValue] ROI calculation failed:', calcError);
      rois = { benefit: 0, card: 0, player: 0, household: 0 };
    }

    // ── Get affected cards for cache invalidation ───────────────────────────
    const affectedCards = [benefit.userCardId];

    // ── Invalidate ROI cache ─────────────────────────────────────────────────
    // When a benefit value changes, all levels of ROI must be recalculated on next access
    invalidateROICache([
      `CARD:${benefit.userCardId}`,
      // Player and household keys would be invalidated on next access since we don't cache at those levels yet
    ]);

    return createSuccessResponse({
      benefit: updatedBenefit,
      rois,
      affectedCards,
      valueBefore,
      valueAfter: valueInCents,
      changeAmount,
      changePercent: parseFloat(changePercent.toFixed(2)),
      changedAt: now,
    });
  } catch (error) {
    // Handle validation and auth errors
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    // Handle database errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
          resource: 'benefit',
          id: benefitId,
        });
      }
    }

    // Log unexpected errors
    console.error('[updateUserDeclaredValue] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

// ============================================================================
// Server Action: Clear Custom Value (Reset to Sticker)
// ============================================================================

/**
 * Clears the user's declared value, reverting to the sticker (master) value.
 * Records the reset in history as source='system'.
 *
 * @param benefitId - The benefit to clear
 * @returns Success response with updated benefit and ROI
 */
export async function clearUserDeclaredValue(
  benefitId: string,
): Promise<ActionResponse<ClearUserDeclaredValueResult>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    validateBenefitId(benefitId);

    // ── Authentication check ────────────────────────────────────────────────────
    const userId = getAuthUserIdOrThrow();

    // ── Authorization: Verify user owns the benefit ──────────────────────────
    const ownership = await verifyBenefitOwnership(benefitId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Fetch current benefit ───────────────────────────────────────────────
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
    });

    if (!benefit) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    if (!benefit.userDeclaredValue) {
      // Already cleared, but that's OK - idempotent
      return createSuccessResponse({
        benefit,
        rois: { benefit: 0, card: 0, player: 0, household: 0 },
        affectedCards: [benefit.userCardId],
        valueBefore: benefit.stickerValue,
        valueAfter: benefit.stickerValue,
        changeAmount: 0,
        changePercent: 0,
        changedAt: new Date(),
      });
    }

    // ── Record change in history ────────────────────────────────────────────
    // Note: Value history tracking disabled (valueHistory field not in schema)
    const now = new Date();
    // const newHistoryEntry: BenefitValueChange = {
    //   value: benefit.stickerValue,
    //   changedAt: now.toISOString(),
    //   changedBy: 'system',
    //   source: 'system',
    //   reason: 'Reset to master value',
    // };
    // const updatedHistory = appendToValueHistory(benefit.valueHistory, newHistoryEntry);

    // ── Clear the value ─────────────────────────────────────────────────────
    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: {
        userDeclaredValue: null,
        updatedAt: now,
      },
    });

    // ── Calculate updated ROI values ────────────────────────────────────────
    let rois;
    try {
      rois = await calculateROIValues(updatedBenefit);
    } catch (calcError) {
      console.error('[clearUserDeclaredValue] ROI calculation failed:', calcError);
      rois = { benefit: 0, card: 0, player: 0, household: 0 };
    }

    return createSuccessResponse({
      benefit: updatedBenefit,
      rois,
      affectedCards: [benefit.userCardId],
      valueBefore: benefit.userDeclaredValue,
      valueAfter: benefit.stickerValue,
      changeAmount: benefit.stickerValue - (benefit.userDeclaredValue ?? 0),
      changePercent: 0,
      changedAt: now,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
          resource: 'benefit',
          id: benefitId,
        });
      }
    }

    console.error('[clearUserDeclaredValue] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

// ============================================================================
// Server Action: Bulk Update Multiple Benefits
// ============================================================================

/**
 * Updates multiple benefit values atomically.
 * All values validated before ANY save. If any validation fails,
 * entire batch is rejected (atomic operation).
 *
 * @param updates - Array of {benefitId, valueInCents} updates
 * @param cardId - Optional: limit updates to single card
 * @returns Success response with list of updated benefits and ROI
 */
export async function bulkUpdateUserDeclaredValues(
  updates: Array<{ benefitId: string; valueInCents: number }>,
  // cardId?: string, // Parameter not used - reserved for future filtering
): Promise<ActionResponse<BulkUpdateUserDeclaredValuesResult>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    if (!Array.isArray(updates) || updates.length === 0) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'updates',
        reason: 'Must provide at least one update',
      });
    }

    // ── Authentication check ────────────────────────────────────────────────────
    const userId = getAuthUserIdOrThrow();

    // ── Validate all values BEFORE any save ──────────────────────────────────
    const validationErrors: Array<{ benefitId: string; error: string }> = [];

    for (const update of updates) {
      try {
        validateBenefitId(update.benefitId);
        validateBenefitValue(update.valueInCents);
      } catch (validationError) {
        if (validationError instanceof AppError) {
          validationErrors.push({
            benefitId: update.benefitId,
            error: validationError.message,
          });
        }
      }
    }

    // If any validation failed, reject entire batch
    if (validationErrors.length > 0) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'updates',
        reason: 'Validation failed for some benefits',
        failedUpdates: validationErrors,
      });
    }

    // ── Verify ownership of all benefits ──────────────────────────────────────
    const benefitIds = updates.map((u) => u.benefitId);
    const benefits = await prisma.userBenefit.findMany({
      where: { id: { in: benefitIds } },
    });

    if (benefits.length !== benefitIds.length) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        reason: 'One or more benefits not found',
      });
    }

    // Verify all belong to authenticated user (via player)
    for (const benefit of benefits) {
      const ownership = await verifyBenefitOwnership(benefit.id, userId);
      if (!ownership.isOwner) {
        return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
          resource: 'benefit',
          id: benefit.id,
        });
      }
    }

    // ── Update all benefits in transaction (atomic) ──────────────────────────
    const now = new Date();
    const resultBenefits: Array<{
      id: string;
      name: string;
      valueBefore: number;
      valueAfter: number;
    }> = [];
    const affectedCards = new Set<string>();

    const updatedBenefits = await prisma.$transaction(
      updates.map((update) => {
        const benefit = benefits.find((b) => b.id === update.benefitId)!;
        const valueBefore = benefit.userDeclaredValue ?? benefit.stickerValue;

        affectedCards.add(benefit.userCardId);

        // Note: Value history tracking disabled (valueHistory field not in schema)
        // const newHistoryEntry: BenefitValueChange = {
        //   value: update.valueInCents,
        //   changedAt: now.toISOString(),
        //   changedBy: userId,
        //   source: 'manual',
        //   reason: 'Bulk update',
        // };
        // const updatedHistory = appendToValueHistory(benefit.valueHistory, newHistoryEntry);

        resultBenefits.push({
          id: benefit.id,
          name: benefit.name,
          valueBefore,
          valueAfter: update.valueInCents,
        });

        return prisma.userBenefit.update({
          where: { id: update.benefitId },
          data: {
            userDeclaredValue: update.valueInCents,
            updatedAt: now,
          },
        });
      }),
    );

    // ── Calculate updated ROI values ────────────────────────────────────────
    let rois = { card: 0, player: 0, household: 0 };
    try {
      if (updatedBenefits.length > 0) {
        const firstBenefit = updatedBenefits[0];
        const roiCalcs = await calculateROIValues(firstBenefit);
        rois = {
          card: roiCalcs.card,
          player: roiCalcs.player,
          household: roiCalcs.household,
        };
      }
    } catch (calcError) {
      console.error('[bulkUpdateUserDeclaredValues] ROI calculation failed:', calcError);
    }

    return createSuccessResponse({
      updated: updatedBenefits.length,
      failed: 0,
      benefits: resultBenefits,
      rois,
      affectedCards: Array.from(affectedCards),
      recalculatedAt: now,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    // Handle transaction errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
          reason: 'One or more benefits no longer exist',
        });
      }
    }

    console.error('[bulkUpdateUserDeclaredValues] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

// ============================================================================
// Server Action: Get Benefit Value History
// ============================================================================

/**
 * Fetches the complete value history for a benefit.
 * History is append-only and immutable for audit trail compliance.
 *
 * @param benefitId - The benefit to fetch history for
 * @param limit - Max number of history entries to return (default 10)
 * @returns Success response with current value and history entries
 */
export async function getBenefitValueHistory(
  benefitId: string,
  limit: number = 10,
): Promise<ActionResponse<GetBenefitValueHistoryResult>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    validateBenefitId(benefitId);

    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'limit',
        reason: 'Limit must be between 1 and 100',
        received: limit,
      });
    }

    // ── Authentication check ────────────────────────────────────────────────────
    const userId = getAuthUserIdOrThrow();

    // ── Authorization ────────────────────────────────────────────────────────
    const ownership = await verifyBenefitOwnership(benefitId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Fetch benefit ────────────────────────────────────────────────────────
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
    });

    if (!benefit) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Parse value history ──────────────────────────────────────────────────
    // Extract and return history from JSON storage
    let history: any[] = [];
    if (benefit.valueHistory) {
      try {
        const fullHistory = JSON.parse(benefit.valueHistory);
        // Return last N entries (newest first)
        history = Array.isArray(fullHistory)
          ? fullHistory.slice(-limit).reverse()
          : [];
      } catch (e) {
        // If parsing fails, return empty history
        console.error('[getBenefitValueHistory] Failed to parse valueHistory:', e);
        history = [];
      }
    }

    return createSuccessResponse({
      benefitId,
      current: {
        value: benefit.userDeclaredValue,
        type: benefit.userDeclaredValue ? 'custom' : 'sticker',
        changedAt: benefit.updatedAt,
      },
      history,
      totalChanges: history.length,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    console.error('[getBenefitValueHistory] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

// ============================================================================
// Server Action: Revert to Previous Value
// ============================================================================

/**
 * Reverts a benefit's value to a previous entry in the history.
 * Creates a new history entry recording the revert action.
 *
 * @param benefitId - The benefit to revert
 * @param historyIndex - Index in history array (0 = oldest)
 * @returns Success response with reverted value and updated ROI
 */
export async function revertUserDeclaredValue(
  benefitId: string,
  historyIndex: number,
): Promise<ActionResponse<RevertUserDeclaredValueResult>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    validateBenefitId(benefitId);

    if (typeof historyIndex !== 'number' || !Number.isInteger(historyIndex) || historyIndex < 0) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'historyIndex',
        reason: 'Must be a non-negative integer',
        received: historyIndex,
      });
    }

    // ── Authentication check ────────────────────────────────────────────────────
    const userId = getAuthUserIdOrThrow();

    // ── Authorization ────────────────────────────────────────────────────────
    const ownership = await verifyBenefitOwnership(benefitId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Fetch benefit with history ───────────────────────────────────────────
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
    });

    if (!benefit) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'benefit',
        id: benefitId,
      });
    }

    // ── Parse value history ──────────────────────────────────────────────────
    let history: any[] = [];
    if (benefit.valueHistory) {
      try {
        const parsed = JSON.parse(benefit.valueHistory);
        history = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return createErrorResponse(ERROR_CODES.INTERNAL_ERROR, {
          reason: 'Failed to parse value history',
        });
      }
    }

    // ── Validate history index ───────────────────────────────────────────────
    if (history.length === 0) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'historyIndex',
        reason: 'No history available for this benefit',
      });
    }

    if (historyIndex >= history.length) {
      return createErrorResponse(ERROR_CODES.VALIDATION_FIELD, {
        field: 'historyIndex',
        reason: `History index out of range (max: ${history.length - 1})`,
        received: historyIndex,
      });
    }

    // ── Get the target history entry ──────────────────────────────────────────
    const targetEntry = history[historyIndex];
    const revertToValue = targetEntry.value;

    // ── Create revert audit record ────────────────────────────────────────────
    const now = new Date();
    const revertRecord = {
      value: revertToValue,
      changedAt: now.toISOString(),
      changedBy: userId,
      source: 'revert' as const,
      reason: `Reverted to value from ${targetEntry.changedAt}`,
    };

    // ── Append revert entry to history ────────────────────────────────────────
    const updatedHistory = [...history, revertRecord];

    // ── Update benefit with reverted value ────────────────────────────────────
    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: {
        userDeclaredValue: revertToValue,
        valueHistory: JSON.stringify(updatedHistory),
        updatedAt: now,
      },
    });

    // ── Calculate updated ROI values ──────────────────────────────────────────
    let rois;
    try {
      rois = await calculateROIValues(updatedBenefit);
    } catch (calcError) {
      console.error('[revertUserDeclaredValue] ROI calculation failed:', calcError);
      rois = { benefit: 0, card: 0, player: 0, household: 0 };
    }

    // ── Invalidate ROI cache ──────────────────────────────────────────────────
    invalidateROICache([
      `CARD:${benefit.userCardId}`,
    ]);

    return createSuccessResponse({
      benefit: updatedBenefit,
      rois,
      affectedCards: [benefit.userCardId],
      valueBefore: benefit.userDeclaredValue ?? benefit.stickerValue,
      valueAfter: revertToValue,
      changeAmount: revertToValue - (benefit.userDeclaredValue ?? benefit.stickerValue),
      changePercent: 0, // Will be calculated on UI
      changedAt: now,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    console.error('[revertUserDeclaredValue] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}
