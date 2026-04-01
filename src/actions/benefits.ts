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
 */

import { prisma } from '@/lib/prisma';
import type { UserBenefit } from '@prisma/client';

// ---------------------------------------------------------------------------
// Shared return type
// ---------------------------------------------------------------------------

type BenefitActionResult =
  | { success: true; benefit: UserBenefit }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// toggleBenefit
// ---------------------------------------------------------------------------

/**
 * Marks a benefit as used (claimed) or reverts it to unclaimed.
 *
 * Claiming:  sets isUsed=true, stamps claimedAt, increments timesUsed.
 * Unclaiming: sets isUsed=false, clears claimedAt. timesUsed is left intact
 *             because it records historical usage across reset cycles.
 *
 * @param benefitId    - The `UserBenefit.id` to update.
 * @param currentIsUsed - The current `isUsed` value on the client; used to
 *                        determine which branch of the update to apply.
 */
export async function toggleBenefit(
  benefitId: string,
  currentIsUsed: boolean,
): Promise<BenefitActionResult> {
  if (!benefitId) {
    return { success: false, error: 'benefitId is required.' };
  }

  try {
    const benefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: currentIsUsed === false
        // Marking as used: record the claim timestamp and bump the counter.
        ? { isUsed: true, claimedAt: new Date(), timesUsed: { increment: 1 } }
        // Unclaiming: clear the used flag and timestamp only.
        // timesUsed is purposely left unchanged (historical record).
        : { isUsed: false, claimedAt: null },
    });

    return { success: true, benefit };
  } catch (err) {
    console.error('[toggleBenefit] Prisma error:', err);
    return { success: false, error: 'Failed to update benefit status. Please try again.' };
  }
}

// ---------------------------------------------------------------------------
// updateUserDeclaredValue
// ---------------------------------------------------------------------------

/**
 * Persists the user's personal valuation override for a benefit.
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
  if (!benefitId) {
    return { success: false, error: 'benefitId is required.' };
  }

  // Guard against floating-point or out-of-range values. All monetary values
  // in this app are stored as integer cents.
  if (!Number.isSafeInteger(valueInCents) || valueInCents < 0) {
    return {
      success: false,
      error: 'valueInCents must be a non-negative integer (e.g. 800 for $8.00).',
    };
  }

  try {
    const benefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: { userDeclaredValue: valueInCents },
    });

    return { success: true, benefit };
  } catch (err) {
    console.error('[updateUserDeclaredValue] Prisma error:', err);
    return { success: false, error: 'Failed to update benefit value. Please try again.' };
  }
}
