/**
 * Backfill UserBenefits Script
 *
 * Links UserBenefits to their corresponding MasterBenefits and calculates
 * period boundaries (periodStart/periodEnd) using the date-math engine.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx scripts/backfill-user-benefits.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// Inline date-math (avoid path alias issues with tsx)
// ============================================================================

// We inline the core period calculation to avoid @/ path alias issues in tsx.
// This is a faithful copy of src/lib/benefit-engine/date-math.ts logic.

type ClaimingCadence = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'FLEXIBLE_ANNUAL' | 'ONE_TIME';

interface PeriodBoundary {
  periodStart: Date;
  periodEnd: Date | null;
}

function resolveCadence(
  claimingCadence: string | null | undefined,
  resetCadence: string
): ClaimingCadence {
  if (claimingCadence) {
    const upper = claimingCadence.toUpperCase();
    const valid: ClaimingCadence[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'FLEXIBLE_ANNUAL', 'ONE_TIME'];
    if (valid.includes(upper as ClaimingCadence)) return upper as ClaimingCadence;
  }
  switch (resetCadence) {
    case 'Monthly':
    case 'MONTHLY':
      return 'MONTHLY';
    case 'CalendarYear':
    case 'ANNUAL':
      return 'FLEXIBLE_ANNUAL';
    case 'CardmemberYear':
      return 'FLEXIBLE_ANNUAL';
    case 'OneTime':
    case 'CUSTOM':
      return 'FLEXIBLE_ANNUAL'; // Safe fallback for CUSTOM
    default:
      return 'FLEXIBLE_ANNUAL';
  }
}

function startOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

function endOfMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
}

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function normalizeDate(year: number, month: number, day: number): Date {
  const candidate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  if (candidate.getUTCMonth() !== month) {
    return new Date(Date.UTC(year, month + 1, 0, 0, 0, 0, 0));
  }
  return candidate;
}

function parseWindowEnd(claimingWindowEnd: string): { month: number; day: number } | null {
  if (!claimingWindowEnd || claimingWindowEnd.length !== 4) return null;
  const month = parseInt(claimingWindowEnd.slice(0, 2), 10) - 1;
  const day = parseInt(claimingWindowEnd.slice(2, 4), 10);
  if (isNaN(month) || isNaN(day) || month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { month, day };
}

function calculatePeriodForBenefit(
  claimingCadence: string | null | undefined,
  resetCadence: string,
  referenceDate: Date,
  renewalDate: Date,
  claimingWindowEnd?: string | null
): PeriodBoundary {
  const cadence = resolveCadence(claimingCadence, resetCadence);

  switch (cadence) {
    case 'MONTHLY': {
      const y = referenceDate.getUTCFullYear();
      const m = referenceDate.getUTCMonth();
      return { periodStart: startOfMonth(y, m), periodEnd: endOfMonth(y, m) };
    }

    case 'QUARTERLY': {
      const y = referenceDate.getUTCFullYear();
      const q = Math.floor(referenceDate.getUTCMonth() / 3);
      const qStart = q * 3;
      return { periodStart: startOfMonth(y, qStart), periodEnd: endOfMonth(y, qStart + 2) };
    }

    case 'SEMI_ANNUAL': {
      const y = referenceDate.getUTCFullYear();
      const win = claimingWindowEnd ? parseWindowEnd(claimingWindowEnd) : null;
      if (win) {
        const splitDate = normalizeDate(y, win.month, win.day);
        if (referenceDate.getTime() < splitDate.getTime()) {
          const dayBefore = new Date(splitDate.getTime() - 86400000);
          return {
            periodStart: startOfMonth(y, 0),
            periodEnd: new Date(Date.UTC(dayBefore.getUTCFullYear(), dayBefore.getUTCMonth(), dayBefore.getUTCDate(), 23, 59, 59, 999)),
          };
        } else {
          return {
            periodStart: new Date(Date.UTC(splitDate.getUTCFullYear(), splitDate.getUTCMonth(), splitDate.getUTCDate(), 0, 0, 0, 0)),
            periodEnd: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
          };
        }
      }
      const month = referenceDate.getUTCMonth();
      if (month < 6) {
        return { periodStart: startOfMonth(y, 0), periodEnd: endOfMonth(y, 5) };
      } else {
        return { periodStart: startOfMonth(y, 6), periodEnd: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)) };
      }
    }

    case 'FLEXIBLE_ANNUAL': {
      if (resetCadence === 'CardmemberYear') {
        const renewalMonth = renewalDate.getUTCMonth();
        const renewalDay = renewalDate.getUTCDate();
        const refYear = referenceDate.getUTCFullYear();
        const candidate = normalizeDate(refYear, renewalMonth, renewalDay);
        let periodStart: Date;
        let nextAnniversary: Date;
        if (referenceDate.getTime() >= candidate.getTime()) {
          periodStart = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(), 0, 0, 0, 0));
          nextAnniversary = normalizeDate(refYear + 1, renewalMonth, renewalDay);
        } else {
          periodStart = normalizeDate(refYear - 1, renewalMonth, renewalDay);
          periodStart = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate(), 0, 0, 0, 0));
          nextAnniversary = candidate;
        }
        const dayBefore = new Date(nextAnniversary.getTime() - 86400000);
        return {
          periodStart,
          periodEnd: new Date(Date.UTC(dayBefore.getUTCFullYear(), dayBefore.getUTCMonth(), dayBefore.getUTCDate(), 23, 59, 59, 999)),
        };
      }
      // Calendar year
      const y = referenceDate.getUTCFullYear();
      return {
        periodStart: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
        periodEnd: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
      };
    }

    case 'ONE_TIME':
      return { periodStart: startOfDay(referenceDate), periodEnd: null };

    default:
      return {
        periodStart: new Date(Date.UTC(referenceDate.getUTCFullYear(), 0, 1, 0, 0, 0, 0)),
        periodEnd: new Date(Date.UTC(referenceDate.getUTCFullYear(), 11, 31, 23, 59, 59, 999)),
      };
  }
}

// ============================================================================
// MasterBenefit Linking
// ============================================================================

/**
 * Find the best MasterBenefit match for a UserBenefit by name.
 * Uses exact match first, then case-insensitive, then fuzzy containment.
 */
