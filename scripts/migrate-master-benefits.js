/**
 * MasterBenefit Cadence Migration Script
 *
 * Fixes MasterBenefit records that are missing claimingCadence, claimingAmount,
 * and variableAmounts fields. Without these fields the benefit engine falls back
 * to stickerValue (annual total) as the per-period amount, producing grossly
 * inflated UserBenefit rows (e.g. "$200 Uber" per month instead of "$15/month").
 *
 * This script is IDEMPOTENT — safe to run multiple times. It skips records that
 * already have correct cadence values.
 *
 * @see .github/specs/masterdata-migration-spec.md
 * @module scripts/migrate-master-benefits
 */

const { PrismaClient, Prisma } = require('@prisma/client');

const prisma = new PrismaClient();

// ============================================================================
// ANSI color helpers
// ============================================================================
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function logUpdate(msg) { console.log(`${GREEN}  ✅ ${msg}${RESET}`); }
function logSkip(msg)   { console.log(`${YELLOW}  ⏭️  ${msg}${RESET}`); }
function logWarn(msg)   { console.log(`${YELLOW}  ⚠️  ${msg}${RESET}`); }
function logError(msg)  { console.error(`${RED}  ❌ ${msg}${RESET}`); }
function logInfo(msg)   { console.log(`${CYAN}  ℹ️  ${msg}${RESET}`); }

