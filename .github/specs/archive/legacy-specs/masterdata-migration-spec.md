# MasterBenefit Cadence Migration — Technical Specification

## Executive Summary & Goals

The production database contains MasterBenefit records (seeded by `scripts/seed-premium-cards.js`) that are missing `claimingCadence`, `claimingAmount`, and `variableAmounts` fields. This causes the benefit engine (`generate-benefits.ts:100-106`) to fall back to `stickerValue` (the full annual total) as the per-period amount, producing grossly inflated UserBenefit rows (e.g., showing $200/month for Uber instead of the correct $15/month).

### Primary Objectives

1. **Correct all MasterBenefit records** in production with accurate per-period cadence and amounts based on actual card terms.
2. **Produce an idempotent Node.js migration script** (`scripts/migrate-master-benefits.js`) safe for repeated execution.
3. **Integrate into the deploy pipeline** so the fix auto-applies on the next Railway deployment.
4. **Provide verification queries** to confirm the migration was successful.
5. **Update the cadence mapping source-of-truth** (`prisma/phase6c-cadence-mapping.ts`) so future runs of `fix-master-benefit-cadences.ts` use correct values.

### Success Criteria

- Zero MasterBenefit records with `type = 'StatementCredit'` + `stickerValue > 0` still have `claimingCadence = NULL`.
- The Amex Platinum `$200 Uber Annual Credit` generates UserBenefits at $15/month (1500 cents), not $200/month.
- The migration script can be run N times with identical database state after the first run.
- The `start` script in `package.json` runs the migration before `next start`.

---

## Root Cause Analysis

### The Bug Chain

```
seed-premium-cards.js
  → Creates MasterBenefit with: { stickerValue: 20000, resetCadence: 'ANNUAL' }
  → claimingCadence: undefined (not set)
  → claimingAmount: undefined (not set)

generate-benefits.ts (line 100-106):
  const effectiveAmount = mb.claimingAmount       // undefined → falsy
    ? resolveClaimingAmount(mb.claimingAmount, ...) 
    : mb.stickerValue;                             // FALLBACK → 20000 ($200!)

date-math.ts resolveCadence():
  claimingCadence = null → falls to resetCadence switch
  resetCadence = 'ANNUAL' → no case match → default: 'MONTHLY'

Result: UserBenefit created with stickerValue=$200, period=MONTHLY
        User sees "$200 Uber credit — resets monthly" ← WRONG
```

### What Should Happen

```
MasterBenefit: { stickerValue: 20000, claimingCadence: 'MONTHLY', 
                 claimingAmount: 1500, variableAmounts: {"12": 3500} }

generate-benefits.ts:
  effectiveAmount = resolveClaimingAmount(1500, {"12": 3500}, currentMonth)
  → Jan-Nov: 1500 ($15), Dec: 3500 ($35)

Result: UserBenefit created with stickerValue=$15, period=MONTHLY ← CORRECT
```

---

## Functional Requirements

### FR-1: MasterBenefit Data Correction
Update all MasterBenefit records from `seed-premium-cards.js` that have `claimingCadence = NULL` and `stickerValue > 0` with correct per-period values.

### FR-2: Idempotent Execution
The script must be safe to run multiple times. If a record already has the correct values, skip it.

### FR-3: Deploy-Time Execution
The migration must run automatically on every deploy, after `prisma migrate deploy` but before `next start`.

### FR-4: Logging & Auditability
Every update must be logged with before/after values. A summary must be printed.

### FR-5: No UserBenefit Backfill Required
Per the reactivation flow design, old UserBenefits are cleaned up when a user deletes and re-adds a card. The next add will use the corrected MasterBenefit data. No retroactive UserBenefit fix is needed.

---

## Implementation Phases

### Phase 1: Cadence Mapping Update (Prerequisite)
**Objective:** Correct the `PREMIUM_CARDS_CADENCES` mapping in `prisma/phase6c-cadence-mapping.ts` so the source-of-truth reflects actual card terms, not "everything is FLEXIBLE_ANNUAL."

**Deliverables:**
- Updated `'American Express Platinum Card (Premium)'` mapping with correct per-period cadences
- Updated `'American Express Gold Card (Premium)'` mapping with correct per-period cadences
- Updated `'Chase Sapphire Reserve'` mapping where applicable

**Estimated scope:** Small — single file edit with ~40 lines changed.

### Phase 2: Migration Script
**Objective:** Create `scripts/migrate-master-benefits.js` that reads the corrected mapping and applies updates to production MasterBenefit rows.

**Deliverables:**
- Self-contained Node.js script (CommonJS, no transpilation needed)
- Inline mapping data (not dependent on TypeScript imports)
- Idempotent update logic
- Detailed logging

**Estimated scope:** Medium — ~250 lines of JavaScript.

### Phase 3: Deploy Integration
**Objective:** Add the migration script to `package.json` `"start"` so it runs on every Railway deploy.

**Deliverables:**
- Updated `package.json` start script
- Verification that the script exits cleanly when there's nothing to do

**Estimated scope:** Small — one-line edit.

### Phase 4: Verification & Monitoring
**Objective:** Confirm the migration was successful and benefits render correctly.

**Deliverables:**
- SQL verification queries
- Manual QA checklist

**Estimated scope:** Small — documentation only.

---

## Complete Benefit Mapping Table

