/**
 * POST /api/benefits/usage - Create a new period-based usage record (Phase 6)
 * GET /api/benefits/usage - List usage records with pagination and filters
 * 
 * Phase 6C: Added claiming cadence validation to enforce period limits
 * Works with:
 * - userBenefitId (UserBenefit instance on a card)
 * - Usage tracking via BenefitUsageRecord
 * - Claiming limits via MasterBenefit.claimingCadence and claimingAmount
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';
import { logSafeError } from '@/lib/error-logging';
import { validateClaimingRequest, getClaimingLimitsInfo } from '@/lib/claiming-validation';
import { getUrgencyLevel } from '@/lib/benefit-period-utils';

/**
 * POST /api/benefits/usage
 * 
 * Create a new benefit usage record for a specific period.
 * Phase 6C: Validates claim against claimingCadence and claimingAmount limits.
 * 
 * Request body:
 * {
 *   "userBenefitId": string,  // The UserBenefit instance (benefit on a card)
 *   "userCardId": string,      // The card instance
 *   "usageAmount": number,     // Amount in dollars (converted to cents internally)
 *   "notes": string,           // Optional notes
 *   "usageDate": ISO date      // Optional specific date (defaults to today)
 * }
 * 
 * Phase 6C Error Codes:
 * - CLAIMING_LIMIT_EXCEEDED: Claim exceeds period limit
 * - ALREADY_CLAIMED_ONE_TIME: ONE_TIME benefit already claimed
 * - INVALID_CLAIMING_AMOUNT: Amount invalid (negative, fractional)
 * - CLAIMING_WINDOW_CLOSED: Period has ended
 * - BENEFIT_NOT_CONFIGURED: Benefit missing claiming cadence
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

    // ========== PHASE 6C: Claiming Cadence Validation ==========
    // Convert usageAmount (dollars) to cents
    const claimAmountCents = Math.round(usageAmount * 100);

    // Check if benefit has MasterBenefit with claiming cadence configured
    // For now, if UserBenefit, we may not have direct access to MasterBenefit
    // In a full implementation, UserBenefit should have a masterBenefitId reference
    // For this version, we'll fetch it via the card and benefit match
    let masterBenefit: any = null;
    if (userBenefit.userCard?.masterCardId) {
      // Try to find matching master benefit by name/type/resetCadence
      const masterBenefits = await prisma.masterBenefit.findMany({
        where: {
          masterCardId: userBenefit.userCard.masterCardId,
          name: userBenefit.name,
          type: userBenefit.type,
        },
        take: 1,
      });
      if (masterBenefits.length > 0) {
        masterBenefit = masterBenefits[0];
      }
    }

    // If master benefit has claiming cadence, validate the claim
    if (masterBenefit?.claimingCadence) {
      // Fetch existing usage records for this benefit
      const existingUsage = await prisma.benefitUsageRecord.findMany({
        where: {
          benefitId: userBenefitId,
          userId,
        },
      });

      // Validate against claiming limits
      const validation = validateClaimingRequest(
        masterBenefit.claimingAmount,
        masterBenefit.claimingCadence as any,
        claimAmountCents,
        existingUsage,
        claimDate,
        masterBenefit.claimingWindowEnd
      );

      if (!validation.valid && validation.error) {
        const statusCode = validation.error.statusCode;
        return NextResponse.json(
          {
            success: false,
            error: validation.error.code,
            code: validation.error.code,
            message: validation.error.message,
            details: validation.error.details,
            statusCode,
          },
          { status: statusCode }
        );
      }
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

      // Get claiming limits info for response (if configured)
      let claimingInfo: any = null;
      if (masterBenefit?.claimingCadence) {
        const allUsage = await prisma.benefitUsageRecord.findMany({
          where: {
            benefitId: userBenefitId,
            userId,
          },
        });
        claimingInfo = getClaimingLimitsInfo(
          userBenefitId,
          masterBenefit.claimingAmount,
          masterBenefit.claimingCadence as any,
          allUsage,
          claimDate,
          masterBenefit.claimingWindowEnd,
          userBenefit.name
        );
      }

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
            // Phase 6C: Include claiming info in response
            ...(claimingInfo && {
              claimingInfo: {
                claimingCadence: claimingInfo.claimingCadence,
                periodStart: claimingInfo.periodStart,
                periodEnd: claimingInfo.periodEnd,
                periodLabel: claimingInfo.periodLabel,
                maxClaimableThisPeriod: claimingInfo.maxClaimableAmount,
                alreadyClaimedThisPeriod: claimingInfo.alreadyClaimedAmount,
                remainingThisPeriod: claimingInfo.remainingAmount,
                daysUntilExpiration: claimingInfo.daysUntilExpiration,
              },
            }),
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
 * Phase 6C: Includes claiming cadence metadata in response.
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - userCardId: string (optional filter)
 * - userBenefitId: string (optional filter)
 * - cadence: string (optional filter - MONTHLY, QUARTERLY, etc.)
 * - urgency: string (optional filter - CRITICAL, HIGH, MEDIUM, LOW)
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
    const cadenceFilter = searchParams.get('cadence') || undefined; // Phase 6C: Cadence filter
    const urgencyFilter = searchParams.get('urgency') || undefined; // Phase 6C: Urgency filter
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

    // Fetch records with pagination and benefitIncludes
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
            type: true,
            userCard: {
              select: {
                masterCardId: true,
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

    // Phase 6C: Enrich records with claiming cadence metadata
    const enrichedRecords = await Promise.all(
      records.map(async (r) => {
        let claimingCadence: any = null;
        let claimingAmount: any = null;
        let claimingWindowEnd: any = null;
        let urgencyLevel: any = null;

        // Try to find master benefit to get claiming cadence
        if (r.userBenefit?.userCard?.masterCardId) {
          const masterBenefits = await prisma.masterBenefit.findMany({
            where: {
              masterCardId: r.userBenefit.userCard.masterCardId,
              name: r.userBenefit.name,
              type: r.userBenefit.type,
            },
            select: {
              claimingCadence: true,
              claimingAmount: true,
              claimingWindowEnd: true,
            },
            take: 1,
          });

          if (masterBenefits.length > 0) {
            claimingCadence = masterBenefits[0].claimingCadence;
            claimingAmount = masterBenefits[0].claimingAmount;
            claimingWindowEnd = masterBenefits[0].claimingWindowEnd;

            // Calculate urgency level
            if (claimingCadence) {
              urgencyLevel = getUrgencyLevel(claimingCadence, r.usageDate, claimingWindowEnd);
            }
          }
        }

        return {
          id: r.id,
          userId: r.userId,
          userBenefitId: r.benefitId,
          benefitName: r.userBenefit?.name,
          benefitType: r.userBenefit?.type,
          cardName: r.userBenefit?.userCard?.masterCard?.cardName,
          usageAmount: Number(r.usageAmount),
          usageDate: r.usageDate,
          notes: r.notes,
          category: r.category,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          // Phase 6C: Claiming cadence metadata
          claimingCadence,
          claimingAmount,
          urgencyLevel,
        };
      })
    );

    // Phase 6C: Filter by cadence and urgency if provided
    let filteredRecords = enrichedRecords;
    if (cadenceFilter) {
      filteredRecords = filteredRecords.filter(r => r.claimingCadence === cadenceFilter);
    }
    if (urgencyFilter) {
      filteredRecords = filteredRecords.filter(r => r.urgencyLevel === urgencyFilter);
    }

    return NextResponse.json(
      {
        success: true,
        data: filteredRecords,
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

