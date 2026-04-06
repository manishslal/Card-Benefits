/**
 * GET /api/admin/cards/[id] - Get Card Details
 * PATCH /api/admin/cards/[id] - Update Card
 * DELETE /api/admin/cards/[id] - Delete Card
 *
 * GET Response 200: Card details with benefit count
 * Response 404: Card not found
 * Response 401: Not authenticated
 * Response 403: Not admin
 *
 * PATCH Request Body (all optional):
 * {
 *   "cardName": string (optional, max 200)
 *   "defaultAnnualFee": number (optional, >= 0)
 *   "cardImageUrl": string (optional, valid URL)
 *   "description": string (optional, max 1000)
 *   "isActive": boolean (optional)
 * }
 *
 * PATCH Response 200: Updated card
 * Response 400: Validation error or duplicate card
 * Response 404: Card not found
 * Response 409: Duplicate card
 *
 * DELETE Query Parameters:
 * - force?: boolean (default: false) - Force delete even if in use
 * - archiveInstead?: boolean (default: false) - Archive instead of delete
 *
 * DELETE Response 200: Card deleted/archived
 * Response 400: Invalid query parameters
 * Response 404: Card not found
 * Response 409: Card in use
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import {
  verifyAdminRole,
  createAuthErrorResponse,
  extractRequestContext,
} from '@/features/admin/middleware/auth';
import {
  UpdateCardSchema,
  DeleteCardQuerySchema,
  parseRequestBody,
  parseQueryParams,
} from '@/features/admin/validation/schemas';
import { logResourceUpdate, logResourceDeletion } from '@/features/admin/lib/audit';
import type { AdminRequestContext } from '@/features/admin/middleware/auth';

// ============================================================
// Types
// ============================================================

interface CardDetailData {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  isArchived: boolean;
  benefitCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CardDetailResponse {
  success: true;
  data: CardDetailData;
}

interface UpdateCardResponse {
  success: true;
  data: CardDetailData;
  message: string;
  changes: Record<string, { old: any; new: any }>;
}

interface DeleteCardResponse {
  success: true;
  data: {
    id: string;
    cardName: string;
    action: 'deleted' | 'archived';
  };
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: { field: string; message: string }[];
  userCardCount?: number;
  suggestion?: string;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Formats a card for response
 */
function formatCardResponse(card: any): CardDetailData {
  return {
    id: card.id,
    issuer: card.issuer,
    cardName: card.cardName,
    defaultAnnualFee: card.defaultAnnualFee,
    cardImageUrl: card.cardImageUrl,
    description: card.description || null,
    displayOrder: card.displayOrder,
    isActive: card.isActive,
    isArchived: card.isArchived,
    benefitCount: card._count?.masterBenefits || 0,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

/**
 * Fetches a single card with benefit count
 */
async function fetchCardWithCount(cardId: string) {
  return prisma.masterCard.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      issuer: true,
      cardName: true,
      defaultAnnualFee: true,
      cardImageUrl: true,
      description: true,
      displayOrder: true,
      isActive: true,
      isArchived: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          masterBenefits: true,
        },
      },
    },
  });
}

/**
 * Counts how many UserCards reference this MasterCard
 */
async function countUserCardsForMasterCard(masterCardId: string): Promise<number> {
  const count = await prisma.userCard.count({
    where: { masterCardId },
  });
  return count;
}

