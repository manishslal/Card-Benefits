/**
 * GET /api/mobile/sync - Get mobile sync data (benefits, usage, periods)
 * POST /api/mobile/sync - Process mobile sync queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/features/auth/context/auth-context';
import { prisma } from '@/shared/lib/prisma';
import { featureFlags } from '@/lib/feature-flags';
import type { Prisma } from '@prisma/client';

export async function GET(_request: NextRequest) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const player = await prisma.player.findFirst({
      where: { userId, isActive: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'No active player found' }, { status: 404 });
    }

    // Build where clause with period filtering when engine is enabled
    const benefitWhere: Prisma.UserBenefitWhereInput = {
      playerId: player.id,
    };

    if (featureFlags.BENEFIT_ENGINE_ENABLED) {
      benefitWhere.periodStatus = 'ACTIVE';
    }

    const userBenefits = await prisma.userBenefit.findMany({
      where: benefitWhere,
    });

    const usageRecords = await prisma.benefitUsageRecord.findMany({
      where: { userId },
      take: 100,
      orderBy: { usageDate: 'desc' },
    });

    const onboarding = await prisma.onboardingSession.findUnique({
      where: { playerId: player.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        benefits: userBenefits.map((ub) => ({
          id: ub.id,
          name: ub.name,
          stickerValue: ub.stickerValue,
          resetCadence: ub.resetCadence,
          expirationDate: ub.expirationDate,
        })),
        usageRecords: usageRecords.map((ur) => ({
          id: ur.id,
          benefitId: ur.benefitId,
          usageAmount: ur.usageAmount,
          notes: ur.notes,
          usageDate: ur.usageDate.toISOString(),
        })),
        onboarding: onboarding
          ? { currentStep: onboarding.currentStep, isCompleted: onboarding.isCompleted }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching mobile sync data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const player = await prisma.player.findFirst({
      where: { userId, isActive: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'No active player found' }, { status: 404 });
    }

    const body = await request.json();
    const { queueItems } = body;

    if (!Array.isArray(queueItems)) {
      return NextResponse.json({ error: 'queueItems must be an array' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const item of queueItems) {
      try {
        const { id, type, resource, data } = item;

        if (resource === 'usage' && type === 'create') {
          // Verify the benefit belongs to the authenticated user
          const benefit = await prisma.userBenefit.findUnique({
            where: { id: data.benefitId },
            select: { playerId: true, userCard: { select: { status: true } } },
          });
          if (!benefit || benefit.playerId !== player.id) {
            errors.push({ id, error: 'Benefit not found or not owned by user' });
            continue;
          }
          if (benefit.userCard?.status === 'DELETED') {
            errors.push({ id, error: 'Cannot record usage on a deleted card' });
            continue;
          }
          const created = await prisma.benefitUsageRecord.create({
            data: {
              benefitId: data.benefitId,
              userId,
              usageAmount: data.usageAmount,
              notes: data.notes,
              usageDate: new Date(data.usageDate),
            },
          });
          results.push({ id, status: 'success', resourceId: created.id });
        } else {
          errors.push({ id, error: 'Unknown operation' });
        }
      } catch (itemError) {
        errors.push({
          id: item.id,
          error: itemError instanceof Error ? itemError.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: results.length,
        errorsCount: errors.length,
        results,
        errors,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error processing mobile sync:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
