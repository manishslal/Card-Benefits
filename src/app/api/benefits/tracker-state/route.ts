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
      const usageRecordCount = await prisma.benefitUsageRecord.count({
        where: { benefitId: userBenefitId, userId },
      });
      readShadow = {
        usageRecordCount,
        benefitIsUsed: benefit.isUsed,
        benefitTimesUsed: benefit.timesUsed,
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