### Card 1: American Express Platinum Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts | Rationale |
|---|---|---|---|---|---|---|---|
| 1 | `$600 Annual Hotel Credit` | 60000 | ANNUAL, no cadence | `SEMI_ANNUAL` | `30000` | `null` | $300 per half-year (H1: Jan–Jun, H2: Jul–Dec) |
| 2 | `$400 Resy Dining Credit` | 40000 | ANNUAL, no cadence | `MONTHLY` | `3333` | `{"12": 3337}` | ~$33.33/mo. December gets $33.37 to total $40,000 cents exactly¹ |
| 3 | `$300 Entertainment Credit` | 30000 | ANNUAL, no cadence | `MONTHLY` | `2500` | `null` | $25/month × 12 = $300 |
| 4 | `$300 Lululemon Annual Credit` | 30000 | ANNUAL, no cadence | `QUARTERLY` | `7500` | `null` | $75/quarter × 4 = $300 |
| 5 | `$200 Uber Annual Credit` | 20000 | ANNUAL, no cadence | `MONTHLY` | `1500` | `{"12": 3500}` | $15/mo × 11 + $35 Dec = $200 |
| 6 | `$209 CLEAR Annual Credit` | 20900 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `20900` | `null` | One-time annual statement credit |
| 7 | `Centurion Lounge Access` | 50000 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `0` | `null` | Usage perk — no per-period monetary claim |
| 8 | `Complimentary Airport Meet & Greet` | 5000 | CUSTOM, no cadence | `FLEXIBLE_ANNUAL` | `0` | `null` | Usage perk — no per-period monetary claim |
| 9 | `Global Entry or TSA PreCheck` | 10500 | CUSTOM, no cadence | `ONE_TIME` | `10500` | `null` | One-time reimbursement every 4–5 years |
| 10 | `Fine Hotels & Resorts Partner Program` | 20000 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `0` | `null` | Access perk — value realized per-stay |

> ¹ Resy Dining rounding: 3333 × 11 = 36663; 40000 − 36663 = 3337. December variableAmounts ensures exact annual total.

### Card 2: American Express Gold Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts | Rationale |
|---|---|---|---|---|---|---|---|
| 1 | `4x Points on Dining & Restaurants` | 0 | CUSTOM, no cadence | `FLEXIBLE_ANNUAL` | `0` | `null` | Points multiplier — no monetary claim |
| 2 | `4x Points on Flights` | 0 | CUSTOM, no cadence | `FLEXIBLE_ANNUAL` | `0` | `null` | Points multiplier — no monetary claim |
| 3 | `$120 Annual Dining Credit` | 12000 | ANNUAL, no cadence | `MONTHLY` | `1000` | `null` | $10/month × 12 = $120 |
| 4 | `$100 Annual Uber Credit` | 10000 | ANNUAL, no cadence | `MONTHLY` | `833` | `{"12": 837}` | ~$8.33/mo. December gets $8.37 to total $10,000 cents exactly² |
| 5 | `Purchase Protection` | 0 | CUSTOM, no cadence | `FLEXIBLE_ANNUAL` | `0` | `null` | Protection perk — no monetary claim |

> ² Uber Credit rounding: 833 × 11 = 9163; 10000 − 9163 = 837. In reality, Amex Gold's Uber credit is $10/month ($120/year) as of 2025. If the stickerValue should be corrected to 12000, see **Decision Record DR-1** below.

### Card 3: Chase Sapphire Reserve

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts | Rationale |
|---|---|---|---|---|---|---|---|
| 1 | `$300 Annual Travel Credit` | 30000 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `30000` | `null` | Redeemable anytime against travel |
| 2 | `$500 The Edit Hotel Credit` | 50000 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `50000` | `null` | Annual hotel credit |
| 3 | `$250 Hotel Chain Credit` | 25000 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `25000` | `null` | Annual hotel credit |
| 4 | `$300 Dining Credit` | 30000 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `30000` | `null` | Annual dining credit |
| 5 | `$300 Entertainment Credit` | 30000 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `30000` | `null` | Annual entertainment credit |
| 6 | `Priority Pass Select Lounge Access` | 27000 | ANNUAL, no cadence | `FLEXIBLE_ANNUAL` | `0` | `null` | Access perk |
| 7 | `Trip Cancellation Insurance` | 10000 | CUSTOM, no cadence | `ONE_TIME` | `0` | `null` | Insurance claim |
| 8 | `Lost Luggage Reimbursement` | 500000 | CUSTOM, no cadence | `ONE_TIME` | `0` | `null` | Insurance claim |
| 9 | `Global Entry or TSA PreCheck Credit` | 10500 | CUSTOM, no cadence | `ONE_TIME` | `10500` | `null` | One-time reimbursement |

### Card 4: Chase Sapphire Preferred

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `3x Points on Travel & Dining` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 2 | `Ultimate Rewards Flexible Redemption` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Trip Cancellation Insurance` | 10000 | CUSTOM | `ONE_TIME` | `0` | `null` |
| 4 | `Trip Delay Reimbursement` | 50000 | CUSTOM | `ONE_TIME` | `0` | `null` |
| 5 | `Emergency Medical & Dental` | 50000 | CUSTOM | `ONE_TIME` | `0` | `null` |
| 6 | `Purchase Protection` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |

### Card 5: Chase Ink Preferred Business

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `3x Points on Business Purchases` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 2 | `Business Expense Tracking` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Purchase Protection` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |

### Card 6: Chase Southwest Rapid Rewards Premier

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `Free Checked Bags` | 30000 | ANNUAL | `FLEXIBLE_ANNUAL` | `30000` | `null` |
| 2 | `2x Points on Southwest Flights` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Complimentary Boarding` | 5000 | ANNUAL | `FLEXIBLE_ANNUAL` | `5000` | `null` |

### Card 7: Chase Hyatt Credit Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `Free Night Award` | 30000 | ANNUAL | `FLEXIBLE_ANNUAL` | `30000` | `null` |
| 2 | `4x Points on Hyatt Hotels` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Elite Night Credits` | 10000 | ANNUAL | `FLEXIBLE_ANNUAL` | `10000` | `null` |