function findMasterBenefitMatch(
  userBenefitName: string,
  masterBenefits: Array<{ id: string; name: string; claimingCadence: string | null; claimingWindowEnd: string | null }>
): { id: string; name: string; claimingCadence: string | null; claimingWindowEnd: string | null } | null {
  // 1. Exact name match
  const exact = masterBenefits.find((mb) => mb.name === userBenefitName);
  if (exact) return exact;

  // 2. Case-insensitive match
  const lower = userBenefitName.toLowerCase();
  const caseMatch = masterBenefits.find((mb) => mb.name.toLowerCase() === lower);
  if (caseMatch) return caseMatch;

  // 3. Fuzzy: one name contains the other (require >5 chars to avoid false positives)
  if (lower.length > 5) {
    const containsMatch = masterBenefits.find(
      (mb) =>
        mb.name.toLowerCase().includes(lower) ||
        lower.includes(mb.name.toLowerCase())
    );
    if (containsMatch) return containsMatch;
  }

  // 4. Fuzzy: strip dollar amounts and compare core keywords
  const stripAmounts = (s: string) =>
    s.toLowerCase().replace(/\$[\d,.]+/g, '').replace(/\d+/g, '').trim();
  const strippedUser = stripAmounts(userBenefitName);
  if (strippedUser.length > 5) {
    const strippedMatch = masterBenefits.find(
      (mb) => stripAmounts(mb.name) === strippedUser
    );
    if (strippedMatch) return strippedMatch;
  }

  return null;
}

// ============================================================================
// Main Backfill Logic
// ============================================================================

