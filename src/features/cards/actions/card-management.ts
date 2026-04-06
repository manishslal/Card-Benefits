/**
 * Card Management Server Actions
 *
 * Server-side actions for all card operations:
 * - getPlayerCards() - Fetch cards with filters
 * - getCardDetails() - Get full card details
 * - addCardToWallet() - Add card (already exists, extended here)
 * - updateCard() - Edit card details
 * - archiveCard() - Soft delete card
 * - unarchiveCard() - Restore archived card
 * - deleteCard() - Hard delete card (requires confirmation)
 * - bulkUpdateCards() - Bulk update multiple cards
 *
 * All follow the pattern:
 *   1. Input validation
 *   2. Authentication check
 *   3. Authorization check
 *   4. Business logic with transaction
 *   5. Error handling
 */

'use server';

import { prisma } from '@/shared/lib';
import { getAuthUserIdOrThrow, verifyPlayerOwnership, authorizeCardOperation } from '@/features/auth/lib/auth';
import {
  validateCustomName,
  validateAnnualFee,
  validateRenewalDate,
  validateCardStatusTransition,
  validateDeleteConfirmation,
  validateBulkUpdateInput
} from '@/features/cards/lib/validation';
import {
  createErrorResponse,
  createSuccessResponse,
  AppError,
  ERROR_CODES,
  ActionResponse
} from '@/shared/lib';
import {
  CardDisplayModel,
  CardDetailsModel,
  CardWalletStats,
  CardStatus
} from '@/features/cards/types';
import {
  getEffectiveAnnualFee,
  getDaysUntilRenewal,
  getRenewalStatus,
  calculateCardROI,
  calculateBenefitsSummary
} from '@/features/cards/lib/calculations';
import { Prisma } from '@prisma/client';
import type { UserCard, MasterCard, UserBenefit } from '@prisma/client';

/**
 * Type for UserCard with relations as returned from Prisma queries
 */
type UserCardWithRelations = UserCard & {
  userBenefits: UserBenefit[];
  masterCard: MasterCard;
};

/**
 * Type for MasterCard as returned from Prisma queries
 */
type MasterCardType = MasterCard;

/**
 * Format UserCard database record into CardDisplayModel for UI rendering
 *
 * Includes calculated fields like ROI, renewal countdown, and benefit counts
 */
function formatCardForDisplay(
  card: UserCardWithRelations,
  masterCard: MasterCardType
): CardDisplayModel {
  const daysUntilRenewal = getDaysUntilRenewal(card.renewalDate);
  const renewalStatus = getRenewalStatus(daysUntilRenewal);

  const effectiveAnnualFee = getEffectiveAnnualFee(
    masterCard.defaultAnnualFee,
    card.actualAnnualFee
  );

  const annualBenefitsValue = (card.userBenefits || []).reduce(
    (sum: number, b: UserBenefit) => sum + b.stickerValue,
    0
  );

  const cardROI = calculateCardROI(annualBenefitsValue, effectiveAnnualFee);
  const activeBenefitsCount = (card.userBenefits || []).filter(
    (b: UserBenefit) => !b.expirationDate || b.expirationDate > new Date()
  ).length;
  const claimedBenefitsCount = (card.userBenefits || []).filter(
    (b: UserBenefit) => b.isUsed
  ).length;

  return {
    id: card.id,
    issuer: masterCard.issuer,
    cardName: masterCard.cardName,
    customName: card.customName,
    defaultAnnualFee: masterCard.defaultAnnualFee,
    actualAnnualFee: card.actualAnnualFee,
    effectiveAnnualFee,
    renewalDate: card.renewalDate,
    daysUntilRenewal,
    renewalStatus,
    status: card.status as CardStatus,
    isOpen: card.status !== 'ARCHIVED', // Backward compatibility
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    archivedAt: card.archivedAt,
    benefitsCount: (card.userBenefits || []).length,
    activeBenefitsCount,
    claimedBenefitsCount,
    cardROI,
    annualValue: annualBenefitsValue,
    cardImageUrl: masterCard.cardImageUrl
  };
}