### Card 8: American Express Green Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `3x Membership Rewards on Travel` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 2 | `1x Membership Rewards on All Other Purchases` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Statement Credits for Travel` | 10000 | ANNUAL | `FLEXIBLE_ANNUAL` | `10000` | `null` |

### Card 9: American Express Business Gold Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `4x Membership Rewards on Business Purchases` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 2 | `1x Membership Rewards on All Other Purchases` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Business Expense Tracking` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |

### Card 10: American Express Hilton Honors Surpass Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `Free Night Award Certificate` | 30000 | ANNUAL | `FLEXIBLE_ANNUAL` | `30000` | `null` |
| 2 | `10x Points on Hilton Hotels` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Complimentary Room Upgrades` | 5000 | ANNUAL | `FLEXIBLE_ANNUAL` | `5000` | `null` |
| 4 | `Airline Fee Credit` | 15000 | ANNUAL | `FLEXIBLE_ANNUAL` | `15000` | `null` |

### Card 11: American Express Marriott Bonvoy Brilliant Credit Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `Free Night Award Certificate` | 25000 | ANNUAL | `FLEXIBLE_ANNUAL` | `25000` | `null` |
| 2 | `6x Points on Marriott Hotels` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Elite Night Credits` | 10000 | ANNUAL | `FLEXIBLE_ANNUAL` | `10000` | `null` |
| 4 | `Airline Fee Credit` | 30000 | ANNUAL | `FLEXIBLE_ANNUAL` | `30000` | `null` |

### Card 12: Capital One Venture X

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `$300 Annual Travel Credit` | 30000 | ANNUAL | `FLEXIBLE_ANNUAL` | `30000` | `null` |
| 2 | `10x Miles on Travel & Dining` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Priority Pass Lounge` | 40000 | ANNUAL | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 4 | `2x Miles on All Purchases` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 5 | `Baggage Fee Credit` | 8000 | ANNUAL | `FLEXIBLE_ANNUAL` | `8000` | `null` |

### Card 13: Barclays JetBlue Plus Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `3x Points on JetBlue Flights` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 2 | `Free Checked Bags` | 30000 | ANNUAL | `FLEXIBLE_ANNUAL` | `30000` | `null` |
| 3 | `Inflight Free Drinks & Snacks` | 5000 | ANNUAL | `FLEXIBLE_ANNUAL` | `5000` | `null` |

### Card 14: Citi Prestige Card

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `Travel Credit` | 25000 | ANNUAL | `FLEXIBLE_ANNUAL` | `25000` | `null` |
| 2 | `3x Prestige Points on Travel` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Fourth Night Free at Hotels` | 50000 | ANNUAL | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 4 | `Concierge Services` | 5000 | ANNUAL | `FLEXIBLE_ANNUAL` | `0` | `null` |

### Card 15: US Bank Altitude Reserve Visa Infinite

| # | Benefit Name (DB) | stickerValue | Current State | → claimingCadence | → claimingAmount | → variableAmounts |
|---|---|---|---|---|---|---|
| 1 | `$300 Quarterly Travel Credit` | 75000 | ANNUAL | `QUARTERLY` | `18750` | `null` | $75/quarter ×4 = $300 (note: stickerValue=75000 may be an error — should be 30000; see DR-2) |
| 2 | `4.5x Points on Travel & Dining` | 0 | CUSTOM | `FLEXIBLE_ANNUAL` | `0` | `null` |
| 3 | `Priority Pass Select` | 40000 | ANNUAL | `FLEXIBLE_ANNUAL` | `0` | `null` |

---

## Decision Records

### DR-1: Amex Gold `$100 Annual Uber Credit` — Sticker Value vs. Reality

**Issue:** The production record says `stickerValue: 10000` ($100), but the actual 2025 Amex Gold Uber credit is $10/month = $120/year. The correct seed (`prisma/seed.ts`) has `stickerValue: 1000` per-month with `resetCadence: 'MONTHLY'`.

**Options:**
- **A) Honor the existing stickerValue.** Set `claimingCadence: 'MONTHLY'`, `claimingAmount: 833`, `variableAmounts: {"12": 837}`. Preserves $100 annual total. Dec gets 837 because 833×11=9163, 10000−9163=837.
- **B) Correct stickerValue to match reality.** Set `stickerValue: 12000`, `claimingCadence: 'MONTHLY'`, `claimingAmount: 1000`. Matches the $120/year actual terms.

**Recommendation:** **Option A** for the migration script (minimal blast radius — only add cadence fields, don't change stickerValue). Note: a future data-quality pass should reconcile stickerValues with current card terms.

### DR-2: US Bank Altitude Reserve `$300 Quarterly Travel Credit` — Sticker Value Anomaly

**Issue:** Sticker value is 75000 ($750) but the name says "$300 Quarterly Travel Credit." The actual benefit is likely $325/year ($75/quarter) or the name is wrong. 

**Recommendation:** Set `QUARTERLY` cadence with `claimingAmount: 18750` ($187.50/quarter) to stay consistent with the stored stickerValue. Flag for data-quality review.

### DR-3: Amex Platinum `$600 Hotel Credit` — Cadence Ambiguity

**Issue:** Amex Platinum historically has a $200/year FHR hotel credit (FLEXIBLE_ANNUAL). The production seed has "$600 Annual Hotel Credit" which appears to be an updated 2025/2026 benefit.

**Options:**
- **A) SEMI_ANNUAL** at $300/half-year — if the benefit resets twice per year
- **B) FLEXIBLE_ANNUAL** at $60,000 — if usable anytime within the year

