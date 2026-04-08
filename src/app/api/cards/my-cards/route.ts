/**
 * GET /api/cards/my-cards
 *
 * Returns all credit cards owned by the authenticated user with their benefits and pagination
 *
 * Query Parameters:
 * - page?: number - Page number starting from 1 (default: 1)
 * - limit?: number - Cards per page (default: 20, max: 100)
 *
 * Response 200 (Success):
 * {
 *   "success": true,
 *   "cards": [...],
 *   "summary": {...},
 *   "pagination": {
 *     "total": 25,
 *     "page": 1,
 *     "limit": 20,
 *     "totalPages": 2,
 *     "hasMore": true
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 400: Invalid pagination parameters
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

// ============================================================
// Type Definitions
// ============================================================

interface BenefitDisplay {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  isUsed: boolean;
  expirationDate: string | null;
  status: string;
}

interface CardDisplay {
  id: string;
  masterCardId: string;
  issuer: string;
  cardName: string;
  customName: string | null;
  type?: string;
  lastFour?: string;
  status: string;
  renewalDate: string;
  actualAnnualFee: number | null;
  defaultAnnualFee: number;
  cardImageUrl: string;
  benefits: BenefitDisplay[];
  createdAt: string;
}

interface CardWalletSummary {
  totalCards: number;
  totalAnnualFees: number;
  totalBenefitValue: number;
  activeCards: number;
  activeBenefits: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

interface UserCardsResponse {
  success: true;
  cards: CardDisplay[];
  summary: CardWalletSummary;
  pagination: PaginationMeta;
}

interface ErrorResponse {
  success: false;
  error: string;
}

// ============================================================
// Helper Functions
// ============================================================

function getCardType(issuer: string): string {
  const lowerIssuer = issuer.toLowerCase();
  if (lowerIssuer.includes('american') || lowerIssuer.includes('amex')) return 'amex';
  if (lowerIssuer.includes('mastercard') || lowerIssuer.includes('mc')) return 'mastercard';
  if (lowerIssuer.includes('visa')) return 'visa';
  if (lowerIssuer.includes('discover')) return 'discover';
  return 'visa';
}

function generateLastFour(cardId: string): string {
  const hex = cardId.substring(0, 4);
  const num = parseInt(hex, 16);
  return String(num % 10000).padStart(4, '0');
}

// ============================================================
// GET Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Extract and validate pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const pageStr = searchParams.get('page') || '1';
    const limitStr = searchParams.get('limit') || '20';

    const page = Math.max(parseInt(pageStr, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || 20, 1), 100);

    if (isNaN(page) || isNaN(limit)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pagination parameters',
        } as ErrorResponse,
        { status: 400 }
      );
    }

    const offset = (page - 1) * limit;

    // Fetch user's primary player and their cards
    const player = await prisma.player.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        userCards: {
          where: {
            status: {
              not: 'DELETED',
            },
          },
          select: {
            id: true,
            masterCardId: true,
            customName: true,
            status: true,
            renewalDate: true,
            actualAnnualFee: true,
            createdAt: true,
            masterCard: {
              select: {
                id: true,
                issuer: true,
                cardName: true,
                defaultAnnualFee: true,
                cardImageUrl: true,
              },
            },
            userBenefits: {
              where: {
                status: {
                  not: 'ARCHIVED',
                },
              },
              select: {
                id: true,
                name: true,
                type: true,
                stickerValue: true,
                userDeclaredValue: true,
                resetCadence: true,
                isUsed: true,
                timesUsed: true,
                expirationDate: true,
                status: true,
              },
              orderBy: {
                name: 'asc',
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!player) {
      const emptyPagination: PaginationMeta = {
        total: 0,
        page: 1,
        limit,
        totalPages: 0,
        hasMore: false,
      };

      return NextResponse.json(
        {
          success: true,
          cards: [],
          summary: {
            totalCards: 0,
            totalAnnualFees: 0,
            totalBenefitValue: 0,
            activeCards: 0,
            activeBenefits: 0,
          },
          pagination: emptyPagination,
        } as UserCardsResponse,
        { status: 200 }
      );
    }

    // Get total count and apply pagination
    const allUserCards = player.userCards;
    const totalCount = allUserCards.length;
    const paginatedCards = allUserCards.slice(offset, offset + limit);

    // Transform paginated results
    const cards: CardDisplay[] = paginatedCards.map((userCard) => {
      const masterCard = userCard.masterCard;
      const benefits: BenefitDisplay[] = userCard.userBenefits.map((benefit) => ({
        id: benefit.id,
        name: benefit.name,
        type: benefit.type,
        stickerValue: benefit.stickerValue,
        userDeclaredValue: benefit.userDeclaredValue,
        resetCadence: benefit.resetCadence,
        isUsed: benefit.isUsed,
        expirationDate: benefit.expirationDate?.toISOString() || null,
        status: benefit.status,
      }));

      return {
        id: userCard.id,
        masterCardId: userCard.masterCardId,
        issuer: masterCard.issuer,
        cardName: masterCard.cardName,
        customName: userCard.customName,
        type: getCardType(masterCard.issuer),
        lastFour: generateLastFour(userCard.id),
        status: userCard.status,
        renewalDate: userCard.renewalDate.toISOString(),
        actualAnnualFee: userCard.actualAnnualFee,
        defaultAnnualFee: masterCard.defaultAnnualFee,
        cardImageUrl: masterCard.cardImageUrl,
        benefits,
        createdAt: userCard.createdAt.toISOString(),
      };
    });

    // Calculate summary from ALL cards
    const summary: CardWalletSummary = {
      totalCards: allUserCards.length,
      totalAnnualFees: allUserCards.reduce(
        (sum, card) => sum + (card.actualAnnualFee || card.masterCard.defaultAnnualFee),
        0
      ),
      totalBenefitValue: allUserCards.reduce(
        (sum, card) =>
          sum +
          card.userBenefits.reduce(
            (bSum, benefit) => bSum + (benefit.userDeclaredValue || benefit.stickerValue),
            0
          ),
        0
      ),
      activeCards: allUserCards.filter((card) => card.status === 'ACTIVE').length,
      activeBenefits: allUserCards.reduce(
        (sum, card) => sum + card.userBenefits.filter((b) => b.status === 'ACTIVE' && !b.isUsed).length,
        0
      ),
    };

    const totalPages = Math.ceil(totalCount / limit);
    const pagination: PaginationMeta = {
      total: totalCount,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };

    return NextResponse.json(
      {
        success: true,
        cards,
        summary,
        pagination,
      } as UserCardsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/cards/my-cards Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve user cards',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
