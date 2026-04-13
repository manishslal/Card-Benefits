/**
 * Vercel Cron Route: GET /api/cron/reset-benefits
 *
 * Runs daily at midnight UTC (configured in vercel.json).
 *
 * NEW behavior (when BENEFIT_ENGINE_ENABLED):
 * Finds all UserBenefit records where periodEnd < now AND periodStatus = 'ACTIVE'.
 * For each expired benefit:
 *   1. Marks periodStatus = 'EXPIRED'
 *   2. Looks up the MasterBenefit via masterBenefitId
 *   3. Calls calculateNextPeriod() to get next period dates
 *   4. Creates a new UserBenefit row with next period dates and isUsed = false
 * Processes in batches of 100 for Vercel timeout safety.
 * Uses skipDuplicates for idempotency.
 *
 * LEGACY behavior (when BENEFIT_ENGINE_ENABLED is false):
 * Finds used+expired benefits → resets isUsed/claimedAt/timesUsed in-place
 * → advances expirationDate. (Preserved for rollback safety.)
 *
 * Security:
 * - Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>` header
 * - Timing-safe comparison prevents attackers from inferring secret via timing
 * - Rate limiting prevents abuse (10 requests per hour per IP)
 * - Environment validation ensures CRON_SECRET is configured
 * - All requests logged (success and failures) for audit trail
 */

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/shared/lib';
import { getNextExpirationDate } from '@/features/benefits/lib';
import { RateLimiter } from '@/shared/lib';
import { featureFlags } from '@/lib/feature-flags';
import { calculateNextPeriod, resolveCadence, resolveClaimingAmount } from '@/lib/benefit-engine';

// ============================================================
// Configuration
// ============================================================
const CHUNK_SIZE = parseInt(process.env.CRON_BATCH_SIZE || '100', 10);
const PAUSE_MS = parseInt(process.env.CRON_BATCH_PAUSE_MS || '50', 10);

// ============================================================
// Rate Limiter Setup
// ============================================================
// Limits cron endpoint to 10 requests per hour per IP
// This is very generous for the legitimate 1 request/day, but protects against abuse
const cronLimiter = new RateLimiter({
  maxAttempts: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
  lockoutMs: 60 * 60 * 1000, // 1 hour lockout
});

/** Sleep utility for batch pausing. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: Request): Promise<NextResponse> {
  const startTime = Date.now();
  const now = new Date();
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown';

  // ── Rate Limiting Check ────────────────────────────────────────────────────
  const rateLimitCheck = cronLimiter.check(clientIp);
  if (!rateLimitCheck.isAllowed) {
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'rate_limit_exceeded',
      attemptsRemaining: rateLimitCheck.attemptsRemaining,
    };
    console.log(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    const response = NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 }
    );
    response.headers.set('Retry-After', '3600');
    return response;
  }

  // ── Environment Validation ─────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'environment_error',
      reason: 'CRON_SECRET not configured',
    };
    console.error(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }

  // ── Timing-Safe Auth Guard ─────────────────────────────────────────────────
  const authHeader = request.headers.get('authorization') || '';
  const expectedHeader = `Bearer ${cronSecret}`;

  let isValidSecret = false;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expectedHeader);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);  // Burn same time to prevent length leakage
    isValidSecret = false;
  } else {
    isValidSecret = timingSafeEqual(a, b);
  }

  if (!isValidSecret) {
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'auth_failed',
      reason: 'Invalid or missing CRON_SECRET',
    };
    console.warn(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    cronLimiter.recordFailure(clientIp);

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  cronLimiter.recordSuccess(clientIp);

  try {
    if (featureFlags.BENEFIT_ENGINE_ENABLED) {
      return await handleNewBehavior(now, clientIp, startTime);
    } else {
      return await handleLegacyBehavior(now, clientIp, startTime);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'cron_error',
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
    console.error(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// ============================================================
// NEW Behavior: Period-based rollover
// ============================================================

/**
 * New period-based cron behavior.
 *
 * 1. Finds all benefits where periodEnd < now AND periodStatus = 'ACTIVE'
 * 2. Filters out inactive cards
 * 3. Marks expired benefits as EXPIRED
 * 4. Creates new UserBenefit rows for the next period
 * 5. Processes in batches of CHUNK_SIZE
 */