**Recommendation:** **Option A (SEMI_ANNUAL)** — this follows the user's specification and matches the pattern of other Amex semi-annual benefits. Can be changed to FLEXIBLE_ANNUAL if real terms differ.

---

## Script Design: `scripts/migrate-master-benefits.js`

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  scripts/migrate-master-benefits.js                 │
│                                                     │
│  1. Connect to DB via DATABASE_URL                  │
│  2. Define INLINE mapping: cardName → benefits[]    │
│  3. For each card in mapping:                       │
│     a. Find MasterCard by issuer+cardName           │
│     b. Find MasterBenefits by masterCardId + name   │
│     c. Compare current values vs target values      │
│     d. UPDATE only if values differ (idempotent)    │
│  4. Apply smart defaults for any remaining NULLs    │
│  5. Print summary                                   │
│  6. Disconnect                                      │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **CommonJS (`.js`)** — No transpilation. Runs directly via `node scripts/migrate-master-benefits.js`.
2. **Inline mapping data** — Does NOT import from TypeScript files. Self-contained.
3. **Match by `issuer + cardName + benefitName`** — Avoids ID-based matching that could break across environments.
4. **Upsert-style logic** — Check current values before UPDATE to ensure idempotency.
5. **Exit code 0 on success** — Critical for deploy pipeline (non-zero would abort `next start`).
6. **Graceful handling of missing records** — Logs a warning but does NOT fail if a card/benefit doesn't exist in the DB.

### Pseudocode

```javascript
const MIGRATIONS = [
  {
    issuer: 'American Express',
    cardName: 'American Express Platinum Card',
    benefits: [
      {
        nameMatch: '$600 Annual Hotel Credit',
        update: { claimingCadence: 'SEMI_ANNUAL', claimingAmount: 30000, variableAmounts: null }
      },
      {
        nameMatch: '$400 Resy Dining Credit',
        update: { claimingCadence: 'MONTHLY', claimingAmount: 3333, variableAmounts: { '12': 3337 } }
      },
      // ... etc
    ]
  },
  // ... other cards
];

for (const card of MIGRATIONS) {
  const masterCard = await prisma.masterCard.findUnique({
    where: { issuer_cardName: { issuer: card.issuer, cardName: card.cardName } }
  });
  if (!masterCard) { log(`WARN: Card not found: ${card.cardName}`); continue; }

  for (const b of card.benefits) {
    const mb = await prisma.masterBenefit.findFirst({
      where: { masterCardId: masterCard.id, name: b.nameMatch }
    });
    if (!mb) { log(`WARN: Benefit not found: ${b.nameMatch}`); continue; }

    // Idempotency check
    if (mb.claimingCadence === b.update.claimingCadence &&
        mb.claimingAmount === b.update.claimingAmount &&
        JSON.stringify(mb.variableAmounts) === JSON.stringify(b.update.variableAmounts)) {
      log(`SKIP: ${b.nameMatch} (already correct)`);
      continue;
    }

    await prisma.masterBenefit.update({
      where: { id: mb.id },
      data: b.update
    });
    log(`UPDATED: ${b.nameMatch} → ${b.update.claimingCadence}, ${b.update.claimingAmount}`);
  }
}
```

---

## SQL UPDATE Statements

These are the equivalent raw SQL for reference and manual execution if needed. All amounts are in cents.

### American Express Platinum Card

```sql
-- 1. $600 Annual Hotel Credit → SEMI_ANNUAL $300/half
UPDATE "MasterBenefit"
SET "claimingCadence" = 'SEMI_ANNUAL',
    "claimingAmount" = 30000,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = '$600 Annual Hotel Credit';

-- 2. $400 Resy Dining Credit → MONTHLY ~$33.33/mo, $33.37 in Dec
UPDATE "MasterBenefit"
SET "claimingCadence" = 'MONTHLY',
    "claimingAmount" = 3333,
    "variableAmounts" = '{"12": 3337}'::jsonb,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = '$400 Resy Dining Credit';

-- 3. $300 Entertainment Credit → MONTHLY $25/mo
UPDATE "MasterBenefit"
SET "claimingCadence" = 'MONTHLY',
    "claimingAmount" = 2500,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = '$300 Entertainment Credit';

-- 4. $300 Lululemon Annual Credit → QUARTERLY $75/quarter
UPDATE "MasterBenefit"
SET "claimingCadence" = 'QUARTERLY',
    "claimingAmount" = 7500,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = '$300 Lululemon Annual Credit';

-- 5. $200 Uber Annual Credit → MONTHLY $15/mo, $35 in Dec
UPDATE "MasterBenefit"
SET "claimingCadence" = 'MONTHLY',
    "claimingAmount" = 1500,
    "variableAmounts" = '{"12": 3500}'::jsonb,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = '$200 Uber Annual Credit';

-- 6. $209 CLEAR Annual Credit → FLEXIBLE_ANNUAL $209
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL',
    "claimingAmount" = 20900,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = '$209 CLEAR Annual Credit';

-- 7. Centurion Lounge Access → FLEXIBLE_ANNUAL $0 (usage perk)
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL',
    "claimingAmount" = 0,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = 'Centurion Lounge Access';

-- 8. Complimentary Airport Meet & Greet → FLEXIBLE_ANNUAL $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL',
    "claimingAmount" = 0,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = 'Complimentary Airport Meet & Greet';

-- 9. Global Entry or TSA PreCheck → ONE_TIME $105
UPDATE "MasterBenefit"
SET "claimingCadence" = 'ONE_TIME',
    "claimingAmount" = 10500,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = 'Global Entry or TSA PreCheck';

-- 10. Fine Hotels & Resorts Partner Program → FLEXIBLE_ANNUAL $0 (access perk)
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL',
    "claimingAmount" = 0,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Platinum Card'
)
AND name = 'Fine Hotels & Resorts Partner Program';
```

