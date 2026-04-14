/**
 * POST /api/benefits/filters - Apply advanced filters to benefits
 * Supports: status, value, resetCadence, expiration, search
 * 
 * QA-001: Added pageSize validation (max 100)
 * QA-002: Moved filtering to database queries instead of in-memory filtering
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { buildBenefitWhereClause, filterByStatus, FilterCriteria } from '@/lib/filters';

const MAX_PAGE_SIZE = 100;

export async function POST(request: NextRequest) {
  try {
    // F-1: Use middleware-set x-user-id header (standardized auth pattern)
    const userId = request.headers.get('x-user-id');
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

    const body = await request.json();
    let {
      status,
      minValue,
      maxValue,
      resetCadence,
      expirationBefore,
      searchTerm,
      page = 1,
      pageSize = 20,
    } = body;

    // QA-001: Validate pageSize to prevent SQL DoS
    if (pageSize > MAX_PAGE_SIZE) {
      return NextResponse.json(
        { error: `pageSize cannot exceed ${MAX_PAGE_SIZE}` },
        { status: 400 }
      );
    }
    pageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
    page = Math.max(1, page);

    // QA-002: Build database where clause from filter criteria
    const criteria: FilterCriteria = {
      status,
      minValue,
      maxValue,
      resetCadence,
      expirationBefore,
      searchTerm,
    };

    const whereClause = buildBenefitWhereClause(criteria, playerId);

    // Fetch filtered benefits from database (not all benefits)
    const total = await prisma.userBenefit.count({ where: whereClause });
    
    const skip = (page - 1) * pageSize;
    const userBenefits = await prisma.userBenefit.findMany({
      where: whereClause,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    });

    // Apply status filter (post-database since status is calculated)
    const now = new Date();
    let filtered = userBenefits;
    if (status && status.length > 0) {
      filtered = filterByStatus(userBenefits, status, now);
    }

    // Recalculate hasMore based on actual results after status filtering
    const hasMore = skip + filtered.length < total;

    return NextResponse.json({
      success: true,
      data: filtered.map((b) => ({
        id: b.id,
        name: b.name,
        type: b.type,
        stickerValue: b.stickerValue,
        resetCadence: b.resetCadence,
        expirationDate: b.expirationDate,
        status: determineStatus(b, now),
      })),
      total,
      page,
      pageSize,
      hasMore,
      appliedFilters: {
        status,
        valueRange: { min: minValue, max: maxValue },
        resetCadence,
        expirationBefore,
        searchTerm,
      },
    });
  } catch (error) {
    // QA-008: Safe error logging without PII
    console.error('Error applying filters:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Determine the status of a benefit
 */
function determineStatus(benefit: any, now: Date): string {
  if (benefit.resetCadence === 'ONE_TIME') {
    return benefit.isUsed ? 'used' : 'unused';
  }

  // Check expiration
  if (benefit.expirationDate) {
    if (benefit.expirationDate < now) {
      return 'expired';
    }

    const daysUntilExpiration = Math.floor(
      (benefit.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiration <= 7) {
      return 'expiring_soon';
    }
  }

  return 'active';
}