// ============================================================================
// Cadence mapping — source of truth for all 15 premium cards
// Keys: issuer + cardName (matches the @@unique constraint in MasterCard)
// Values: benefit name → { claimingCadence, claimingAmount, variableAmounts }
//
// Amounts are in CENTS. variableAmounts overrides claimingAmount for specific
// months (e.g. { "12": 3500 } means December = $35.00 instead of default).
// ============================================================================
const MIGRATIONS = [
  // ── Card 1: American Express Platinum Card ──────────────────────────────
  {
    issuer: 'American Express',
    cardName: 'American Express Platinum Card',
    benefits: [
      { name: '$600 Annual Hotel Credit',            claimingCadence: 'SEMI_ANNUAL',     claimingAmount: 30000, variableAmounts: null, newName: 'Hotel Credit' },
      { name: '$400 Resy Dining Credit',             claimingCadence: 'QUARTERLY',       claimingAmount: 10000, variableAmounts: null, newName: 'Resy Dining Credit' },
      { name: '$300 Entertainment Credit',           claimingCadence: 'MONTHLY',         claimingAmount: 2500,  variableAmounts: null, newName: 'Entertainment Credit' },
      { name: '$300 Lululemon Annual Credit',        claimingCadence: 'QUARTERLY',       claimingAmount: 7500,  variableAmounts: null, newName: 'Lululemon Credit' },
      { name: '$200 Uber Annual Credit',             claimingCadence: 'MONTHLY',         claimingAmount: 1500,  variableAmounts: { '12': 3500 }, newName: 'Uber Credit' },
      { name: '$209 CLEAR Annual Credit',            claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 20900, variableAmounts: null, newName: 'CLEAR+ Credit' },
      { name: 'Centurion Lounge Access',             claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: 'Complimentary Airport Meet & Greet',  claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null, isActive: false },
      { name: 'Global Entry or TSA PreCheck',        claimingCadence: 'ONE_TIME',        claimingAmount: 12000, variableAmounts: null },
      { name: 'Fine Hotels & Resorts Partner Program', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,   variableAmounts: null },
    ],
  },

  // ── Card 2: American Express Gold Card ──────────────────────────────────
  {
    issuer: 'American Express',
    cardName: 'American Express Gold Card',
    benefits: [
      { name: '4x Points on Dining & Restaurants', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,    variableAmounts: null },
      { name: '4x Points on Flights',              claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,    variableAmounts: null, newName: '3x Points on Flights' },
      { name: '$120 Annual Dining Credit',          claimingCadence: 'MONTHLY',         claimingAmount: 1000, variableAmounts: null, newName: 'Dining Credit' },
      { name: '$100 Annual Uber Credit',            claimingCadence: 'MONTHLY',         claimingAmount: 1000, variableAmounts: null, stickerValue: 12000, newName: 'Uber Credit' },
      { name: 'Purchase Protection',               claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,    variableAmounts: null },
    ],
  },

  // ── Card 3: Chase Sapphire Reserve ──────────────────────────────────────
  {
    issuer: 'Chase',
    cardName: 'Chase Sapphire Reserve',
    benefits: [
      { name: '$300 Annual Travel Credit',         claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 30000, variableAmounts: null, newName: 'Travel Credit' },
      { name: '$500 The Edit Hotel Credit',        claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 25000, variableAmounts: null, newName: 'The Edit Hotel Credit' },
      { name: '$250 Hotel Chain Credit',           claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 25000, variableAmounts: null, newName: 'Hotel Chain Credit' },
      { name: '$300 Dining Credit',                claimingCadence: 'SEMI_ANNUAL',     claimingAmount: 15000, variableAmounts: null, newName: 'Dining Credit' },
      { name: '$300 Entertainment Credit',         claimingCadence: 'SEMI_ANNUAL',     claimingAmount: 15000, variableAmounts: null, newName: 'Entertainment Credit' },
      { name: 'Priority Pass Select Lounge Access', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,    variableAmounts: null },
      { name: 'Trip Cancellation Insurance',       claimingCadence: 'ONE_TIME',        claimingAmount: 0,     variableAmounts: null },
      { name: 'Lost Luggage Reimbursement',        claimingCadence: 'ONE_TIME',        claimingAmount: 0,     variableAmounts: null },
      { name: 'Global Entry or TSA PreCheck Credit', claimingCadence: 'ONE_TIME',      claimingAmount: 10500, variableAmounts: null },
    ],
  },

  // ── Card 4: Chase Sapphire Preferred ────────────────────────────────────
  {
    issuer: 'Chase',
    cardName: 'Chase Sapphire Preferred',
    benefits: [
      { name: '3x Points on Travel & Dining',         claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null },
      { name: 'Ultimate Rewards Flexible Redemption',  claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null },
      { name: 'Trip Cancellation Insurance',           claimingCadence: 'ONE_TIME',        claimingAmount: 0, variableAmounts: null },
      { name: 'Trip Delay Reimbursement',              claimingCadence: 'ONE_TIME',        claimingAmount: 0, variableAmounts: null },
      { name: 'Emergency Medical & Dental',            claimingCadence: 'ONE_TIME',        claimingAmount: 0, variableAmounts: null },
      { name: 'Purchase Protection',                   claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null },
    ],
  },

  // ── Card 5: Chase Ink Preferred Business ────────────────────────────────
  {
    issuer: 'Chase',
    cardName: 'Chase Ink Preferred Business',
    benefits: [
      { name: '3x Points on Business Purchases', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null },
      { name: 'Business Expense Tracking',       claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null },
      { name: 'Purchase Protection',             claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null },
    ],
  },

  // ── Card 6: Chase Southwest Rapid Rewards Premier ───────────────────────
  {
    issuer: 'Chase',
    cardName: 'Chase Southwest Rapid Rewards Premier',
    benefits: [
      { name: 'Free Checked Bags',              claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 30000, variableAmounts: null },
      { name: '2x Points on Southwest Flights', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: 'Complimentary Boarding',         claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 5000,  variableAmounts: null },
    ],
  },

  // ── Card 7: Chase Hyatt Credit Card ─────────────────────────────────────
  {
    issuer: 'Chase',
    cardName: 'Chase Hyatt Credit Card',
    benefits: [
      { name: 'Free Night Award',         claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 30000, variableAmounts: null },
      { name: '4x Points on Hyatt Hotels', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: 'Elite Night Credits',       claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 10000, variableAmounts: null },
    ],
  },

  // ── Card 8: American Express Green Card ─────────────────────────────────
  {
    issuer: 'American Express',
    cardName: 'American Express Green Card',
    benefits: [
      { name: '3x Membership Rewards on Travel',             claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: '1x Membership Rewards on All Other Purchases', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: 'Statement Credits for Travel',                 claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 20900, variableAmounts: null, newName: 'CLEAR+ Credit', stickerValue: 20900 },
    ],
  },

  // ── Card 9: American Express Business Gold Card ─────────────────────────
  {
    issuer: 'American Express',
    cardName: 'American Express Business Gold Card',
    benefits: [
      { name: '4x Membership Rewards on Business Purchases',  claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null, newName: '4x on Top 2 Categories' },
      { name: '1x Membership Rewards on All Other Purchases', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null },
      { name: 'Business Expense Tracking',                    claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null },
      // ── April 2026: New benefits ──
      { name: 'Flexible Business Credit',                     claimingCadence: 'MONTHLY',         claimingAmount: 2000,  variableAmounts: null, isNew: true, type: 'StatementCredit', stickerValue: 24000, resetCadence: 'Monthly' },
      { name: 'Squarespace Credit',                          claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 15000, variableAmounts: null, isNew: true, type: 'StatementCredit', stickerValue: 15000, resetCadence: 'CalendarYear' },
    ],
  },

  // ── Card 10: American Express Hilton Honors Surpass Card ────────────────
  {
    issuer: 'American Express',
    cardName: 'American Express Hilton Honors Surpass Card',
    benefits: [
      { name: 'Free Night Award Certificate', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 30000, variableAmounts: null },
      { name: '10x Points on Hilton Hotels',  claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null, newName: '12x Points on Hilton Hotels' },
      { name: 'Complimentary Room Upgrades',  claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 5000,  variableAmounts: null },
      { name: 'Airline Fee Credit',           claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 15000, variableAmounts: null, isActive: false },
      { name: 'Priority Pass (10 visits)',    claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null, isActive: false },
    ],
  },

  // ── Card 11: American Express Marriott Bonvoy Brilliant Credit Card ─────
  {
    issuer: 'American Express',
    cardName: 'American Express Marriott Bonvoy Brilliant Credit Card',
    benefits: [
      { name: 'Free Night Award Certificate', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 25000, variableAmounts: null },
      { name: '6x Points on Marriott Hotels', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: 'Elite Night Credits',          claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 10000, variableAmounts: null },
      { name: 'Airline Fee Credit',           claimingCadence: 'MONTHLY',         claimingAmount: 2500,  variableAmounts: null, newName: 'Dining Credit', stickerValue: 30000 },
      // ── April 2026: New benefit ──
      { name: 'Priority Pass Select',         claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null, isNew: true, type: 'TravelPerk', stickerValue: 0, resetCadence: 'CardmemberYear' },
    ],
  },

  // ── Card 12: Capital One Venture X ──────────────────────────────────────
  {
    issuer: 'Capital One',
    cardName: 'Capital One Venture X',
    benefits: [
      { name: '$300 Annual Travel Credit',   claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 30000, variableAmounts: null, newName: 'Travel Credit' },
      { name: '10x Miles on Travel & Dining', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null, newName: '10x Hotels/Cars via Portal, 5x Flights, 2x All Else' },
      { name: 'Priority Pass Lounge',        claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: '2x Miles on All Purchases',   claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: 'Baggage Fee Credit',          claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 8000,  variableAmounts: null, isActive: false },
    ],
  },

  // ── Card 13: Barclays JetBlue Plus Card ─────────────────────────────────
  {
    issuer: 'Barclays',
    cardName: 'Barclays JetBlue Plus Card',
    benefits: [
      { name: '3x Points on JetBlue Flights',   claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,    variableAmounts: null },
      { name: 'Free Checked Bags',               claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 30000, variableAmounts: null },
      { name: 'Inflight Free Drinks & Snacks',   claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 5000, variableAmounts: null, newName: '50% Statement Credit on Food & Cocktails' },
    ],
  },

  // ── Card 14: Citi Prestige Card ─────────────────────────────────────────
  {
    issuer: 'Citi',
    cardName: 'Citi Prestige Card',
    benefits: [
      { name: 'Travel Credit',               claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 25000, variableAmounts: null, newName: 'Airline Travel Credit' },
      { name: '3x Prestige Points on Travel', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null, newName: '5x Airlines/Dining, 3x Hotels/Cruise' },
      { name: 'Fourth Night Free at Hotels',  claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: 'Concierge Services',           claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
    ],
  },

  // ── Card 15: US Bank Altitude Reserve Visa Infinite ─────────────────────
  {
    issuer: 'US Bank',
    cardName: 'US Bank Altitude Reserve Visa Infinite',
    benefits: [
      { name: '$300 Quarterly Travel Credit',    claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 32500, variableAmounts: null, newName: 'Travel Credit', stickerValue: 32500 },
      { name: '4.5x Points on Travel & Dining',  claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
      { name: 'Priority Pass Select',            claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0,     variableAmounts: null },
    ],
  },
];

// ============================================================================
// Migration Logic
// ============================================================================

/**
 * Format cents as dollars for logging.
 * @param {number} cents
 * @returns {string}
 */
function formatCents(cents) {
  if (cents === 0 || cents === null || cents === undefined) return '$0';
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Compare variableAmounts objects for equality.
 * Handles null, Prisma.DbNull, and JSON objects.
 * @param {*} a - Current DB value
 * @param {*} b - Target value (null or object)
 * @returns {boolean}
 */
function variableAmountsEqual(a, b) {
  // Both null/undefined/DbNull → equal
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

async function main() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  MasterBenefit Cadence Migration${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}\n`);

  const stats = {
    cardsProcessed: 0,
    cardsNotFound: 0,
    benefitsUpdated: 0,
    benefitsSkipped: 0,
    benefitsNotFound: 0,
    benefitsAlreadyCorrect: 0,
    benefitsDeactivated: 0,
    benefitsRenamed: 0,
    benefitsCreated: 0,
    catchAllUpdated: 0,
    errors: 0,
  };

  // ── Phase 1: Apply explicit card-level mappings ───────────────────────
  for (const cardMapping of MIGRATIONS) {
    const cardLabel = `${cardMapping.issuer} → ${cardMapping.cardName}`;
    console.log(`\n${BOLD}📇 ${cardLabel}${RESET}`);

    // Find the MasterCard using the unique (issuer, cardName) constraint
    let masterCard;
    try {
      masterCard = await prisma.masterCard.findUnique({
        where: {
          issuer_cardName: {
            issuer: cardMapping.issuer,
            cardName: cardMapping.cardName,
          },
        },
      });
    } catch (err) {
      logError(`Failed to query MasterCard: ${err.message}`);
      stats.errors++;
      continue;
    }

    if (!masterCard) {
      logWarn(`Card not found in DB — skipping all benefits`);
      stats.cardsNotFound++;
      continue;
    }

    stats.cardsProcessed++;

    for (const benefitMapping of cardMapping.benefits) {
      try {
        // Find MasterBenefit by card + name (scoped to avoid cross-card collisions)
        let mb = await prisma.masterBenefit.findFirst({
          where: {
            masterCardId: masterCard.id,
            name: benefitMapping.name,
          },
        });

        // For renames: if not found by old name, try new name (idempotent re-run)
        if (!mb && benefitMapping.newName) {
          mb = await prisma.masterBenefit.findFirst({
            where: {
              masterCardId: masterCard.id,
              name: benefitMapping.newName,
            },
          });
        }

        // For new benefits: create if not found in DB
        if (!mb && benefitMapping.isNew) {
          await prisma.masterBenefit.create({
            data: {
              masterCardId: masterCard.id,
              name: benefitMapping.name,
              type: benefitMapping.type || 'StatementCredit',
              stickerValue: benefitMapping.stickerValue || 0,
              resetCadence: benefitMapping.resetCadence || 'CalendarYear',
              claimingCadence: benefitMapping.claimingCadence,
              claimingAmount: benefitMapping.claimingAmount,
              variableAmounts: benefitMapping.variableAmounts === null
                ? Prisma.DbNull
                : benefitMapping.variableAmounts,
            },
          });
          logUpdate(`[NEW] "${benefitMapping.name}" created (${benefitMapping.claimingCadence}, ${formatCents(benefitMapping.claimingAmount)})`);
          stats.benefitsCreated++;
          continue;
        }

        if (!mb) {
          logWarn(`Benefit not found: "${benefitMapping.name}"`);
          stats.benefitsNotFound++;
          continue;
        }

        // Idempotency: check if values already match the target
        const cadenceMatches = mb.claimingCadence === benefitMapping.claimingCadence;
        const amountMatches = mb.claimingAmount === benefitMapping.claimingAmount;
        const variableMatches = variableAmountsEqual(mb.variableAmounts, benefitMapping.variableAmounts);
        const nameMatches = !benefitMapping.newName || mb.name === benefitMapping.newName;
        const activeMatches = benefitMapping.isActive === undefined || mb.isActive === benefitMapping.isActive;
        const stickerMatches = benefitMapping.stickerValue === undefined || mb.stickerValue === benefitMapping.stickerValue;

        if (cadenceMatches && amountMatches && variableMatches && nameMatches && activeMatches && stickerMatches) {
          logSkip(`"${benefitMapping.newName || benefitMapping.name}" — already correct (${benefitMapping.claimingCadence}, ${formatCents(benefitMapping.claimingAmount)})`);
          stats.benefitsAlreadyCorrect++;
          continue;
        }

        // If claimingCadence is set but DIFFERENT from target, still update
        // (could happen if mapping was partially applied with wrong values)
        if (mb.claimingCadence && !cadenceMatches) {
          logInfo(`"${benefitMapping.name}" — cadence changing: ${mb.claimingCadence} → ${benefitMapping.claimingCadence}`);
        }

        // Build update data — use Prisma.DbNull for null Json fields
        const updateData = {
          claimingCadence: benefitMapping.claimingCadence,
          claimingAmount: benefitMapping.claimingAmount,
          variableAmounts: benefitMapping.variableAmounts === null
            ? Prisma.DbNull
            : benefitMapping.variableAmounts,
        };

        // Handle renames
        if (benefitMapping.newName) {
          updateData.name = benefitMapping.newName;
        }

        // Handle deactivations
        if (benefitMapping.isActive === false) {
          updateData.isActive = false;
        }

        // Handle stickerValue updates
        if (benefitMapping.stickerValue !== undefined) {
          updateData.stickerValue = benefitMapping.stickerValue;
        }

        await prisma.masterBenefit.update({
          where: { id: mb.id },
          data: updateData,
        });

        const displayName = benefitMapping.newName || benefitMapping.name;
        const beforeStr = `${mb.claimingCadence || 'NULL'}, ${formatCents(mb.claimingAmount)}`;
        const afterStr = `${benefitMapping.claimingCadence}, ${formatCents(benefitMapping.claimingAmount)}`;
        const varStr = benefitMapping.variableAmounts
          ? `, variableAmounts=${JSON.stringify(benefitMapping.variableAmounts)}`
          : '';
        const renameStr = benefitMapping.newName ? ` (renamed from "${benefitMapping.name}")` : '';
        const deactivateStr = benefitMapping.isActive === false ? ' [DEACTIVATED]' : '';

        logUpdate(`"${displayName}": [${beforeStr}] → [${afterStr}${varStr}]${renameStr}${deactivateStr}`);
        stats.benefitsUpdated++;
        if (benefitMapping.newName) stats.benefitsRenamed++;
        if (benefitMapping.isActive === false) stats.benefitsDeactivated++;
      } catch (err) {
        logError(`Failed to update "${benefitMapping.name}": ${err.message}`);
        stats.errors++;
      }
    }
  }

  // ── Phase 2: Smart-default catch-all for remaining NULLs ──────────────
  console.log(`\n${BOLD}🔄 Phase 2: Smart defaults for remaining NULL claimingCadence records${RESET}`);

  try {
    const remaining = await prisma.masterBenefit.findMany({
      where: { claimingCadence: null },
      include: { masterCard: { select: { cardName: true } } },
    });

    if (remaining.length === 0) {
      logInfo('No remaining records with NULL claimingCadence — all covered!');
    } else {
      logInfo(`Found ${remaining.length} record(s) with NULL claimingCadence — applying smart defaults`);

      for (const mb of remaining) {
        const nameLower = mb.name.toLowerCase();
        let cadence = 'FLEXIBLE_ANNUAL';
        let amount = mb.stickerValue > 0 ? mb.stickerValue : 0;

        // Keyword-based heuristics
        if (nameLower.includes('monthly')) {
          cadence = 'MONTHLY';
          amount = mb.stickerValue > 0 ? Math.round(mb.stickerValue / 12) : 0;
        } else if (nameLower.includes('quarterly')) {
          cadence = 'QUARTERLY';
          amount = mb.stickerValue > 0 ? Math.round(mb.stickerValue / 4) : 0;
        } else if (nameLower.includes('semi-annual') || nameLower.includes('semi annual')) {
          cadence = 'SEMI_ANNUAL';
          amount = mb.stickerValue > 0 ? Math.round(mb.stickerValue / 2) : 0;
        } else if (nameLower.includes('one-time') || nameLower.includes('one time') ||
                   nameLower.includes('global entry') || nameLower.includes('tsa precheck')) {
          cadence = 'ONE_TIME';
          amount = mb.stickerValue;
        }

        await prisma.masterBenefit.update({
          where: { id: mb.id },
          data: {
            claimingCadence: cadence,
            claimingAmount: amount,
            variableAmounts: Prisma.DbNull,
          },
        });

        logUpdate(`[catch-all] "${mb.name}" (${mb.masterCard.cardName}): → ${cadence}, ${formatCents(amount)}`);
        stats.catchAllUpdated++;
      }
    }
  } catch (err) {
    logError(`Smart-default catch-all failed: ${err.message}`);
    stats.errors++;
  }

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  Migration Summary${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${DIM}  Cards processed:        ${RESET}${stats.cardsProcessed}`);
  console.log(`${DIM}  Cards not found:        ${RESET}${stats.cardsNotFound > 0 ? YELLOW : ''}${stats.cardsNotFound}${RESET}`);
  console.log(`${DIM}  Benefits updated:       ${RESET}${GREEN}${stats.benefitsUpdated}${RESET}`);
  console.log(`${DIM}  Benefits created:       ${RESET}${GREEN}${stats.benefitsCreated}${RESET}`);
  console.log(`${DIM}  Benefits renamed:       ${RESET}${stats.benefitsRenamed}`);
  console.log(`${DIM}  Benefits deactivated:   ${RESET}${stats.benefitsDeactivated}`);
  console.log(`${DIM}  Benefits already correct:${RESET} ${stats.benefitsAlreadyCorrect}`);
  console.log(`${DIM}  Benefits skipped (set): ${RESET}${stats.benefitsSkipped}`);
  console.log(`${DIM}  Benefits not found:     ${RESET}${stats.benefitsNotFound > 0 ? YELLOW : ''}${stats.benefitsNotFound}${RESET}`);
  console.log(`${DIM}  Catch-all applied:      ${RESET}${stats.catchAllUpdated}`);
  console.log(`${DIM}  Errors:                 ${RESET}${stats.errors > 0 ? RED : ''}${stats.errors}${RESET}`);
  console.log('');

  if (stats.benefitsUpdated > 0 || stats.catchAllUpdated > 0 || stats.benefitsCreated > 0) {
    console.log(`${GREEN}${BOLD}  ✅ Migration complete — ${stats.benefitsUpdated + stats.catchAllUpdated + stats.benefitsCreated} record(s) updated/created.${RESET}\n`);
  } else if (stats.benefitsAlreadyCorrect > 0) {
    console.log(`${GREEN}${BOLD}  ✅ Migration complete — all records already up to date.${RESET}\n`);
  } else {
    console.log(`${YELLOW}${BOLD}  ⚠️  Migration complete — no records were updated (check warnings above).${RESET}\n`);
  }
}

// ============================================================================
// Entry point — always exit 0 to avoid blocking deploys
// ============================================================================
main()
  .catch((err) => {
    console.error(`${RED}${BOLD}⚠️  Migration encountered a fatal error:${RESET}`, err.message);
    console.error(`${DIM}${err.stack}${RESET}`);
    // Exit 0 even on failure — don't block the app from starting
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
