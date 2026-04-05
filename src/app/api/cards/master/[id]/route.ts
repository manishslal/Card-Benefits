/**
 * GET /api/cards/master/[id]
 *
 * Fetches complete details for a master card in the catalog, including full benefits list
 * This is used for the card details modal when browsing the catalog
 *
 * Path Parameters:
 * - id: string - MasterCard ID (CUID format)
 *
 * Response 200 (Success):
 * {
 *   "success": true,
 *   "card": {
 *     "id": "mastercard_001",
 *     "issuer": "Chase",
 *     "cardName": "Sapphire Preferred",
 *     "defaultAnnualFee": 9500,
 *     "cardImageUrl": "https://cdn.example.com/...",
 *     "benefits": [
 *       {
 *         "id": "benefit_001",
 *         "name": "$300 annual travel credit",
 *         "type": "Travel",
 *         "stickerValue": 30000,
 *         "resetCadence": "Annual"
 *       }
 *     ]
 *   }
 * }
 *
 * Errors:
 * - 404: Card not found
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';

// ============================================================
// Type Definitions
// ============================================================

/**
 * Master benefit representation
 */
interface MasterBenefitDTO {
  id: string;
  name: string;
  type: string;
  stickerValue: number; // in cents
  resetCadence: string;
}

/**
 * Master card detail response
 */
interface CardDetailResponse {
  success: true;
  card: {
    id: string;
    issuer: string;
    cardName: string;
    defaultAnnualFee: number; // in cents
    cardImageUrl: string;
    benefits: MasterBenefitDTO[];
  };
}

/**
 * Error response
 */
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/cards/master/[id] handler
 *
 * Retrieves complete details for a master card from the catalog
 * Performance SLO: p95 < 400ms
 *
 * @param request - NextRequest
 * @param params - Route parameters with cardId
 * @returns NextResponse with card details or error
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: cardId } = await params;

    // Validate cardId is not empty
    if (!cardId || typeof cardId !== 'string' || cardId.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid card ID',
          code: 'INVALID_CARD_ID',
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Fetch master card with all benefits
    const masterCard = await prisma.masterCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        issuer: true,
        cardName: true,
        defaultAnnualFee: true,
        cardImageUrl: true,
        masterBenefits: {
          select: {
            id: true,
            name: true,
            type: true,
            stickerValue: true,
            resetCadence: true,
          },
          where: {
            isActive: true, // Only active benefits
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Card not found
    if (!masterCard) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // Transform benefits to DTO
    const benefits: MasterBenefitDTO[] = masterCard.masterBenefits.map((benefit) => ({
      id: benefit.id,
      name: benefit.name,
      type: benefit.type,
      stickerValue: benefit.stickerValue,
      resetCadence: benefit.resetCadence,
    }));

    return NextResponse.json(
      {
        success: true,
        card: {
          id: masterCard.id,
          issuer: masterCard.issuer,
          cardName: masterCard.cardName,
          defaultAnnualFee: masterCard.defaultAnnualFee,
          cardImageUrl: masterCard.cardImageUrl,
          benefits,
        },
      } as CardDetailResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/cards/master/[id] Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch card details',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
