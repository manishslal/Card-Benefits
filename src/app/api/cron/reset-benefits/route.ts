/**
 * Vercel Cron Route: GET /api/cron/reset-benefits
 *
 * Runs daily at midnight UTC (configured in vercel.json).
 * Finds all UserBenefit records whose current period has expired and
 * resets them — clearing isUsed/claimedAt/timesUsed and advancing the
 * expirationDate to the next period via getNextExpirationDate.
 *
 * Security: Vercel Cron attaches `Authorization: Bearer <CRON_SECRET>` to
 * every invocation. Any request that omits or mismatches this header is
 * rejected with 401 before any database work is attempted.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextExpirationDate } from '@/lib/benefitDates';

export async function GET(request: Request): Promise<NextResponse> {
  // ── Auth guard ────────────────────────────────────────────────────────────
  // CRON_SECRET must be set in Vercel environment variables. We intentionally
  // fall through to a rejection even when the env var is undefined so that
  // misconfigured deployments don't accidentally allow unauthenticated resets.
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Capture a single `now` timestamp for the entire run so every expiration
  // comparison and next-date calculation uses a consistent reference point.
  const now = new Date();

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
    console.log(
      `[cron/reset-benefits] Reset ${resetCount} benefits at ${now.toISOString()}`
    );

    return NextResponse.json({
      ok: true,
      resetCount,
      processedAt: now.toISOString(),
    });
  } catch (err) {
    console.error('[cron/reset-benefits]', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
