/**
 * GET /api/benefits/recommendations - Generate recommendations based on user spending
 * Returns array of recommendations sorted by priority
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
    const limit = parseInt(searchParams.get('limit') || '5');

    // Get user's benefits
    const userBenefits = await prisma.userBenefit.findMany({
      where: { playerId },
    });

    if (userBenefits.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No benefits found for this user',
      });
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

    // For each benefit, generate recommendations based on usage patterns
    for (const benefit of userBenefits) {
      if (!benefit.stickerValue && !benefit.userDeclaredValue) {
        continue;
      }

      const limitValue = benefit.userDeclaredValue || benefit.stickerValue;

      if (benefit.resetCadence === 'ONE_TIME') {
        continue;
      }

      // Calculate current period usage
      const now = new Date();
      let periodStart = new Date(now);

      switch (benefit.resetCadence) {
        case 'MONTHLY':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'QUARTERLY':
          const quarter = Math.floor(now.getMonth() / 3);
          periodStart = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case 'ANNUAL':
        case 'CARDMEMBER_YEAR':
          periodStart = new Date(now.getFullYear(), 0, 1);
          break;
      }

      const usageRecords = await prisma.benefitUsageRecord.findMany({
        where: {
          benefitId: benefit.id,
          userId,
          usageDate: { gte: periodStart },
        },
      });

      const used = usageRecords.reduce((sum, r) => sum + Number(r.usageAmount), 0);
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
    console.error('Error generating recommendations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