async function handleNewBehavior(
  now: Date,
  clientIp: string,
  startTime: number
): Promise<NextResponse> {
  // Step 1: Fetch expired active benefits in batches using cursor-based pagination
  // to avoid OOM on large backlogs (e.g., 10K+ benefits after an outage)
  const FETCH_BATCH_SIZE = 500;
  let fetchCursor: string | undefined;
  const allExpiredBenefits: Array<Awaited<ReturnType<typeof prisma.userBenefit.findMany>>[number] & {
    userCard: { renewalDate: Date; isOpen: boolean; status: string };
  }> = [];

  while (true) {
    const batch = await prisma.userBenefit.findMany({
      where: {
        periodEnd: {
          not: null,
          lt: now,
        },
        periodStatus: 'ACTIVE',
        status: { not: 'ARCHIVED' },
      },
      include: {
        userCard: {
          select: {
            renewalDate: true,
            isOpen: true,
            status: true,
          },
        },
      },
      take: FETCH_BATCH_SIZE,
      ...(fetchCursor ? { skip: 1, cursor: { id: fetchCursor } } : {}),
      orderBy: { id: 'asc' },
    });

    if (batch.length === 0) break;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allExpiredBenefits.push(...(batch as any[]));
    fetchCursor = batch[batch.length - 1].id;

    // If we got fewer than the batch size, we've exhausted all results
    if (batch.length < FETCH_BATCH_SIZE) break;
  }

  const expiredBenefits = allExpiredBenefits;

  if (expiredBenefits.length === 0) {
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'cron_complete',
      expiredCount: 0,
      generatedCount: 0,
      skippedInactiveCard: 0,
      skippedDeactivatedBenefit: 0,
      skippedOneTime: 0,
      durationMs: Date.now() - startTime,
    };
    console.log(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    return NextResponse.json({
      ok: true,
      expiredCount: 0,
      generatedCount: 0,
      processedAt: now.toISOString(),
      durationMs: Date.now() - startTime,
    });
  }

  // Step 2: Filter and categorize
  let skippedInactiveCard = 0;
  let skippedDeactivatedBenefit = 0;
  let skippedOneTime = 0;

  // For benefits with masterBenefitId, batch-fetch their MasterBenefit data
  const masterBenefitIds = [
    ...new Set(
      expiredBenefits
        .map((b) => b.masterBenefitId)
        .filter((id): id is string => id !== null)
    ),
  ];

  const masterBenefitMap = new Map<
    string,
    {
      isActive: boolean;
      claimingCadence: string | null;
      claimingWindowEnd: string | null;
      claimingAmount: number | null;
      variableAmounts: Record<string, number> | null;
    }
  >();

  if (masterBenefitIds.length > 0) {
    const masterBenefits = await prisma.masterBenefit.findMany({
      where: { id: { in: masterBenefitIds } },
      select: {
        id: true,
        isActive: true,
        claimingCadence: true,
        claimingWindowEnd: true,
        claimingAmount: true,
        variableAmounts: true,
      },
    });
    for (const mb of masterBenefits) {
      masterBenefitMap.set(mb.id, {
        isActive: mb.isActive,
        claimingCadence: mb.claimingCadence,
        claimingWindowEnd: mb.claimingWindowEnd,
        claimingAmount: mb.claimingAmount,
        variableAmounts: mb.variableAmounts as Record<string, number> | null,
      });
    }
  }

  // Prepare processable benefits
  interface ProcessableBenefit {
    id: string;
    userCardId: string;
    playerId: string;
    masterBenefitId: string | null;
    name: string;
    type: string;
    stickerValue: number;
    resetCadence: string;
    periodEnd: Date;
    renewalDate: Date;
    claimingCadence: string | null;
    claimingWindowEnd: string | null;
  }

  const processable: ProcessableBenefit[] = [];

  for (const benefit of expiredBenefits) {
    // Skip benefits for inactive/closed/deleted cards
    if (!benefit.userCard.isOpen || benefit.userCard.status === 'DELETED' || benefit.userCard.status === 'CLOSED') {
      skippedInactiveCard++;
      continue;
    }

    // Skip ONE_TIME benefits (they never roll over)
    const cadence = resolveCadence(
      benefit.masterBenefitId ? masterBenefitMap.get(benefit.masterBenefitId)?.claimingCadence ?? null : null,
      benefit.resetCadence
    );
    if (cadence === 'ONE_TIME') {
      skippedOneTime++;
      continue;
    }

    // Skip deactivated MasterBenefits
    if (benefit.masterBenefitId) {
      const mb = masterBenefitMap.get(benefit.masterBenefitId);
      if (mb && !mb.isActive) {
        skippedDeactivatedBenefit++;
        console.info(`[cron/reset-benefits] Skipping deactivated benefit masterBenefitId=${benefit.masterBenefitId}`);
        continue;
      }
    }

    if (!benefit.periodEnd) continue; // TypeScript guard (already filtered in query)

    processable.push({
      id: benefit.id,
      userCardId: benefit.userCardId,
      playerId: benefit.playerId,
      masterBenefitId: benefit.masterBenefitId,
      name: benefit.name,
      type: benefit.type,
      stickerValue: benefit.stickerValue,
      resetCadence: benefit.resetCadence,
      periodEnd: benefit.periodEnd,
      renewalDate: benefit.userCard.renewalDate,
      claimingCadence: benefit.masterBenefitId
        ? masterBenefitMap.get(benefit.masterBenefitId)?.claimingCadence ?? null
        : null,
      claimingWindowEnd: benefit.masterBenefitId
        ? masterBenefitMap.get(benefit.masterBenefitId)?.claimingWindowEnd ?? null
        : null,
    });
  }

  // Step 3 & 4: Process in batches
  let totalExpired = 0;
  let totalGenerated = 0;

  for (let i = 0; i < processable.length; i += CHUNK_SIZE) {
    const chunk = processable.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(async (tx) => {
      // Mark chunk as EXPIRED
      const chunkIds = chunk.map((b) => b.id);
      await tx.userBenefit.updateMany({
        where: { id: { in: chunkIds } },
        data: {
          periodStatus: 'EXPIRED',
          status: 'EXPIRED',
        },
      });
      totalExpired += chunkIds.length;

      // Calculate next periods and create new rows
      const nextPeriodData = [];
      for (const benefit of chunk) {
        const nextPeriod = calculateNextPeriod(
          benefit.periodEnd,
          benefit.claimingCadence,
          benefit.resetCadence,
          benefit.renewalDate,
          benefit.claimingWindowEnd
        );

        // ONE_TIME guard (should already be filtered, but defense in depth)
        if (nextPeriod.periodEnd === null) continue;

        // Resolve stickerValue from master benefit for variable-amount benefits
        const masterBenefit = benefit.masterBenefitId
          ? masterBenefitMap?.get(benefit.masterBenefitId)
          : null;

        const nextPeriodMonth = nextPeriod.periodStart
          ? new Date(nextPeriod.periodStart).getUTCMonth() + 1
          : new Date().getUTCMonth() + 1;

        const resolvedStickerValue = masterBenefit?.claimingAmount != null
          ? resolveClaimingAmount(
              masterBenefit.claimingAmount,
              masterBenefit.variableAmounts,
              nextPeriodMonth
            )
          : benefit.stickerValue;

        nextPeriodData.push({
          userCardId: benefit.userCardId,
          playerId: benefit.playerId,
          masterBenefitId: benefit.masterBenefitId,
          name: benefit.name,
          type: benefit.type,
          stickerValue: resolvedStickerValue,
          resetCadence: benefit.resetCadence,
          periodStart: nextPeriod.periodStart,
          periodEnd: nextPeriod.periodEnd,
          periodStatus: 'ACTIVE',
          isUsed: false,
          timesUsed: 0,
          claimedAt: null,
          expirationDate: nextPeriod.periodEnd, // backward compat
          status: 'ACTIVE',
        });
      }

      if (nextPeriodData.length > 0) {
        const created = await tx.userBenefit.createMany({
          data: nextPeriodData,
          skipDuplicates: true,
        });
        totalGenerated += created.count;
      }
    });

    // Pause between batches to avoid DB connection exhaustion
    if (i + CHUNK_SIZE < processable.length) {
      await sleep(PAUSE_MS);
    }
  }

  const durationMs = Date.now() - startTime;
  const logEntry = {
    timestamp: now.toISOString(),
    ip: clientIp,
    event: 'cron_complete',
    expiredCount: totalExpired,
    generatedCount: totalGenerated,
    skippedInactiveCard,
    skippedDeactivatedBenefit,
    skippedOneTime,
    durationMs,
  };
  console.log(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

  return NextResponse.json({
    ok: true,
    expiredCount: totalExpired,
    generatedCount: totalGenerated,
    skippedInactiveCard,
    skippedDeactivatedBenefit,
    skippedOneTime,
    processedAt: now.toISOString(),
    durationMs,
  });
}

// ============================================================
// LEGACY Behavior: In-place reset (preserved for rollback)
// ============================================================

/**
 * Legacy cron behavior: finds used+expired benefits and resets them in-place.
 * Preserved behind the feature flag for safe rollback.
 */
async function handleLegacyBehavior(
  now: Date,
  clientIp: string,
  startTime: number
): Promise<NextResponse> {
  const resetCount = await prisma.$transaction(async (tx) => {
    const expiredBenefits = await tx.userBenefit.findMany({
      where: {
        isUsed: true,
        expirationDate: {
          not: null,
          lte: now,
        },
        resetCadence: {
          not: 'OneTime',
        },
      },
      include: {
        userCard: true,
      },
    });

    if (expiredBenefits.length === 0) {
      return 0;
    }

    await Promise.all(
      expiredBenefits.map((benefit) => {
        const nextExpiration = getNextExpirationDate(
          benefit.resetCadence,
          benefit.userCard.renewalDate,
          now
        );

        return tx.userBenefit.update({
          where: { id: benefit.id },
          data: {
            isUsed: false,
            claimedAt: null,
            timesUsed: 0,
            expirationDate: nextExpiration,
          },
        });
      })
    );

    return expiredBenefits.length;
  });

  const durationMs = Date.now() - startTime;
  const logEntry = {
    timestamp: now.toISOString(),
    ip: clientIp,
    event: 'cron_success',
    mode: 'legacy',
    resetCount,
    durationMs,
  };
  console.log(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

  return NextResponse.json({
    ok: true,
    resetCount,
    processedAt: now.toISOString(),
    durationMs,
  });
}
