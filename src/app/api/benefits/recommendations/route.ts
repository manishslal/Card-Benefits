/**
 * GET /api/benefits/recommendations - Generate recommendations based on user spending
 * Returns array of recommendations sorted by priority
 * 
 * QA-004: Fixed N+1 query by fetching all benefits and usage records upfront
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';
import { getCurrentPeriod } from '@/lib/period-utils';
import { featureFlags } from '@/lib/feature-flags';

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
    const limit = parseInt(searchParams.get('limit') || '5');

    // QA-004: Fetch all benefits and usage records upfront (not in a loop)
    const [userBenefits, allUsageRecords] = await Promise.all([
      prisma.userBenefit.findMany({
        where: {
          playerId,
          ...(featureFlags.BENEFIT_ENGINE_ENABLED
            ? { periodStatus: 'ACTIVE' }
            : {}),
        },
      }),
      prisma.benefitUsageRecord.findMany({
        where: { userId },
      }),
    ]);

    if (userBenefits.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No benefits found for this user',
      });
    }

    // QA-004: Build map for O(1) lookup instead of O(n²) with per-benefit queries
    const usageByBenefit = new Map<string, typeof allUsageRecords>();
    for (const record of allUsageRecords) {
      const benefitUsage = usageByBenefit.get(record.benefitId) || [];
      benefitUsage.push(record);
      usageByBenefit.set(record.benefitId, benefitUsage);
    }

    const recommendations: Array<{
      id: string;
      benefitId: string;
      title: string;
      value: number;
      reason: string;
      urgency: string;
      priority: number;
      potentialValue: number;
    }> = [];

    const now = new Date();

    // For each benefit, generate recommendations based on usage patterns
    for (const benefit of userBenefits) {
      if (!benefit.stickerValue && !benefit.userDeclaredValue) {
        continue;
      }

      const limitValue = benefit.userDeclaredValue || benefit.stickerValue;

      if (benefit.resetCadence === 'ONE_TIME') {
        continue;
      }

      // QA-004: Use map lookup instead of database query
      const usageRecords = usageByBenefit.get(benefit.id) || [];

      // Calculate current period usage
      const { start: periodStart } = getCurrentPeriod(benefit.resetCadence);

      // Filter usage records for current period
      const currentPeriodUsage = usageRecords.filter((r) => r.usageDate >= periodStart);
      const used = currentPeriodUsage.reduce((sum, r) => sum + Number(r.usageAmount), 0);
      const remaining = Math.max(0, limitValue - used);

      // Generate recommendation if benefit is underutilized
      if (remaining > 0 && used < limitValue * 0.5) {
        // Check expiration date for urgency
        let urgency = 'LOW';
        let priority = 3;

        if (benefit.expirationDate) {
          const daysUntilExpiration = Math.floor(
            (benefit.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysUntilExpiration <= 7) {
            urgency = 'HIGH';
            priority = 1;
          } else if (daysUntilExpiration <= 14) {
            urgency = 'MEDIUM';
            priority = 2;
          }
        }

        recommendations.push({
          id: `rec-${benefit.id}-${Date.now()}`,
          benefitId: benefit.id,
          title: `Don't miss your ${benefit.name}`,
          value: remaining,
          reason: `You have $${(remaining / 100).toFixed(2)} remaining in your ${benefit.name} benefit${
            benefit.expirationDate
              ? ` before ${benefit.expirationDate.toLocaleDateString()}`
              : ''
          }`,
          urgency,
          priority,
          potentialValue: remaining,
        });
      }
    }

    // Sort by priority and limit results
    const sorted = recommendations
      .sort((a, b) => a.priority - b.priority)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: sorted,
      total: sorted.length,
    });
  } catch (error) {
    // QA-008: Safe error logging without PII
    console.error('Error generating recommendations:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
