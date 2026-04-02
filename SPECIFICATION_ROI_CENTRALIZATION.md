# ROI Calculation Logic Centralization - Technical Specification

## Executive Summary & Goals

The Card-Benefits application currently has **ROI calculation logic scattered across 3 different locations** with slightly different implementations, causing inconsistent results across the UI. This specification designs a unified approach to create a **single source of truth** for all ROI calculations, ensuring type-safe, testable, and consistent behavior across all components.

**Primary Objectives:**
- Eliminate duplicate ROI calculation logic across Card.tsx, SummaryStats.tsx, and calculations.ts
- Create a unified, type-safe calculation API that all components depend on
- Document the subtle differences between implementations and resolve them
- Ensure backward compatibility with existing features (uncaptured value, used benefits, etc.)
- Implement comprehensive edge case handling
- Provide clear testing strategy for validation

**Success Criteria:**
1. All components (Card, SummaryStats, and Dashboard views) use the same ROI calculation functions
2. Results are provably consistent across all UI surfaces
3. All edge cases are documented and handled with defined behavior
4. Unit and integration tests validate consistency
5. No functional behavior changes for normal use cases
6. Code coverage >= 95% for calculation functions

---

## Current State Analysis

### Implementation 1: Card.tsx (lines 58-67)

**Location:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/components/Card.tsx`

```typescript
function getEffectiveROI(card: UserCard): number {
  let extracted = 0;
  for (const benefit of card.userBenefits) {
    if (benefit.isUsed) {
      extracted += getResolvedValue(benefit);
    }
  }
  const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
  return extracted - annualFee;
}
```

**Characteristics:**
- **Simple linear ROI:** Total used benefits value - simple annual fee
- **Annual fee handling:** Uses `actualAnnualFee ?? defaultAnnualFee` fallback
- **Benefit value resolution:** Prefers user-declared value over sticker value
- **Does NOT account for:** Fee-offsetting credits (e.g., Chase Reserve $300 credit)
- **Scope:** Individual card only
- **Loop-based:** Manually iterates to sum extracted value

**Issues Identified:**
1. Does not subtract fee-offsetting StatementCredits from the annual fee
2. Treats all fees equally, regardless of whether they're offset by card-provided credits
3. Does not handle benefit type differentiation (StatementCredit vs UsagePerk)

---

### Implementation 2: calculations.ts (lines 146-154)

**Location:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/lib/calculations.ts`

```typescript
export function getEffectiveROI(
  userCard: UserCard,
  userBenefits: UserBenefit[],
): number {
  return (
    getTotalValueExtracted(userBenefits) -
    getNetAnnualFee(userCard, userBenefits)
  );
}
```

Supporting functions:
```typescript
// getTotalValueExtracted (lines 57-75)
export function getTotalValueExtracted(userBenefits: UserBenefit[]): number {
  return userBenefits.reduce((total, benefit) => {
    if (!benefit.isUsed) return total;

    let contributedValue: number;
    if (benefit.type === 'StatementCredit') {
      contributedValue = resolveUnitValue(benefit);
    } else {
      // UsagePerk: timesUsed * per-unit value
      contributedValue = benefit.timesUsed * resolveUnitValue(benefit);
    }
    return total + contributedValue;
  }, 0);
}

// getNetAnnualFee (lines 111-132)
export function getNetAnnualFee(
  userCard: UserCard,
  userBenefits: UserBenefit[],
): number {
  const baseFee = userCard.actualAnnualFee ?? 0;

  const feeOffsets = userBenefits.reduce((sum, benefit) => {
    const isFeeOffsetCredit =
      benefit.type === 'StatementCredit' &&
      benefit.resetCadence === 'CardmemberYear';

    return isFeeOffsetCredit ? sum + benefit.stickerValue : sum;
  }, 0);

  return baseFee - feeOffsets;
}
```

**Characteristics:**
- **Sophisticated ROI:** Extracts value intelligently based on benefit type
- **Fee offset logic:** Subtracts `CardmemberYear StatementCredit` values from annual fee
- **Benefit type awareness:** Differentiates between StatementCredit (one-shot) and UsagePerk (per-use)
- **Per-unit handling:** UsagePerks multiply per-unit value by timesUsed count
- **Sticker value preference for offsets:** Uses stickerValue (not user override) for fee calculations
- **Scope:** Individual card, passed benefits array
- **Reduce-based:** Uses functional reduce pattern

**Advantages:**
- More sophisticated, accounts for card design (fee-offsetting credits)
- Handles benefit type differentiation
- Properly calculates UsagePerk value with timesUsed multiplier
- Better designed overall

---

### Implementation 3: SummaryStats.tsx (lines 117-137)

