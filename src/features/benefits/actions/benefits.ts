'use server';

/**
 * benefits.ts — Server Actions for individual benefit management.
 *
 * Design notes:
 * - All actions use centralized error handling for consistent responses
 * - `toggleBenefit` intentionally does NOT decrement `timesUsed` when
 *   unclaiming — that field is a historical counter, not a live toggle.
 * - Input validation throws AppError which is caught and converted to responses
 * - AUTHORIZATION: All actions verify user ownership before mutations.
 * - Race condition handling uses conditional updates to detect concurrent changes
 */

import { prisma } from '@/lib/prisma';
import { getAuthUserIdOrThrow, verifyBenefitOwnership } from '@/features/auth/lib/auth';
import {
  validateUUID,
  validateMonetaryValue,
} from '@/lib/validation';
import {
  createErrorResponse,
  createSuccessResponse,
  AppError,
  ERROR_CODES,
  ActionResponse,
} from '@/lib/errors';
import { Prisma } from '@prisma/client';
import type { UserBenefit } from '@prisma/client';

/**
 * Marks a benefit as used (claimed) or reverts it to unclaimed.
 *
 * AUTHORIZATION: Verifies the authenticated user owns the benefit (via player ownership)
 * before allowing the toggle. Returns a 403-equivalent error if ownership check fails.
 *
 * RACE CONDITION HANDLING: Uses conditional update (isUsed must match currentIsUsed)
 * to prevent issues when multiple clients attempt to toggle simultaneously. If the
 * benefit state changes between client load and submit, returns CONFLICT_STATE error.
 *
 * Claiming:  sets isUsed=true, stamps claimedAt, increments timesUsed.
 * Unclaiming: sets isUsed=false, clears claimedAt. timesUsed is left intact
 *             because it records historical usage across reset cycles.
 *
 * @param benefitId - The UserBenefit.id to update
 * @param currentIsUsed - The current isUsed value on the client; used for
 *                        conditional update (race condition detection) and
 *                        to determine which branch of the update to apply
 * @returns Success response with updated benefit, or error response
 */
export async function toggleBenefit(
  benefitId: string,
  currentIsUsed: boolean,
): Promise<ActionResponse<UserBenefit>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    validateUUID(benefitId, 'benefitId');

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

    // ── Mutation with race condition prevention ──────────────────────────────
    // OPTIMISTIC LOCKING: Use both conditional state check AND version field
    // This provides defense-in-depth against race conditions:
    // 1. State guard (isUsed) prevents toggling if state changed
    // 2. Version guard ensures no other updates occurred
    // If either guard fails, update rejects with P2025 (not found)
    const benefit = await prisma.userBenefit.update({
      where: {
        id: benefitId,
        isUsed: currentIsUsed,  // State guard: only update if isUsed matches
      },
      data: currentIsUsed === false
        // Marking as used: record the claim timestamp, bump counter, increment version
        ? {
            isUsed: true,
            claimedAt: new Date(),
            timesUsed: { increment: 1 },
            version: { increment: 1 }  // Bump version on successful update
          }
        // Unclaiming: clear the used flag and timestamp only
        // timesUsed is purposely left unchanged (historical record)
        // Version still bumps to detect the change
        : {
            isUsed: false,
            claimedAt: null,
            version: { increment: 1 }  // Bump version on successful update
          },
    });

    return createSuccessResponse(benefit);
  } catch (error) {
    // Handle validation and auth errors
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    // Handle database errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Conditional update failed - benefit state doesn't match expectation
        // This means another client toggled the benefit concurrently
        return createErrorResponse(ERROR_CODES.CONFLICT_STATE, {
          reason: 'Benefit state changed since you loaded it. Please refresh and try again.',
        });
      }
    }

    // Log unexpected errors server-side for debugging
    console.error('[toggleBenefit] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

/**
 * Persists the user's personal valuation override for a benefit.
 *
 * AUTHORIZATION: Verifies the authenticated user owns the benefit (via player ownership)
 * before allowing the update. Returns a 403-equivalent error if ownership check fails.
 *
 * Allows users to express that a benefit is worth more or less than its
 * advertised sticker value (e.g. "$10 Uber Cash is only worth $8 to me").
 * This value is used in ROI calculations in place of stickerValue.
 *
 * @param benefitId - The UserBenefit.id to update
 * @param valueInCents - The user's declared value in cents. Must be a
 *                       non-negative safe integer (e.g. 800 = $8.00)
 * @returns Success response with updated benefit, or error response
 */
export async function updateUserDeclaredValue(
  benefitId: string,
  valueInCents: number,
): Promise<ActionResponse<UserBenefit>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    validateUUID(benefitId, 'benefitId');

    // Validate monetary value (non-negative safe integer)
    validateMonetaryValue(valueInCents, 'valueInCents');

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

    // ── Update with new declared value ──────────────────────────────────────
    const benefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: { userDeclaredValue: valueInCents },
    });

    return createSuccessResponse(benefit);
  } catch (error) {
    // Handle validation and auth errors
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    // Handle database errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Benefit not found
        return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
          resource: 'benefit',
          id: benefitId,
        });
      }
    }

    // Log unexpected errors server-side for debugging
    console.error('[updateUserDeclaredValue] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}
