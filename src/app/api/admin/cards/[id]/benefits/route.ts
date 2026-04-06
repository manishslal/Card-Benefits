/**
 * GET /api/admin/cards/[id]/benefits
 * 
 * @summary List all benefits for a specific card with pagination
 * @rateLimit 100 requests per minute (per admin user)
 * @auth Required - Admin role
 * @pagination Supports pagination with max 100 items per page (default 50 for benefits)
 *
 * Path Parameters:
 * - id: string - Card ID
 *
 * Query Parameters:
 * - page?: number (default: 1) - Page number
 * - limit?: number (default: 50, max: 100) - Items per page
 * - isActive?: boolean (optional) - Filter by active status
 *
 * Response 200: List of benefits for the card with pagination metadata
 * Response 401: Not authenticated
 * Response 403: Not admin
 * Response 404: Card not found
 *
 * POST /api/admin/cards/[id]/benefits
 * 
 * @summary Create a new benefit for a specific card
 * @rateLimit 50 requests per minute (per admin user)
 * @auth Required - Admin role
 * @constraint Benefit name must be unique within the card (returns 409 if duplicate within same card)
 *
 * Path Parameters:
 * - id: string - Card ID
 *
 * Request Body:
 * {
 *   "name": string (required, max 200, unique per card)
 *   "type": enum (required) - One of: INSURANCE | CASHBACK | TRAVEL | BANKING | POINTS | OTHER
 *   "stickerValue": number (required, >= 0) - Display value of the benefit
 *   "resetCadence": enum (required) - One of: ANNUAL | QUARTERLY | MONTHLY | ONE_TIME
 *   "isDefault": boolean (optional, default: true) - Whether benefit is shown by default
 * }
 *
 * Response 201: Benefit created successfully with full benefit object
 * Response 400: Validation error (invalid type/cadence, exceeds max length, negative value)
 * Response 401: Not authenticated
 * Response 403: Not admin
 * Response 404: Card not found
 * Response 409: Duplicate benefit name within same card
 * Response 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, extractRequestContext, createAuthErrorResponse } from '@/features/admin/middleware/auth';
import {
  ListBenefitsQuerySchema,
  CreateBenefitSchema,
  parseQueryParams,
  parseRequestBody,
} from '@/features/admin/validation/schemas';
import { logResourceCreation } from '@/features/admin/lib/audit';
import type { PaginationMeta } from '@/features/admin/validation/schemas';

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

interface CreateBenefitResponse {
  success: true;
  data: BenefitItem;
  message: string;
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    try {
      await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Verify card exists
    const card = await prisma.masterCard.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 3. Parse and validate query parameters
    const queryObj = Object.fromEntries(request.nextUrl.searchParams.entries());
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

    // 4. Build filter conditions
    const where: any = { masterCardId: params.id };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // 5. Calculate pagination
    const skip = (query.page - 1) * query.limit;

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
        orderBy: { createdAt: 'desc' },
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
    console.error('[GET /api/admin/cards/[id]/benefits Error]', error);
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

// ============================================================
// POST Handler
// ============================================================

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const params = await context.params;
  try {
    // 1. Verify admin role
    let adminContext;
    try {
      adminContext = await verifyAdminRole();
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Extract request context
    const { ipAddress, userAgent } = extractRequestContext(request);

    // 3. Verify card exists
    const card = await prisma.masterCard.findUnique({
      where: { id: params.id },
      select: { id: true, cardName: true },
    });

    if (!card) {
      return NextResponse.json(
        {
          success: false,
          error: 'Card not found',
          code: 'CARD_NOT_FOUND',
        } as ErrorResponse,
        { status: 404 }
      );
    }

    // 4. Parse and validate request body
    const parseResult = parseRequestBody(CreateBenefitSchema, await request.json());

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

    const input = parseResult.data!;

    // 5. Create benefit in a transaction with duplicate check
    const benefit = await prisma.$transaction(async (tx) => {
      // Re-check for duplicate within transaction
      const existingBenefit = await tx.masterBenefit.findFirst({
        where: {
          masterCardId: params.id,
          name: {
            equals: input.name,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });

      if (existingBenefit) {
        throw new Error('DUPLICATE_BENEFIT');
      }

      // Create benefit - unique constraint is safety net
      return tx.masterBenefit.create({
        data: {
          masterCardId: params.id,
          name: input.name,
          type: input.type,
          stickerValue: input.stickerValue,
          resetCadence: input.resetCadence,
          isDefault: input.isDefault ?? true,
          isActive: true,
        },
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
      });
    });

    // 6. Log creation
    await logResourceCreation(
      adminContext,
      'BENEFIT',
      benefit.id,
      `${benefit.name} (${card.cardName})`,
      {
        name: benefit.name,
        type: benefit.type,
        stickerValue: benefit.stickerValue,
        resetCadence: benefit.resetCadence,
        isDefault: benefit.isDefault,
      },
      ipAddress,
      userAgent
    );

    const data: BenefitItem = {
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
    };

    return NextResponse.json(
      {
        success: true,
        data,
        message: 'Benefit created successfully',
      } as CreateBenefitResponse,
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/admin/cards/[id]/benefits Error]', error);

    const errorMessage = String(error);

    // Handle duplicate benefit error
    if (errorMessage.includes('DUPLICATE_BENEFIT')) {
      return NextResponse.json(
        {
          success: false,
          error: 'A benefit with this name already exists for this card',
          code: 'DUPLICATE_BENEFIT',
        } as ErrorResponse,
        { status: 409 }
      );
    }

    // Catch audit logging failures
    if (errorMessage.includes('Audit logging failed')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create audit trail - operation cannot proceed',
          code: 'AUDIT_LOGGING_FAILED',
        } as ErrorResponse,
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create benefit',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