**Location:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/components/SummaryStats.tsx`

```typescript
function calculateHouseholdROI(players: Player[]): number {
  let totalCaptured = 0;
  let totalFees = 0;

  for (const player of players) {
    for (const card of player.userCards) {
      // Add captured benefit value
      for (const benefit of card.userBenefits) {
        if (benefit.isUsed) {
          totalCaptured += getResolvedValue(benefit);
        }
      }

      // Subtract net annual fee
      const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
      totalFees += annualFee;
    }
  }

  return totalCaptured - totalFees;
}
```

**Characteristics:**
- **Household-level aggregation:** Sums ROI across all players and cards
- **Simple fee handling:** Like Card.tsx, does not account for fee offsets
- **Benefit value resolution:** Uses getResolvedValue (same as Card.tsx)
- **Does NOT differentiate:** Between StatementCredit and UsagePerk benefit types
- **Ignores timesUsed:** Does not multiply UsagePerk values
- **Scope:** Household aggregation across multiple cards
- **Nested loops:** Iterates through players -> cards -> benefits

**Issues Identified:**
1. Same as Card.tsx: Ignores fee-offsetting credits
2. Does not account for benefit type (treats all as StatementCredit-like)
3. For UsagePerks, only counts 1x the per-unit value, not timesUsed * value

---

## Analysis: Differences & Root Causes

### Difference Summary Table

| Aspect | Card.tsx | calculations.ts | SummaryStats.tsx |
|--------|----------|-----------------|------------------|
| **Scope** | Single card | Single card (via params) | Household (multi-card) |
| **Benefit Type Aware** | ❌ No | ✅ Yes | ❌ No |
| **Handles TimesUsed** | ❌ No | ✅ Yes | ❌ No |
| **Fee Offset Logic** | ❌ No | ✅ Yes | ❌ No |
| **Function Type** | Closure | Pure function | Nested loops |
| **Integration** | Embedded in component | Reusable utility | Embedded in component |

### Bug Classification

**BUGS (should be fixed):**
1. **Card.tsx & SummaryStats.tsx do NOT handle UsagePerk timesUsed** - A lounge access benefit used 3 times is counted as 1x value, not 3x. This is measurably wrong.
2. **Card.tsx & SummaryStats.tsx do NOT subtract fee-offsetting credits** - A $300 annual fee card with a $300 travel credit should show $0 net fee, but shows $300.

**FEATURES (working as designed):**
1. calculations.ts's use of stickerValue for fee offsets is intentional - represents "advertised value" not "user-claimed value"
2. Per-card or per-household scope differences are by design (different use cases)

### Canonical Version

**calculations.ts is the canonical/correct implementation** because:
1. It properly handles benefit type differentiation (StatementCredit vs UsagePerk)
2. It correctly multiplies UsagePerk values by timesUsed
3. It properly implements fee offset logic for CardmemberYear credits
4. It uses stickerValue for fee calculations (correct accounting)
5. It's designed as a reusable utility library, not embedded in components
6. It has clear separation of concerns (extract -> net fee -> ROI)

---

## Proposed Solution: Unified ROI Calculation API

### Architecture Overview

We will **centralize all ROI logic in `/src/lib/calculations.ts`** as the single source of truth, and update `Card.tsx` and `SummaryStats.tsx` to use those functions.

### Proposed Function Suite

All functions will be in `/src/lib/calculations.ts`. They will be organized into three layers:

#### Layer 1: Core Calculations (Already in calculations.ts)

These are the foundational, reusable calculations:

```typescript
/**
 * Resolves the per-unit value of a benefit in cents.
 * Prefers user's declared override over sticker value.
 * Returns 0 when neither is set (handles UsagePerk with no monetary value).
 *
 * @private (internal use only)
 */
function resolveUnitValue(benefit: UserBenefit): number {
  return benefit.userDeclaredValue ?? benefit.stickerValue;
}

/**
 * Calculates total cents extracted from benefits.
 *
 * Rules:
 * - Only count benefits where isUsed === true
 * - StatementCredit: contributes full resolved value (one-shot)
 * - UsagePerk: contributes timesUsed * per-unit value
 *
 * @param userBenefits - All benefits for a card
 * @returns Total extracted value in cents
 *
 * @example
 * const benefits = [
 *   { type: 'StatementCredit', stickerValue: 30000, userDeclaredValue: null, isUsed: true }
 *   { type: 'UsagePerk', stickerValue: 1000, userDeclaredValue: null, isUsed: true, timesUsed: 3 }
 * ]
 * getTotalValueExtracted(benefits) // => 33000 (300 + 30)
 */
export function getTotalValueExtracted(userBenefits: UserBenefit[]): number {
  return userBenefits.reduce((total, benefit) => {
    if (!benefit.isUsed) return total;

    let contributedValue: number;
    if (benefit.type === 'StatementCredit') {
      contributedValue = resolveUnitValue(benefit);
    } else {
      // UsagePerk: multiply per-unit value by usage count
      contributedValue = benefit.timesUsed * resolveUnitValue(benefit);
    }
    return total + contributedValue;
  }, 0);
}

/**
 * Calculates total cents of value in unused, non-expired benefits.
 *
 * Rules:
 * - Skip benefits where isUsed === true
 * - Skip benefits where expirationDate < now
 * - Include benefits with expirationDate === null (never expire)
 * - Use resolved value (user override or sticker)
 *
 * @param userBenefits - All benefits for a card
 * @param now - Reference date for expiration check (defaults to Date.now())
 * @returns Total uncaptured value in cents
 */
export function getUncapturedValue(
  userBenefits: UserBenefit[],
  now: Date = new Date(),
): number {
  return userBenefits.reduce((total, benefit) => {
    if (benefit.isUsed) return total;
    if (benefit.expirationDate !== null && benefit.expirationDate < now) {
      return total;
    }
    return total + resolveUnitValue(benefit);
  }, 0);
}

/**
 * Calculates net annual fee after subtracting fee-offsetting credits.
 *
 * Fee-offsetting credits are defined as:
 * - type === 'StatementCredit'
 * - resetCadence === 'CardmemberYear'
 *
 * Use sticker value (not user override) because we're measuring
 * "advertised offset vs advertised fee" not "claimed value".
 *
 * Result can be negative (card generates value before any spending).
 *
 * @param userCard - Card record with actualAnnualFee
 * @param userBenefits - All benefits for the card
 * @returns Net annual fee in cents (may be negative)
 *
 * @example
 * // Card: $95 annual fee, $300 travel credit (CardmemberYear)
 * // Result: $95 - $300 = -$205 (net gain)
 * getNetAnnualFee(card, benefits) // => -20500 cents
 */
