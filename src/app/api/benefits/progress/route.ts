/**
 * GET /api/benefits/progress - Calculate progress for a benefit
 * Returns { used, limit, percentage, status }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the first active player for this user
    const player = await prisma.player.findFirst({
      where: { userId, isActive: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'No active player found' }, { status: 404 });
    }

    const playerId = player.id;

    const { searchParams } = new URL(request.url);
    const userBenefitId = searchParams.get('benefitId');
    const periodId = searchParams.get('periodId');

    if (!userBenefitId) {
      return NextResponse.json(
        { error: 'benefitId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify user has access to this benefit
    const userBenefit = await prisma.userBenefit.findFirst({
      where: {
        id: userBenefitId,
        playerId,
      },
    });

    if (!userBenefit) {
      return NextResponse.json({ error: 'Benefit not found' }, { status: 404 });
    }

    // If no limit is set, return special response
    const limit = userBenefit.stickerValue || userBenefit.userDeclaredValue;
    if (!limit) {
      return NextResponse.json({
        success: true,
        data: {
          benefitId: userBenefitId,
          used: 0,
          limit: null,
          percentage: 0,
          status: 'no_limit',
          unit: 'N/A',
        },
      });
    }

    // Build query for usage records
    const usageWhere: Record<string, unknown> = {
      benefitId: userBenefitId,
      userId,
    };

    if (periodId) {
      usageWhere.benefitPeriodId = periodId;
    } else {
      // Get usage for current period based on resetCadence
      const now = new Date();
      let periodStart = new Date(now);
      let periodEnd = new Date(now);

      switch (userBenefit.resetCadence) {
        case 'MONTHLY':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'QUARTERLY':
          const quarter = Math.floor(now.getMonth() / 3);
          periodStart = new Date(now.getFullYear(), quarter * 3, 1);
          periodEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0);
          break;
        case 'ANNUAL':
        case 'CARDMEMBER_YEAR':
          periodStart = new Date(now.getFullYear(), 0, 1);
          periodEnd = new Date(now.getFullYear(), 11, 31);
          break;
        case 'ONE_TIME':
          // No period filtering for one-time
          break;
      }

      if (userBenefit.resetCadence !== 'ONE_TIME') {
        usageWhere.usageDate = {
          gte: periodStart,
          lte: periodEnd,
        };
      }
    }

    // Calculate total usage
    const usageRecords = await prisma.benefitUsageRecord.findMany({
      where: usageWhere,
    });

    const used = usageRecords.reduce((sum, record) => sum + Number(record.usageAmount), 0);

    // Calculate percentage
    let percentage = (used / limit) * 100;
    percentage = Math.min(percentage, 150); // Cap at 150% for visualization

    // Determine status
    let status: string;
    if (percentage === 0) {
      status = 'unused';
    } else if (percentage < 50) {
      status = 'active';
    } else if (percentage < 80) {
      status = 'warning';
    } else if (percentage < 100) {
      status = 'critical';
    } else {
      status = 'exceeded';
    }

    return NextResponse.json({
      success: true,
      data: {
        benefitId: userBenefitId,
        used: Math.round(used),
        limit,
        percentage: Math.round(percentage * 10) / 10,
        status,
        unit: 'dollars',
        periodId: periodId || null,
      },
    });
  } catch (error) {
    console.error('Error calculating progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
