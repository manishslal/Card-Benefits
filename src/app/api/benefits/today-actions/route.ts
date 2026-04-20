/**
 * GET /api/benefits/today-actions
 *
 * Returns benefits organized into 4 action-oriented sections:
 *   - urgent:             Unused benefits expiring within 7 days
 *   - availableThisMonth: Unused ACTIVE benefits for this month (not urgent)
 *   - upcomingResets:     Used benefits with periodEnd this month (will reset soon)
 *   - recentlyUsed:      Benefits marked used in the last 7 days
 *
 * Auth: x-user-id header → player resolution (same as all benefit routes)
 * Feature flag: BENEFIT_ENGINE_ENABLED must be true
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { featureFlags } from '@/lib/feature-flags';

// ============================================================
// Type Definitions
// ============================================================

interface TodayBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number; // cents
  isUsed: boolean;
  periodEnd: string | null;
  periodStart: string | null;
  resetCadence: string;
  claimedAt: string | null;
  daysLeft: number | null; // days until periodEnd
  cardName: string;
  cardIssuer: string;
  userCardId: string;
}

interface TodayActionsResponse {
  success: true;
  sections: {
    urgent: TodayBenefit[];
    availableThisMonth: TodayBenefit[];
    upcomingResets: TodayBenefit[];
    recentlyUsed: TodayBenefit[];
  };
}

interface ErrorResponse {
  success: false;
  error: string;
}

// ============================================================
// Helpers
// ============================================================

function getDaysLeft(periodEnd: Date | null, now: Date): number | null {
  if (!periodEnd) return null;
  const diffMs = periodEnd.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function getEndOfMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

// Common select fields for all queries
const benefitSelect = {
  id: true,
  name: true,
  type: true,
  stickerValue: true,
  isUsed: true,
  periodEnd: true,
  periodStart: true,
  resetCadence: true,
  claimedAt: true,
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
} as const;

type RawBenefit = {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  isUsed: boolean;
  periodEnd: Date | null;
  periodStart: Date | null;
  resetCadence: string;
  claimedAt: Date | null;
  userCardId: string;
  userCard: {
    masterCard: {
      cardName: string;
      issuer: string;
    };
  };
};

function transformBenefit(raw: RawBenefit, now: Date): TodayBenefit {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    stickerValue: raw.stickerValue,
    isUsed: raw.isUsed,
    periodEnd: raw.periodEnd?.toISOString() ?? null,
    periodStart: raw.periodStart?.toISOString() ?? null,
    resetCadence: raw.resetCadence,
    claimedAt: raw.claimedAt?.toISOString() ?? null,
    daysLeft: getDaysLeft(raw.periodEnd, now),
    cardName: raw.userCard.masterCard.cardName,
    cardIssuer: raw.userCard.masterCard.issuer,
    userCardId: raw.userCardId,
  };
}

// ============================================================
// GET Handler
// ============================================================

export async function GET(request: NextRequest): Promise<NextResponse<TodayActionsResponse | ErrorResponse>> {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    // Feature flag gate
    if (!featureFlags.BENEFIT_ENGINE_ENABLED) {
      return NextResponse.json(
        {
          success: true,
          sections: {
            urgent: [],
            availableThisMonth: [],
            upcomingResets: [],
            recentlyUsed: [],
          },
        } as TodayActionsResponse,
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
        {
          success: true,
          sections: {
            urgent: [],
            availableThisMonth: [],
            upcomingResets: [],
            recentlyUsed: [],
          },
        } as TodayActionsResponse,
        { status: 200 }
      );
    }

    // ── Date boundaries ────────────────────────────────────────────
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const endOfMonth = getEndOfMonth(now);

    // Common base filter
    const baseWhere = {
      playerId: player.id,
      status: { not: 'ARCHIVED' },
    };

    // ── Query 1: Urgent (expiring within 7 days, unused) ───────────
    const urgentRaw = await prisma.userBenefit.findMany({
      where: {
        ...baseWhere,
        isUsed: false,
        periodStatus: 'ACTIVE',
        type: { not: 'Lounge Access' },
        periodEnd: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      select: benefitSelect,
      orderBy: { periodEnd: 'asc' },
    });

    // ── Query 2: Available this month (unused, not urgent) ─────────
    const availableRaw = await prisma.userBenefit.findMany({
      where: {
        ...baseWhere,
        isUsed: false,
        periodStatus: 'ACTIVE',
        type: { not: 'Lounge Access' },
        periodEnd: {
          gt: sevenDaysFromNow,
          lte: endOfMonth,
        },
      },
      select: benefitSelect,
      orderBy: { periodEnd: 'asc' },
    });

    // ── Query 3: Upcoming resets (used, expiring this month) ───────
    const upcomingResetsRaw = await prisma.userBenefit.findMany({
      where: {
        ...baseWhere,
        isUsed: true,
        periodStatus: 'ACTIVE',
        periodEnd: {
          gte: now,
          lte: endOfMonth,
        },
      },
      select: benefitSelect,
      orderBy: { periodEnd: 'asc' },
    });

    // ── Query 4: Recently used (last 7 days) ──────────────────────
    const recentlyUsedRaw = await prisma.userBenefit.findMany({
      where: {
        ...baseWhere,
        isUsed: true,
        claimedAt: {
          gte: sevenDaysAgo,
        },
      },
      select: benefitSelect,
      orderBy: { claimedAt: 'desc' },
      take: 10,
    });

    // ── Transform results ──────────────────────────────────────────
    const sections = {
      urgent: urgentRaw.map(b => transformBenefit(b, now)),
      availableThisMonth: availableRaw.map(b => transformBenefit(b, now)),
      upcomingResets: upcomingResetsRaw.map(b => transformBenefit(b, now)),
      recentlyUsed: recentlyUsedRaw.map(b => transformBenefit(b, now)),
    };

    return NextResponse.json(
      { success: true, sections } as TodayActionsResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[today-actions] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ErrorResponse,
      { status: 500 }
    );
  }
}