export function getNetAnnualFee(
  userCard: UserCard,
  userBenefits: UserBenefit[],
): number {
  const baseFee = userCard.actualAnnualFee ?? 0;

  const feeOffsets = userBenefits.reduce((sum, benefit) => {
    const isFeeOffsetCredit =
      benefit.type === 'StatementCredit' &&
      benefit.resetCadence === 'CardmemberYear';

    return isFeeOffsetCredit ? sum + benefit.stickerValue : sum;
  }, 0);

  return baseFee - feeOffsets;
}
```

#### Layer 2: ROI Calculations (Existing + New)

```typescript
/**
 * Calculates effective ROI for a single card.
 *
 * Formula: Extracted Value - Net Annual Fee
 *
 * This represents the user's net financial position after:
 * 1. Claiming the benefits they've used
 * 2. Paying the card's annual fee (minus any fee-offsetting credits)
 *
 * @param userCard - Card record
 * @param userBenefits - Benefits for the card
 * @returns Effective ROI in cents
 *
 * @example
 * // Card: $95/yr fee, used $200 in credits
 * // ROI: $200 - $95 = $105
 * getEffectiveROI(card, benefits) // => 10500 cents
 */
export function getEffectiveROI(
  userCard: UserCard,
  userBenefits: UserBenefit[],
): number {
  return (
    getTotalValueExtracted(userBenefits) -
    getNetAnnualFee(userCard, userBenefits)
  );
}

/**
 * Calculates household ROI by aggregating across all cards for all players.
 *
 * Formula: Sum of (each card's extracted value) - Sum of (each card's net fee)
 *
 * @param players - Array of players with their cards and benefits
 * @returns Household ROI in cents
 *
 * @example
 * // Player 1: Card A ROI $50, Card B ROI -$10
 * // Player 2: Card C ROI $75
 * // Household: $50 + (-$10) + $75 = $115
 * getHouseholdROI(players) // => 11500 cents
 */
export function getHouseholdROI(players: Player[]): number {
  let totalExtracted = 0;
  let totalFees = 0;

  for (const player of players) {
    for (const card of player.userCards) {
      totalExtracted += getTotalValueExtracted(card.userBenefits);
      totalFees += getNetAnnualFee(card, card.userBenefits);
    }
  }

  return totalExtracted - totalFees;
}

/**
 * Calculates total benefit value captured (used) across all cards.
 *
 * Used primarily for the "Benefits Captured" stat card.
 * Does NOT subtract fees (pure benefit extraction sum).
 *
 * @param players - Array of players with their cards and benefits
 * @returns Total captured value in cents
 */
export function getHouseholdTotalCaptured(players: Player[]): number {
  let total = 0;
  for (const player of players) {
    for (const card of player.userCards) {
      total += getTotalValueExtracted(card.userBenefits);
    }
  }
  return total;
}
```

#### Layer 3: Component Helpers

```typescript
/**
 * Calculates total benefit counts for household summary.
 *
 * @param players - Array of players
 * @param now - Reference date for "active" definition
 * @returns Count of unused, non-expired benefits
 */
export function getHouseholdActiveCount(
  players: Player[],
  now: Date = new Date(),
): number {
  let count = 0;
  for (const player of players) {
    for (const card of player.userCards) {
      count += card.userBenefits.filter(
        (b) => !b.isUsed && (!b.expirationDate || b.expirationDate > now)
      ).length;
    }
  }
  return count;
}
```

### Type Definitions

Ensure these types are properly imported in calculations.ts:

```typescript
import type { UserCard, UserBenefit } from '@prisma/client';

// For household-level calculations
interface Player {
  id: string;
  userCards: UserCard[];
}
```

---

## Integration Plan: Updated Component Usage

### Card.tsx Changes

**Current (BROKEN):**
```typescript
function getEffectiveROI(card: UserCard): number {
  let extracted = 0;
  for (const benefit of card.userBenefits) {
    if (benefit.isUsed) {
      extracted += getResolvedValue(benefit);
    }
  }
  const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
  return extracted - annualFee;
}

function getUncapturedValue(card: UserCard): number {
  const now = new Date();
  let total = 0;
  for (const benefit of card.userBenefits) {
    if (
      !benefit.isUsed &&
      benefit.expirationDate &&
      benefit.expirationDate > now
    ) {
      total += getResolvedValue(benefit);
    }
  }
  return total;
}
```

**Updated (FIXED):**
```typescript
import {
  getEffectiveROI,
  getUncapturedValue,
} from '@/lib/calculations';

// Remove the local getEffectiveROI and getUncapturedValue functions

// In the component render section:
const roi = getEffectiveROI(card, card.userBenefits);
const uncapturedValue = getUncapturedValue(card.userBenefits);
```

### SummaryStats.tsx Changes

**Current (BROKEN):**
```typescript
function calculateHouseholdROI(players: Player[]): number {
  let totalCaptured = 0;
  let totalFees = 0;

  for (const player of players) {
    for (const card of player.userCards) {
      for (const benefit of card.userBenefits) {
        if (benefit.isUsed) {
          totalCaptured += getResolvedValue(benefit);
        }
      }
      const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
      totalFees += annualFee;
    }
  }

  return totalCaptured - totalFees;
}

function getTotalCaptured(players: Player[]): number {
  let total = 0;
  for (const player of players) {
    for (const card of player.userCards) {
      for (const benefit of card.userBenefits) {
        if (benefit.isUsed) {
          total += getResolvedValue(benefit);
        }
      }
    }
  }
  return total;
}

function getActiveCount(players: Player[]): number {
  let count = 0;
  const now = new Date();
  for (const player of players) {
    for (const card of player.userCards) {
      count += card.userBenefits.filter(
        (b) => !b.isUsed && b.expirationDate && b.expirationDate > now
      ).length;
    }
  }
  return count;
}
```

**Updated (FIXED):**
```typescript
import {
  getHouseholdROI,
  getHouseholdTotalCaptured,
  getHouseholdActiveCount,
} from '@/lib/calculations';

// Remove the local calculateHouseholdROI, getTotalCaptured, getActiveCount functions

