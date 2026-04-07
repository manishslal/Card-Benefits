/**
 * GET /api/benefits/periods - List periods for a benefit
 * Automatically calculates periods based on resetCadence
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';

/**
 * Calculate period boundaries based on reset cadence
 */
function calculatePeriods(
  cadence: string,
  limitToMonths: number = 12
): Array<{ start: Date; end: Date }> {
  const periods: Array<{ start: Date; end: Date }> = [];
  const now = new Date();
  let currentDate = new Date(now);
  currentDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < limitToMonths; i++) {
    let periodStart: Date;
    let periodEnd: Date;

    switch (cadence) {
      case 'MONTHLY':
        periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);
        currentDate = new Date(periodStart);
        currentDate.setMonth(currentDate.getMonth() - 1);
        break;

      case 'QUARTERLY':
        const quarter = Math.floor(currentDate.getMonth() / 3);
        periodStart = new Date(currentDate.getFullYear(), quarter * 3, 1);
        periodEnd = new Date(currentDate.getFullYear(), quarter * 3 + 3, 0);
        periodEnd.setHours(23, 59, 59, 999);
        currentDate = new Date(periodStart);
        currentDate.setMonth(currentDate.getMonth() - 3);
        break;

      case 'ANNUAL':
        periodStart = new Date(currentDate.getFullYear(), 0, 1);
        periodEnd = new Date(currentDate.getFullYear(), 11, 31);
        periodEnd.setHours(23, 59, 59, 999);
        currentDate = new Date(periodStart);
        currentDate.setFullYear(currentDate.getFullYear() - 1);
        break;

      case 'CARDMEMBER_YEAR':
        // Assuming card member year starts in January
        periodStart = new Date(currentDate.getFullYear(), 0, 1);
        periodEnd = new Date(currentDate.getFullYear(), 11, 31);
        periodEnd.setHours(23, 59, 59, 999);
        currentDate = new Date(periodStart);
        currentDate.setFullYear(currentDate.getFullYear() - 1);
        break;

      case 'ONE_TIME':
        // One-time benefits have no reset, return a single period
        periodStart = new Date(1970, 0, 1);
        periodEnd = new Date(2099, 11, 31);
        periodEnd.setHours(23, 59, 59, 999);
        return [{ start: periodStart, end: periodEnd }];

      default:
        // Default to monthly
        periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        periodEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        periodEnd.setHours(23, 59, 59, 999);
        currentDate = new Date(periodStart);
        currentDate.setMonth(currentDate.getMonth() - 1);
    }

    periods.push({ start: periodStart, end: periodEnd });
  }

  return periods;
}

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

    // Calculate periods
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
    console.error('Error fetching periods:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
