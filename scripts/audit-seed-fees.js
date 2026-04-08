#!/usr/bin/env node
/**
 * scripts/audit-seed-fees.js
 *
 * Sprint 2 — cat-7: Reads all seed files, extracts (cardName, defaultAnnualFee)
 * pairs, compares them against prisma/seed.ts as the source of truth, and reports
 * any mismatches.
 *
 * Usage:
 *   node scripts/audit-seed-fees.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Source of truth — extracted from prisma/seed.ts
// Values are in CENTS (e.g., 9500 = $95)
// ============================================================================

const SOURCE_OF_TRUTH = {
  'American Express Gold Card': 25000,
  'American Express Platinum Card': 69500,
  'Chase Sapphire Preferred': 9500,
  'Discover It': 0,
  'Capital One Venture X': 39500,
  'Citi Prestige': 49500,
  'Bank of America Premium Rewards': 9500,
  'Wells Fargo Propel American Express': 0,
  'Chase Freedom Unlimited': 0,
};

// ============================================================================
// Seed files to audit
// ============================================================================

const SEED_FILES = [
  'seed-top-10-cards.js',
  'seed-points-cards-comprehensive.js',
  'seed-demo.js',
  // april-2026 files use intentionally hypothetical fees — skip
];

// ============================================================================
// Extract (cardName, fee) pairs from a JS file
// ============================================================================

function extractFees(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const pairs = [];

  // Match patterns like:
  //   cardName: 'Card Name',    (possibly with or without quotes)
  //   defaultAnnualFee: 12345,
  const cardNameRegex = /cardName:\s*['"`]([^'"`]+)['"`]/g;
  const feeRegex = /defaultAnnualFee:\s*(\d+)/g;

  const cardNames = [];
  let match;
  while ((match = cardNameRegex.exec(content)) !== null) {
    cardNames.push({ name: match[1], index: match.index });
  }

  const fees = [];
  while ((match = feeRegex.exec(content)) !== null) {
    fees.push({ fee: parseInt(match[1], 10), index: match.index });
  }

  // Pair each cardName with the nearest following fee
  for (const card of cardNames) {
    const nearestFee = fees.find((f) => f.index > card.index);
    if (nearestFee) {
      pairs.push({ cardName: card.name, fee: nearestFee.fee });
    }
  }

  return pairs;
}

// ============================================================================
// Main audit
// ============================================================================

let mismatches = 0;
let warnings = 0;
const MAX_FEE_CENTS = 1000000; // $10,000 sanity limit

console.log('🔍 Auditing seed file annual fees...\n');

for (const file of SEED_FILES) {
  const filePath = path.resolve(__dirname, '..', file);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  File not found: ${file} — skipping`);
    warnings++;
    continue;
  }

  const pairs = extractFees(filePath);
  console.log(`📄 ${file} (${pairs.length} cards found)`);

  for (const { cardName, fee } of pairs) {
    // Sanity checks
    if (fee > MAX_FEE_CENTS) {
      console.log(`  ❌ ${cardName}: $${(fee / 100).toFixed(0)} exceeds $10,000 sanity limit`);
      mismatches++;
      continue;
    }
    if (fee < 0) {
      console.log(`  ❌ ${cardName}: negative fee (${fee})`);
      mismatches++;
      continue;
    }

    // Check against source of truth
    const truthFee = SOURCE_OF_TRUTH[cardName];
    if (truthFee !== undefined && fee !== truthFee) {
      console.log(
        `  ❌ ${cardName}: ${file} has $${(fee / 100).toFixed(0)} (${fee}), ` +
        `expected $${(truthFee / 100).toFixed(0)} (${truthFee})`
      );
      mismatches++;
    }
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (mismatches === 0) {
  console.log('✅ All seed files agree on fees. No mismatches found.');
} else {
  console.log(`❌ Found ${mismatches} mismatch(es). Please fix before deploying.`);
}
if (warnings > 0) {
  console.log(`⚠️  ${warnings} warning(s).`);
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

process.exit(mismatches > 0 ? 1 : 0);