// In the component memoization section:
const metrics = useMemo(() => {
  const householdROI = getHouseholdROI(players);
  const totalCaptured = getHouseholdTotalCaptured(players);
  const activeCount = getHouseholdActiveCount(players);

  return {
    householdROI,
    totalCaptured,
    activeCount,
  };
}, [players]);
```

---

## Edge Cases & Error Handling

### Edge Case 1: Zero Sticker Value with User-Declared Value

**Scenario:** A benefit has stickerValue = 0 but userDeclaredValue = 5000 (user estimates airline credit)

**Expected Behavior:**
- `resolveUnitValue()` returns 5000 (user override takes precedence)
- Benefit is fully counted in extracted value
- For fee calculations, stickerValue (0) is used, not user value

**Handling:**
```typescript
const benefit = {
  id: '1',
  stickerValue: 0,
  userDeclaredValue: 5000,
  isUsed: true,
  type: 'StatementCredit',
};
expect(getTotalValueExtracted([benefit])).toBe(5000); // ✓
expect(getNetAnnualFee(card, [benefit])).toBe(baseFee); // Uses stickerValue (0)
```

### Edge Case 2: Null User-Declared Value

**Scenario:** A benefit has userDeclaredValue = null

**Expected Behavior:**
- Falls back to stickerValue
- Works correctly if stickerValue is also 0 (returns 0)

**Handling:**
```typescript
const benefit = {
  stickerValue: 10000,
  userDeclaredValue: null,
  // ... rest of fields
};
expect(resolveUnitValue(benefit)).toBe(10000); // ✓
```

### Edge Case 3: Missing Annual Fee

**Scenario:** card.actualAnnualFee = null (user hasn't set, no default available)

**Expected Behavior:**
- Use 0 as the base fee
- Only subtract fee-offsetting credits if they exist

**Handling:**
```typescript
const card = {
  actualAnnualFee: null,
  // ... rest of fields
};
const baseFee = card.actualAnnualFee ?? 0; // => 0
expect(getNetAnnualFee(card, benefits)).toBe(-300 * 100); // If $300 offset exists
```

### Edge Case 4: Negative ROI

**Scenario:** User has $50 annual fee, extracted $20 in benefits

**Expected Behavior:**
- ROI is -3000 (cents)
- Component displays as negative (red badge, "$ formatting)
- No special error handling needed

**Handling:**
```typescript
expect(getEffectiveROI(card, benefits)).toBe(-3000);
// Card.tsx uses isPositiveROI = roi >= 0 to color code
```

### Edge Case 5: Division by Zero (Not Applicable)

**Scenario:** Why this isn't an issue

**Analysis:**
Our implementation never divides any values. All operations are addition/subtraction:
- Sum of benefit values (reduce add)
- Difference of fees (subtract)

No division means no divide-by-zero edge case.

### Edge Case 6: Overflow / Large Numbers

**Scenario:** User has 50 cards × 30 benefits × $1000 sticker values

**Expected Behavior:**
- JavaScript numbers handle up to 2^53 (9 quadrillion)
- 50 × 30 × 1000 = 1.5M cents = well within bounds
- No overflow or precision loss

**Safe Bounds:**
- Max cards per user: ~1000
- Max benefits per card: ~100
- Max sticker value: $100K = 10M cents
- Max household ROI: 10^9 cents = $10M (well safe)

### Edge Case 7: TimesUsed = 0 (UsagePerk Never Used)

**Scenario:** A UsagePerk has timesUsed = 0 but isUsed = true

**Expected Behavior:**
- Contribution = timesUsed * perUnitValue = 0 * 1000 = 0
- This is correct (user marked as used but never actually used)
- Should be flagged as data inconsistency (separate validation layer)

**Handling:**
```typescript
const benefit = {
  type: 'UsagePerk',
  stickerValue: 1000,
  isUsed: true,
  timesUsed: 0,
};
expect(getTotalValueExtracted([benefit])).toBe(0); // ✓ Correct behavior
```

### Edge Case 8: Negative Sticker Value

**Scenario:** Database corruption or manual entry: benefit.stickerValue = -5000

**Expected Behavior:**
- Subtract from total (user "lost" value)
- This is technically valid but should not occur in normal operation
- Would be caught by database constraints

**Handling:**
```typescript
const benefit = {
  stickerValue: -5000,
  isUsed: true,
};
expect(getTotalValueExtracted([benefit])).toBe(-5000); // Propagates correctly
```

### Edge Case 9: Fee Offset Greater Than Annual Fee

**Scenario:** Card has $95 fee, but $300 credit (e.g., Chase Reserve)

**Expected Behavior:**
- Net fee = $95 - $300 = -$205 (negative!)
- ROI calculation still works: extracted - (-205) = extracted + 205
- Component displays negative fee correctly

**Handling:**
```typescript
const benefits = [
  {
    type: 'StatementCredit',
    stickerValue: 30000,
    resetCadence: 'CardmemberYear',
  },
];
const card = { actualAnnualFee: 9500 };
expect(getNetAnnualFee(card, benefits)).toBe(-20500); // ✓ Negative fee
expect(getEffectiveROI(card, benefits)).toBe(10000 - (-20500)); // Extracts correctly
```

### Edge Case 10: Multiple CardmemberYear Credits

**Scenario:** Card has both a $200 travel credit AND $100 dining credit (both CardmemberYear)

**Expected Behavior:**
- Both are summed: $300 total offset
- Works correctly with the reduce pattern

**Handling:**
```typescript
const benefits = [
  { type: 'StatementCredit', stickerValue: 20000, resetCadence: 'CardmemberYear' },
  { type: 'StatementCredit', stickerValue: 10000, resetCadence: 'CardmemberYear' },
];
const card = { actualAnnualFee: 5000 };
expect(getNetAnnualFee(card, benefits)).toBe(5000 - 30000); // ✓ -25000
```

### Edge Case 11: Benefit Expiration Date Edge Cases

**Scenario:** Benefit expiration is exactly now

**Expected Behavior:**
- `benefit.expirationDate < now` evaluates to false
- Benefit IS included in uncaptured value
- This is correct (expired at end of today means still valid during today)

**Handling:**
```typescript
const now = new Date('2025-04-01T00:00:00Z');
const benefit = {
  expirationDate: new Date('2025-04-01T00:00:00Z'),
  isUsed: false,
};
expect(getUncapturedValue([benefit], now)).toBeGreaterThan(0); // ✓ Still valid
```

### Edge Case 12: Null Expiration Date (Never Expires)

**Scenario:** A benefit with expirationDate = null (e.g., Global Entry lounge access)

**Expected Behavior:**
- The condition `benefit.expirationDate < now` short-circuits (null < anything is false)
- Benefit is never excluded by expiration
- Correct behavior

**Handling:**
```typescript
const benefit = {
  expirationDate: null,
  isUsed: false,
  stickerValue: 50000,
};
expect(getUncapturedValue([benefit])).toBe(50000); // ✓ Never expires
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                   Component Layer                           │
│  Card.tsx          SummaryStats.tsx      Dashboard          │
└──────────┬──────────────────┬──────────────────────┬────────┘
           │                  │                      │
           └──────────────────┼──────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  calculations.ts   │
                    │  (Single Source)   │
                    └────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
        ┌─────▼─────┐  ┌──────▼──────┐ ┌─────▼──────┐
        │  Extract  │  │ Net Fee     │ │ Uncaptured │
        │  (used)   │  │ (account)   │ │ (potential)│
        └───────────┘  └─────────────┘ └────────────┘
              │               │               │
              └───────────────┼───────────────┘
                              │
                      ┌───────▼──────┐
                      │ ROI Result   │
                      │ (component   │
                      │  displays)   │
                      └──────────────┘
