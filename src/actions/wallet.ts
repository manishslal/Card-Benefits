'use server';

import { prisma } from '@/shared/lib';
import { calcExpirationDate } from '@/features/benefits/lib';
import { getAuthUserIdOrThrow, verifyPlayerOwnership } from '@/features/auth/lib/auth';
import {
  validateUUID,
  validateDate,
} from '@/shared/lib';
import {
  createErrorResponse,
  createSuccessResponse,
  AppError,
  ERROR_CODES,
  ActionResponse,
} from '@/shared/lib';
import { Prisma } from '@prisma/client';
import type { UserCard } from '@prisma/client';

/**
 * Clones a MasterCard template into a player's wallet.
 *
 * AUTHORIZATION: Verifies the authenticated user owns the player before allowing
 * the card to be added. Returns a 403-equivalent error if ownership check fails.
 *
 * Steps:
 *  1. Validate input parameters (UUIDs, dates)
 *  2. Get authenticated user ID from context
 *  3. Verify user owns the player (ownership boundary check)
 *  4. Fetch MasterCard + all active MasterBenefit records
 *  5. Create a UserCard linked to the player, inheriting defaultAnnualFee
 *  6. Clone each MasterBenefit into a UserBenefit with computed expirationDate
 *
 * All writes are wrapped in a single Prisma transaction so the wallet
 * is never left in a partial state.
 *
 * @param playerId - UUID of the player who will own the card
 * @param masterCardId - UUID of the MasterCard template to clone
 * @param renewalDate - Date when the card renews (used to calculate benefit expiration)
 * @returns Success response with the created UserCard and cloned benefits, or error response
 */
export async function addCardToWallet(
  playerId: string,
  masterCardId: string,
  renewalDate: Date
): Promise<ActionResponse<UserCard>> {
  try {
    // ── Input validation ────────────────────────────────────────────────────────
    // Validate UUIDs first (will throw AppError if invalid)
    validateUUID(playerId, 'playerId');
    validateUUID(masterCardId, 'masterCardId');

    // Validate renewal date (must be a valid Date in the future)
    validateDate(renewalDate, 'renewalDate', {
      minDate: new Date(),
    });

    // ── Authentication check ────────────────────────────────────────────────────
    // getAuthUserIdOrThrow throws AppError if no session
    const userId = getAuthUserIdOrThrow();

    // ── Authorization: Verify user owns the player ───────────────────────────
    const ownership = await verifyPlayerOwnership(playerId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
        resource: 'player',
        id: playerId,
      });
    }

    // ── Create card and clone benefits atomically ───────────────────────────
    const userCard = await createUserCardWithBenefits(playerId, masterCardId, renewalDate);

    return createSuccessResponse(userCard);
  } catch (error) {
    // Handle validation and auth errors
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }

    // Handle database errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found (MasterCard doesn't exist)
        return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
          resource: 'masterCard',
          id: masterCardId,
        });
      }
      if (error.code === 'P2002') {
        // Unique constraint violation (player already has this card)
        return createErrorResponse(ERROR_CODES.CONFLICT_DUPLICATE, {
          resource: 'userCard',
          message: 'Player already has this card',
        });
      }
    }

    // Log unexpected errors server-side for debugging
    console.error('[addCardToWallet] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

// ── Internal transaction helper ───────────────────────────────────────────────

async function createUserCardWithBenefits(
  playerId: string,
  masterCardId: string,
  renewalDate: Date
) {
  // 1. Fetch the template (throws P2025 if not found via findUniqueOrThrow)
  const masterCard = await prisma.masterCard.findUniqueOrThrow({
    where: { id: masterCardId },
    include: {
      masterBenefits: {
        where: { isActive: true }, // skip soft-deleted benefits
      },
    },
  });

  // 2 & 3. Create UserCard + all UserBenefits atomically
  return prisma.$transaction(async (tx) => {
    const userCard = await tx.userCard.create({
      data: {
        playerId,
        masterCardId,
        // Inherit the template's annual fee as the actual fee
        actualAnnualFee: masterCard.defaultAnnualFee,
        renewalDate,
      },
    });

    // Clone each active MasterBenefit
    const benefitData = masterCard.masterBenefits.map((mb) => ({
      userCardId: userCard.id,
      playerId,                         // denormalized FK
      name: mb.name,
      type: mb.type,
      stickerValue: mb.stickerValue,
      resetCadence: mb.resetCadence,
      expirationDate: calcExpirationDate(mb.resetCadence, renewalDate),
    }));

    await tx.userBenefit.createMany({ data: benefitData });

    // Return the card with its freshly-created benefits
    return tx.userCard.findUniqueOrThrow({
      where: { id: userCard.id },
      include: { userBenefits: true, masterCard: true },
    });
  });
}
