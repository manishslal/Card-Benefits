/**
 * PATCH /api/benefits/[id]/toggle-used
 *
 * Toggle "mark as used" for a benefit.
 *
 * When the Benefit Engine is enabled, blocks toggling on non-ACTIVE periods
 * (EXPIRED, UPCOMING, or any other future status).  Legacy rows with
 * periodStatus = null are allowed through.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { featureFlags } from '@/lib/feature-flags';

interface ToggleUsedRequest {
  isUsed: boolean;
}

interface ToggleUsedResponse {
  success: true;
  benefit: {
    id: string;
    isUsed: boolean;
    timesUsed: number;
    updatedAt: string;
    claimedAt: string | null;
    claimingAmount: number | null;
    claimingCadence: string | null;
    stickerValue: number | null;
  };
}

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    const benefitId = request.nextUrl.pathname.split('/')[3];
    const body = (await request.json().catch(() => ({}))) as ToggleUsedRequest;
    const isUsed = Boolean(body.isUsed);

    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      include: {
        userCard: {
          include: {
            player: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!benefit) {
      return NextResponse.json(
        { success: false, error: 'Benefit not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    if (benefit.userCard.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to update this benefit' } as ErrorResponse,
        { status: 403 }
      );
    }

    // Guard: prevent toggling benefits on a deleted card
    if (benefit.userCard.status === 'DELETED') {
      return NextResponse.json(
        { success: false, error: 'Cannot update benefits on a deleted card', code: 'CARD_DELETED' } as ErrorResponse,
        { status: 400 }
      );
    }

    // ── Period-status guard (api-4 + api-6) ─────────────────────────────────
    // When the Benefit Engine is enabled, only ACTIVE periods (or legacy null)
    // may be toggled.  This covers both used→unused and unused→used directions.
    if (featureFlags.BENEFIT_ENGINE_ENABLED) {
      const status = benefit.periodStatus;

      if (status === 'EXPIRED') {
        const endDate = benefit.periodEnd
          ? ` (ended ${benefit.periodEnd.toISOString().slice(0, 10)})`
          : '';
        return NextResponse.json(
          {
            success: false,
            error: `This benefit period has expired${endDate} and can no longer be marked as used.`,
            code: 'PERIOD_EXPIRED',
          } as ErrorResponse,
          { status: 400 }
        );
      }

      if (status === 'UPCOMING') {
        const startDate = benefit.periodStart
          ? ` (starts ${benefit.periodStart.toISOString().slice(0, 10)})`
          : '';
        return NextResponse.json(
          {
            success: false,
            error: `This benefit period has not started yet${startDate}.`,
            code: 'PERIOD_UPCOMING',
          } as ErrorResponse,
          { status: 400 }
        );
      }

      // Catch-all for any future status values that aren't ACTIVE or null (legacy)
      if (status && status !== 'ACTIVE') {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot update benefit in '${status}' status.`,
            code: 'INVALID_PERIOD_STATUS',
          } as ErrorResponse,
          { status: 400 }
        );
      }
    }

    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: {
        isUsed,
        timesUsed: isUsed && !benefit.isUsed ? benefit.timesUsed + 1 : benefit.timesUsed,
        claimedAt: isUsed ? new Date() : benefit.claimedAt,
      },
      include: { masterBenefit: true },
    });

    return NextResponse.json(
      {
        success: true,
        benefit: {
          id: updatedBenefit.id,
          isUsed: updatedBenefit.isUsed,
          timesUsed: updatedBenefit.timesUsed,
          updatedAt: updatedBenefit.updatedAt.toISOString(),
          claimedAt: updatedBenefit.claimedAt?.toISOString() ?? null,
          claimingAmount: updatedBenefit.masterBenefit?.claimingAmount ?? null,
          claimingCadence: updatedBenefit.masterBenefit?.claimingCadence ?? null,
          stickerValue: updatedBenefit.stickerValue,
        },
      } as ToggleUsedResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Toggle Used Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update benefit' } as ErrorResponse,
      { status: 500 }
    );
  }
}
