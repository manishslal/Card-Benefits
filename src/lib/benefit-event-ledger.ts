import { Prisma, BenefitEventFamily, BenefitEventType } from '@prisma/client';
import { getPeriodBoundaries, type ResetCadence } from '@/lib/benefit-period-utils';
import { prisma } from '@/shared/lib/prisma';

type TxClient = Prisma.TransactionClient;

export interface CreateBenefitEventInput {
  userId: string;
  userCardId: string;
  userBenefitId: string;
  eventFamily: BenefitEventFamily;
  eventType: BenefitEventType;
  amountCents?: number | null;
  points?: number | null;
  quantity?: number | null;
  eventDate?: Date;
  endpointScope: string;
  idempotencyKey?: string | null;
  source?: string | null;
  notes?: string | null;
  metadata?: Prisma.JsonValue;
}

function eventSign(eventType: BenefitEventType): -1 | 1 {
  if (eventType === 'USAGE_REMOVE' || eventType === 'SPEND_REMOVE' || eventType === 'POINTS_REMOVE') {
    return -1;
  }
  return 1;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getRequestIdempotencyKey(headers: Headers): string | null {
  return normalizeOptionalString(
    headers.get('Idempotency-Key') || headers.get('x-idempotency-key')
  );
}

async function resolveBenefitPeriod(
  tx: TxClient,
  userBenefitId: string,
  referenceDate: Date
): Promise<{ periodStart: Date; periodEnd: Date }> {
  const benefit = await tx.userBenefit.findUnique({
    where: { id: userBenefitId },
    include: {
      userCard: {
        select: {
          renewalDate: true,
        },
      },
    },
  });

  if (!benefit) {
    throw new Error('Benefit not found while resolving projection period');
  }

  if (benefit.periodStart && benefit.periodEnd) {
    const inExistingRange = referenceDate >= benefit.periodStart && referenceDate <= benefit.periodEnd;
    if (inExistingRange) {
      return {
        periodStart: benefit.periodStart,
        periodEnd: benefit.periodEnd,
      };
    }
  }

  const cadence = (benefit.resetCadence || 'MONTHLY') as ResetCadence;

  try {
    const { start, end } = getPeriodBoundaries(cadence, benefit.userCard.renewalDate, referenceDate);
    return { periodStart: start, periodEnd: end };
  } catch {
    // CUSTOM/invalid cadence fallback keeps projection stable without breaking writes.
    const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
    const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { periodStart: start, periodEnd: end };
  }
}

async function computeProjectionTotals(
  tx: TxClient,
  userId: string,
  userBenefitId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const periodEvents = await tx.benefitEvent.findMany({
    where: {
      userId,
      userBenefitId,
      eventDate: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    orderBy: { eventDate: 'asc' },
  });

  let unlimitedNetCount = 0;
  let spendCentsTotal = 0;
  let pointsTotal = 0;

  for (const event of periodEvents) {
    const sign = eventSign(event.eventType);
    if (event.quantity !== null) unlimitedNetCount += sign * event.quantity;
    if (event.amountCents !== null) spendCentsTotal += sign * event.amountCents;
    if (event.points !== null) pointsTotal += sign * event.points;
  }

  return {
    unlimitedNetCount,
    spendCentsTotal,
    pointsTotal,
    lastEventAt: periodEvents.length > 0 ? periodEvents[periodEvents.length - 1].eventDate : null,
  };
}

export async function rebuildBenefitTrackerProjection(
  tx: TxClient,
  userId: string,
  userBenefitId: string,
  referenceDate: Date = new Date()
) {
  const { periodStart, periodEnd } = await resolveBenefitPeriod(tx, userBenefitId, referenceDate);
  const totals = await computeProjectionTotals(tx, userId, userBenefitId, periodStart, periodEnd);

  return tx.benefitTrackerProjection.upsert({
    where: { userBenefitId },
    create: {
      userBenefitId,
      periodStart,
      periodEnd,
      unlimitedNetCount: totals.unlimitedNetCount,
      spendCentsTotal: totals.spendCentsTotal,
      pointsTotal: totals.pointsTotal,
      lastEventAt: totals.lastEventAt,
      version: 1,
    },
    update: {
      periodStart,
      periodEnd,
      unlimitedNetCount: totals.unlimitedNetCount,
      spendCentsTotal: totals.spendCentsTotal,
      pointsTotal: totals.pointsTotal,
      lastEventAt: totals.lastEventAt,
      version: { increment: 1 },
    },
  });
}

export async function createBenefitEventWithProjection(
  tx: TxClient,
  input: CreateBenefitEventInput
) {
  const eventDate = input.eventDate ?? new Date();
  const idempotencyKey = normalizeOptionalString(input.idempotencyKey);

  if (idempotencyKey) {
    const existing = await tx.benefitEvent.findFirst({
      where: {
        userId: input.userId,
        endpointScope: input.endpointScope,
        idempotencyKey,
      },
    });

    if (existing) {
      const projection =
        (await tx.benefitTrackerProjection.findUnique({
          where: { userBenefitId: existing.userBenefitId },
        })) ||
        (await rebuildBenefitTrackerProjection(tx, existing.userId, existing.userBenefitId, existing.eventDate));

      return { event: existing, projection, replayed: true as const };
    }
  }

  const event = await tx.benefitEvent.create({
    data: {
      userId: input.userId,
      userCardId: input.userCardId,
      userBenefitId: input.userBenefitId,
      eventFamily: input.eventFamily,
      eventType: input.eventType,
      amountCents: input.amountCents ?? null,
      points: input.points ?? null,
      quantity: input.quantity ?? null,
      eventDate,
      endpointScope: input.endpointScope,
      idempotencyKey,
      source: normalizeOptionalString(input.source),
      notes: normalizeOptionalString(input.notes),
      metadata: input.metadata ?? undefined,
    },
  });

  const projection = await rebuildBenefitTrackerProjection(tx, input.userId, input.userBenefitId, eventDate);
  return { event, projection, replayed: false as const };
}

export async function reconcileBenefitTrackerProjection(
  userId: string,
  userBenefitId: string,
  referenceDate: Date = new Date()
) {
  return prisma.$transaction(async (tx) => {
    const projection = await tx.benefitTrackerProjection.findUnique({ where: { userBenefitId } });
    const rebuilt = await rebuildBenefitTrackerProjection(tx, userId, userBenefitId, referenceDate);

    if (!projection) {
      return { changed: true, before: null, after: rebuilt };
    }

    const changed =
      projection.periodStart.getTime() !== rebuilt.periodStart.getTime() ||
      projection.periodEnd.getTime() !== rebuilt.periodEnd.getTime() ||
      projection.unlimitedNetCount !== rebuilt.unlimitedNetCount ||
      projection.spendCentsTotal !== rebuilt.spendCentsTotal ||
      projection.pointsTotal !== rebuilt.pointsTotal ||
      (projection.lastEventAt?.getTime() || null) !== (rebuilt.lastEventAt?.getTime() || null);

    return { changed, before: projection, after: rebuilt };
  });
}
