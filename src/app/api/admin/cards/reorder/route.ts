/**
 * PATCH /api/admin/cards/reorder
 *
 * Reorders cards by updating displayOrder for multiple cards in a single batch operation.
 *
 * Request Body:
 * {
 *   "cards": [
 *     { "id": "card_1", "displayOrder": 0 },
 *     { "id": "card_2", "displayOrder": 1 },
 *     // ...
 *   ]
 * }
 *
 * Response 200: Cards reordered successfully
 * Response 400: Validation error
 * Response 401: Not authenticated
 * Response 403: Not admin
 * Response 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, extractRequestContext, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import { ReorderCardsSchema, parseRequestBody } from '@/features/admin/validation/schemas';
import { createAuditLog } from '@/features/admin/lib/audit';

// ============================================================
// Types
// ============================================================

interface CardOrder {
  id: string;
  displayOrder: number;
}

interface ReorderResponse {
  success: true;
  data: CardOrder[];
  message: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: { field: string; message: string }[];
}

// ============================================================
// PATCH Handler
// ============================================================

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify admin role
    let adminContext;
    try {
      adminContext = await verifyAdminRole(request);
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Parse and validate request body
    const parseResult = parseRequestBody(ReorderCardsSchema, await request.json());

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

    const { cards } = parseResult.data!;

    // 4. Verify all card IDs exist
    const cardIds = cards.map((c) => c.id);
    const existingCards = await prisma.masterCard.findMany({
      where: { id: { in: cardIds } },
      select: { id: true, displayOrder: true },
    });

    const existingCardIds = new Set(existingCards.map((c) => c.id));
    const missingIds = cardIds.filter((id) => !existingCardIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cards not found: ${missingIds.join(', ')}`,
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 5. Update displayOrder for all cards in a transaction
    const updatedCards = await Promise.all(
      cards.map(async (card) => {
        const oldCard = existingCards.find((c) => c.id === card.id);
        const oldOrder = oldCard?.displayOrder ?? 0;

        const updated = await prisma.masterCard.update({
          where: { id: card.id },
          data: { displayOrder: card.displayOrder },
          select: { id: true, displayOrder: true },
        });

        // 6. Log each change if order actually changed
        if (oldOrder !== card.displayOrder) {
          await createAuditLog({
            adminUserId: adminContext.userId,
            actionType: 'UPDATE',
            resourceType: 'CARD',
            resourceId: card.id,
            oldValues: { displayOrder: oldOrder },
            newValues: { displayOrder: card.displayOrder },
            ipAddress,
            userAgent,
          });
        }

        return updated;
      })
    );

    return NextResponse.json(
      {
        success: true,
        data: updatedCards,
        message: `Reordered ${updatedCards.length} card(s) successfully`,
      } as ReorderResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[PATCH /api/admin/cards/reorder Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reorder cards',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