async function backfillUserBenefits(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Backfill UserBenefits');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const now = new Date();

  // Load all UserBenefits that need processing
  const userBenefits = await prisma.userBenefit.findMany({
    where: {
      OR: [
        { masterBenefitId: null },
        { periodStart: null },
      ],
    },
    include: {
      userCard: {
        select: {
          id: true,
          masterCardId: true,
          renewalDate: true,
          masterCard: {
            select: {
              cardName: true,
              masterBenefits: {
                where: { isActive: true },
                select: { id: true, name: true, claimingCadence: true, claimingWindowEnd: true },
              },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  console.log(`\n📋 Found ${userBenefits.length} UserBenefits needing backfill.\n`);

  let linkedCount = 0;
  let alreadyLinkedCount = 0;
  let unlinkableCount = 0;
  let periodCount = 0;
  let periodSkippedCount = 0;
  let errorCount = 0;

  for (const ub of userBenefits) {
    try {
      const updateData: Record<string, unknown> = {};
      const cardName = ub.userCard.masterCard.cardName;
      const masterBenefits = ub.userCard.masterCard.masterBenefits;

      // ── Step A: Link masterBenefitId ──────────────────────────────────────
      if (ub.masterBenefitId === null) {
        const match = findMasterBenefitMatch(ub.name, masterBenefits);

        if (match) {
          updateData.masterBenefitId = match.id;
          linkedCount++;
          console.log(`  🔗 Linked: "${ub.name}" → MasterBenefit "${match.name}" (${cardName})`);
        } else {
          unlinkableCount++;
          console.log(`  ⚠️  No match: "${ub.name}" on ${cardName} (custom benefit — skipped)`);
        }
      } else {
        alreadyLinkedCount++;
      }

      // ── Step B: Calculate period ─────────────────────────────────────────
      if (ub.periodStart === null) {
        // Get the cadence info — prefer MasterBenefit if linked, else infer from UserBenefit
        let claimingCadence: string | null = null;
        let claimingWindowEnd: string | null = null;

        if (updateData.masterBenefitId || ub.masterBenefitId) {
          const mbId = (updateData.masterBenefitId ?? ub.masterBenefitId) as string;
          const matchedMB = masterBenefits.find((mb) => mb.id === mbId);
          if (matchedMB) {
            claimingCadence = matchedMB.claimingCadence;
            claimingWindowEnd = matchedMB.claimingWindowEnd ?? null;
          }
        }

        // Use expirationDate as reference if available, otherwise use now
        const referenceDate = ub.expirationDate ?? now;
        const renewalDate = ub.userCard.renewalDate;

        const period = calculatePeriodForBenefit(
          claimingCadence,
          ub.resetCadence,
          referenceDate,
          renewalDate,
          claimingWindowEnd
        );

        updateData.periodStart = period.periodStart;
        updateData.periodEnd = period.periodEnd;
        updateData.periodStatus = 'ACTIVE';
        periodCount++;

        console.log(
          `  📅 Period: "${ub.name}" → ` +
            `${period.periodStart.toISOString().slice(0, 10)} to ` +
            `${period.periodEnd ? period.periodEnd.toISOString().slice(0, 10) : 'never'}` +
            ` (cadence: ${claimingCadence ?? ub.resetCadence})`
        );
      } else {
        periodSkippedCount++;
      }

      // ── Step C: Apply update ─────────────────────────────────────────────
      if (Object.keys(updateData).length > 0) {
        await prisma.userBenefit.update({
          where: { id: ub.id },
          data: updateData,
        });
      }
    } catch (err) {
      errorCount++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ ERROR: "${ub.name}" (id: ${ub.id}): ${msg}`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n━━━ Summary ━━━');
  console.log(`  Total processed:          ${userBenefits.length}`);
  console.log(`  Linked to MasterBenefit:  ${linkedCount}`);
  console.log(`  Already linked:           ${alreadyLinkedCount}`);
  console.log(`  Unlinked (custom):        ${unlinkableCount}`);
  console.log(`  Periods calculated:       ${periodCount}`);
  console.log(`  Periods skipped:          ${periodSkippedCount}`);
  console.log(`  Errors:                   ${errorCount}`);

  // Verification
  const [totalUB, linkedUB, periodSetUB, stillNull] = await Promise.all([
    prisma.userBenefit.count(),
    prisma.userBenefit.count({ where: { masterBenefitId: { not: null } } }),
    prisma.userBenefit.count({ where: { periodStart: { not: null } } }),
    prisma.userBenefit.count({ where: { masterBenefitId: null } }),
  ]);

  console.log('\n━━━ Verification ━━━');
  console.log(`  Total UserBenefits:              ${totalUB}`);
  console.log(`  With masterBenefitId set:        ${linkedUB}`);
  console.log(`  With periodStart set:            ${periodSetUB}`);
  console.log(`  Still unlinked (custom/orphan):  ${stillNull}`);

  if (stillNull > 0) {
    const orphans = await prisma.userBenefit.findMany({
      where: { masterBenefitId: null },
      select: { name: true, userCard: { select: { masterCard: { select: { cardName: true } } } } },
    });
    console.log('  Unlinked benefits:');
    for (const o of orphans) {
      console.log(`    - "${o.name}" on ${o.userCard.masterCard.cardName}`);
    }
  }
}

// ============================================================================
// Entry Point
// ============================================================================

backfillUserBenefits()
  .then(() => {
    console.log('\n✅ UserBenefit backfill complete.\n');
  })
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
