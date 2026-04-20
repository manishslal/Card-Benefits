/**
 * GET /api/benefits/expiring-soon
 *
 * Returns all ACTIVE-period, unused benefits expiring within the current
 * calendar month across ALL of the user's cards. Excludes lounge-type benefits.
 *
 * Requires: BENEFIT_ENGINE_ENABLED feature flag
 *
 * Response 200:
 * {
 *   "success": true,
 *   "benefits": ExpiringBenefit[],
 *   "totalValue": number (cents)
 * }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { featureFlags } from '@/lib/feature-flags';

// ============================================================
// Type Definitions
// ============================================================

interface ExpiringBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number; // cents
  periodEnd: string; // ISO
  daysLeft: number;
  cardName: string;
  cardIssuer: string;
  userCardId: string;
}

// ============================================================
// GET Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // This endpoint only makes sense when the benefit engine is on
    if (!featureFlags.BENEFIT_ENGINE_ENABLED) {
      return NextResponse.json(
        { success: true, benefits: [], totalValue: 0 },
        { status: 200 }
      );
    }

    // ── Resolve player ─────────────────────────────────────────────
    const player = await prisma.player.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!player) {
      return NextResponse.json(
        { success: true, benefits: [], totalValue: 0 },
        { status: 200 }
      );
    }

    // ── Calculate end of current month ─────────────────────────────
    const now = new Date();
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    // ── Query expiring benefits ────────────────────────────────────
    const rawBenefits = await prisma.userBenefit.findMany({
      where: {
        playerId: player.id,
        isUsed: false,
        status: { not: 'ARCHIVED' },
        periodStatus: 'ACTIVE',
        periodEnd: {
          gte: now,
          lte: endOfMonth,
        },
        type: {
          notIn: ['Lounge Access', 'lounge'],
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        stickerValue: true,
        periodEnd: true,
        userCardId: true,
        userCard: {
          select: {
            masterCard: {
              select: {
                cardName: true,
                issuer: true,
              },
            },
          },
        },
      },
      orderBy: { periodEnd: 'asc' },
    });

    // ── Transform to response shape ───────────────────────────────
    const benefits: ExpiringBenefit[] = rawBenefits.map((b) => {
      const periodEndDate = b.periodEnd as Date;
      const diffMs = periodEndDate.getTime() - now.getTime();
      const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      return {
        id: b.id,
        name: b.name,
        type: b.type,
        stickerValue: b.stickerValue,
        periodEnd: periodEndDate.toISOString(),
        daysLeft,
        cardName: b.userCard.masterCard.cardName,
        cardIssuer: b.userCard.masterCard.issuer,
        userCardId: b.userCardId,
      };
    });

    const totalValue = benefits.reduce((sum, b) => sum + b.stickerValue, 0);

    return NextResponse.json(
      { success: true, benefits, totalValue },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/benefits/expiring-soon Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve expiring benefits' },
      { status: 500 }
    );
  }
}
