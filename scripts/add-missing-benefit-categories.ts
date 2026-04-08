#!/usr/bin/env npx ts-node
/**
 * scripts/add-missing-benefit-categories.ts
 *
 * Sprint 2 — cat-6: Adds missing MasterBenefit categories that are
 * trackable but were not in the original catalog:
 *
 *   1. Welcome / sign-up bonuses   → claimingCadence: ONE_TIME, isDefault: false
 *   2. Anniversary certificates    → claimingCadence: FLEXIBLE_ANNUAL, isDefault: true
 *
 * Idempotent: uses findFirst + create to skip existing entries.
 *
 * Usage:
 *   npx ts-node scripts/add-missing-benefit-categories.ts
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ============================================================================
// New benefit entries to add (keyed by card name for lookup)
// ============================================================================

interface NewBenefit {
  cardIssuer: string;
  cardName: string;
  benefit: {
    name: string;
    type: string;
    stickerValue: number;
    resetCadence: string;
    claimingCadence: string;
    claimingAmount: number;
    isDefault: boolean;
  };
}

const NEW_BENEFITS: NewBenefit[] = [
  // ── Welcome Bonuses ───────────────────────────────────────────────
  {
    cardIssuer: 'American Express',
    cardName: 'American Express Gold Card',
    benefit: {
      name: 'Welcome Bonus: 90,000 MR Points',
      type: 'UsagePerk',
      stickerValue: 135000,
      resetCadence: 'CUSTOM',
      claimingCadence: 'ONE_TIME',
      claimingAmount: 0,
      isDefault: false,
    },
  },
  {
    cardIssuer: 'American Express',
    cardName: 'American Express Platinum Card',
    benefit: {
      name: 'Welcome Bonus: 150,000 MR Points',
      type: 'UsagePerk',
      stickerValue: 225000,
      resetCadence: 'CUSTOM',
      claimingCadence: 'ONE_TIME',
      claimingAmount: 0,
      isDefault: false,
    },
  },
  {
    cardIssuer: 'Chase',
    cardName: 'Chase Sapphire Preferred',
    benefit: {
      name: 'Welcome Bonus: 60,000 Points',
      type: 'UsagePerk',
      stickerValue: 90000,
      resetCadence: 'CUSTOM',
      claimingCadence: 'ONE_TIME',
      claimingAmount: 0,
      isDefault: false,
    },
  },
  {
    cardIssuer: 'Capital One',
    cardName: 'Capital One Venture X',
    benefit: {
      name: 'Welcome Bonus: 75,000 Miles',
      type: 'UsagePerk',
      stickerValue: 112500,
      resetCadence: 'CUSTOM',
      claimingCadence: 'ONE_TIME',
      claimingAmount: 0,
      isDefault: false,
    },
  },

  // ── Anniversary Certificates / Bonuses ────────────────────────────
  {
    cardIssuer: 'Capital One',
    cardName: 'Capital One Venture X',
    benefit: {
      name: 'Anniversary 10,000 Miles Bonus',
      type: 'UsagePerk',
      stickerValue: 15000,
      resetCadence: 'ANNUAL',
      claimingCadence: 'FLEXIBLE_ANNUAL',
      claimingAmount: 0,
      isDefault: true,
    },
  },
];

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🏷️  Adding missing benefit categories...\n');

  let created = 0;
  let skipped = 0;

  for (const entry of NEW_BENEFITS) {
    // Look up the MasterCard
    const masterCard = await prisma.masterCard.findFirst({
      where: {
        issuer: entry.cardIssuer,
        cardName: entry.cardName,
      },
    });

    if (!masterCard) {
      console.log(`  ⚠️  Card not found: ${entry.cardIssuer} ${entry.cardName} — skipping`);
      skipped++;
      continue;
    }

    // Check if the benefit already exists
    const existing = await prisma.masterBenefit.findFirst({
      where: {
        masterCardId: masterCard.id,
        name: entry.benefit.name,
      },
    });

    if (existing) {
      console.log(`  ⏭️  Already exists: ${entry.benefit.name} on ${entry.cardName}`);
      skipped++;
      continue;
    }

    // Create the new MasterBenefit
    await prisma.masterBenefit.create({
      data: {
        masterCardId: masterCard.id,
        name: entry.benefit.name,
        type: entry.benefit.type,
        stickerValue: entry.benefit.stickerValue,
        resetCadence: entry.benefit.resetCadence,
        claimingCadence: entry.benefit.claimingCadence,
        claimingAmount: entry.benefit.claimingAmount,
        isDefault: entry.benefit.isDefault,
        isActive: true,
      },
    });

    console.log(`  ✅ Created: ${entry.benefit.name} on ${entry.cardName}`);
    created++;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

main()
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
