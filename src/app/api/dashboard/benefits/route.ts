/**
 * Dashboard Benefits API - Server-side wrapper
 * 
 * This endpoint:
 * 1. Reads authenticated user from middleware (x-user-id header)
 * 2. Fetches real benefits data from UserCard and UserBenefit
 * 3. Returns to client with proper auth
 * 
 * Security: Runs on server, has access to auth context
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';
import { featureFlags } from '@/lib/feature-flags';
import type { Prisma } from '@prisma/client';

export async function POST(request: Request) {
  try {
    // Get authenticated user ID from middleware-set header
    const userId = request.headers.get('x-user-id');

    // DEBUG: Log header presence for troubleshooting
    console.log('[Dashboard Benefits API] Request received', {
      userId: userId || 'MISSING',
      headerKeys: Array.from(request.headers.keys()),
    });

    if (!userId) {
      console.error('[Dashboard Benefits API] Authorization failed - x-user-id header missing');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Dashboard Benefits API] Authorization successful for user:', userId);

    // Get the user's primary player profile
    const player = await prisma.player.findFirst({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc', // Get first/primary player
      },
    });

    if (!player) {
      console.error('[Dashboard Benefits API] No active player found for user:', userId);
      return NextResponse.json({
        success: true,
        data: [], // No player profile, return empty benefits
      });
    }

    console.log('[Dashboard Benefits API] Found player:', player.id);

    // Fetch user's card(s) for this player
    const userCards = await prisma.userCard.findMany({
      where: { playerId: player.id },
    });

    if (!userCards.length) {
      return NextResponse.json({
        success: true,
        data: [], // No cards, return empty benefits
      });
    }

    const cardIds = userCards.map((c) => c.id);

    // Build where clause with period filtering when engine is enabled
    const whereClause: Prisma.UserBenefitWhereInput = {
      userCardId: { in: cardIds },
    };

    if (featureFlags.BENEFIT_ENGINE_ENABLED) {
      whereClause.periodStatus = 'ACTIVE';
    }

    // Fetch all benefits for user's cards
    const userBenefits = await prisma.userBenefit.findMany({
      where: whereClause,
      take: 100,
    });

    // Transform to response format
    const benefits = userBenefits.map((ub) => ({
      id: ub.id,
      name: ub.name,
      type: ub.type || 'credit_card',
      stickerValue: ub.stickerValue,
      userDeclaredValue: ub.userDeclaredValue,
      resetCadence: ub.resetCadence || 'ANNUAL',
      status: 'active',
      isUsed: ub.isUsed || false,
      timesUsed: ub.timesUsed || 0,
    }));

    return NextResponse.json({
      success: true,
      data: benefits,
    });
  } catch (error) {
    console.error('Dashboard benefits error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
