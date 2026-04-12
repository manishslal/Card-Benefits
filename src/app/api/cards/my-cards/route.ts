/**
 * GET /api/cards/my-cards
 *
 * Returns all credit cards owned by the authenticated user with their benefits and pagination.
 *
 * When BENEFIT_ENGINE_ENABLED=true, includes period data (periodStart, periodEnd,
 * periodStatus) and masterBenefit info (claimingCadence). Only ACTIVE-period benefits
 * are returned by default; EXPIRED/UPCOMING benefits are available via the
 * /api/benefits/history endpoint.
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
 *   "pagination": { ... },
 *   "benefitEngineEnabled": boolean
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 400: Invalid pagination parameters
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { featureFlags } from '@/lib/feature-flags';

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
  // Period-based fields (only present when benefit engine is enabled)
  periodStart?: string | null;
  periodEnd?: string | null;
  periodStatus?: string | null;
  masterBenefitId?: string | null;
  claimingCadence?: string | null;
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
  benefitEngineEnabled: boolean;
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

    // Determine if benefit engine is enabled for period-based filtering
    const engineEnabled = featureFlags.BENEFIT_ENGINE_ENABLED;

    // Build the userBenefits where clause:
    // When engine is enabled, only show ACTIVE period benefits
    // When disabled, still exclude EXPIRED rows to prevent stale period data
    // from leaking into the dashboard if the flag is toggled off after being on
    const benefitWhereClause = engineEnabled
      ? {
          status: { not: 'ARCHIVED' },
          periodStatus: 'ACTIVE',
        }
      : {
          status: 'ACTIVE',
        };

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
              where: benefitWhereClause,
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
                // Period-based fields (always selected; null when engine is off)
                periodStart: true,
                periodEnd: true,
                periodStatus: true,
                masterBenefitId: true,
                // JOIN masterBenefit for claimingCadence
                masterBenefit: {
                  select: {
                    id: true,
                    claimingCadence: true,
                  },
                },
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
          benefitEngineEnabled: engineEnabled,
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
        // Period-based fields — only populated when benefit engine creates them
        ...(benefit.periodStart != null && {
          periodStart: benefit.periodStart.toISOString(),
        }),
        ...(benefit.periodEnd != null && {
          periodEnd: benefit.periodEnd.toISOString(),
        }),
        ...(benefit.periodStatus != null && {
          periodStatus: benefit.periodStatus,
        }),
        ...(benefit.masterBenefitId != null && {
          masterBenefitId: benefit.masterBenefitId,
        }),
        ...(benefit.masterBenefit?.claimingCadence != null && {
          claimingCadence: benefit.masterBenefit.claimingCadence,
        }),
      }));

      return {
        id: userCard.id,
        masterCardId: userCard.masterCardId,
        issuer: masterCard.issuer,
        cardName: masterCard.cardName,
        customName: userCard.customName,
        type: getCardType(masterCard.issuer),
        lastFour: undefined,
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
    // When benefit engine is enabled, the Prisma query already filtered to
    // ACTIVE-period benefits only, so the counts here are correct.
    const summary: CardWalletSummary = {
      totalCards: allUserCards.length,
      totalAnnualFees: allUserCards.reduce(
        (sum, card) => sum + (card.actualAnnualFee ?? card.masterCard.defaultAnnualFee),
        0
      ),
      totalBenefitValue: allUserCards.reduce(
        (sum, card) =>
          sum +
          card.userBenefits.reduce(
            (bSum, benefit) => bSum + (benefit.userDeclaredValue ?? benefit.stickerValue),
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
        benefitEngineEnabled: engineEnabled,
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
