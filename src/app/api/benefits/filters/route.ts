/**
 * POST /api/benefits/filters - Apply advanced filters to benefits
 * Supports: status, value, resetCadence, expiration, search
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const userId = getAuthUserId();
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
    const {
      status,
      minValue,
      maxValue,
      resetCadence,
      expirationBefore,
      searchTerm,
      page = 1,
      pageSize = 20,
    } = body;

    // Get user's benefits
    const userBenefits = await prisma.userBenefit.findMany({
      where: { playerId },
    });

    const now = new Date();
    let filtered = userBenefits;

    // Apply status filter
    if (status && status.length > 0) {
      filtered = filtered.filter((benefit) => {
        const benefitStatus = determineStatus(benefit, now);
        return status.includes(benefitStatus);
      });
    }

    // Apply value range filter
    if (minValue !== undefined || maxValue !== undefined) {
      filtered = filtered.filter((benefit) => {
        const value = benefit.stickerValue || 0;
        const minCheck = minValue === undefined || value >= minValue;
        const maxCheck = maxValue === undefined || value <= maxValue;
        return minCheck && maxCheck;
      });
    }

    // Apply reset cadence filter
    if (resetCadence && resetCadence.length > 0) {
      filtered = filtered.filter((benefit) =>
        resetCadence.includes(benefit.resetCadence)
      );
    }

    // Apply expiration filter
    if (expirationBefore) {
      const expirationDate = new Date(expirationBefore);
      filtered = filtered.filter((benefit) => {
        if (!benefit.expirationDate) return true;
        return benefit.expirationDate <= expirationDate;
      });
    }

    // Apply search filter
    if (searchTerm && searchTerm.length > 0) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((benefit) =>
        benefit.name.toLowerCase().includes(term)
      );
    }

    // Calculate pagination
    const total = filtered.length;
    const skip = (page - 1) * pageSize;
    const paginatedBenefits = filtered.slice(skip, skip + pageSize);
    const hasMore = skip + pageSize < total;

    return NextResponse.json({
      success: true,
      data: paginatedBenefits.map((b) => ({
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
    console.error('Error applying filters:', error);
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
