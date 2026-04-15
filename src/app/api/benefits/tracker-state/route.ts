import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { featureFlags } from '@/lib/feature-flags';
import {
  rebuildBenefitTrackerProjection,
  reconcileBenefitTrackerProjection,
} from '@/lib/benefit-event-ledger';
import { logSafeError } from '@/lib/error-logging';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userBenefitId = searchParams.get('userBenefitId');
    const rebuild = searchParams.get('rebuild') === 'true';
    const reconcile = searchParams.get('reconcile') === 'true';

    if (!userBenefitId) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'userBenefitId is required' },
        { status: 400 }
      );
    }

    const benefit = await prisma.userBenefit.findUnique({
      where: { id: userBenefitId },
      include: { userCard: { include: { player: { select: { userId: true } } } } },
    });

    if (!benefit) {
      return NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (benefit.userCard.player.userId !== userId) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    let projection = await prisma.benefitTrackerProjection.findUnique({
      where: { userBenefitId },
    });

    if (!projection || rebuild) {
      projection = await prisma.$transaction((tx) =>
        rebuildBenefitTrackerProjection(tx, userId, userBenefitId)
      );
    }

    let reconciliation = null;
    if (reconcile) {
      reconciliation = await reconcileBenefitTrackerProjection(userId, userBenefitId);
      projection = reconciliation.after;
    }

    let readShadow = null;
    if (featureFlags.EVENT_LEDGER_READ_SHADOW_ENABLED) {
      const usageRecords = await prisma.benefitUsageRecord.findMany({
        where: {
          benefitId: userBenefitId,
          userId,
          usageDate: {
            gte: projection.periodStart,
            lte: projection.periodEnd,
          },
        },
        select: {
          usageAmount: true,
          usageDate: true,
        },
      });
      const usageRecordCount = usageRecords.length;
      const usageAmountCentsTotal = usageRecords.reduce((sum, record) => {
        const amount = Number(record.usageAmount);
        if (!Number.isFinite(amount)) return sum;
        return sum + Math.round(amount * 100);
      }, 0);

      const unlimitedDelta = Number(benefit.timesUsed ?? 0) - Number(projection.unlimitedNetCount ?? 0);
      const spendDeltaCents = usageAmountCentsTotal - Number(projection.spendCentsTotal ?? 0);

      readShadow = {
        enabled: true,
        legacy: {
          usageRecordCount,
          usageAmountCentsTotal,
          benefitIsUsed: benefit.isUsed,
          benefitTimesUsed: benefit.timesUsed,
        },
        projection: {
          unlimitedNetCount: projection.unlimitedNetCount,
          spendCentsTotal: projection.spendCentsTotal,
          pointsTotal: projection.pointsTotal,
        },
        parity: {
          unlimited: {
            legacyTimesUsed: benefit.timesUsed,
            projectionUnlimitedNetCount: projection.unlimitedNetCount,
            delta: unlimitedDelta,
            isMatch: unlimitedDelta === 0,
          },
          multiplierSpend: {
            legacySpendCentsTotal: usageAmountCentsTotal,
            projectionSpendCentsTotal: projection.spendCentsTotal,
            deltaCents: spendDeltaCents,
            isMatch: spendDeltaCents === 0,
          },
          multiplierPoints: {
            projectionPointsTotal: projection.pointsTotal,
            legacyComparableSource: null,
            isEvaluated: false,
            note: 'Legacy usage records do not persist points totals; spend parity only.',
          },
        },
      };
    }

    return NextResponse.json(
      { success: true, trackerState: projection, reconciliation, readShadow },
      { status: 200 }
    );
  } catch (error) {
    logSafeError('Failed to fetch tracker state', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
