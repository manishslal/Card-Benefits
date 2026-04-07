/**
 * GET /api/benefits/[id]/status
 * 
 * Get current period status for a specific benefit on a specific card.
 * Works with existing UserBenefit model structure.
 * 
 * Query parameters:
 * - userCardId: string (required - which card to check)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';
import { logSafeError } from '@/lib/error-logging';
import {
  getPeriodBoundaries,
  calculateAmountPerPeriod,
  getNextPeriodReset,
  getDaysRemainingInPeriod,
  ResetCadence,
} from '@/lib/benefit-period-utils';

type Params = Promise<{ id: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHORIZED', message: 'Authentication required', statusCode: 401 },
        { status: 401 }
      );
    }

    const { id: benefitId } = await params;
    const { searchParams } = new URL(request.url);
    const userCardId = searchParams.get('userCardId');

    if (!userCardId) {
      return NextResponse.json(
        {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'userCardId is required',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // ========== Fetch UserBenefit (which is the benefit instance for this card) ==========
    const userBenefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      include: {
        userCard: {
          include: {
            masterCard: true,
          },
        },
      },
    });

    if (!userBenefit) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Benefit not found',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    // Verify card matches
    if (userBenefit.userCardId !== userCardId) {
      return NextResponse.json(
        {
          success: false,
          error: 'NOT_FOUND',
          message: 'Benefit not available on this card',
          statusCode: 404,
        },
        { status: 404 }
      );
    }

    const { userCard } = userBenefit;

    // ========== Calculate Current Period ==========
    const resetCadence = userBenefit.resetCadence as ResetCadence;
    const { start: periodStart, end: periodEnd } = getPeriodBoundaries(
      resetCadence,
      userCard.createdAt || new Date(),
      new Date()
    );

    const amountAvailable = calculateAmountPerPeriod(userBenefit.stickerValue, resetCadence);

    // ========== Fetch Current Period Claims ==========
    const currentClaims = await prisma.benefitUsageRecord.findMany({
      where: {
        benefitId: benefitId,
        usageDate: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    const amountClaimed = currentClaims.reduce((sum, claim) => sum + Number(claim.usageAmount), 0) * 100;
    const remaining = Math.max(0, amountAvailable - amountClaimed);
    const percentageClaimed = Math.round((amountClaimed / amountAvailable) * 100);

    let status: 'NOT_STARTED' | 'PARTIALLY_CLAIMED' | 'FULLY_CLAIMED' | 'EXPIRED';
    if (percentageClaimed === 0) {
      status = 'NOT_STARTED';
    } else if (percentageClaimed === 100) {
      status = 'FULLY_CLAIMED';
    } else {
      status = 'PARTIALLY_CLAIMED';
    }

    // ========== Calculate Upcoming Period ==========
    const nextReset = getNextPeriodReset(resetCadence, userCard.createdAt || new Date());
    const { start: nextStart, end: nextEnd } = getPeriodBoundaries(
      resetCadence,
      userCard.createdAt || new Date(),
      nextReset
    );

    // ========== Fetch Recent Claims (Last 3 periods) ==========
    const recentClaims = await prisma.benefitUsageRecord.findMany({
      where: {
        benefitId: benefitId,
        usageDate: {
          lt: periodStart,
        },
      },
      orderBy: { usageDate: 'desc' },
      take: 3,
    });

    // ========== Format Response ==========
    return NextResponse.json(
      {
        success: true,
        benefit: {
          id: userBenefit.id,
          name: userBenefit.name,
          description: userBenefit.type,
          annualAmount: userBenefit.stickerValue,
          card: {
            id: userCard.masterCard.id,
            name: userCard.masterCard.cardName,
            issuer: userCard.masterCard.issuer,
          },
        },
        currentPeriod: {
          periodStart,
          periodEnd,
          resetCadence,
          amountAvailable,
          amountClaimed,
          remaining,
          percentageClaimed,
          status,
          claimDate: currentClaims.length > 0 ? currentClaims[0].usageDate : null,
        },
        upcomingPeriod: {
          periodStart: nextStart,
          periodEnd: nextEnd,
          resetCadence,
          amountAvailable: calculateAmountPerPeriod(userBenefit.stickerValue, resetCadence),
          amountClaimed: 0,
          remaining: calculateAmountPerPeriod(userBenefit.stickerValue, resetCadence),
          percentageClaimed: 0,
          status: 'NOT_STARTED',
        },
        daysUntilReset: getDaysRemainingInPeriod(resetCadence, userCard.createdAt || new Date()),
        recentClaims: recentClaims.map(claim => ({
          periodStart: claim.usageDate,
          periodEnd: claim.usageDate,
          amountClaimed: Math.round(Number(claim.usageAmount) * 100),
          claimDate: claim.usageDate,
          notes: claim.notes,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    logSafeError('Error fetching benefit status', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR', message: 'Internal server error', statusCode: 500 },
      { status: 500 }
    );
  }
}

