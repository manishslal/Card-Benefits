/**
 * GET /api/cards/my-cards
 *
 * Returns all credit cards owned by the authenticated user with their benefits
 *
 * Response 200 (Success):
 * {
 *   "success": true,
 *   "cards": [
 *     {
 *       "id": "usercard_456",
 *       "masterCardId": "mastercard_123",
 *       "issuer": "Chase",
 *       "cardName": "Chase Sapphire Preferred",
 *       "customName": "Primary Sapphire",
 *       "type": "visa",
 *       "lastFour": "4242",
 *       "status": "ACTIVE",
 *       "renewalDate": "2025-12-31",
 *       "actualAnnualFee": 9500, // in cents ($95.00)
 *       "defaultAnnualFee": 9500,
 *       "cardImageUrl": "https://cdn.example.com/cards/...",
 *       "benefits": [
 *         {
 *           "id": "userbenefit_789",
 *           "name": "$300 Travel Credit",
 *           "type": "StatementCredit",
 *           "stickerValue": 30000, // in cents
 *           "userDeclaredValue": 30000,
 *           "resetCadence": "CalendarYear",
 *           "isUsed": false,
 *           "expirationDate": "2025-01-15",
 *           "status": "ACTIVE"
 *         }
 *       ],
 *       "createdAt": "2024-01-15T10:30:00Z"
 *     }
 *   ],
 *   "summary": {
 *     "totalCards": 1,
 *     "totalAnnualFees": 9500,
 *     "totalBenefitValue": 30000,
 *     "activeCards": 1,
 *     "activeBenefits": 1
 *   }
 * }
 *
 * Errors:
 * - 401: Not authenticated
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { prisma } from '@/lib/prisma';

// ============================================================
// Type Definitions
// ============================================================

/**
 * Represents a single benefit associated with a user's card
 */
interface BenefitDisplay {
  id: string;
  name: string;
  type: string; // 'StatementCredit' | 'UsagePerk'
  stickerValue: number; // in cents
  userDeclaredValue: number | null; // in cents
  resetCadence: string; // 'Monthly' | 'CalendarYear' | 'CardmemberYear' | 'OneTime'
  isUsed: boolean;
  expirationDate: string | null;
  status: string;
}

/**
 * Represents a credit card owned by the user with full details
 */
interface CardDisplay {
  id: string;
  masterCardId: string;
  issuer: string;
  cardName: string;
  customName: string | null;
  type?: string; // 'visa', 'amex', 'mastercard' - derived from issuer or cardImageUrl
  lastFour?: string; // Last 4 digits - can be derived or stored
  status: string; // 'ACTIVE' | 'PENDING' | 'PAUSED' | 'ARCHIVED' | 'DELETED'
  renewalDate: string;
  actualAnnualFee: number | null; // in cents
  defaultAnnualFee: number; // in cents
  cardImageUrl: string;
  benefits: BenefitDisplay[];
  createdAt: string;
}

/**
 * Summary statistics for user's card wallet
 */
interface CardWalletSummary {
  totalCards: number;
  totalAnnualFees: number; // in cents
  totalBenefitValue: number; // in cents
  activeCards: number;
  activeBenefits: number;
}

/**
 * Success response for user cards endpoint
 */
interface UserCardsResponse {
  success: true;
  cards: CardDisplay[];
  summary: CardWalletSummary;
}

/**
 * Error response
 */
interface ErrorResponse {
  success: false;
  error: string;
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Derives card network type from issuer or image URL
 * Useful for frontend display logic
 *
 * @param issuer - Card issuer name
 * @returns Card type: 'visa', 'amex', 'mastercard', or 'other'
 */
function getCardType(issuer: string): string {
  const lowerIssuer = issuer.toLowerCase();
  if (lowerIssuer.includes('american') || lowerIssuer.includes('amex')) return 'amex';
  if (lowerIssuer.includes('mastercard') || lowerIssuer.includes('mc')) return 'mastercard';
  if (lowerIssuer.includes('visa')) return 'visa';
  if (lowerIssuer.includes('discover')) return 'discover';
  return 'visa'; // Default fallback
}

/**
 * Generates a placeholder last-four digits
 * In production, this should be stored in the database
 *
 * @param cardId - Card ID for consistent generation
 * @returns Last four digits
 */
function generateLastFour(cardId: string): string {
  // Use first 4 hex chars of card ID and convert to digits
  const hex = cardId.substring(0, 4);
  const num = parseInt(hex, 16);
  return String(num % 10000).padStart(4, '0');
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/cards/my-cards handler
 *
 * Retrieves all cards owned by the authenticated user along with their benefits
 * and calculates wallet summary statistics.
 *
 * @param request - NextRequest with authenticated user context
 * @returns NextResponse with user's cards and summary, or error
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    // Get authenticated user ID from context
    const authContext = await getAuthContext();
    const userId = authContext?.userId;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Fetch user's primary player and their cards
    const player = await prisma.player.findFirst({
      where: {
        userId,
        playerName: 'Primary', // Only fetch primary player's cards for now
      },
      select: {
        id: true,
        userCards: {
          where: {
            status: {
              not: 'DELETED', // Exclude deleted cards
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
                  not: 'ARCHIVED', // Exclude archived benefits
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

    // Handle case where primary player doesn't exist
    if (!player) {
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
        } as UserCardsResponse,
        { status: 200 }
      );
    }

    // Transform database results into display DTOs
    const cards: CardDisplay[] = player.userCards.map((userCard) => {
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

    // Calculate summary statistics
    const summary: CardWalletSummary = {
      totalCards: cards.length,
      totalAnnualFees: cards.reduce((sum, card) => sum + (card.actualAnnualFee || card.defaultAnnualFee), 0),
      totalBenefitValue: cards.reduce(
        (sum, card) => sum + card.benefits.reduce((bSum, benefit) => bSum + (benefit.userDeclaredValue || benefit.stickerValue), 0),
        0
      ),
      activeCards: cards.filter((card) => card.status === 'ACTIVE').length,
      activeBenefits: cards.reduce((sum, card) => sum + card.benefits.filter((b) => b.status === 'ACTIVE' && !b.isUsed).length, 0),
    };

    return NextResponse.json(
      {
        success: true,
        cards,
        summary,
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
