'use server';

/**
 * benefits.ts — Server Actions for individual benefit management.
 *
 * Design notes:
 * - Both actions return a discriminated union so callers can branch on
 *   `success` without try/catch on the client side.
 * - `toggleBenefit` intentionally does NOT decrement `timesUsed` when
 *   unclaiming — that field is a historical counter, not a live toggle.
 * - Validation lives here (not in the client) so it can't be bypassed.
 * - AUTHORIZATION: Both actions verify user ownership before mutations.
 */

import { prisma } from '@/lib/prisma';
import { getAuthUserIdOrThrow, verifyBenefitOwnership, AUTH_ERROR_CODES } from '@/lib/auth-server';
import { Prisma } from '@prisma/client';
import type { UserBenefit } from '@prisma/client';

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

type BenefitActionResult =
  | { success: true; benefit: UserBenefit }
  | { success: false; error: string; code?: string };

// ---------------------------------------------------------------------------
// toggleBenefit
// ---------------------------------------------------------------------------

/**
 * Marks a benefit as used (claimed) or reverts it to unclaimed.
 *
 * AUTHORIZATION: Verifies the authenticated user owns the benefit (via player ownership)
 * before allowing the toggle. Returns a 403-equivalent error if ownership check fails.
 *
 * RACE CONDITION HANDLING: Uses conditional update (isUsed must match currentIsUsed)
 * to prevent issues when multiple clients attempt to toggle simultaneously. If the
 * benefit state changes between client load and submit, returns ALREADY_CLAIMED error.
 *
 * Claiming:  sets isUsed=true, stamps claimedAt, increments timesUsed.
 * Unclaiming: sets isUsed=false, clears claimedAt. timesUsed is left intact
 *             because it records historical usage across reset cycles.
 *
 * @param benefitId    - The `UserBenefit.id` to update.
 * @param currentIsUsed - The current `isUsed` value on the client; used for
 *                        conditional update (race condition detection) and
 *                        to determine which branch of the update to apply.
 */
export async function toggleBenefit(
  benefitId: string,
  currentIsUsed: boolean,
): Promise<BenefitActionResult> {
  // ── Authentication check ────────────────────────────────────────────────────
  let userId: string;
  try {
    userId = getAuthUserIdOrThrow();
  } catch (err) {
    return { success: false, error: 'Unauthorized', code: AUTH_ERROR_CODES.UNAUTHORIZED };
  }

  // ── Input validation ────────────────────────────────────────────────────────
  if (!benefitId) {
    return { success: false, error: 'Unauthorized', code: AUTH_ERROR_CODES.INVALID_INPUT };
  }

  try {
    // ── Authorization: Verify user owns the benefit ──────────────────────────
    const ownership = await verifyBenefitOwnership(benefitId, userId);
    if (!ownership.isOwner) {
      return {
        success: false,
        error: 'Unauthorized',
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
      };
    }

    // ── Mutation with race condition prevention ──────────────────────────────
    // Use conditional update: only update if current state matches client's expectation
    const benefit = await prisma.userBenefit.update({
      where: {
        id: benefitId,
        isUsed: currentIsUsed,  // Race condition guard: only update if state matches
      },
      data: currentIsUsed === false
        // Marking as used: record the claim timestamp and bump the counter.
        ? { isUsed: true, claimedAt: new Date(), timesUsed: { increment: 1 } }
        // Unclaiming: clear the used flag and timestamp only.
        // timesUsed is purposely left unchanged (historical record).
        : { isUsed: false, claimedAt: null },
    });

    return { success: true, benefit };
  } catch (err) {
    // Prisma P2025 indicates conditional update failed (state mismatch)
    // This means another client toggled the benefit concurrently
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return {
        success: false,
        error: 'Unauthorized',
        code: AUTH_ERROR_CODES.ALREADY_CLAIMED,
      };
    }

    console.error('[toggleBenefit] Prisma error:', err);
    return {
      success: false,
      error: 'Unauthorized',
      code: AUTH_ERROR_CODES.UNAUTHORIZED
    };
  }
}

// ---------------------------------------------------------------------------
// updateUserDeclaredValue
// ---------------------------------------------------------------------------

/**
 * Persists the user's personal valuation override for a benefit.
 *
 * AUTHORIZATION: Verifies the authenticated user owns the benefit (via player ownership)
 * before allowing the update. Returns a 403-equivalent error if ownership check fails.
 *
 * Allows users to express that a benefit is worth more or less than its
 * advertised sticker value (e.g. "$10 Uber Cash is only worth $8 to me").
 * This value is used in ROI calculations in place of `stickerValue`.
 *
 * @param benefitId    - The `UserBenefit.id` to update.
 * @param valueInCents - The user's declared value in cents. Must be a
 *                       non-negative safe integer (e.g. 800 = $8.00).
 */
export async function updateUserDeclaredValue(
  benefitId: string,
  valueInCents: number,
): Promise<BenefitActionResult> {
  // ── Authentication check ────────────────────────────────────────────────────
  let userId: string;
  try {
    userId = getAuthUserIdOrThrow();
  } catch (err) {
    return { success: false, error: 'Unauthorized', code: AUTH_ERROR_CODES.UNAUTHORIZED };
  }

  // ── Input validation ────────────────────────────────────────────────────────
  if (!benefitId) {
    return { success: false, error: 'Unauthorized', code: AUTH_ERROR_CODES.INVALID_INPUT };
  }

  // Guard against floating-point or out-of-range values. All monetary values
  // in this app are stored as integer cents.
  if (!Number.isSafeInteger(valueInCents) || valueInCents < 0) {
    return {
      success: false,
      error: 'Unauthorized',
      code: AUTH_ERROR_CODES.INVALID_INPUT
    };
  }

  try {
    // ── Authorization: Verify user owns the benefit ──────────────────────────
    const ownership = await verifyBenefitOwnership(benefitId, userId);
    if (!ownership.isOwner) {
      return {
        success: false,
        error: 'Unauthorized',
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
      };
    }

    const benefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: { userDeclaredValue: valueInCents },
    });

    return { success: true, benefit };
  } catch (err) {
    console.error('[updateUserDeclaredValue] Prisma error:', err);
    return {
      success: false,
      error: 'Unauthorized',
      code: AUTH_ERROR_CODES.UNAUTHORIZED
    };
  }
}