### American Express Gold Card

```sql
-- 1. 4x Points on Dining & Restaurants → FLEXIBLE_ANNUAL $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL',
    "claimingAmount" = 0,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Gold Card'
)
AND name = '4x Points on Dining & Restaurants';

-- 2. 4x Points on Flights → FLEXIBLE_ANNUAL $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL',
    "claimingAmount" = 0,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Gold Card'
)
AND name = '4x Points on Flights';

-- 3. $120 Annual Dining Credit → MONTHLY $10/mo
UPDATE "MasterBenefit"
SET "claimingCadence" = 'MONTHLY',
    "claimingAmount" = 1000,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Gold Card'
)
AND name = '$120 Annual Dining Credit';

-- 4. $100 Annual Uber Credit → MONTHLY ~$8.33/mo, $8.37 in Dec
UPDATE "MasterBenefit"
SET "claimingCadence" = 'MONTHLY',
    "claimingAmount" = 833,
    "variableAmounts" = '{"12": 837}'::jsonb,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Gold Card'
)
AND name = '$100 Annual Uber Credit';

-- 5. Purchase Protection → FLEXIBLE_ANNUAL $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL',
    "claimingAmount" = 0,
    "variableAmounts" = NULL,
    "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" 
  WHERE issuer = 'American Express' AND "cardName" = 'American Express Gold Card'
)
AND name = 'Purchase Protection';
```

### Chase Sapphire Reserve

```sql
-- 1. $300 Annual Travel Credit → FLEXIBLE_ANNUAL $300
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 30000,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = '$300 Annual Travel Credit';

-- 2. $500 The Edit Hotel Credit → FLEXIBLE_ANNUAL $500
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 50000,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = '$500 The Edit Hotel Credit';

-- 3. $250 Hotel Chain Credit → FLEXIBLE_ANNUAL $250
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 25000,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = '$250 Hotel Chain Credit';

-- 4. $300 Dining Credit → FLEXIBLE_ANNUAL $300
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 30000,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = '$300 Dining Credit';

-- 5. $300 Entertainment Credit → FLEXIBLE_ANNUAL $300
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 30000,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = '$300 Entertainment Credit';

-- 6. Priority Pass Select Lounge Access → FLEXIBLE_ANNUAL $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 0,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = 'Priority Pass Select Lounge Access';

-- 7. Trip Cancellation Insurance → ONE_TIME $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'ONE_TIME', "claimingAmount" = 0,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = 'Trip Cancellation Insurance';

-- 8. Lost Luggage Reimbursement → ONE_TIME $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'ONE_TIME', "claimingAmount" = 0,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = 'Lost Luggage Reimbursement';

-- 9. Global Entry or TSA PreCheck Credit → ONE_TIME $105
UPDATE "MasterBenefit"
SET "claimingCadence" = 'ONE_TIME', "claimingAmount" = 10500,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "masterCardId" = (
  SELECT id FROM "MasterCard" WHERE issuer = 'Chase' AND "cardName" = 'Chase Sapphire Reserve'
) AND name = 'Global Entry or TSA PreCheck Credit';
```

### All Remaining Cards (Smart-Default Pattern)

For the remaining cards (Chase Sapphire Preferred, Chase Ink, Southwest, Hyatt, Amex Green, Amex Business Gold, Hilton Surpass, Marriott Bonvoy, Capital One Venture X, Barclays JetBlue, Citi Prestige, US Bank Altitude Reserve), the script applies the smart-default rules from the existing `fix-master-benefit-cadences.ts`:

```sql
-- Pattern for Insurance/Trip/Luggage benefits → ONE_TIME
UPDATE "MasterBenefit"
SET "claimingCadence" = 'ONE_TIME', "claimingAmount" = 0,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "claimingCadence" IS NULL
  AND (name ILIKE '%trip cancellation%' OR name ILIKE '%trip delay%' 
       OR name ILIKE '%lost luggage%' OR name ILIKE '%emergency medical%'
       OR type = 'Insurance');

-- Pattern for Global Entry/TSA → ONE_TIME
UPDATE "MasterBenefit"
SET "claimingCadence" = 'ONE_TIME', "claimingAmount" = "stickerValue",
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "claimingCadence" IS NULL
  AND (name ILIKE '%global entry%' OR name ILIKE '%tsa precheck%');

-- Pattern for Rewards/Points/Miles perks → FLEXIBLE_ANNUAL $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 0,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "claimingCadence" IS NULL
  AND (type IN ('Rewards', 'Service', 'Protection') OR "stickerValue" = 0);

-- Pattern for Lounge/Access perks → FLEXIBLE_ANNUAL $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 0,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "claimingCadence" IS NULL
  AND (name ILIKE '%lounge%' OR name ILIKE '%concierge%' 
       OR type IN ('TravelPerk', 'UsagePerk'));

-- Pattern for "Annual" keyword monetary benefits → FLEXIBLE_ANNUAL at stickerValue
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = "stickerValue",
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "claimingCadence" IS NULL
  AND "stickerValue" > 0
  AND (name ILIKE '%annual%' OR name ILIKE '%/year%');

-- Pattern for "Quarterly" keyword benefits → QUARTERLY
UPDATE "MasterBenefit"
SET "claimingCadence" = 'QUARTERLY',
    "claimingAmount" = ROUND("stickerValue"::numeric / 4)::int,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "claimingCadence" IS NULL
  AND name ILIKE '%quarterly%';

-- Final catch-all: any remaining with monetary value → FLEXIBLE_ANNUAL
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = "stickerValue",
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "claimingCadence" IS NULL
  AND "stickerValue" > 0;

-- Final catch-all: any remaining without monetary value → FLEXIBLE_ANNUAL $0
UPDATE "MasterBenefit"
SET "claimingCadence" = 'FLEXIBLE_ANNUAL', "claimingAmount" = 0,
    "variableAmounts" = NULL, "updatedAt" = NOW()
WHERE "claimingCadence" IS NULL;
```

