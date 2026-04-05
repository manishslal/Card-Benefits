/**
 * GET /api/cards/available
 *
 * Returns all available credit cards from the MasterCard catalog with optional filtering
 *
 * Query Parameters:
 * - issuer?: string - Filter by card issuer (e.g., "Chase", "American Express")
 * - search?: string - Search by card name (case-insensitive)
 * - limit?: number - Max results to return (default: 50, max: 500)
 * - offset?: number - Pagination offset (default: 0)
 *
 * Response 200 (Success):
 * {
 *   "success": true,
 *   "cards": [
 *     {
 *       "id": "mastercard_123",
 *       "issuer": "Chase",
 *       "cardName": "Chase Sapphire Preferred",
 *       "defaultAnnualFee": 9500, // in cents ($95.00)
 *       "cardImageUrl": "https://cdn.example.com/cards/...",
 *       "benefits": {
 *         "count": 3,
 *         "preview": ["$300 travel credit", "3x points on dining", "Emergency assistance"]
 *       }
 *     }
 *   ],
 *   "pagination": {
 *     "total": 450,
 *     "limit": 50,
 *     "offset": 0,
 *     "hasMore": true
 *   }
 * }
 *
 * Errors:
 * - 400: Invalid parameters (invalid limit, offset, etc.)
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

// ============================================================
// Type Definitions
// ============================================================

/**
 * Available card response DTO (Data Transfer Object)
 * Represents a card in the master catalog with essential information
 */
interface AvailableCard {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number; // in cents
  cardImageUrl: string;
  benefits: {
    count: number;
    preview: string[]; // Up to 3 benefit names
  };
}

/**
 * Pagination metadata for list responses
 */
interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Success response structure for available cards endpoint
 */
interface AvailableCardsResponse {
  success: true;
  cards: AvailableCard[];
  pagination: PaginationMeta;
}

/**
 * Error response structure
 */
interface ErrorResponse {
  success: false;
  error: string;
  details?: string;
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/cards/available handler
 *
 * Retrieves available credit cards from the master catalog with optional filtering
 * by issuer, search term, and pagination.
 *
 * @param request - NextRequest with optional query parameters
 * @returns NextResponse with available cards or error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const issuer = searchParams.get('issuer');
    const search = searchParams.get('search');
    const limitStr = searchParams.get('limit') || '50';
    const offsetStr = searchParams.get('offset') || '0';

    // Parse and validate pagination parameters
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || 50, 1), 500); // Clamp between 1-500
    const offset = Math.max(parseInt(offsetStr, 10) || 0, 0);

    if (isNaN(limit) || isNaN(offset)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pagination parameters',
          details: 'limit and offset must be valid integers',
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Build Prisma query filter
    const whereClause: Record<string, any> = {
      // Only include active cards (if needed for soft-delete filtering)
      // You can add: isActive: true if that field exists
    };

    // Apply issuer filter if provided
    if (issuer && issuer.trim().length > 0) {
      whereClause.issuer = {
        contains: issuer.trim(),
        mode: 'insensitive', // Case-insensitive search
      };
    }

    // Apply search filter if provided (searches card name)
    if (search && search.trim().length > 0) {
      whereClause.cardName = {
        contains: search.trim(),
        mode: 'insensitive',
      };
    }

    // Execute parallel queries for total count and paginated results
    const [totalCount, masterCards] = await Promise.all([
      // Get total count matching filters
      prisma.masterCard.count({ where: whereClause }),
      // Get paginated results with benefits
      prisma.masterCard.findMany({
        where: whereClause,
        select: {
          id: true,
          issuer: true,
          cardName: true,
          defaultAnnualFee: true,
          cardImageUrl: true,
          masterBenefits: {
            select: {
              name: true,
            },
            where: {
              isActive: true, // Only active benefits
            },
            take: 3, // Get up to 3 benefits for preview
          },
        },
        orderBy: {
          issuer: 'asc', // Sort by issuer alphabetically
        },
        take: limit,
        skip: offset,
      }),
    ]);

    // Transform database results into response DTOs
    const cards: AvailableCard[] = masterCards.map((card) => ({
      id: card.id,
      issuer: card.issuer,
      cardName: card.cardName,
      defaultAnnualFee: card.defaultAnnualFee,
      cardImageUrl: card.cardImageUrl,
      benefits: {
        count: card.masterBenefits.length,
        preview: card.masterBenefits.map((benefit) => benefit.name),
      },
    }));

    // Construct pagination metadata
    const pagination: PaginationMeta = {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
    };

    return NextResponse.json(
      {
        success: true,
        cards,
        pagination,
      } as AvailableCardsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/cards/available Error]', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve available cards',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
