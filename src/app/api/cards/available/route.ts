/**
 * GET /api/cards/available
 *
 * Returns available credit cards from the MasterCard catalog with pagination and filtering
 *
 * Query Parameters:
 * - page?: number - Page number starting from 1 (default: 1)
 * - limit?: number - Cards per page (default: 12, max: 50)
 * - issuer?: string - Filter by card issuer (case-insensitive partial match)
 * - search?: string - Search by card name (case-insensitive partial match)
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
 *         "count": 8,
 *         "preview": ["$300 travel credit", "3x points on dining", "2x points on travel"]
 *       }
 *     }
 *   ],
 *   "pagination": {
 *     "total": 47,
 *     "page": 1,
 *     "limit": 12,
 *     "totalPages": 4,
 *     "hasMore": true
 *   }
 * }
 *
 * Errors:
 * - 400: Invalid parameters (invalid page, limit, etc.)
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
  page: number;
  limit: number;
  totalPages: number;
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
 * Retrieves available credit cards from the master catalog with pagination and optional filtering
 * by issuer, search term, and pagination.
 *
 * Performance SLO: p95 < 500ms
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
    const pageStr = searchParams.get('page') || '1';
    const limitStr = searchParams.get('limit') || '12';

    // Parse and validate pagination parameters
    // Page-based pagination: page starts at 1, min 1
    const page = Math.max(parseInt(pageStr, 10) || 1, 1);
    // Limit: default 12, min 1, max 50
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || 12, 1), 50);

    if (isNaN(page) || isNaN(limit)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pagination parameters',
          details: 'page and limit must be valid integers (page >= 1, 1 <= limit <= 50)',
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Calculate offset from page number
    const offset = (page - 1) * limit;

    // Build Prisma query filter
    const whereClause: Record<string, any> = {};

    // Apply issuer filter if provided (case-insensitive partial match)
    if (issuer && issuer.trim().length > 0) {
      whereClause.issuer = {
        contains: issuer.trim(),
        mode: 'insensitive', // Case-insensitive search (works with PostgreSQL and SQLite)
      };
    }

    // Apply search filter if provided (searches card name, case-insensitive)
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
      // Get paginated results with benefit preview
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
              isActive: true, // Only include active benefits
            },
            take: 3, // Preview up to 3 benefits
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          issuer: 'asc', // Sort by issuer alphabetically, then by creation date
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

    // Calculate total pages
    const totalPages = Math.ceil(totalCount / limit);

    // Construct pagination metadata
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
