/**
 * POST /api/benefits/usage - Create a new period-based usage record (Phase 6)
 * GET /api/benefits/usage - List usage records with pagination and filters
 * 
 * Adapted for existing UserBenefit schema structure. Works with:
 * - userBenefitId (UserBenefit instance on a card)
 * - Usage tracking via BenefitUsageRecord
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';
import { logSafeError } from '@/lib/error-logging';

/**
 * POST /api/benefits/usage
 * 
 * Create a new benefit usage record for a specific period.
 * 
 * Request body:
 * {
 *   "userBenefitId": string,  // The UserBenefit instance (benefit on a card)
 *   "userCardId": string,      // The card instance
 *   "usageAmount": number,     // Amount in dollars (converted to Decimal)
 *   "notes": string,           // Optional notes
 *   "usageDate": ISO date      // Optional specific date (defaults to today)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userBenefitId, userCardId, usageAmount, notes, usageDate } = body;

    // ========== Validation ==========
    if (!userBenefitId || !userCardId) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Missing required fields: userBenefitId, userCardId',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (usageAmount === undefined || typeof usageAmount !== 'number' || usageAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'usageAmount must be a positive number (in dollars)',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Max amount validation
    if (usageAmount > 999999.99) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'usageAmount exceeds maximum allowed',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    if (notes && typeof notes === 'string' && notes.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Notes must not exceed 500 characters',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // ========== Fetch and Validate UserBenefit ==========
    const userBenefit = await prisma.userBenefit.findUnique({
      where: { id: userBenefitId },
      include: { userCard: true },
    });

    if (!userBenefit || userBenefit.userCardId !== userCardId) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Benefit not found on this card',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // ========== Validate and Determine Usage Date ==========
    const claimDate = usageDate ? new Date(usageDate) : new Date();
    if (claimDate > new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Cannot record usage for future dates',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // ========== Create Usage Record ==========
    try {
      const record = await prisma.benefitUsageRecord.create({
        data: {
          benefitId: userBenefitId,
          userId,
          usageAmount: usageAmount, // Stored as Decimal
          notes: notes || null,
          usageDate: claimDate,
          category: userBenefit.type || null,
        },
      });

      return NextResponse.json(
        {
          success: true,
          record: {
            id: record.id,
            userBenefitId: record.benefitId,
            usageAmount: Number(record.usageAmount),
            notes: record.notes,
            usageDate: record.usageDate,
            claimDate: record.usageDate,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            message: 'Benefit usage recorded successfully',
          },
        },
        { status: 201 }
      );
    } catch (error: any) {
      // Handle duplicate constraint violations
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error: 'DUPLICATE_CLAIM',
            message: 'Usage already recorded for this benefit on this date',
            statusCode: 409,
          },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    logSafeError('Error creating usage record', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
      { status: 500 }
    );
  }
}

/**
 * GET /api/benefits/usage
 * 
 * List all benefit usage records for the authenticated user with pagination and filtering.
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - userCardId: string (optional filter)
 * - userBenefitId: string (optional filter)
 * - sortBy: "usageDate" | "usageAmount" (default: "usageDate")
 * - sortOrder: "asc" | "desc" (default: "desc")
 */
export async function GET(request: NextRequest) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const userBenefitId = searchParams.get('userBenefitId') || undefined;
    const sortBy = searchParams.get('sortBy') || 'usageDate';
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';

    const skip = (page - 1) * limit;

    // Build filter
    const where: Record<string, any> = { userId };

    if (userBenefitId) {
      where.benefitId = userBenefitId;
    }

    // Get total count
    const total = await prisma.benefitUsageRecord.count({ where });

    // Fetch records with pagination
    const records = await prisma.benefitUsageRecord.findMany({
      where,
      orderBy: {
        [sortBy === 'usageAmount' ? 'usageAmount' : 'usageDate']:
          sortOrder === 'asc' ? 'asc' : 'desc',
      },
      skip,
      take: limit,
      include: {
        userBenefit: {
          select: {
            id: true,
            name: true,
            userCard: {
              select: {
                masterCard: {
                  select: { cardName: true },
                },
              },
            },
          },
        },
      },
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(
      {
        success: true,
        data: records.map(r => ({
          id: r.id,
          userId: r.userId,
          userBenefitId: r.benefitId,
          benefitName: r.userBenefit?.name,
          cardName: r.userBenefit?.userCard?.masterCard?.cardName,
          usageAmount: Number(r.usageAmount),
          usageDate: r.usageDate,
          notes: r.notes,
          category: r.category,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logSafeError('Error fetching usage records', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
      { status: 500 }
    );
  }
}
