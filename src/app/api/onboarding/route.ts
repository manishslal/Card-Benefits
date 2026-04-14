/**
 * GET /api/onboarding - Get onboarding state
 * POST /api/onboarding - Mark onboarding step complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // F-1: Use middleware-set x-user-id header (standardized auth pattern)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const player = await prisma.player.findFirst({
      where: { userId, isActive: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'No active player found' }, { status: 404 });
    }

    const playerId = player.id;

    let onboardingState = await prisma.onboardingSession.findUnique({
      where: { playerId },
    });

    if (!onboardingState) {
      onboardingState = await prisma.onboardingSession.create({
        data: {
          userId,
          playerId,
          currentStep: 1,
          completedSteps: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: onboardingState.userId,
        currentStep: onboardingState.currentStep,
        completedSteps: onboardingState.completedSteps,
        isCompleted: onboardingState.isCompleted,
        createdAt: onboardingState.createdAt,
      },
    });
  } catch (error) {
    console.error('Error fetching onboarding state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // F-1: Use middleware-set x-user-id header (standardized auth pattern)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const player = await prisma.player.findFirst({
      where: { userId, isActive: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'No active player found' }, { status: 404 });
    }

    const playerId = player.id;
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    let onboardingState = await prisma.onboardingSession.findUnique({
      where: { playerId },
    });

    if (!onboardingState) {
      onboardingState = await prisma.onboardingSession.create({
        data: { userId, playerId, currentStep: 1, completedSteps: 0 },
      });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    switch (action) {
      case 'next_step':
        updateData.currentStep = (onboardingState.currentStep || 1) + 1;
        break;
      case 'complete':
        updateData.isCompleted = true;
        updateData.completedAt = new Date();
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updated = await prisma.onboardingSession.update({
      where: { playerId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: updated.userId,
        currentStep: updated.currentStep,
        completedSteps: updated.completedSteps,
        isCompleted: updated.isCompleted,
      },
      message: `Onboarding action '${action}' completed successfully`,
    });
  } catch (error) {
    console.error('Error updating onboarding state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
