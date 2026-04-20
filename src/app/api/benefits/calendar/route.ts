/**
 * GET /api/benefits/calendar?month=2026-04&cardId=optional
 *
 * Returns benefit events mapped to calendar dates for the requested month.
 * Event types:
 *   - "reset"    → A benefit period started on this date
 *   - "used"     → A benefit was claimed on this date
 *   - "expiring" → A benefit period ends on this date (includes isUsed flag)
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

interface CalendarEvent {
  date: string; // "YYYY-MM-DD"
  type: 'reset' | 'used' | 'expiring';
  benefitId: string;
  benefitName: string;
  cardName: string;
  stickerValue: number; // cents
  isUsed?: boolean;
}

interface CalendarResponse {
  success: true;
  month: string;
  events: CalendarEvent[];
}

interface ErrorResponse {
  success: false;
  error: string;
}

// ============================================================
// Helpers
// ============================================================

/** Parse "YYYY-MM" into year and month (0-indexed for Date constructor) */
function parseMonth(monthStr: string): { year: number; month: number } | null {
  const match = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  if (month < 0 || month > 11) return null;
  if (year < 2020 || year > 2100) return null;
  return { year, month };
}

/** Format a Date to "YYYY-MM-DD" in UTC */
function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Common select fields
const benefitSelect = {
  id: true,
  name: true,
  stickerValue: true,
  isUsed: true,
  periodStart: true,
  periodEnd: true,
  claimedAt: true,
  userCard: {
    select: {
      id: true,
      masterCard: {
        select: {
          cardName: true,
        },
      },
    },
  },
} as const;

// ============================================================
// GET Handler
// ============================================================

export async function GET(
  request: NextRequest
): Promise<NextResponse<CalendarResponse | ErrorResponse>> {
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
        { success: true, month: '', events: [] } as CalendarResponse,
        { status: 200 }
      );
    }

    // ── Parse query params ─────────────────────────────────────────
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');
    const cardId = searchParams.get('cardId');

    // Default to current month if not provided
    const now = new Date();
    const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const monthStr = monthParam || defaultMonth;

    const parsed = parseMonth(monthStr);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'Invalid month format. Expected YYYY-MM.' } as ErrorResponse,
        { status: 400 }
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
        { success: true, month: monthStr, events: [] } as CalendarResponse,
        { status: 200 }
      );
    }

    // ── Date boundaries for the requested month ────────────────────
    const monthStart = new Date(Date.UTC(parsed.year, parsed.month, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(parsed.year, parsed.month + 1, 0, 23, 59, 59, 999));

    // ── Query benefits overlapping with this month ─────────────────
    // A benefit overlaps the month if:
    //   periodStart <= monthEnd AND periodEnd >= monthStart
    const whereClause: Record<string, unknown> = {
      playerId: player.id,
      status: { not: 'ARCHIVED' },
      OR: [
        // periodStart falls in month
        {
          periodStart: { gte: monthStart, lte: monthEnd },
        },
        // periodEnd falls in month
        {
          periodEnd: { gte: monthStart, lte: monthEnd },
        },
        // claimedAt falls in month
        {
          claimedAt: { gte: monthStart, lte: monthEnd },
        },
        // Spans entire month (period started before and ends after)
        {
          periodStart: { lte: monthStart },
          periodEnd: { gte: monthEnd },
        },
      ],
    };

    // Optional card filter
    if (cardId) {
      whereClause.userCardId = cardId;
    }

    const benefits = await prisma.userBenefit.findMany({
      where: whereClause,
      select: benefitSelect,
      orderBy: { periodStart: 'asc' },
    });

    // ── Map benefits to calendar events ────────────────────────────
    const events: CalendarEvent[] = [];

    for (const benefit of benefits) {
      const cardName = benefit.userCard.masterCard.cardName;

      // "reset" event — periodStart falls in the month
      if (benefit.periodStart) {
        const start = new Date(benefit.periodStart);
        if (start >= monthStart && start <= monthEnd) {
          events.push({
            date: formatDateUTC(start),
            type: 'reset',
            benefitId: benefit.id,
            benefitName: benefit.name,
            cardName,
            stickerValue: benefit.stickerValue,
          });
        }
      }

      // "used" event — claimedAt falls in the month
      if (benefit.claimedAt) {
        const claimed = new Date(benefit.claimedAt);
        if (claimed >= monthStart && claimed <= monthEnd) {
          events.push({
            date: formatDateUTC(claimed),
            type: 'used',
            benefitId: benefit.id,
            benefitName: benefit.name,
            cardName,
            stickerValue: benefit.stickerValue,
          });
        }
      }

      // "expiring" event — periodEnd falls in the month
      if (benefit.periodEnd) {
        const end = new Date(benefit.periodEnd);
        if (end >= monthStart && end <= monthEnd) {
          events.push({
            date: formatDateUTC(end),
            type: 'expiring',
            benefitId: benefit.id,
            benefitName: benefit.name,
            cardName,
            stickerValue: benefit.stickerValue,
            isUsed: benefit.isUsed,
          });
        }
      }
    }

    // Sort events by date
    events.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(
      { success: true, month: monthStr, events } as CalendarResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[benefits/calendar] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ErrorResponse,
      { status: 500 }
    );
  }
}