---

## Deploy Pipeline Integration

### Current `package.json` Start Script

```json
"start": "prisma migrate resolve --applied 20260410000000_sprint1_variable_amounts 2>/dev/null; prisma migrate deploy && next start"
```

### Updated Start Script

```json
"start": "prisma migrate resolve --applied 20260410000000_sprint1_variable_amounts 2>/dev/null; prisma migrate deploy && node scripts/migrate-master-benefits.js && next start"
```

### Execution Order on Deploy

```
1. prisma migrate resolve (idempotent, suppress errors)
2. prisma migrate deploy  (apply pending migrations)
3. node scripts/migrate-master-benefits.js  (fix cadence data — idempotent)
4. next start  (start the app)
```

### Failure Handling

- If the migration script fails (exit code ≠ 0), `next start` will NOT execute (due to `&&` chaining).
- The script must catch all errors internally and decide whether to exit 0 (soft failure, log warning) or exit 1 (hard failure, block deploy).
- **Recommendation:** Exit 0 even on partial failure — log all errors but don't block the app from starting. The data fix is important but not worth blocking a deploy over. Wrap the entire migration in a try/catch.

```javascript
// In migrate-master-benefits.js
async function main() {
  try {
    // ... migration logic
    console.log('✅ Migration complete');
  } catch (err) {
    console.error('⚠️ Migration encountered errors:', err.message);
    // Exit 0 to not block deploy — errors are logged
  } finally {
    await prisma.$disconnect();
  }
}
main();
```

---

## Edge Cases & Error Handling

### EC-1: Card Does Not Exist in DB
**Scenario:** The migration references "American Express Platinum Card" but the card was deleted or renamed.
**Handling:** Log `WARN: Card not found: American Express Platinum Card`. Skip all benefits for that card. Do NOT fail.

### EC-2: Benefit Name Changed
**Scenario:** The benefit was renamed (e.g., "$200 Uber Annual Credit" → "$200 Uber Cash").
**Handling:** The script uses exact name matching. If the name doesn't match, it falls through to the smart-default catch-all which inspects keywords and type. Log the miss.

### EC-3: Benefit Already Has Correct Values
**Scenario:** Script runs for the 2nd+ time, or the benefit was manually fixed.
**Handling:** Compare current DB values vs target values. If identical, skip and log `SKIP`. This is the idempotency guarantee.

### EC-4: Multiple Benefits With Same Name on Different Cards
**Scenario:** Two cards both have "Airline Fee Credit."
**Handling:** The script scopes all queries by `masterCardId`, so benefits on different cards are never confused.

### EC-5: variableAmounts JSON Comparison
**Scenario:** `{"12": 3500}` in DB vs `{"12": 3500}` in script — are they equal?
**Handling:** Use `JSON.stringify()` comparison for JSON fields. Prisma returns JSON as a plain object; stringify both sides.

### EC-6: Concurrent Deploys
**Scenario:** Two Railway instances start simultaneously, both running the migration.
**Handling:** Each UPDATE is atomic and idempotent. Two concurrent runs will produce the same result. No race condition risk because each UPDATE is a point write (WHERE id = X), not a batch with dependent state.

### EC-7: Database Connection Failure
**Scenario:** DATABASE_URL is invalid or the DB is unreachable.
**Handling:** Prisma client will throw on first query. The outer try/catch logs the error and exits 0 (per the failure handling design above).

### EC-8: Null variableAmounts vs Missing Key
**Scenario:** Setting `variableAmounts: null` when Prisma expects `undefined` or `Prisma.JsonNull`.
**Handling:** Use `Prisma.DbNull` for setting JSON fields to NULL. Test this behavior explicitly.

```javascript
const { PrismaClient, Prisma } = require('@prisma/client');
// When setting variableAmounts to null:
data: { variableAmounts: Prisma.DbNull }
// When setting variableAmounts to an object:
data: { variableAmounts: { '12': 3500 } }
```

### EC-9: Existing `fix-master-benefit-cadences.ts` Conflict
**Scenario:** Both the old TypeScript fix script and the new JS migration script exist. Which takes precedence?
**Handling:** The new script is authoritative. It runs on every deploy via the `start` script. The old `.ts` script requires `npx tsx` and manual execution. They use the same idempotent pattern — whichever runs last wins, and running both is safe.

### EC-10: Benefits Created by `prisma/seed.ts` (Correct Seed)
**Scenario:** Some benefits in the DB were created by the correct seed and already have valid cadence data.
**Handling:** The idempotency check (`if current === target, skip`) handles this. The script will log `SKIP` for these records.

### EC-11: New Cards Added After Migration
**Scenario:** A new card is added to `seed-premium-cards.js` without cadence fields.
**Handling:** The smart-default catch-all at the end of the script handles ANY MasterBenefit with `claimingCadence = NULL`. Future-proofed.