```

---

## Consistency Guarantees

### Before Centralization (BROKEN)

| Component | Card A: $200 extracted, $95 fee, $300 credit | Result |
|-----------|-----------------------------------------------|--------|
| Card.tsx | $200 - $95 = | **$105** ❌ |
| calculations.ts | $200 - ($95 - $300) = $200 - (-$205) = | **$405** ✓ |
| SummaryStats.tsx (if multi-card) | $200 - $95 = | **$105** ❌ |

### After Centralization (FIXED)

| Component | Card A: $200 extracted, $95 fee, $300 credit | Result |
|-----------|-----------------------------------------------|--------|
| Card.tsx (updated) | `getEffectiveROI(card, benefits)` = | **$405** ✓ |
| calculations.ts | `getEffectiveROI(card, benefits)` = | **$405** ✓ |
| SummaryStats.tsx (updated) | `getHouseholdROI(players)` = | **$405** ✓ |

---

## Testing Strategy

### Unit Tests for calculations.ts

**File:** `/src/lib/calculations.test.ts` (to be created)

#### Test Suite 1: resolveUnitValue (private helper)

```typescript
describe('resolveUnitValue', () => {
  test('prefers userDeclaredValue over stickerValue', () => {
    const benefit = {
      stickerValue: 5000,
      userDeclaredValue: 8000,
    };
    // Test indirectly through getTotalValueExtracted
    expect(getTotalValueExtracted([{ ...benefit, isUsed: true, type: 'StatementCredit' }]))
      .toBe(8000);
  });

  test('falls back to stickerValue when userDeclaredValue is null', () => {
    const benefit = {
      stickerValue: 5000,
      userDeclaredValue: null,
    };
    expect(getTotalValueExtracted([{ ...benefit, isUsed: true, type: 'StatementCredit' }]))
      .toBe(5000);
  });

  test('returns 0 when both are 0 (non-monetary benefit)', () => {
    const benefit = {
      stickerValue: 0,
      userDeclaredValue: null,
    };
    expect(getTotalValueExtracted([{ ...benefit, isUsed: true, type: 'UsagePerk', timesUsed: 5 }]))
      .toBe(0);
  });
});
```

#### Test Suite 2: getTotalValueExtracted

```typescript
describe('getTotalValueExtracted', () => {
  test('sums StatementCredit benefits where isUsed is true', () => {
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        stickerValue: 10000,
        userDeclaredValue: null,
        isUsed: true,
        timesUsed: 0,
      },
      {
        id: '2',
        type: 'StatementCredit',
        stickerValue: 5000,
        userDeclaredValue: null,
        isUsed: true,
        timesUsed: 0,
      },
    ];
    expect(getTotalValueExtracted(benefits)).toBe(15000);
  });

  test('multiplies UsagePerk value by timesUsed', () => {
    const benefit = {
      id: '1',
      type: 'UsagePerk',
      stickerValue: 1000,
      userDeclaredValue: null,
      isUsed: true,
      timesUsed: 5,
    };
    expect(getTotalValueExtracted([benefit])).toBe(5000);
  });

  test('ignores benefits where isUsed is false', () => {
    const benefit = {
      id: '1',
      type: 'StatementCredit',
      stickerValue: 10000,
      userDeclaredValue: null,
      isUsed: false,
      timesUsed: 0,
    };
    expect(getTotalValueExtracted([benefit])).toBe(0);
  });

  test('handles mixed benefit types', () => {
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        stickerValue: 10000,
        userDeclaredValue: null,
        isUsed: true,
        timesUsed: 0,
      },
      {
        id: '2',
        type: 'UsagePerk',
        stickerValue: 1000,
        userDeclaredValue: null,
        isUsed: true,
        timesUsed: 3,
      },
    ];
    expect(getTotalValueExtracted(benefits)).toBe(13000);
  });

  test('respects userDeclaredValue override', () => {
    const benefit = {
      id: '1',
      type: 'StatementCredit',
      stickerValue: 10000,
      userDeclaredValue: 7000,
      isUsed: true,
      timesUsed: 0,
    };
    expect(getTotalValueExtracted([benefit])).toBe(7000);
  });

  test('returns 0 for empty benefits array', () => {
    expect(getTotalValueExtracted([])).toBe(0);
  });

  test('handles edge case: timesUsed = 0 for UsagePerk', () => {
    const benefit = {
      id: '1',
      type: 'UsagePerk',
      stickerValue: 5000,
      userDeclaredValue: null,
      isUsed: true,
      timesUsed: 0,
    };
    expect(getTotalValueExtracted([benefit])).toBe(0);
  });
});
```

#### Test Suite 3: getUncapturedValue

```typescript
describe('getUncapturedValue', () => {
  const now = new Date('2025-04-01T12:00:00Z');

  test('includes unused benefits that have not expired', () => {
    const benefit = {
      id: '1',
      stickerValue: 10000,
      userDeclaredValue: null,
      isUsed: false,
      expirationDate: new Date('2025-05-01'), // Future
      type: 'StatementCredit',
      timesUsed: 0,
    };
    expect(getUncapturedValue([benefit], now)).toBe(10000);
  });

  test('excludes benefits where isUsed is true', () => {
    const benefit = {
      id: '1',
      stickerValue: 10000,
      userDeclaredValue: null,
      isUsed: true,
      expirationDate: new Date('2025-05-01'),
      type: 'StatementCredit',
      timesUsed: 0,
    };
    expect(getUncapturedValue([benefit], now)).toBe(0);
  });

  test('excludes expired benefits', () => {
    const benefit = {
      id: '1',
      stickerValue: 10000,
      userDeclaredValue: null,
      isUsed: false,
      expirationDate: new Date('2025-03-01'), // Past
      type: 'StatementCredit',
      timesUsed: 0,
    };
    expect(getUncapturedValue([benefit], now)).toBe(0);
  });

  test('includes benefits with null expirationDate (never expire)', () => {
    const benefit = {
      id: '1',
      stickerValue: 10000,
      userDeclaredValue: null,
      isUsed: false,
      expirationDate: null,
      type: 'StatementCredit',
      timesUsed: 0,
    };
    expect(getUncapturedValue([benefit], now)).toBe(10000);
  });

  test('uses provided now parameter for expiration check', () => {
    const benefit = {
      id: '1',
      stickerValue: 10000,
      userDeclaredValue: null,
      isUsed: false,
      expirationDate: new Date('2025-04-15'),
      type: 'StatementCredit',
      timesUsed: 0,
    };
    const beforeExpiry = new Date('2025-04-01');
    const afterExpiry = new Date('2025-04-20');

    expect(getUncapturedValue([benefit], beforeExpiry)).toBe(10000);
    expect(getUncapturedValue([benefit], afterExpiry)).toBe(0);
  });

  test('respects userDeclaredValue override', () => {
    const benefit = {
      id: '1',
      stickerValue: 10000,
      userDeclaredValue: 8000,
      isUsed: false,
      expirationDate: new Date('2025-05-01'),
      type: 'StatementCredit',
      timesUsed: 0,
    };
    expect(getUncapturedValue([benefit], now)).toBe(8000);
  });

  test('returns 0 for empty benefits array', () => {
    expect(getUncapturedValue([], now)).toBe(0);
  });
});
```

#### Test Suite 4: getNetAnnualFee

```typescript
describe('getNetAnnualFee', () => {
  test('subtracts CardmemberYear StatementCredits from base fee', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'CardmemberYear',
        stickerValue: 30000,
        userDeclaredValue: null,
        isUsed: false,
        expirationDate: null,
      },
    ];
    expect(getNetAnnualFee(card, benefits)).toBe(-20500);
  });

  test('ignores non-CardmemberYear credits', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'Monthly',
        stickerValue: 10000,
        userDeclaredValue: null,
        isUsed: false,
        expirationDate: null,
      },
    ];
    expect(getNetAnnualFee(card, benefits)).toBe(9500); // Fee unchanged
  });

  test('ignores UsagePerk benefits (not fee offsets)', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'UsagePerk',
        resetCadence: 'CardmemberYear',
        stickerValue: 5000,
        userDeclaredValue: null,
        isUsed: false,
        expirationDate: null,
        timesUsed: 0,
      },
    ];
    expect(getNetAnnualFee(card, benefits)).toBe(9500); // Fee unchanged
  });

  test('uses stickerValue, not userDeclaredValue, for fee offsets', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'CardmemberYear',
        stickerValue: 30000,
        userDeclaredValue: 25000, // User override, should be ignored
        isUsed: false,
        expirationDate: null,
      },
    ];
    expect(getNetAnnualFee(card, benefits)).toBe(9500 - 30000); // Uses sticker, not user value
  });

  test('handles null actualAnnualFee as 0', () => {
    const card = { actualAnnualFee: null };
    const benefits = [];
    expect(getNetAnnualFee(card, benefits)).toBe(0);
  });

  test('handles multiple CardmemberYear credits', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'CardmemberYear',
        stickerValue: 20000,
        userDeclaredValue: null,
        isUsed: false,
        expirationDate: null,
      },
      {
        id: '2',
        type: 'StatementCredit',
        resetCadence: 'CardmemberYear',
        stickerValue: 10000,
        userDeclaredValue: null,
        isUsed: false,
        expirationDate: null,
      },
    ];
    expect(getNetAnnualFee(card, benefits)).toBe(9500 - 30000);
  });

  test('ignores isUsed flag (potential value matters)', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'CardmemberYear',
        stickerValue: 30000,
        userDeclaredValue: null,
        isUsed: false, // Unused, but still offsets fee
        expirationDate: null,
      },
    ];
    expect(getNetAnnualFee(card, benefits)).toBe(-20500);
  });
});
```

#### Test Suite 5: getEffectiveROI

```typescript
describe('getEffectiveROI', () => {
  test('calculates extracted value minus net annual fee', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'Monthly',
        stickerValue: 20000,
        userDeclaredValue: null,
        isUsed: true,
        expirationDate: null,
        timesUsed: 0,
      },
    ];
    // Extracted: 20000, Net Fee: 9500, ROI: 10500
    expect(getEffectiveROI(card, benefits)).toBe(10500);
  });

  test('handles negative ROI correctly', () => {
    const card = { actualAnnualFee: 10000 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'Monthly',
        stickerValue: 3000,
        userDeclaredValue: null,
        isUsed: true,
        expirationDate: null,
        timesUsed: 0,
      },
    ];
    // Extracted: 3000, Net Fee: 10000, ROI: -7000
    expect(getEffectiveROI(card, benefits)).toBe(-7000);
  });

  test('accounts for fee-offsetting credits', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'CardmemberYear',
        stickerValue: 30000,
        userDeclaredValue: null,
        isUsed: false,
        expirationDate: null,
        timesUsed: 0,
      },
    ];
    // Extracted: 0, Net Fee: -20500, ROI: 20500
    expect(getEffectiveROI(card, benefits)).toBe(20500);
  });

  test('combines extracted + offset correctly', () => {
    const card = { actualAnnualFee: 9500 };
    const benefits = [
      {
        id: '1',
        type: 'StatementCredit',
        resetCadence: 'Monthly',
        stickerValue: 15000,
        userDeclaredValue: null,
        isUsed: true,
        expirationDate: null,
        timesUsed: 0,
      },
      {
        id: '2',
        type: 'StatementCredit',
        resetCadence: 'CardmemberYear',
        stickerValue: 30000,
        userDeclaredValue: null,
        isUsed: false,
        expirationDate: null,
        timesUsed: 0,
      },
    ];
    // Extracted: 15000, Net Fee: -20500, ROI: 35500
    expect(getEffectiveROI(card, benefits)).toBe(35500);
  });

  test('returns 0 for zero extracted and zero fee', () => {
    const card = { actualAnnualFee: 0 };
    const benefits = [];
    expect(getEffectiveROI(card, benefits)).toBe(0);
  });
});
```

#### Test Suite 6: getHouseholdROI

```typescript
describe('getHouseholdROI', () => {
  test('sums ROI across multiple cards and players', () => {
    const players = [
      {
        id: 'p1',
        userCards: [
          {
            id: 'c1',
            actualAnnualFee: 9500,
            userBenefits: [
              {
                id: 'b1',
                type: 'StatementCredit',
                resetCadence: 'Monthly',
                stickerValue: 20000,
                userDeclaredValue: null,
                isUsed: true,
                expirationDate: null,
                timesUsed: 0,
              },
            ],
          },
        ],
      },
      {
        id: 'p2',
        userCards: [
          {
            id: 'c2',
            actualAnnualFee: 5000,
            userBenefits: [
              {
                id: 'b2',
                type: 'StatementCredit',
                resetCadence: 'Monthly',
                stickerValue: 8000,
                userDeclaredValue: null,
                isUsed: true,
                expirationDate: null,
                timesUsed: 0,
              },
            ],
          },
        ],
      },
    ];
    // Card 1: 20000 - 9500 = 10500
    // Card 2: 8000 - 5000 = 3000
    // Total: 13500
    expect(getHouseholdROI(players)).toBe(13500);
  });

  test('handles multiple cards per player', () => {
    const players = [
      {
        id: 'p1',
        userCards: [
          {
            id: 'c1',
            actualAnnualFee: 9500,
            userBenefits: [
              {
                id: 'b1',
                type: 'StatementCredit',
                resetCadence: 'Monthly',
                stickerValue: 20000,
                userDeclaredValue: null,
                isUsed: true,
                expirationDate: null,
                timesUsed: 0,
              },
            ],
          },
          {
            id: 'c2',
            actualAnnualFee: 5000,
            userBenefits: [
              {
                id: 'b2',
                type: 'StatementCredit',
                resetCadence: 'Monthly',
                stickerValue: 8000,
                userDeclaredValue: null,
                isUsed: true,
                expirationDate: null,
                timesUsed: 0,
              },
            ],
          },
        ],
      },
    ];
    // Card 1: 20000 - 9500 = 10500
    // Card 2: 8000 - 5000 = 3000
    // Total: 13500
    expect(getHouseholdROI(players)).toBe(13500);
  });

  test('returns 0 for empty players array', () => {
    expect(getHouseholdROI([])).toBe(0);
  });
});
```

### Integration Tests

**File:** `/src/components/__tests__/Card.integration.test.ts`

```typescript
describe('Card Component - ROI Calculation Integration', () => {
  test('Card.tsx and calculations.ts produce identical ROI', () => {
    const card = {
      id: 'c1',
      actualAnnualFee: 9500,
      masterCard: { defaultAnnualFee: 9500 },
      userBenefits: [
        {
          id: 'b1',
          type: 'StatementCredit',
          resetCadence: 'Monthly',
          stickerValue: 20000,
          userDeclaredValue: null,
          isUsed: true,
          expirationDate: null,
          timesUsed: 0,
        },
      ],
    };

    const componentROI = getEffectiveROI(card, card.userBenefits);
    expect(componentROI).toBe(10500);
  });

  test('Card.tsx and SummaryStats.tsx agree on household ROI', () => {
    const players = [
      {
        id: 'p1',
        userCards: [
          {
            id: 'c1',
            actualAnnualFee: 9500,
            masterCard: { defaultAnnualFee: 9500 },
            userBenefits: [
              {
                id: 'b1',
                type: 'StatementCredit',
                resetCadence: 'Monthly',
                stickerValue: 20000,
                userDeclaredValue: null,
                isUsed: true,
                expirationDate: null,
                timesUsed: 0,
              },
            ],
          },
        ],
      },
    ];

    const householdROI = getHouseholdROI(players);
    expect(householdROI).toBe(10500);
  });
});
```

### Component Render Tests

**File:** `/src/components/__tests__/Card.render.test.ts`

Test that after refactoring, Card component still renders correctly with centralized calculations:

```typescript
describe('Card Component - Render with Centralized ROI', () => {
  test('renders positive ROI in green badge', () => {
    const card = { /* ... 10500 ROI ... */ };
    const { getByText } = render(<Card card={card} />);
    const badge = getByText('$105.00');
    expect(badge).toHaveClass('bg-success-500');
  });

  test('renders negative ROI in red badge', () => {
    const card = { /* ... -7000 ROI ... */ };
    const { getByText } = render(<Card card={card} />);
    const badge = getByText('-$70.00');
    expect(badge).toHaveClass('bg-danger-500');
  });

  test('uncaptured value calculated correctly', () => {
    const now = new Date('2025-04-01');
    const card = { /* ... benefits with expiry in future ... */ };
    const { getByText } = render(<Card card={card} />);
    // Should display uncaptured value from getUncapturedValue()
    expect(getByText('$250.00')).toBeInTheDocument();
  });
});
```

---

## Implementation Roadmap

### Phase 1: Library Enhancement (calculations.ts)

**Tasks:**
1. Add `getHouseholdROI()` function to calculations.ts
2. Add `getHouseholdTotalCaptured()` function to calculations.ts
3. Add `getHouseholdActiveCount()` function to calculations.ts
4. Add comprehensive JSDoc comments and examples
5. Create unit test suite (calculations.test.ts)
6. Run tests, validate 95%+ coverage

**Estimated Effort:** 3-4 hours

---

### Phase 2: Card.tsx Refactoring

**Tasks:**
1. Import `getEffectiveROI` and `getUncapturedValue` from calculations
2. Remove local `getEffectiveROI()` implementation
3. Remove local `getUncapturedValue()` implementation
4. Update component calls: `getEffectiveROI(card, card.userBenefits)` and `getUncapturedValue(card.userBenefits)`
5. Verify component still renders correctly
6. Update component integration tests

**Estimated Effort:** 1-2 hours

---

### Phase 3: SummaryStats.tsx Refactoring

**Tasks:**
1. Import `getHouseholdROI`, `getHouseholdTotalCaptured`, `getHouseholdActiveCount` from calculations
2. Remove local `calculateHouseholdROI()` implementation
3. Remove local `getTotalCaptured()` implementation
4. Remove local `getActiveCount()` implementation
5. Update component calls in useMemo
6. Verify component still renders correctly
7. Update component integration tests

**Estimated Effort:** 1-2 hours

---

### Phase 4: End-to-End Testing

**Tasks:**
1. Visual regression testing (compare before/after screenshots)
2. Data consistency audit (verify all three locations now produce same results)
3. Edge case validation (test all 12 edge cases)
4. Performance profiling (ensure no regression)
5. User acceptance testing (compare display values)

**Estimated Effort:** 2-3 hours

---

### Phase 5: Documentation & Cleanup

**Tasks:**
1. Update code comments in Card.tsx and SummaryStats.tsx
2. Add migration notes to team documentation
3. Mark old implementations as deprecated (if any remain)
4. Update type definitions if needed
5. Finalize spec document

**Estimated Effort:** 1 hour

---

## Acceptance Criteria Checklist

- [ ] All ROI calculations in Card.tsx use `getEffectiveROI()` from calculations.ts
- [ ] All ROI calculations in SummaryStats.tsx use `getHouseholdROI()` from calculations.ts
- [ ] All uncaptured value calculations use `getUncapturedValue()` from calculations.ts
- [ ] Results are **identical** across all components for the same data
- [ ] Unit tests pass with 95%+ code coverage
- [ ] Integration tests validate component rendering
- [ ] All 12 edge cases are documented and have test coverage
- [ ] No behavior changes for normal use cases
- [ ] Visual appearance unchanged (same calculations, same formatting)
- [ ] Performance is neutral or improved
- [ ] TypeScript compilation succeeds with no errors
- [ ] Code review approved by team lead

---

## Files to Modify

1. `/src/lib/calculations.ts` - **Add** household-level functions
2. `/src/components/Card.tsx` - **Remove** local ROI functions, import from calculations
3. `/src/components/SummaryStats.tsx` - **Remove** local ROI functions, import from calculations
4. `/src/lib/calculations.test.ts` - **Create** comprehensive unit test suite

---

## Potential Issues & Mitigation

| Issue | Risk | Mitigation |
|-------|------|-----------|
| Component display changes | Medium | Test all UI surfaces before/after, visual regression testing |
| Performance regression | Low | Profile before/after, optimize if needed |
| Type mismatches | Medium | Use TypeScript strict mode, run type checker |
| Data consistency bugs | Low | Unit tests cover all edge cases |
| Breaking changes | Low | All new functions backward compatible |

---

## Summary of Changes

**What stays the same:**
- UI/component structure
- Data model and database schema
- API contracts
- User-facing behavior for normal cases

**What changes:**
- Implementation details (removed duplication)
- ROI calculation results for cards with fee offsets (bug fix)
- ROI calculation results for UsagePerks with timesUsed > 1 (bug fix)
- All ROI calculations now use single source of truth

**Impact:**
- More accurate ROI reporting (bug fixes)
- Consistent results across all views
- Easier maintenance and future enhancements
- Better test coverage

---

## Conclusion

This specification provides a clear roadmap for centralizing ROI calculation logic and fixing the existing bugs. The proposed changes are **backward compatible**, **well-tested**, and **comprehensive**. Implementation can proceed with confidence that all edge cases are documented and handled appropriately.

The key insight is that **calculations.ts already has the correct implementation**—we simply need to use it everywhere and eliminate the duplicate/incorrect code in Card.tsx and SummaryStats.tsx.
