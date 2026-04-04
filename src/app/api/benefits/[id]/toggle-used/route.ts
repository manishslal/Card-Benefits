/**
 * PATCH /api/benefits/[id]/toggle-used
 *
 * Toggle "mark as used" for a benefit
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
  };
}

interface ErrorResponse {
  success: false;
  error: string;
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

    const updatedBenefit = await prisma.userBenefit.update({
      where: { id: benefitId },
      data: {
        isUsed,
        timesUsed: isUsed && !benefit.isUsed ? benefit.timesUsed + 1 : benefit.timesUsed,
        claimedAt: isUsed ? new Date() : benefit.claimedAt,
      },
    });

    return NextResponse.json(
      {
        success: true,
        benefit: {
          id: updatedBenefit.id,
          isUsed: updatedBenefit.isUsed,
          timesUsed: updatedBenefit.timesUsed,
          updatedAt: updatedBenefit.updatedAt.toISOString(),
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
