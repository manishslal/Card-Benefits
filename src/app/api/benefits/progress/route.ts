/**
 * GET /api/benefits/[id]/progress
 * Get single benefit progress tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import type { BenefitProgress } from '@/features/benefits/types/benefits';
import { Decimal } from '@prisma/client/runtime/library';

interface ErrorResponse {
  success: false;
  error: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    const { id: benefitId } = await params;

    // Get benefit with usage records
    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      include: {
        player: { select: { userId: true } },
        usageRecords: {
          where: {
            period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
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

    if (benefit.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ErrorResponse,
        { status: 403 }
      );
    }

    const benefitValue = benefit.userDeclaredValue || benefit.stickerValue;
    const totalUsed = benefit.usageRecords.reduce(
      (sum, record) => sum + parseFloat(record.amount.toString()),
      0
    );

    const daysRemaining = benefit.expirationDate
      ? Math.ceil((benefit.expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 0;

    const progress: BenefitProgress = {
      benefitId: benefit.id,
      benefitName: benefit.name,
      stickerValue: benefit.stickerValue,
      userValue: benefit.userDeclaredValue,
      currentPeriod: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      totalUsed,
      percentageUsed: Math.round((totalUsed / benefitValue) * 100),
      daysRemaining,
      resetDate: benefit.expirationDate?.toISOString() || '',
      status: benefit.isUsed ? 'USED' : benefit.expirationDate && daysRemaining <= 7 ? 'EXPIRING' : 'ACTIVE',
      usageRecords: benefit.usageRecords.map((r) => ({
        id: r.id,
        benefitId: r.benefitId,
        playerId: r.playerId,
        userCardId: r.userCardId,
        amount: r.amount.toString(),
        usageDate: r.usageDate.toISOString(),
        period: r.period,
        notes: r.notes || undefined,
        category: r.category || undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    };

    return NextResponse.json({ success: true, progress }, { status: 200 });
  } catch (error) {
    console.error('[Get Progress Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch progress' } as ErrorResponse,
      { status: 500 }
    );
  }
}