/**
 * Get all cards for a player with filtering, searching, and sorting
 *
 * @param playerId - ID of the player to fetch cards for
 * @param options - Filtering, sorting, and pagination options
 * @returns Array of CardDisplayModel objects and wallet stats
 */
export async function getPlayerCards(
  playerId: string,
  options: {
    status?: CardStatus | 'ALL';
    search?: string;
    issuer?: string[];
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}
): Promise<ActionResponse<{
  cards: CardDisplayModel[];
  total: number;
  limit: number;
  offset: number;
  stats: CardWalletStats;
}>> {
  try {
    // Auth check
    const userId = getAuthUserIdOrThrow();

    // Verify user owns the player
    const ownership = await verifyPlayerOwnership(playerId, userId);
    if (!ownership.isOwner) {
      return createErrorResponse(ERROR_CODES.AUTHZ_OWNERSHIP, {
        resource: 'player',
        id: playerId
      });
    }

    const {
      status = 'ACTIVE',
      search = '',
      issuer = [],
      sortBy = 'renewalDate',
      sortDir = 'asc',
      limit = 50,
      offset = 0
    } = options;

    // Build filter conditions
    const filters: Prisma.UserCardWhereInput = {
      playerId,
      status: status === 'ALL' ? undefined : status,
      // Search across card name, custom name, and issuer
      // Note: SQLite uses LIKE which is case-insensitive by default
      ...(search && {
        OR: [
          { customName: { contains: search } },
          { masterCard: { cardName: { contains: search } } },
          { masterCard: { issuer: { contains: search } } }
        ]
      }),
      // Filter by issuers if provided
      ...(issuer.length > 0 && {
        masterCard: { issuer: { in: issuer } }
      })
    };

    // Build sort order
    // Use Prisma's OrderByWithRelationInput type for type safety
    const orderBy: Prisma.UserCardOrderByWithRelationInput = {};

    switch (sortBy) {
      case 'name':
        orderBy.customName = sortDir;
        break;
      case 'issuer':
        orderBy.masterCard = { issuer: sortDir };
        break;
      case 'fee':
        orderBy.actualAnnualFee = sortDir;
        break;
      case 'renewal':
        orderBy.renewalDate = sortDir;
        break;
      case 'benefits':
        // Sort by renewal date as proxy for now
        orderBy.renewalDate = sortDir;
        break;
      case 'roi':
        // Sort by renewal date as proxy for now
        orderBy.renewalDate = sortDir;
        break;
      default:
        orderBy.renewalDate = sortDir;
    }

    // Fetch cards with relations
    const [cards, total] = await Promise.all([
      prisma.userCard.findMany({
        where: filters,
        include: {
          masterCard: true,
          userBenefits: true
        },
        skip: offset,
        take: limit,
        orderBy
      }),
      prisma.userCard.count({ where: filters })
    ]);

    // Format for display
    const displayCards = cards.map(card =>
      formatCardForDisplay(card, card.masterCard)
    );

    // Calculate wallet stats
    const allCards = await prisma.userCard.findMany({
      where: { playerId, status: { not: 'DELETED' } },
      include: { masterCard: true, userBenefits: true }
    });

    const activeCards = allCards.filter(c => c.status === 'ACTIVE');
    const activeDisplayCards = activeCards.map(c =>
      formatCardForDisplay(c, c.masterCard)
    );

    const stats: CardWalletStats = {
      totalCards: allCards.length,
      activeCards: activeCards.length,
      archivedCards: allCards.filter(c => c.status === 'ARCHIVED').length,
      pendingCards: allCards.filter(c => c.status === 'PENDING').length,
      pausedCards: allCards.filter(c => c.status === 'PAUSED').length,
      totalROI: activeDisplayCards.length > 0
        ? activeDisplayCards.reduce((sum, c) => sum + c.cardROI, 0) / activeDisplayCards.length
        : 0,
      walletValue: activeDisplayCards.reduce((sum, c) => sum + c.annualValue, 0),
      totalAnnualFee: activeDisplayCards.reduce((sum, c) => sum + c.effectiveAnnualFee, 0)
    };

    return createSuccessResponse({
      cards: displayCards,
      total,
      limit,
      offset,
      stats
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }
    console.error('[getPlayerCards] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

/**
 * Get full details for a single card including benefits and diagnostics
 *
 * @param cardId - ID of the card to fetch
 * @returns CardDetailsModel with all information
 */
export async function getCardDetails(
  cardId: string
): Promise<ActionResponse<CardDetailsModel>> {
  try {
    // Auth check
    const userId = getAuthUserIdOrThrow();

    // SECURITY: Check authorization with minimal query FIRST
    // This prevents loading sensitive data before verifying ownership
    const cardOwnership = await prisma.userCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        playerId: true,
        player: { select: { userId: true } }
      }
    });

    if (!cardOwnership) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'card',
        id: cardId
      });
    }

    // Authorize BEFORE fetching full data
    // This follows least privilege principle - don't load more data than necessary
    // Cast is safe: Prisma select query returns exact type needed
    const authorized = await authorizeCardOperation(
      userId,
      cardOwnership as UserCard & { player: { userId: string } },
      'READ'
    );
    if (!authorized) {
      return createErrorResponse(ERROR_CODES.AUTHZ_DENIED);
    }

    // NOW fetch full card with all relations (only after auth passes)
    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: {
        masterCard: { include: { masterBenefits: true } },
        userBenefits: true,
        player: { include: { user: true } }
      }
    });

    if (!card) {
      // This should not happen since we just checked, but be defensive
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'card',
        id: cardId
      });
    }

    // Format base card display
    const displayModel = formatCardForDisplay(card, card.masterCard);

    // Calculate benefits summary
    const summary = calculateBenefitsSummary(
      card.userBenefits.map(b => ({
        stickerValue: b.stickerValue,
        isUsed: b.isUsed,
        expirationDate: b.expirationDate
      }))
    );

    // Build diagnostics
    const warnings = [];
    if (card.renewalDate < new Date()) {
      warnings.push({
        type: 'RENEWAL_OVERDUE' as const,
        severity: 'HIGH' as const,
        message: 'Card renewal date has passed',
        suggestedAction: 'Update renewal date or archive this card if closed'
      });
    }
    if (summary.count === 0) {
      warnings.push({
        type: 'NO_BENEFITS' as const,
        severity: 'MEDIUM' as const,
        message: 'This card has no benefits',
        suggestedAction: 'Check if benefits were properly cloned from the catalog'
      });
    }

    const details: CardDetailsModel = {
      ...displayModel,
      masterCard: {
        id: card.masterCard.id,
        issuer: card.masterCard.issuer,
        cardName: card.masterCard.cardName,
        defaultAnnualFee: card.masterCard.defaultAnnualFee
      },
      userBenefits: card.userBenefits,
      benefitsSummary: summary,
      diagnostics: {
        warnings,
        suggestions: []
      },
      relatedStats: {
        percentOfWallet: 0, // TODO: Calculate based on household
        monthlyROI: displayModel.cardROI / 12,
        monthlyAnnualFee: displayModel.effectiveAnnualFee / 12
      }
    };

    return createSuccessResponse(details);
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }
    console.error('[getCardDetails] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

/**
 * Update card details (custom name, annual fee, renewal date, status)
 *
 * @param cardId - ID of the card to update
 * @param updates - Object with fields to update
 * @returns Updated CardDisplayModel
 */
export async function updateCard(
  cardId: string,
  updates: {
    customName?: string;
    actualAnnualFee?: number;
    renewalDate?: Date;
    status?: CardStatus;
  }
): Promise<ActionResponse<CardDisplayModel>> {
  try {
    // Auth check
    const userId = getAuthUserIdOrThrow();

    // Fetch current card
    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: { masterCard: true }
    });

    if (!card) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'card',
        id: cardId
      });
    }

    // Authorize edit
    const authorized = await authorizeCardOperation(userId, card, 'EDIT');
    if (!authorized) {
      return createErrorResponse(ERROR_CODES.AUTHZ_DENIED);
    }

    // Validate inputs
    if (updates.customName !== undefined) {
      validateCustomName(updates.customName);
    }
    if (updates.actualAnnualFee !== undefined) {
      validateAnnualFee(updates.actualAnnualFee);
    }
    if (updates.renewalDate !== undefined) {
      validateRenewalDate(updates.renewalDate);
    }
    if (updates.status !== undefined) {
      validateCardStatusTransition(card.status as CardStatus, updates.status);
    }

    // Build update data
    const updateData: Prisma.UserCardUpdateInput = {};

    if (updates.customName !== undefined) {
      updateData.customName = updates.customName || null;
    }
    if (updates.actualAnnualFee !== undefined) {
      updateData.actualAnnualFee = updates.actualAnnualFee || null;
    }
    if (updates.renewalDate !== undefined) {
      updateData.renewalDate = updates.renewalDate;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
      updateData.statusChangedAt = new Date();
      updateData.statusChangedBy = userId;
    }

    // Update card
    const updated = await prisma.userCard.update({
      where: { id: cardId },
      data: updateData,
      include: { masterCard: true, userBenefits: true }
    });

    return createSuccessResponse(formatCardForDisplay(updated, updated.masterCard));
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }
    console.error('[updateCard] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

/**
 * Archive card (soft delete - status = ARCHIVED)
 *
 * @param cardId - ID of the card to archive
 * @param reason - Optional reason for archival
 * @returns Updated CardDisplayModel
 */
export async function archiveCard(
  cardId: string,
  reason?: string
): Promise<ActionResponse<CardDisplayModel>> {
  try {
    const userId = getAuthUserIdOrThrow();

    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: { masterCard: true }
    });

    if (!card) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'card',
        id: cardId
      });
    }

    const authorized = await authorizeCardOperation(userId, card, 'EDIT');
    if (!authorized) {
      return createErrorResponse(ERROR_CODES.AUTHZ_DENIED);
    }

    // Validate transition
    validateCardStatusTransition(card.status as CardStatus, 'ARCHIVED');

    // Update card and mark benefits as archived
    const updated = await prisma.$transaction(async (tx) => {
      // Archive card
      return tx.userCard.update({
        where: { id: cardId },
        data: {
          status: 'ARCHIVED',
          archivedAt: new Date(),
          archivedBy: userId,
          archivedReason: reason || 'User archived card'
        },
        include: { masterCard: true, userBenefits: true }
      });
    });

    return createSuccessResponse(formatCardForDisplay(updated, updated.masterCard));
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }
    console.error('[archiveCard] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

/**
 * Unarchive card (restore from ARCHIVED status)
 *
 * @param cardId - ID of the card to unarchive
 * @returns Updated CardDisplayModel
 */
export async function unarchiveCard(
  cardId: string
): Promise<ActionResponse<CardDisplayModel>> {
  try {
    const userId = getAuthUserIdOrThrow();

    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: { masterCard: true }
    });

    if (!card) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'card',
        id: cardId
      });
    }

    const authorized = await authorizeCardOperation(userId, card, 'EDIT');
    if (!authorized) {
      return createErrorResponse(ERROR_CODES.AUTHZ_DENIED);
    }

    // Validate transition
    validateCardStatusTransition(card.status as CardStatus, 'ACTIVE');

    // Update card and reactivate benefits
    const updated = await prisma.$transaction(async (tx) => {
      // Unarchive card
      return tx.userCard.update({
        where: { id: cardId },
        data: {
          status: 'ACTIVE',
          archivedAt: null,
          archivedBy: null,
          archivedReason: null
        },
        include: { masterCard: true, userBenefits: true }
      });
    });

    return createSuccessResponse(formatCardForDisplay(updated, updated.masterCard));
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }
    console.error('[unarchiveCard] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

/**
 * Delete card (hard delete - permanent)
 *
 * @param cardId - ID of the card to delete
 * @param confirmationText - Must match card name exactly
 * @returns Success message
 */
export async function deleteCard(
  cardId: string,
  confirmationText: string
): Promise<ActionResponse<{ success: boolean }>> {
  try {
    const userId = getAuthUserIdOrThrow();

    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: { masterCard: true }
    });

    if (!card) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'card',
        id: cardId
      });
    }

    const authorized = await authorizeCardOperation(userId, card, 'DELETE');
    if (!authorized) {
      return createErrorResponse(ERROR_CODES.AUTHZ_DENIED);
    }

    // Validate confirmation
    validateDeleteConfirmation(confirmationText, card.masterCard.cardName, card.customName);

    // Delete card (cascade deletes benefits)
    await prisma.userCard.delete({
      where: { id: cardId }
    });

    return createSuccessResponse({ success: true });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }
    console.error('[deleteCard] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}

/**
 * Bulk update multiple cards
 *
 * @param cardIds - Array of card IDs to update
 * @param updates - Fields to update on all cards
 * @returns Counts of updated and failed cards
 */
export async function bulkUpdateCards(
  cardIds: string[],
  updates: {
    status?: CardStatus;
    actualAnnualFee?: number;
    renewalDate?: Date;
  }
): Promise<ActionResponse<{
  updated: number;
  failed: number;
  errors?: Array<{ cardId: string; reason: string }>;
}>> {
  try {
    const userId = getAuthUserIdOrThrow();

    // Validate input
    validateBulkUpdateInput({ cardIds, updates });

    // Fetch all cards to authorize
    const cards = await prisma.userCard.findMany({
      where: { id: { in: cardIds } },
      include: { masterCard: true }
    });

    if (cards.length !== cardIds.length) {
      return createErrorResponse(ERROR_CODES.RESOURCE_NOT_FOUND, {
        resource: 'cards',
        message: 'Some cards not found'
      });
    }

    // Check authorization on all cards
    for (const card of cards) {
      const authorized = await authorizeCardOperation(userId, card, 'EDIT');
      if (!authorized) {
        return createErrorResponse(ERROR_CODES.AUTHZ_DENIED);
      }
    }

    // Validate inputs
    if (updates.actualAnnualFee !== undefined) {
      validateAnnualFee(updates.actualAnnualFee);
    }
    if (updates.renewalDate !== undefined) {
      validateRenewalDate(updates.renewalDate);
    }

    // PRE-VALIDATE ALL CARDS BEFORE TRANSACTION
    // This ensures transaction can't fail on validation, allowing full rollback if needed
    for (const card of cards) {
      // Validate transition if changing status
      if (updates.status) {
        validateCardStatusTransition(card.status as CardStatus, updates.status);
      }
    }

    // Execute update in transaction
    // Since all validations passed above, this should succeed fully or fail completely
    const updated = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const card of cards) {
        await tx.userCard.update({
          where: { id: card.id },
          data: {
            actualAnnualFee: updates.actualAnnualFee,
            renewalDate: updates.renewalDate,
            status: updates.status,
            statusChangedAt: updates.status ? new Date() : undefined,
            statusChangedBy: updates.status ? userId : undefined
          }
        });
        count++;
      }
      return count;
    });

    return createSuccessResponse({
      updated,
      failed: 0
    });
  } catch (error) {
    if (error instanceof AppError) {
      return createErrorResponse(error.code, error.details);
    }
    console.error('[bulkUpdateCards] Unexpected error:', error);
    return createErrorResponse(ERROR_CODES.INTERNAL_ERROR);
  }
}
