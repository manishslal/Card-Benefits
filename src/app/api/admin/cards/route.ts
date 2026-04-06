/**
 * GET /api/admin/cards
 * 
 * @summary List all master cards with pagination, search, and filtering
 * @rateLimit 100 requests per minute (per admin user)
 * @auth Required - Admin role
 * @pagination Supports pagination with max 100 items per page
 *
 * Query Parameters:
 * - page: number (default: 1) - Page number
 * - limit: number (default: 20, max: 100) - Items per page
 * - issuer?: string - Filter by issuer (case-insensitive, max 255 chars)
 * - search?: string - Search in card name and issuer (max 255 chars)
 * - isActive?: boolean - Filter by active status
 * - sortBy?: 'issuer' | 'cardName' | 'displayOrder' | 'updatedAt' (default: 'displayOrder')
 * - sortDirection?: 'asc' | 'desc' (default: 'asc')
 *
 * Response 200: List of cards with pagination metadata
 * Response 400: Invalid query parameters
 * Response 401: Not authenticated
 * Response 403: Not admin
 * Response 500: Server error
 *
 * POST /api/admin/cards
 * 
 * @summary Create a new master card
 * @rateLimit 50 requests per minute (per admin user)
 * @auth Required - Admin role
 * @constraint Issuer + CardName must be unique (returns 409 if duplicate)
 *
 * Request Body:
 * {
 *   "issuer": string (required, max 100 chars)
 *   "cardName": string (required, max 200 chars)
 *   "defaultAnnualFee": number (required, >= 0)
 *   "cardImageUrl": string (required, valid URL)
 * }
 *
 * Response 201: Card created successfully with full card object
 * Response 400: Validation error (invalid params, bad URL, negative fee, etc)
 * Response 401: Not authenticated
 * Response 403: Not admin
 * Response 409: Duplicate card (issuer + cardName already exists)
 * Response 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole, createAuthErrorResponse, extractRequestContext } from '@/features/admin/middleware/auth';
import { ListCardsQuerySchema, parseQueryParams, CreateCardSchema, parseRequestBody } from '@/features/admin/validation/schemas';
import { logResourceCreation } from '@/features/admin/lib/audit';
import type { PaginationMeta } from '@/features/admin/validation/schemas';

// ============================================================
// Types
// ============================================================

interface CardListItem {
  id: string;
  issuer: string;
  cardName: string;
  defaultAnnualFee: number;
  cardImageUrl: string;
  displayOrder: number;
  isActive: boolean;
  isArchived: boolean;
  benefitCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ListCardsResponse {
  success: true;
  data: CardListItem[];
  pagination: PaginationMeta;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
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
    const parseResult = parseQueryParams(ListCardsQuerySchema, queryObj);

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
        } as Record<string, unknown>,
        { status: 400 }
      );
    }

    const query = parseResult.data!;

    // 3. Build filter conditions
    const where: Record<string, unknown> = {};

    // Filter by active status
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    // Filter by issuer (case-insensitive)
    if (query.issuer) {
      where.issuer = {
        contains: query.issuer,
        mode: 'insensitive',
      };
    }

    // Search in cardName and issuer
    if (query.search) {
      where.OR = [
        {
          cardName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          issuer: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // 4. Build sort order
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    switch (query.sortBy) {
      case 'issuer':
        orderBy.issuer = query.sortDirection;
        break;
      case 'cardName':
        orderBy.cardName = query.sortDirection;
        break;
      case 'updatedAt':
        orderBy.updatedAt = query.sortDirection;
        break;
      case 'displayOrder':
      default:
        orderBy.displayOrder = query.sortDirection;
        break;
    }

    // 5. Calculate pagination
    const skip = (query.page - 1) * query.limit;

    // 6. Execute queries in parallel
    const [totalCount, cards] = await Promise.all([
      prisma.masterCard.count({ where }),
      prisma.masterCard.findMany({
        where,
        select: {
          id: true,
          issuer: true,
          cardName: true,
          defaultAnnualFee: true,
          cardImageUrl: true,
          displayOrder: true,
          isActive: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              masterBenefits: true,
            },
          },
        },
        orderBy,
        skip,
        take: query.limit,
      }),
    ]);

    // 7. Transform response
    const totalPages = Math.ceil(totalCount / query.limit);
    const data: CardListItem[] = cards.map((card) => ({
      id: card.id,
      issuer: card.issuer,
      cardName: card.cardName,
      defaultAnnualFee: card.defaultAnnualFee,
      cardImageUrl: card.cardImageUrl,
      displayOrder: card.displayOrder,
      isActive: card.isActive,
      isArchived: card.isArchived,
      benefitCount: card._count.masterBenefits,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
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
      } as ListCardsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/admin/cards Error]', error);
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

// ============================================================
// POST Handler
// ============================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Verify admin role
    let adminContext;
    try {
      adminContext = await verifyAdminRole(request);
    } catch (error) {
      const code = (error as Error).message || 'ADMIN_ROLE_REQUIRED';
      return createAuthErrorResponse(code);
    }

    // 2. Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON',
          code: 'INVALID_REQUEST_BODY',
        },
        { status: 400 }
      );
    }

    // 3. Validate request body
    const parseResult = parseRequestBody(CreateCardSchema, body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: parseResult.errors?.details || [],
        },
        { status: 400 }
      );
    }

    const input = parseResult.data!;

    // 4. Create the card in a transaction to ensure atomicity
    // If a duplicate is created between check and insert (race condition),
    // the database unique constraint will catch it
    const card = await prisma.$transaction(async (tx) => {
      // Re-check for duplicate within transaction to minimize race window
      const existingCard = await tx.masterCard.findFirst({
        where: {
          AND: [
            { issuer: input.issuer },
            { cardName: input.cardName },
          ],
        },
        select: { id: true },
      });

      if (existingCard) {
        throw new Error('DUPLICATE_CARD');
      }

      // Create the card - unique constraint is the safety net if race condition occurs
      return tx.masterCard.create({
        data: {
          issuer: input.issuer,
          cardName: input.cardName,
          defaultAnnualFee: input.defaultAnnualFee,
          cardImageUrl: input.cardImageUrl,
          displayOrder: 0, // Default order, can be reordered later
          isActive: true,
          isArchived: false,
        },
        select: {
          id: true,
          issuer: true,
          cardName: true,
          defaultAnnualFee: true,
          cardImageUrl: true,
          displayOrder: true,
          isActive: true,
          isArchived: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              masterBenefits: true,
            },
          },
        },
      });
    });

    // 6. Log audit trail
    const context = extractRequestContext(request);
    await logResourceCreation(
      { ...adminContext, ...context },
      'CARD',
      card.id,
      `${card.issuer} ${card.cardName}`,
      {
        issuer: card.issuer,
        cardName: card.cardName,
        defaultAnnualFee: card.defaultAnnualFee,
        cardImageUrl: card.cardImageUrl,
      },
      context.ipAddress,
      context.userAgent
    );

    // 7. Return created card
    return NextResponse.json(
      {
        success: true,
        data: {
          id: card.id,
          issuer: card.issuer,
          cardName: card.cardName,
          defaultAnnualFee: card.defaultAnnualFee,
          cardImageUrl: card.cardImageUrl,
          displayOrder: card.displayOrder,
          isActive: card.isActive,
          isArchived: card.isArchived,
          benefitCount: card._count?.masterBenefits || 0,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        },
        message: 'Card created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/admin/cards Error]', error);

    // Handle specific error cases
    const errorMessage = String(error);

    // Catch duplicate card errors (from transaction or unique constraint)
    if (
      errorMessage.includes('DUPLICATE_CARD') ||
      errorMessage.includes('Unique constraint failed')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'A card with this issuer and name already exists',
          code: 'DUPLICATE_CARD',
        } as ErrorResponse,
        { status: 409 }
      );
    }

    // Catch audit logging failures (which now throw)
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
        error: 'Failed to create card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}