### EC-12: resetCadence 'ANNUAL' Fallback Mismatch
**Scenario:** The `date-math.ts` resolveCadence() maps `resetCadence: 'ANNUAL'` to `default: 'MONTHLY'` (because only 'Monthly', 'CalendarYear', 'CardmemberYear', 'OneTime' are matched). This means ANNUAL benefits without claimingCadence get MONTHLY periods with full annual amounts.
**Handling:** This is exactly the bug we're fixing. After the migration, ALL MasterBenefits will have explicit `claimingCadence`, so the `resolveCadence()` fallback will never be hit. The explicit value takes priority (line 96-100 of `date-math.ts`).

---

## Implementation Tasks

| # | Task | Phase | Depends On | Complexity | Acceptance Criteria |
|---|------|-------|------------|------------|---------------------|
| 1 | Create `scripts/migrate-master-benefits.js` with inline mapping for all 15 cards (87 benefits total) | 2 | — | Medium | Script runs via `node scripts/migrate-master-benefits.js`, exits 0, logs updates/skips |
| 2 | Implement idempotency check: compare current DB values vs target before UPDATE | 2 | 1 | Small | Running the script 3× produces identical DB state and "SKIP" logs on runs 2 and 3 |
| 3 | Implement smart-default catch-all for benefits not in the explicit mapping | 2 | 1 | Small | Any MasterBenefit with `claimingCadence = NULL` gets a sensible default based on name/type analysis |
| 4 | Handle `Prisma.DbNull` for variableAmounts when setting NULL | 2 | 1 | Small | Benefits without variable amounts have `variableAmounts = NULL` (not `{}` or `undefined`) |
| 5 | Add migration to `package.json` start script (`&& node scripts/migrate-master-benefits.js`) | 3 | 1 | Small | `npm start` executes the migration before `next start` |
| 6 | Update `prisma/phase6c-cadence-mapping.ts` with corrected Amex Platinum Premium mappings | 1 | — | Small | The `'American Express Platinum Card (Premium)'` entry reflects MONTHLY/QUARTERLY/SEMI_ANNUAL cadences, not all FLEXIBLE_ANNUAL |
| 7 | Test locally: run migration against a local DB seeded with `seed-premium-cards.js` | 4 | 1-5 | Medium | All verification queries pass (see below) |
| 8 | Test locally: add an Amex Platinum card as a user and verify UserBenefits show correct per-period amounts | 4 | 7 | Medium | Uber Credit shows $15/month, Entertainment shows $25/month, Lululemon shows $75/quarter |
| 9 | Deploy to Railway staging/production | 4 | 7 | Small | Migration runs in deploy logs, app starts normally |

---

## Verification Steps

### Post-Migration SQL Verification Queries

```sql
-- V1: No NULL claimingCadence on active benefits
SELECT COUNT(*) AS null_cadence_count
FROM "MasterBenefit" mb
JOIN "MasterCard" mc ON mb."masterCardId" = mc.id
WHERE mb."claimingCadence" IS NULL
  AND mb."isActive" = true
  AND mc."isArchived" = false;
-- Expected: 0

-- V2: Amex Platinum benefits with correct cadences
SELECT mb.name, mb."claimingCadence", mb."claimingAmount", mb."variableAmounts"
FROM "MasterBenefit" mb
JOIN "MasterCard" mc ON mb."masterCardId" = mc.id
WHERE mc."cardName" = 'American Express Platinum Card'
ORDER BY mb.name;
-- Expected:
-- $200 Uber Annual Credit     | MONTHLY          | 1500  | {"12": 3500}
-- $209 CLEAR Annual Credit    | FLEXIBLE_ANNUAL  | 20900 | null
-- $300 Entertainment Credit   | MONTHLY          | 2500  | null
-- $300 Lululemon Annual Credit| QUARTERLY        | 7500  | null
-- $400 Resy Dining Credit     | MONTHLY          | 3333  | {"12": 3337}
-- $600 Annual Hotel Credit    | SEMI_ANNUAL      | 30000 | null
-- Centurion Lounge Access     | FLEXIBLE_ANNUAL  | 0     | null
-- Complimentary Airport M&G   | FLEXIBLE_ANNUAL  | 0     | null
-- Fine Hotels & Resorts       | FLEXIBLE_ANNUAL  | 0     | null
-- Global Entry or TSA PreCheck| ONE_TIME         | 10500 | null

-- V3: Amex Gold benefits with correct cadences
SELECT mb.name, mb."claimingCadence", mb."claimingAmount", mb."variableAmounts"
FROM "MasterBenefit" mb
JOIN "MasterCard" mc ON mb."masterCardId" = mc.id
WHERE mc."cardName" = 'American Express Gold Card'
ORDER BY mb.name;
-- Expected:
-- $100 Annual Uber Credit             | MONTHLY         | 833  | {"12": 837}
-- $120 Annual Dining Credit           | MONTHLY         | 1000 | null
-- 4x Points on Dining & Restaurants   | FLEXIBLE_ANNUAL | 0    | null
-- 4x Points on Flights                | FLEXIBLE_ANNUAL | 0    | null
-- Purchase Protection                 | FLEXIBLE_ANNUAL | 0    | null

-- V4: Monthly benefits have claimingAmount < stickerValue (sanity check)
SELECT mb.name, mb."stickerValue", mb."claimingAmount", mc."cardName"
FROM "MasterBenefit" mb
JOIN "MasterCard" mc ON mb."masterCardId" = mc.id
WHERE mb."claimingCadence" = 'MONTHLY'
  AND mb."claimingAmount" >= mb."stickerValue"
  AND mb."stickerValue" > 0;
-- Expected: 0 rows (monthly claiming should always be < annual sticker)

-- V5: All variableAmounts are valid JSON (no corrupt data)
SELECT mb.name, mb."variableAmounts"
FROM "MasterBenefit" mb
WHERE mb."variableAmounts" IS NOT NULL;
-- Expected: Only Uber and Resy benefits with valid JSON
```

