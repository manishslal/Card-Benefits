/**
 * GET /api/benefits/history
 *
 * Returns paginated EXPIRED-period benefits for the authenticated user.
 * Only relevant when BENEFIT_ENGINE_ENABLED=true (period-based tracking).
 *
 * Query Parameters:
 *   - page?:        number  (default: 1, min: 1)
 *   - limit?:       number  (default: 20, max: 100)
 *   - cardId?:      string  (filter by specific UserCard)
 *   - benefitType?: string  (filter by benefit type, e.g. "Travel")
 *
 * Sort: periodEnd DESC (most recently expired first)
 *
 * Response 200:
 * {
 *   "success": true,
 *   "benefits": [...],
 *   "pagination": { total, page, limit, totalPages, hasMore }
 * }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 400: Invalid parameters
 *   - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { featureFlags } from '@/lib/feature-flags';

// ============================================================
// Type Definitions
// ============================================================

interface HistoryBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  isUsed: boolean;
  timesUsed: number;
  periodStart: string | null;
  periodEnd: string | null;
  periodStatus: string;
  masterBenefitId: string | null;
  claimingCadence: string | null;
  // Card context so the UI can group by card
  userCardId: string;
  cardName: string;
  cardIssuer: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
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
        {
          success: true,
          benefits: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0, hasMore: false },
        },
        { status: 200 }
      );
    }

    // ── Parse & validate query parameters ──────────────────────────
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1),
      100
    );
    const cardId = searchParams.get('cardId') || undefined;
    const benefitType = searchParams.get('benefitType') || undefined;

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
          benefits: [],
          pagination: { total: 0, page: 1, limit, totalPages: 0, hasMore: false },
        },
        { status: 200 }
      );
    }

    // ── Build where clause ─────────────────────────────────────────
    const where: Record<string, unknown> = {
      playerId: player.id,
      periodStatus: 'EXPIRED',
      status: { not: 'ARCHIVED' },
    };

    if (cardId) {
      where.userCardId = cardId;
    }
    if (benefitType) {
      where.type = benefitType;
    }

    // ── Count total for pagination ─────────────────────────────────
    const total = await prisma.userBenefit.count({ where });

    // ── Fetch paginated expired benefits ───────────────────────────
    const offset = (page - 1) * limit;
    const rawBenefits = await prisma.userBenefit.findMany({
      where,
      select: {
        id: true,
        name: true,
        type: true,
        stickerValue: true,
        userDeclaredValue: true,
        resetCadence: true,
        isUsed: true,
        timesUsed: true,
        periodStart: true,
        periodEnd: true,
        periodStatus: true,
        masterBenefitId: true,
        userCardId: true,
        masterBenefit: {
          select: {
            claimingCadence: true,
          },
        },
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
      orderBy: { periodEnd: 'desc' },
      skip: offset,
      take: limit,
    });

    // ── Transform ──────────────────────────────────────────────────
    const benefits: HistoryBenefit[] = rawBenefits.map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      stickerValue: b.stickerValue,
      userDeclaredValue: b.userDeclaredValue,
      resetCadence: b.resetCadence,
      isUsed: b.isUsed,
      timesUsed: b.timesUsed,
      periodStart: b.periodStart?.toISOString() ?? null,
      periodEnd: b.periodEnd?.toISOString() ?? null,
      periodStatus: b.periodStatus,
      masterBenefitId: b.masterBenefitId,
      claimingCadence: b.masterBenefit?.claimingCadence ?? null,
      userCardId: b.userCardId,
      cardName: b.userCard.masterCard.cardName,
      cardIssuer: b.userCard.masterCard.issuer,
    }));

    const totalPages = Math.ceil(total / limit);
    const pagination: PaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };

    return NextResponse.json(
      { success: true, benefits, pagination },
      { status: 200 }
    );
  } catch (error) {
    console.error('[GET /api/benefits/history Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve benefit history' },
      { status: 500 }
    );
  }
}
