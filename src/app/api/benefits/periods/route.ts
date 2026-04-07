/**
 * GET /api/benefits/periods - List periods for a benefit
 * Automatically calculates periods based on resetCadence using UTC calculations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';
import { calculatePeriods } from '@/lib/period-utils';

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
    const cadence = searchParams.get('cadence') || 'MONTHLY';

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

    // QA-003: Use UTC-aware period calculations
    const calculatedPeriods = calculatePeriods(cadence || userBenefit.resetCadence, 12);

    // Map to database format
    const periods = calculatedPeriods.map((p, index) => ({
      id: `${userBenefitId}-${cadence}-${index}`,
      benefitId: userBenefitId,
      startDate: p.start,
      endDate: p.end,
      resetCadence: cadence || userBenefit.resetCadence,
      periodNumber: index,
      isArchived: p.end < new Date(),
    }));

    return NextResponse.json({
      success: true,
      data: periods,
      total: periods.length,
    });
  } catch (error) {
    // QA-008: Safe error logging without PII
    console.error('Error fetching periods:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