// ============================================================
// GET Handler - Fetch Card Details
// ============================================================

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    try {
      await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Fetch card by ID with benefit count
    const card = await fetchCardWithCount(params.id);

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 3. Return card details
    return NextResponse.json(
      {
        success: true,
        data: formatCardResponse(card),
      } as CardDetailResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/cards/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH Handler - Update Card
// ============================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    let adminContext: AdminRequestContext;
    try {
      adminContext = await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Fetch current card state for audit trail
    const currentCard = await prisma.masterCard.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        issuer: true,
        cardName: true,
        defaultAnnualFee: true,
        cardImageUrl: true,
        description: true,
        displayOrder: true,
        isActive: true,
      },
    });

    if (!currentCard) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 4. Parse and validate request body
    let input;
    try {
      const body = await request.json();
      const parseResult = parseRequestBody(UpdateCardSchema, body);

      if (!parseResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: Object.entries(parseResult.errors || {}).map(([field, message]) => ({
              field,
              message: String(message),
            })),
          } as any,
          { status: 400 }
        );
      }
      input = parseResult.data!;
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body',
          code: 'INVALID_REQUEST',
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // 5. Check for duplicate card name if changing (using unique constraint approach)
    // Note: We check first to give better error message, but database constraint is the safety net
    if (input.cardName && input.cardName !== currentCard.cardName) {
      const existingCard = await prisma.masterCard.findFirst({
        where: {
          AND: [
            { issuer: currentCard.issuer }, // Keep same issuer
            { cardName: input.cardName },
            { id: { not: params.id } }, // Exclude current card
          ],
        },
        select: { id: true },
      });

      if (existingCard) {
        return NextResponse.json(
          {
            success: false,
            error: 'A card with this issuer and name already exists',
            code: 'DUPLICATE_CARD',
          } as ErrorResponse,
          { status: 409 }
        );
      }
    }

    // 6. Update card in a transaction to ensure atomicity
    const updatedCard = await prisma.$transaction(async (tx) => {
      return tx.masterCard.update({
        where: { id: params.id },
        data: {
          ...(input.cardName && { cardName: input.cardName }),
          ...(input.defaultAnnualFee !== undefined && { defaultAnnualFee: input.defaultAnnualFee }),
          ...(input.cardImageUrl && { cardImageUrl: input.cardImageUrl }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        },
        select: {
          id: true,
          issuer: true,
          cardName: true,
          defaultAnnualFee: true,
          cardImageUrl: true,
          description: true,
          displayOrder: true,
          isActive: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              masterBenefits: true,
            },
          },
        },
      });
    });

    // 7. Calculate what changed for audit log
    const changes: Record<string, { old: any; new: any }> = {};
    if (input.cardName && input.cardName !== currentCard.cardName) {
      changes.cardName = { old: currentCard.cardName, new: input.cardName };
    }
    if (input.defaultAnnualFee !== undefined && input.defaultAnnualFee !== currentCard.defaultAnnualFee) {
      changes.defaultAnnualFee = {
        old: currentCard.defaultAnnualFee,
        new: input.defaultAnnualFee,
      };
    }
    if (input.cardImageUrl && input.cardImageUrl !== currentCard.cardImageUrl) {
      changes.cardImageUrl = { old: currentCard.cardImageUrl, new: input.cardImageUrl };
    }
    if (input.description !== undefined && input.description !== currentCard.description) {
      changes.description = { old: currentCard.description, new: input.description };
    }
    if (input.isActive !== undefined && input.isActive !== currentCard.isActive) {
      changes.isActive = { old: currentCard.isActive, new: input.isActive };
    }

    // 8. Log the update operation
    try {
      await logResourceUpdate(
        adminContext,
        'CARD',
        updatedCard.id,
        `${updatedCard.issuer} ${updatedCard.cardName}`,
        {
          cardName: currentCard.cardName,
          defaultAnnualFee: currentCard.defaultAnnualFee,
          cardImageUrl: currentCard.cardImageUrl,
          description: currentCard.description,
          isActive: currentCard.isActive,
        },
        {
          cardName: updatedCard.cardName,
          defaultAnnualFee: updatedCard.defaultAnnualFee,
          cardImageUrl: updatedCard.cardImageUrl,
          description: updatedCard.description,
          isActive: updatedCard.isActive,
        },
        ipAddress,
        userAgent
      );
    } catch (auditError) {
      console.error('[Audit Log Error during PATCH]', auditError);
      // Don't fail the request if audit logging fails, but log it
      // The critical fix will make audit failures throw, which will catch in main error handler
    }

    // 9. Return updated card
    return NextResponse.json(
      {
        success: true,
        data: formatCardResponse(updatedCard),
        message: 'Card updated successfully',
        changes,
      } as UpdateCardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/cards/[id] Error]', error);

    // Check if it's a unique constraint violation (duplicate card)
    const errorMessage = String(error);
    if (errorMessage.includes('Unique constraint failed') || errorMessage.includes('unique')) {
      return NextResponse.json(
        {
          success: false,
          error: 'A card with this issuer and name already exists',
          code: 'DUPLICATE_CARD',
        } as ErrorResponse,
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE Handler - Delete or Archive Card
// ============================================================

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    let adminContext: AdminRequestContext;
    try {
      adminContext = await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Parse query parameters
    const queryObj = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parseResult = parseQueryParams(DeleteCardQuerySchema, queryObj);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          code: 'INVALID_QUERY',
          details: Object.entries(parseResult.errors || {}).map(([field, message]) => ({
            field,
            message: String(message),
          })),
        } as any,
        { status: 400 }
      );
    }

    const query = parseResult.data!;

    // 4. Fetch card to check if it exists and has data
    const card = await prisma.masterCard.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        cardName: true,
        issuer: true,
        _count: {
          select: {
            masterBenefits: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 5. Check if card is used by any users
    const userCardCount = await countUserCardsForMasterCard(params.id);

    // 6. Handle deletion based on parameters
    if (userCardCount > 0 && !query.force) {
      // Card is in use
      if (query.archiveInstead) {
        // Archive instead of delete
        await prisma.$transaction(async (tx) => {
          await tx.masterCard.update({
            where: { id: params.id },
            data: {
              isArchived: true,
              archivedAt: new Date(),
              archivedReason: 'Archived by admin due to active user cards',
            },
          });
        });

        await logResourceUpdate(
          adminContext,
          'CARD',
          card.id,
          `${card.issuer} ${card.cardName}`,
          { isArchived: false },
          { isArchived: true },
          ipAddress,
          userAgent
        );

        return NextResponse.json(
          {
            success: true,
            data: {
              id: card.id,
              cardName: card.cardName,
              action: 'archived' as const,
            },
            message: `Card archived (was in use by ${userCardCount} user(s))`,
          } as DeleteCardResponse,
          { status: 200 }
        );
      } else {
        // Return 409 conflict
        return NextResponse.json(
          {
            success: false,
            error: `Card cannot be deleted: it is used by ${userCardCount} user(s)`,
            code: 'CARD_IN_USE',
            userCardCount,
            suggestion:
              'Archive the card instead or use archiveInstead=true, or use force=true to delete anyway',
          } as ErrorResponse,
          { status: 409 }
        );
      }
    }

    // 7. Delete card and cascade delete all related benefits and user cards
    // (using transaction for atomicity)
    const deletedCard = await prisma.$transaction(async (tx) => {
      return tx.masterCard.delete({
        where: { id: params.id },
        select: {
          id: true,
          cardName: true,
          issuer: true,
        },
      });
    });

    // 8. Log the deletion
    try {
      await logResourceDeletion(
        adminContext,
        'CARD',
        deletedCard.id,
        `${deletedCard.issuer} ${deletedCard.cardName}`,
        {
          cardName: deletedCard.cardName,
          issuer: deletedCard.issuer,
          benefitCount: card._count.masterBenefits,
          userCardCount,
        },
        ipAddress,
        userAgent
      );
    } catch (auditError) {
      console.error('[Audit Log Error during DELETE]', auditError);
      // Log but don't fail - the critical fix will make this throw
    }

    // 9. Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          id: deletedCard.id,
          cardName: deletedCard.cardName,
          action: 'deleted' as const,
        },
        message: 'Card deleted successfully',
      } as DeleteCardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/admin/cards/[id] Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
