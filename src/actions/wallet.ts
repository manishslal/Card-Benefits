'use server';

import { prisma } from '@/lib/prisma';
import { calcExpirationDate } from '@/lib/benefitDates';
import { getAuthUserIdOrThrow, verifyPlayerOwnership, AUTH_ERROR_CODES } from '@/lib/auth-server';
import { Prisma } from '@prisma/client';

// Full return type: the new UserCard with all cloned UserBenefits
type AddCardResult =
  | { success: true; userCard: Awaited<ReturnType<typeof createUserCardWithBenefits>> }
  | { success: false; error: string; code: string };

/**
 * Clones a MasterCard template into a player's wallet.
 *
 * AUTHORIZATION: Verifies the authenticated user owns the player before allowing
 * the card to be added. Returns a 403-equivalent error if ownership check fails.
 *
 * Steps:
 *  1. Get authenticated user ID from context.
 *  2. Verify user owns the player (ownership boundary check).
 *  3. Fetch MasterCard + all active MasterBenefit records.
 *  4. Create a UserCard linked to the player, inheriting defaultAnnualFee.
 *  5. Clone each MasterBenefit into a UserBenefit with computed expirationDate.
 *
 * All writes are wrapped in a single Prisma transaction so the wallet
 * is never left in a partial state.
 */
export async function addCardToWallet(
  playerId: string,
  masterCardId: string,
  renewalDate: Date
): Promise<AddCardResult> {
  // ── Authentication check ────────────────────────────────────────────────────
  let userId: string;
  try {
    userId = getAuthUserIdOrThrow();
  } catch (err) {
    return { success: false, error: 'Unauthorized', code: AUTH_ERROR_CODES.UNAUTHORIZED };
  }

  // ── Input validation ────────────────────────────────────────────────────────
  if (!playerId || !masterCardId) {
    return { success: false, error: 'Unauthorized', code: AUTH_ERROR_CODES.INVALID_INPUT };
  }
  if (!(renewalDate instanceof Date) || isNaN(renewalDate.getTime())) {
    return { success: false, error: 'Unauthorized', code: AUTH_ERROR_CODES.INVALID_INPUT };
  }

  try {
    // ── Authorization: Verify user owns the player ───────────────────────────
    const ownership = await verifyPlayerOwnership(playerId, userId);
    if (!ownership.isOwner) {
      return {
        success: false,
        error: 'Unauthorized',
        code: AUTH_ERROR_CODES.UNAUTHORIZED,
      };
    }

    const userCard = await createUserCardWithBenefits(playerId, masterCardId, renewalDate);
    return { success: true, userCard };
  } catch (err) {
    // Prisma unique constraint: player already has this card
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return {
        success: false,
        error: 'Unauthorized',
        code: AUTH_ERROR_CODES.UNAUTHORIZED
      };
    }
    // MasterCard not found
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return {
        success: false,
        error: 'Unauthorized',
        code: AUTH_ERROR_CODES.UNAUTHORIZED
      };
    }
    console.error('[addCardToWallet]', err);
    return {
      success: false,
      error: 'Unauthorized',
      code: AUTH_ERROR_CODES.UNAUTHORIZED
    };
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
