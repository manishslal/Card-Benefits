/**
 * Fix MasterBenefit Cadences Script
 *
 * Populates claimingCadence, claimingAmount, and claimingWindowEnd for all
 * MasterBenefits using the phase6c cadence mapping. Applies smart defaults
 * for benefits not in the mapping. Deduplicates Citi Prestige cards.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage: npx tsx scripts/fix-master-benefit-cadences.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  MASTER_CATALOG_CADENCES,
  PREMIUM_CARDS_CADENCES,
  type BenefitCadenceMapping,
} from '../prisma/phase6c-cadence-mapping';

const prisma = new PrismaClient();

// ============================================================================
// Cadence Lookup
// ============================================================================

type CadenceLookupEntry = BenefitCadenceMapping & { sourceCard: string };

/**
 * Builds a lookup map keyed by lowercase benefit name.
 * Each entry is an array (multiple cards may share a benefit name).
 */
function buildCadenceLookup(): Map<string, CadenceLookupEntry[]> {
  const lookup = new Map<string, CadenceLookupEntry[]>();

  function addEntries(catalog: Record<string, BenefitCadenceMapping[]>) {
    for (const [cardName, benefits] of Object.entries(catalog)) {
      for (const b of benefits) {
        const key = b.name.toLowerCase();
        const entry: CadenceLookupEntry = { ...b, sourceCard: cardName };
        const existing = lookup.get(key);
        if (existing) {
          existing.push(entry);
        } else {
          lookup.set(key, [entry]);
        }
      }
    }
  }

  addEntries(MASTER_CATALOG_CADENCES);
  addEntries(PREMIUM_CARDS_CADENCES);
  return lookup;
}

/**
 * Find the best cadence match for a given DB benefit.
 *
 * Strategy:
 * 1. Exact benefit name match — prefer entry whose card name best matches the DB card name
 * 2. Contains match (mapping name is substring of DB name or vice versa)
 * 3. Return null if no match
 */
function findCadenceMatch(
  dbCardName: string,
  dbBenefitName: string,
  lookup: Map<string, CadenceLookupEntry[]>
): CadenceLookupEntry | null {
  const benefitLower = dbBenefitName.toLowerCase();
  const cardLower = dbCardName.toLowerCase();

  // 1. Exact benefit name match
  const exactMatches = lookup.get(benefitLower);
  if (exactMatches && exactMatches.length > 0) {
    // Prefer the entry whose card name best matches DB card name
    const bestMatch = pickBestCardMatch(cardLower, exactMatches);
    return bestMatch;
  }

  // 2. Contains/fuzzy match on benefit name
  for (const [mappedName, entries] of lookup) {
    // Check bidirectional containment (but require substantial overlap)
    if (
      (mappedName.length > 5 && benefitLower.includes(mappedName)) ||
      (benefitLower.length > 5 && mappedName.includes(benefitLower))
    ) {
      return pickBestCardMatch(cardLower, entries);
    }
  }

  return null;
}