### Manual QA Checklist

- [ ] Add Amex Platinum card as test user → verify 10 UserBenefits created
- [ ] Check Uber Credit UserBenefit: `stickerValue` = 1500 (Jan–Nov) or 3500 (Dec)
- [ ] Check Entertainment UserBenefit: `stickerValue` = 2500
- [ ] Check Lululemon UserBenefit: `stickerValue` = 7500, period spans a full quarter
- [ ] Check Resy Dining UserBenefit: `stickerValue` = 3333 (or 3337 in Dec)
- [ ] Check CLEAR UserBenefit: `stickerValue` = 20900, period spans full year
- [ ] Check Hotel Credit UserBenefit: `stickerValue` = 30000, period = semi-annual
- [ ] Add Amex Gold card as test user → verify 5 UserBenefits created
- [ ] Check Gold Dining UserBenefit: `stickerValue` = 1000
- [ ] Check Gold Uber UserBenefit: `stickerValue` = 833 (or 837 in Dec)
- [ ] Delete and re-add the same card → verify old benefits cleaned up, new ones correct

---

## Security & Compliance

- **No secrets in script:** The script reads `DATABASE_URL` from the environment (set by Railway). No hardcoded credentials.
- **No destructive operations:** Only UPDATE statements — no DELETE, no DROP, no schema changes.
- **Audit trail:** All changes logged to stdout (captured by Railway deploy logs).
- **Read-only fallback:** If `DATABASE_URL` is not set, the script exits with a warning.

## Performance & Scalability

- **Query count:** ~87 `findFirst` + ~87 `update` = ~174 queries. At ~5ms/query on Railway PostgreSQL, total runtime ≈ 1 second.
- **No indexes needed:** All queries use existing indexes on `masterCardId` and `name`.
- **No table locks:** Individual row UPDATEs. No full-table scans.
- **Deploy-time cost:** Adds ~2 seconds to deploy. After first run, all subsequent runs are ~1 second (all SKIPs).

---

## Relationship to Existing Scripts

| Script | Purpose | Status After This Spec |
|--------|---------|----------------------|
| `scripts/seed-premium-cards.js` | Original seed (source of the bug) | **Do not re-run.** Consider deleting or adding deprecation warning. |
| `scripts/fix-master-benefit-cadences.ts` | Phase 6C cadence fix (TypeScript, manual) | **Superseded** by the new migration script. Keep for reference but do not run. |
| `prisma/phase6c-cadence-mapping.ts` | Cadence mapping source-of-truth | **Update** with corrected Amex Premium mappings (Phase 1). |
| `scripts/migrate-master-benefits.js` | **NEW** — Deploy-time idempotent migration | **Primary fix.** Runs on every deploy. |
| `prisma/seed.ts` | Correct seed for clean environments | **No change needed.** Already has correct cadence data. |
| `scripts/backfill-user-benefits.ts` | Backfills UserBenefit rows | **No change needed.** Only relevant if retroactive UserBenefit fix is required (not in scope). |

---

## Appendix A: Cadence Type Reference

| Cadence | Period Length | Period Boundaries | Use Case |
|---------|-------------|-------------------|----------|
| `MONTHLY` | 1 month | 1st → last day of month | Uber Cash, Dining Credits, Entertainment |
| `QUARTERLY` | 3 months | Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec | Lululemon Credit |
| `SEMI_ANNUAL` | 6 months | Jan–Jun, Jul–Dec (or custom via `claimingWindowEnd`) | Hotel Credit, Saks Credit |
| `FLEXIBLE_ANNUAL` | 12 months | Calendar year (Jan–Dec) or cardmember year (anniversary-based) | Airline Fee, CLEAR, Travel Credits |
| `ONE_TIME` | Forever | From card-add date, no expiration | Global Entry/TSA PreCheck, Insurance |

## Appendix B: variableAmounts Schema

```typescript
// JSON stored in MasterBenefit.variableAmounts
// Keys are 1-indexed month numbers as strings
// Values are amounts in cents that OVERRIDE claimingAmount for that month
type VariableAmounts = {
  [monthNumber: string]: number; // "1" = January, "12" = December
} | null;

// Example: Amex Platinum Uber Cash
// Default: $15/month (claimingAmount: 1500)
// December: $35 (variableAmounts: {"12": 3500})
// Annual total: $15×11 + $35 = $200
```

## Appendix C: How the Benefit Engine Uses These Fields

```
generate-benefits.ts (simplified flow):

for each MasterBenefit on the card:
  1. period = calculatePeriodForBenefit(
       mb.claimingCadence,  ← USES THIS (falls back to resetCadence if null)
       mb.resetCadence,
       today,
       userCard.renewalDate
     )

  2. effectiveAmount = mb.claimingAmount  ← USES THIS (falls back to stickerValue if null)
       ? resolveClaimingAmount(mb.claimingAmount, mb.variableAmounts, month)
       : mb.stickerValue

  3. CREATE UserBenefit {
       stickerValue: effectiveAmount,
       periodStart: period.periodStart,
       periodEnd: period.periodEnd,
       ...
     }
```

After this migration, step 1 always uses `claimingCadence` (never falls back) and step 2 always uses `claimingAmount` + `variableAmounts` (never falls back to `stickerValue`).
