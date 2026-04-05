/**
 * Vercel Cron Route: GET /api/cron/reset-benefits
 *
 * Runs daily at midnight UTC (configured in vercel.json).
 * Finds all UserBenefit records whose current period has expired and
 * resets them — clearing isUsed/claimedAt/timesUsed and advancing the
 * expirationDate to the next period via getNextExpirationDate.
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

export async function GET(request: Request): Promise<NextResponse> {
  const now = new Date();
  const clientIp = request.headers.get('x-forwarded-for') ||
                   request.headers.get('x-real-ip') ||
                   'unknown';

  // ── Rate Limiting Check ────────────────────────────────────────────────────
  // Check if this IP has exceeded the rate limit before doing auth work
  const rateLimitCheck = cronLimiter.check(clientIp);
  if (!rateLimitCheck.isAllowed) {
    // Log failed rate limit attempt
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'rate_limit_exceeded',
      attemptsRemaining: rateLimitCheck.attemptsRemaining,
    };
    console.log(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    // Return 429 with retry-after header
    const response = NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 }
    );
    response.headers.set('Retry-After', '3600'); // Retry after 1 hour
    return response;
  }

  // ── Environment Validation ─────────────────────────────────────────────────
  // CRON_SECRET must be configured. Fail fast if missing to prevent security issues.
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
  // Compare using constant-time algorithm to prevent timing attacks
  // Timing attacks allow attackers to infer secret content/length via response timing
  const authHeader = request.headers.get('authorization') || '';
  const expectedHeader = `Bearer ${cronSecret}`;

  let isValidSecret = false;
  try {
    // timingSafeEqual throws if buffers are different lengths, so we catch that
    isValidSecret = timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(expectedHeader)
    );
  } catch {
    // Different lengths - invalid. timingSafeEqual still takes ~same time
    isValidSecret = false;
  }

  if (!isValidSecret) {
    // Log failed auth attempt
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'auth_failed',
      reason: 'Invalid or missing CRON_SECRET',
    };
    console.warn(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    // Record the failed attempt for rate limiting
    cronLimiter.recordFailure(clientIp);

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Now that auth passed, record successful authentication for rate limiter
  cronLimiter.recordSuccess(clientIp);

  try {
    const resetCount = await prisma.$transaction(async (tx) => {
      // ── Step 1: Find all expired, resettable benefits ─────────────────────
      // We only care about benefits that:
      //   - have already been used (isUsed true)
      //   - have a concrete expiration date that has now passed
      //   - are NOT OneTime (those are never automatically recycled)
      //
      // We include the parent userCard because CardmemberYear resets need the
      // card's renewalDate to compute the next window boundary.
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

      // ── Step 2 & 3: Compute next window and batch-update each record ───────
      // Prisma's `updateMany` does not support per-record data, so we issue
      // individual `update` calls collected into a single transaction batch.
      // All writes either commit together or roll back together.
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
              // Reset the usage counter so tracking starts fresh for the new period.
              timesUsed: 0,
              // Advance the deadline; null only if cadence unexpectedly falls through
              // (getNextExpirationDate guards against that for non-OneTime cadences).
              expirationDate: nextExpiration,
            },
          });
        })
      );

      return expiredBenefits.length;
    });

    // ── Step 4: Log success and return summary ─────────────────────────────
    // Log successful cron execution for monitoring and audit
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'cron_success',
      resetCount,
    };
    console.log(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    return NextResponse.json({
      ok: true,
      resetCount,
      processedAt: now.toISOString(),
    });
  } catch (err) {
    // Log error details (but not sensitive data)
    const errorMessage = err instanceof Error ? err.message : String(err);
    const logEntry = {
      timestamp: now.toISOString(),
      ip: clientIp,
      event: 'cron_error',
      error: errorMessage,
    };
    console.error(`[cron/reset-benefits] ${JSON.stringify(logEntry)}`);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
