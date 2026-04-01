'use server';

import { prisma } from '@/lib/prisma';
import { calcExpirationDate } from '@/lib/benefitDates';
import { Prisma } from '@prisma/client';

// Full return type: the new UserCard with all cloned UserBenefits
type AddCardResult =
  | { success: true; userCard: Awaited<ReturnType<typeof createUserCardWithBenefits>> }
  | { success: false; error: string };

/**
 * Clones a MasterCard template into a player's wallet.
 *
 * Steps:
 *  1. Fetch MasterCard + all active MasterBenefit records.
 *  2. Create a UserCard linked to the player, inheriting defaultAnnualFee.
 *  3. Clone each MasterBenefit into a UserBenefit with computed expirationDate.
 *
 * All three writes are wrapped in a single Prisma transaction so the wallet
 * is never left in a partial state.
 */
export async function addCardToWallet(
  playerId: string,
  masterCardId: string,
  renewalDate: Date
): Promise<AddCardResult> {
  // ── Input validation ────────────────────────────────────────────────────────
  if (!playerId || !masterCardId) {
    return { success: false, error: 'playerId and masterCardId are required.' };
  }
  if (!(renewalDate instanceof Date) || isNaN(renewalDate.getTime())) {
    return { success: false, error: 'renewalDate must be a valid Date.' };
  }

  try {
    const userCard = await createUserCardWithBenefits(playerId, masterCardId, renewalDate);
    return { success: true, userCard };
  } catch (err) {
    // Prisma unique constraint: player already has this card
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return { success: false, error: 'This card is already in the player\'s wallet.' };
    }
    // MasterCard not found
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return { success: false, error: 'MasterCard not found.' };
    }
    console.error('[addCardToWallet]', err);
    return { success: false, error: 'An unexpected error occurred.' };
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
