/**
 * GET /api/cards/master
 *
 * Returns all master cards from the catalog with pagination
 *
 * Query Parameters:
 * - page?: number - Page number starting from 1 (default: 1)
 * - limit?: number - Cards per page (default: 12, max: 50)
 *
 * Response 200 (Success):
 * {
 *   "success": true,
 *   "data": [
 *     {
 *       "id": "mastercard_123",
 *       "issuer": "Chase",
 *       "cardName": "Chase Sapphire Preferred",
 *       "defaultAnnualFee": 9500,
 *       "cardImageUrl": "https://cdn.example.com/cards/...",
 *       "masterBenefits": [...]
 *     }
 *   ],
 *   "pagination": {
 *     "total": 100,
 *     "page": 1,
 *     "limit": 12,
 *     "totalPages": 9,
 *     "hasMore": true
 *   }
 * }
 *
 * Errors:
 * - 400: Invalid pagination parameters
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';

// ============================================================
// Type Definitions
// ============================================================

/**
 * Represents a master card from the catalog
 */
interface MasterCard {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  masterBenefits: Array<{ id: string; name: string }>;
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
 * Success response structure for master cards endpoint
 */
interface MasterCardsResponse {
  success: true;
  data: MasterCard[];
  pagination: PaginationMeta;
}

/**
 * Error response structure
 */
interface ErrorResponse {
  success: false;
  error: string;
}

// ============================================================
// GET Handler
// ============================================================

/**
 * GET /api/cards/master handler
 *
 * Retrieves all master cards from the catalog with pagination.
 * Supports configurable page size with a maximum limit of 50 records per page.
 *
 * Performance SLO: p95 < 500ms
 *
 * @param request - NextRequest with optional pagination query parameters
 * @returns NextResponse with paginated master cards or error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract and validate pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const pageStr = searchParams.get('page') || '1';
    const limitStr = searchParams.get('limit') || '12';

    // Parse and validate pagination parameters
    // Page-based pagination: page starts at 1, min 1
    const page = Math.max(parseInt(pageStr, 10) || 1, 1);
    // Limit: default 12, min 1, max 50
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || 12, 1), 50);

    // Validate parsed values to catch edge cases
    if (isNaN(page) || isNaN(limit)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid pagination parameters',
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Calculate offset for pagination: (page - 1) * limit
    // Example: page=2, limit=12 -> offset=12 (skip first 12 records)
    const offset = (page - 1) * limit;

    // Execute parallel queries for total count and paginated results
    // This is more efficient than sequential queries
    const [totalCount, masterCards] = await Promise.all([
      // Get total count of all master cards (no filters needed for core catalog)
      prisma.masterCard.count(),
      // Get paginated batch of master cards with active benefits
      prisma.masterCard.findMany({
        include: {
          masterBenefits: {
            where: { isActive: true },
          },
        },
        orderBy: {
          issuer: 'asc',
        },
        take: limit,
        skip: offset,
      }),
    ]);

    // Calculate total number of pages
    const totalPages = Math.ceil(totalCount / limit);

    // Construct pagination metadata for client consumption
    const pagination: PaginationMeta = {
      total: totalCount,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages, // True if there are more pages after current
    };

    return NextResponse.json(
      {
        success: true,
        data: masterCards,
        pagination,
      } as MasterCardsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/cards/master Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch master cards' } as ErrorResponse,
      { status: 500 }
    );
  }
}
