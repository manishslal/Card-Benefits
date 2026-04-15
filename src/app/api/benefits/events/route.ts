import { NextRequest, NextResponse } from 'next/server';
import { BenefitEventFamily, BenefitEventType } from '@prisma/client';
import { prisma } from '@/shared/lib/prisma';
import { featureFlags } from '@/lib/feature-flags';
import {
  createBenefitEventWithProjection,
  getRequestIdempotencyKey,
} from '@/lib/benefit-event-ledger';
import { logSafeError } from '@/lib/error-logging';

function parseEventFamily(value: unknown): BenefitEventFamily | null {
  if (value === 'UNLIMITED_USE' || value === 'MULTIPLIER_SPEND') return value;
  return null;
}

function parseEventType(value: unknown): BenefitEventType | null {
  if (
    value === 'USAGE_ADD' ||
    value === 'USAGE_REMOVE' ||
    value === 'SPEND_ADD' ||
    value === 'SPEND_REMOVE' ||
    value === 'POINTS_ADD' ||
    value === 'POINTS_REMOVE' ||
    value === 'ADJUSTMENT'
  ) {
    return value;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    if (!featureFlags.EVENT_LEDGER_WRITE_ENABLED) {
      return NextResponse.json(
        { success: false, error: 'FEATURE_DISABLED', message: 'Event ledger writes are disabled' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const userBenefitId = body.userBenefitId || body.benefitId;
    const userCardId = body.userCardId;
    const eventFamily = parseEventFamily(body.eventFamily);
    const eventType = parseEventType(body.eventType);
    const eventDate = body.eventDate ? new Date(body.eventDate) : new Date();
    const endpointScope = typeof body.endpointScope === 'string' && body.endpointScope.length > 0
      ? body.endpointScope
      : '/api/benefits/events';

    if (!userBenefitId || !userCardId || !eventFamily || !eventType || Number.isNaN(eventDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'VALIDATION_ERROR', message: 'Invalid event payload' },
        { status: 400 }
      );
    }

    const benefit = await prisma.userBenefit.findUnique({
      where: { id: userBenefitId },
      include: { userCard: { include: { player: { select: { userId: true } } } } },
    });

    if (!benefit || benefit.userCardId !== userCardId) {
      return NextResponse.json(
        { success: false, error: 'NOT_FOUND', message: 'Benefit/card relationship not found' },
        { status: 404 }
      );
    }

    if (benefit.userCard.player.userId !== userId) {
      return NextResponse.json({ success: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    const idempotencyKey = getRequestIdempotencyKey(request.headers);
    const result = await prisma.$transaction((tx) =>
      createBenefitEventWithProjection(tx, {
        userId,
        userCardId,
        userBenefitId,
        eventFamily,
        eventType,
        amountCents: typeof body.amountCents === 'number' ? Math.round(body.amountCents) : null,
        points: typeof body.points === 'number' ? Math.round(body.points) : null,
        quantity: typeof body.quantity === 'number' ? Math.round(body.quantity) : null,
        eventDate,
        endpointScope,
        idempotencyKey,
        source: typeof body.source === 'string' ? body.source : 'api',
        notes: typeof body.notes === 'string' ? body.notes : null,
        metadata: body.metadata ?? null,
      })
    );

    return NextResponse.json(
      { success: true, replayed: result.replayed, event: result.event, projection: result.projection },
      { status: result.replayed ? 200 : 201 }
    );
  } catch (error) {
    logSafeError('Failed to create event', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userBenefitId = searchParams.get('userBenefitId') || undefined;
    const userCardId = searchParams.get('userCardId') || undefined;
    const eventFamily = parseEventFamily(searchParams.get('eventFamily'));
    const eventType = parseEventType(searchParams.get('eventType'));
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit') || 50)));

    const events = await prisma.benefitEvent.findMany({
      where: {
        userId,
        ...(userBenefitId ? { userBenefitId } : {}),
        ...(userCardId ? { userCardId } : {}),
        ...(eventFamily ? { eventFamily } : {}),
        ...(eventType ? { eventType } : {}),
      },
      orderBy: { eventDate: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, events }, { status: 200 });
  } catch (error) {
    logSafeError('Failed to fetch events', error);
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
