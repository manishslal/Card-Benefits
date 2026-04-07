/**
 * GET /api/admin/benefits/cards
 * 
 * Returns all unique cards that have at least one benefit.
 * Used by the CardFilterDropdown to show all available cards
 * independent of pagination.
 * 
 * @summary Get all unique cards with benefits
 * @rateLimit 100 requests per minute (per admin user)
 * @auth Required - Admin role
 * @pagination Not paginated - returns complete list
 * 
 * Response 200: List of all unique cards ordered by name
 * Response 401: Not authenticated
 * Response 403: Not admin
 * Response 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, createAuthErrorResponse } from '@/features/admin/middleware/auth';

// ============================================================
// Types
// ============================================================

interface CardOption {
  id: string;
  cardName: string;
  issuer?: string;
}

interface ListCardsResponse {
  success: true;
  data: CardOption[];
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

// ============================================================
// GET Handler
// ============================================================

/**
 * Fetch all unique cards that have at least one benefit.
 * Results are ordered alphabetically by card name.
 * 
 * This endpoint is optimized for performance:
 * - Uses Prisma distinct to avoid duplicate cards
 * - Only fetches card IDs and names (minimal fields)
 * - No pagination overhead
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify admin role
    try {
      await verifyAdminRole(request);
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Fetch all unique cards with benefits, ordered by card name
    // Use findMany with distinct to get each card ID only once
    const uniqueCards = await prisma.masterBenefit.findMany({
      distinct: ['masterCardId'],
      select: {
        masterCard: {
          select: {
            id: true,
            cardName: true,
            issuer: true,
          },
        },
      },
      orderBy: {
        masterCard: {
          cardName: 'asc',
        },
      },
    });

    // 3. Transform response - extract card data from nested structure
    const cards: CardOption[] = uniqueCards
      .map((item) =>
        item.masterCard
          ? {
              id: item.masterCard.id,
              cardName: item.masterCard.cardName,
              issuer: item.masterCard.issuer,
            }
          : null
      )
      .filter((card) => card !== null) as CardOption[];

    // 4. Return success response
    return NextResponse.json(
      {
        success: true,
        data: cards,
      } as ListCardsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/benefits/cards Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch cards',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
