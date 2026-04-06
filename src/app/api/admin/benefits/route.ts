/**
 * GET /api/admin/benefits
 * 
 * @summary List all benefits with pagination, search, and sorting
 * @rateLimit 100 requests per minute (per admin user)
 * @auth Required - Admin role
 * @pagination Supports pagination with max 100 items per page (default 20)
 *
 * Query Parameters:
 * - page?: number (default: 1) - Page number
 * - limit?: number (default: 20, max: 100) - Items per page
 * - search?: string (optional, max 255 chars) - Search by name or type
 * - sort?: 'name' | 'type' | 'stickerValue' (optional) - Sort field
 * - order?: 'asc' | 'desc' (optional, requires sort) - Sort direction
 *
 * Response 200: List of benefits with pagination metadata
 * Response 400: Invalid query parameters
 * Response 401: Not authenticated
 * Response 403: Not admin
 * Response 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import { parseQueryParams } from '@/features/admin/validation/schemas';
import { z } from 'zod';
import type { PaginationMeta } from '@/features/admin/validation/schemas';

// ============================================================
// Validation Schema
// ============================================================

/**
 * Query parameters schema for listing benefits
 */
const ListBenefitsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(255).optional(),
  sort: z.enum(['name', 'type', 'stickerValue']).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
});

// ============================================================
// Types
// ============================================================

interface BenefitItem {
  id: string;
  masterCardId: string;
  name: string;
  type: string;
  stickerValue: number;
  resetCadence: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListBenefitsResponse {
  success: true;
  data: BenefitItem[];
  pagination: PaginationMeta;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: { field: string; message: string }[];
}

// ============================================================
// GET Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify admin role
    try {
      await verifyAdminRole(request);
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Parse and validate query parameters
    const queryObj = Object.fromEntries(request.nextUrl.searchParams.entries());
    
    // Validate that if order is specified, sort must also be specified
    if (queryObj.order && !queryObj.sort) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          code: 'INVALID_PAGINATION',
          details: [
            {
              field: 'order',
              message: 'order parameter requires sort parameter to be set',
            },
          ],
        } as any,
        { status: 400 }
      );
    }

    const parseResult = parseQueryParams(ListBenefitsQuerySchema, queryObj);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          code: 'INVALID_PAGINATION',
          details: Object.entries(parseResult.errors || {}).map(([field, message]) => ({
            field,
            message: String(message),
          })),
        } as any,
        { status: 400 }
      );
    }

    const query = parseResult.data!;

    // 3. Build filter conditions
    const where: any = {};

    // Search in name and type
    if (query.search) {
      where.OR = [
        {
          name: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          type: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // 4. Calculate pagination
    const skip = (query.page - 1) * query.limit;

    // 5. Build sort order
    const orderBy: any = {};
    if (query.sort) {
      orderBy[query.sort] = query.order;
    } else {
      // Default sort by createdAt descending if no sort specified
      orderBy.createdAt = 'desc';
    }

    // 6. Execute queries in parallel
    const [totalCount, benefits] = await Promise.all([
      prisma.masterBenefit.count({ where }),
      prisma.masterBenefit.findMany({
        where,
        select: {
          id: true,
          masterCardId: true,
          name: true,
          type: true,
          stickerValue: true,
          resetCadence: true,
          isDefault: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
        skip,
        take: query.limit,
      }),
    ]);

    // 7. Transform response
    const totalPages = Math.ceil(totalCount / query.limit);
    const data: BenefitItem[] = benefits.map((benefit) => ({
      id: benefit.id,
      masterCardId: benefit.masterCardId,
      name: benefit.name,
      type: benefit.type,
      stickerValue: benefit.stickerValue,
      resetCadence: benefit.resetCadence,
      isDefault: benefit.isDefault,
      isActive: benefit.isActive,
      createdAt: benefit.createdAt.toISOString(),
      updatedAt: benefit.updatedAt.toISOString(),
    }));

    return NextResponse.json(
      {
        success: true,
        data,
        pagination: {
          total: totalCount,
          page: query.page,
          limit: query.limit,
          totalPages,
          hasMore: query.page < totalPages,
        },
      } as ListBenefitsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/benefits Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch benefits',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