/** Pick the entry whose sourceCard most closely matches the DB card name. */
function pickBestCardMatch(
  dbCardLower: string,
  candidates: CadenceLookupEntry[]
): CadenceLookupEntry {
  if (candidates.length === 1) return candidates[0];

  // Score each candidate by how well its card name matches
  let bestScore = -1;
  let best = candidates[0];

  for (const c of candidates) {
    const srcLower = c.sourceCard.toLowerCase();
    let score = 0;

    if (srcLower === dbCardLower) {
      score = 100; // Exact match
    } else if (dbCardLower.includes(srcLower) || srcLower.includes(dbCardLower)) {
      // One contains the other — closer match scores higher
      score = 50 + Math.min(srcLower.length, dbCardLower.length);
    } else {
      // Check for base card name match (strip "(Premium)" suffix)
      const baseSrc = srcLower.replace(/\s*\(premium\)\s*$/, '');
      if (baseSrc === dbCardLower || dbCardLower.includes(baseSrc)) {
        score = 40 + baseSrc.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}

// ============================================================================
// Smart Defaults
// ============================================================================

type CadenceType = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'FLEXIBLE_ANNUAL' | 'ONE_TIME';

interface SmartDefault {
  claimingCadence: CadenceType;
  claimingAmount: number;
  claimingWindowEnd: string | null;
}

/**
 * Infer cadence from benefit name, type, and stickerValue when no mapping match exists.
 */
function inferSmartDefault(
  name: string,
  type: string,
  stickerValue: number,
  resetCadence: string
): SmartDefault {
  const nameLower = name.toLowerCase();

  // Rule: names containing time-based keywords
  if (nameLower.includes('monthly') || nameLower.includes('/month') || nameLower.includes('per month')) {
    return {
      claimingCadence: 'MONTHLY',
      claimingAmount: stickerValue > 0 ? stickerValue : 0, // stickerValue is already monthly amount
      claimingWindowEnd: null,
    };
  }

  if (nameLower.includes('quarterly') || nameLower.includes('/quarter')) {
    return {
      claimingCadence: 'QUARTERLY',
      claimingAmount: stickerValue > 0 ? Math.round(stickerValue / 4) : 0,
      claimingWindowEnd: null,
    };
  }

  // Rule: Global Entry / TSA PreCheck → ONE_TIME
  if (
    nameLower.includes('global entry') ||
    nameLower.includes('tsa precheck') ||
    nameLower.includes('tsa pre✓')
  ) {
    return {
      claimingCadence: 'ONE_TIME',
      claimingAmount: stickerValue,
      claimingWindowEnd: null,
    };
  }

  // Rule: Insurance / one-time claims
  if (
    type === 'Insurance' ||
    nameLower.includes('trip cancellation') ||
    nameLower.includes('trip delay') ||
    nameLower.includes('lost luggage') ||
    nameLower.includes('emergency medical')
  ) {
    return {
      claimingCadence: 'ONE_TIME',
      claimingAmount: stickerValue,
      claimingWindowEnd: null,
    };
  }

  // Rule: Annual keywords with monetary value
  if (
    (nameLower.includes('annual') || nameLower.includes('/year')) &&
    stickerValue > 0
  ) {
    return {
      claimingCadence: 'FLEXIBLE_ANNUAL',
      claimingAmount: stickerValue,
      claimingWindowEnd: null,
    };
  }

  // Rule: resetCadence-based fallback
  if (resetCadence === 'MONTHLY' || resetCadence === 'Monthly') {
    return {
      claimingCadence: 'MONTHLY',
      claimingAmount: stickerValue > 0 ? stickerValue : 0,
      claimingWindowEnd: null,
    };
  }

  // Rule: Usage perks (stickerValue = 0) like lounge access, rewards
  // Points/miles multipliers, protection perks, etc.
  if (
    stickerValue === 0 ||
    nameLower.includes('lounge') ||
    nameLower.includes('points') ||
    nameLower.includes('miles') ||
    nameLower.includes('cashback') ||
    nameLower.includes('cash back') ||
    nameLower.includes('rewards') ||
    type === 'Rewards' ||
    type === 'UsagePerk' ||
    type === 'Service' ||
    type === 'Protection'
  ) {
    return {
      claimingCadence: 'FLEXIBLE_ANNUAL',
      claimingAmount: 0,
      claimingWindowEnd: null,
    };
  }

  // Fallback: any remaining benefit with monetary value
  return {
    claimingCadence: 'FLEXIBLE_ANNUAL',
    claimingAmount: stickerValue,
    claimingWindowEnd: null,
  };
}

// ============================================================================
// Citi Prestige Deduplication
// ============================================================================

async function deduplicateCitiPrestige(): Promise<void> {
  console.log('\n━━━ Citi Prestige Deduplication ━━━');

  const citiCards = await prisma.masterCard.findMany({
    where: {
      issuer: 'Citi',
      cardName: { contains: 'Prestige' },
      isArchived: false,
    },
    include: {
      masterBenefits: true,
      userCards: { select: { id: true } },
    },
  });

  if (citiCards.length <= 1) {
    console.log('  ℹ️  No duplicate Citi Prestige cards found (already deduplicated).');
    return;
  }

  console.log(`  Found ${citiCards.length} Citi Prestige cards:`);
  for (const c of citiCards) {
    console.log(`    - "${c.cardName}" (id: ${c.id}, benefits: ${c.masterBenefits.length}, userCards: ${c.userCards.length})`);
  }

  // Keep the card with UserCards attached; archive the other
  const keepCard = citiCards.find((c) => c.userCards.length > 0) || citiCards[0];
  const archiveCards = citiCards.filter((c) => c.id !== keepCard.id);

  console.log(`  ✅ Keeping: "${keepCard.cardName}" (id: ${keepCard.id})`);

  for (const dupe of archiveCards) {
    // Move unique benefits to the kept card
    const keepBenefitNames = new Set(keepCard.masterBenefits.map((b) => b.name.toLowerCase()));
    const uniqueBenefits = dupe.masterBenefits.filter(
      (b) => !keepBenefitNames.has(b.name.toLowerCase())
    );

    if (uniqueBenefits.length > 0) {
      console.log(`  📋 Moving ${uniqueBenefits.length} unique benefits from "${dupe.cardName}" → "${keepCard.cardName}":`);
      for (const b of uniqueBenefits) {
        await prisma.masterBenefit.update({
          where: { id: b.id },
          data: { masterCardId: keepCard.id },
        });
        console.log(`     - "${b.name}" (sv=${b.stickerValue})`);
      }
    }

    // Delete remaining duplicate benefits (names that already exist on keep card)
    const dupeOnlyBenefits = dupe.masterBenefits.filter(
      (b) => keepBenefitNames.has(b.name.toLowerCase())
    );
    if (dupeOnlyBenefits.length > 0) {
      console.log(`  🗑️  Removing ${dupeOnlyBenefits.length} duplicate benefits from "${dupe.cardName}":`);
      for (const b of dupeOnlyBenefits) {
        await prisma.masterBenefit.delete({ where: { id: b.id } });
        console.log(`     - "${b.name}"`);
      }
    }

    // Reassign any UserCards from dupe to keep (shouldn't exist but be safe)
    if (dupe.userCards.length > 0) {
      console.log(`  🔄 Reassigning ${dupe.userCards.length} UserCards from "${dupe.cardName}" → "${keepCard.cardName}"`);
      await prisma.userCard.updateMany({
        where: { masterCardId: dupe.id },
        data: { masterCardId: keepCard.id },
      });
    }

    // Archive the duplicate card
    await prisma.masterCard.update({
      where: { id: dupe.id },
      data: {
        isArchived: true,
        isActive: false,
        archivedAt: new Date(),
        archivedReason: `Deduplicated into "${keepCard.cardName}" (id: ${keepCard.id})`,
      },
    });
    console.log(`  🗄️  Archived: "${dupe.cardName}" (id: ${dupe.id})`);
  }
}

// ============================================================================
// Main: Update All MasterBenefits
// ============================================================================

async function fixMasterBenefitCadences(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Fix MasterBenefit Cadences');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Step 1: Deduplicate Citi Prestige
  await deduplicateCitiPrestige();

  // Step 2: Build cadence lookup from mapping
  const lookup = buildCadenceLookup();
  console.log(`\n📖 Cadence lookup built: ${lookup.size} unique benefit names mapped.\n`);

  // Step 3: Load all active MasterBenefits
  const allBenefits = await prisma.masterBenefit.findMany({
    where: { isActive: true },
    include: { masterCard: { select: { cardName: true, isArchived: true } } },
    orderBy: [{ masterCard: { cardName: 'asc' } }, { name: 'asc' }],
  });

  // Filter out benefits on archived cards
  const benefits = allBenefits.filter((b) => !b.masterCard.isArchived);

  console.log(`━━━ Updating ${benefits.length} MasterBenefits ━━━\n`);

  let mappedCount = 0;
  let defaultedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const mb of benefits) {
    try {
      const match = findCadenceMatch(mb.masterCard.cardName, mb.name, lookup);

      let cadence: CadenceType;
      let amount: number;
      let windowEnd: string | null;
      let source: string;

      if (match) {
        cadence = match.claimingCadence;
        amount = match.claimingAmount;
        windowEnd = match.claimingWindowEnd ?? null;
        source = `mapping (${match.sourceCard})`;
        mappedCount++;
      } else {
        const defaults = inferSmartDefault(mb.name, mb.type, mb.stickerValue, mb.resetCadence);
        cadence = defaults.claimingCadence;
        amount = defaults.claimingAmount;
        windowEnd = defaults.claimingWindowEnd;
        source = 'smart default';
        defaultedCount++;
      }

      // Check if update is needed (idempotency)
      if (
        mb.claimingCadence === cadence &&
        mb.claimingAmount === amount &&
        mb.claimingWindowEnd === windowEnd
      ) {
        skippedCount++;
        continue;
      }

      // Apply update
      await prisma.masterBenefit.update({
        where: { id: mb.id },
        data: {
          claimingCadence: cadence,
          claimingAmount: amount,
          claimingWindowEnd: windowEnd,
        },
      });

      console.log(
        `  ✅ ${mb.masterCard.cardName} → "${mb.name}"\n` +
          `     cadence: ${mb.claimingCadence ?? 'NULL'} → ${cadence}` +
          ` | amount: ${mb.claimingAmount ?? 'NULL'} → ${amount}` +
          (windowEnd ? ` | windowEnd: ${windowEnd}` : '') +
          ` [${source}]`
      );
    } catch (err) {
      errorCount++;
      console.error(
        `  ❌ FAILED: ${mb.masterCard.cardName} → "${mb.name}": ${err instanceof Error ? err.message : err}`
      );
    }
  }

  // Step 4: Summary
  console.log('\n━━━ Summary ━━━');
  console.log(`  Total benefits processed: ${benefits.length}`);
  console.log(`  Mapped from cadence data: ${mappedCount}`);
  console.log(`  Smart defaults applied:   ${defaultedCount}`);
  console.log(`  Skipped (already set):    ${skippedCount}`);
  console.log(`  Errors:                   ${errorCount}`);

  // Verification query
  const nullCount = await prisma.masterBenefit.count({
    where: { claimingCadence: null, isActive: true, masterCard: { isArchived: false } },
  });
  console.log(`\n  MasterBenefits still with NULL cadence: ${nullCount}`);

  if (nullCount > 0) {
    const remaining = await prisma.masterBenefit.findMany({
      where: { claimingCadence: null, isActive: true, masterCard: { isArchived: false } },
      include: { masterCard: { select: { cardName: true } } },
    });
    console.log('  Remaining NULL cadence benefits:');
    for (const r of remaining) {
      console.log(`    - ${r.masterCard.cardName}: "${r.name}"`);
    }
  }
}

// ============================================================================
// Entry Point
// ============================================================================

fixMasterBenefitCadences()
  .then(() => {
    console.log('\n✅ MasterBenefit cadence fix complete.\n');
  })
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
