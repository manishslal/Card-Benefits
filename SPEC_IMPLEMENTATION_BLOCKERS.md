# ROI Centralization - Implementation Blockers & Resolution Guide

**Status:** BLOCKING ISSUES IDENTIFIED
**Severity:** Critical (must resolve before implementation)
**Resolution Time:** 1-2 hours

---

## Overview

Before implementation of the ROI centralization refactoring can begin, three critical blockers must be resolved. This document provides specific, actionable guidance for each blocker.

---

## BLOCKER #1: Missing Household Functions

### The Issue

The specification proposes a Phase 1 task: "Add getHouseholdROI(), getHouseholdTotalCaptured(), getHouseholdActiveCount() to calculations.ts"

However, these functions do not exist. The specification describes them but doesn't implement them.

### Current State

**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/lib/calculations.ts`

**What exists (lines 1-207):**
```typescript
✅ getTotalValueExtracted()        - Single card level
✅ getUncapturedValue()            - Single card level
✅ getNetAnnualFee()               - Single card level
✅ getEffectiveROI()               - Single card level
✅ getExpirationWarnings()         - Single card level
```

**What's missing (needed for Phase 1):**
```typescript
❌ getHouseholdROI()               - Household aggregation
❌ getHouseholdTotalCaptured()     - Household aggregation
❌ getHouseholdActiveCount()       - Household aggregation
```

### Broken Implementations to Replace

**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/components/SummaryStats.tsx` (lines 117-137)

```typescript
function calculateHouseholdROI(players: Player[]): number {
  let totalCaptured = 0;
  let totalFees = 0;

  for (const player of players) {
    for (const card of player.userCards) {
      // Add captured benefit value
      for (const benefit of card.userBenefits) {
        if (benefit.isUsed) {
          totalCaptured += getResolvedValue(benefit);  // ❌ BUG: Doesn't use timesUsed
        }
      }

      // Subtract net annual fee
      const annualFee = card.actualAnnualFee ?? card.masterCard.defaultAnnualFee;
      totalFees += annualFee;  // ❌ BUG: Doesn't subtract fee offsets
    }
  }

  return totalCaptured - totalFees;
}
```

This function has both bugs (timesUsed and fee offsets).

### What to Create

Add these three functions to `/src/lib/calculations.ts` (after line 207):

```typescript
/**
 * Calculates household ROI by aggregating across all cards for all players.
 *
 * Formula: Sum of (each card's extracted value) - Sum of (each card's net fee)
 *
 * @param players - Array of players with their cards and benefits
 * @returns Household ROI in cents
 *
 * @example
 * const players = [
 *   { id: 'p1', userCards: [...] },
 *   { id: 'p2', userCards: [...] }
 * ];
 * getHouseholdROI(players) // => 15000 cents ($150)
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

/**
 * Calculates total benefit counts for household summary.
 *
 * Returns count of unused, non-expired benefits across all cards.
 * Perpetual benefits (null expirationDate) are included.
 *
 * @param players - Array of players
 * @param now - Reference date for "active" definition (defaults to Date.now())
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

### Critical Detail: getHouseholdActiveCount Bug Fix

**Important:** The current SummaryStats.tsx implementation (line 106) has a bug:

```typescript
// WRONG (SummaryStats.tsx line 106)
count += card.userBenefits.filter(
  (b) => !b.isUsed && b.expirationDate && b.expirationDate > now
).length;
```

This requires `b.expirationDate &&` (truthy), which EXCLUDES perpetual benefits (where expirationDate is null).

The **correct** implementation is:

```typescript
// CORRECT (proposed getHouseholdActiveCount)
count += card.userBenefits.filter(
  (b) => !b.isUsed && (!b.expirationDate || b.expirationDate > now)
).length;
```

This is the implementation provided above. It correctly includes perpetual benefits.

**Acceptance Criteria:** After this change, activeCount will increase for households with perpetual benefits. Document this as a bug fix.

### Add Type Definition

The functions need the `Player` type. Add this to calculations.ts (after the imports, around line 10):

```typescript
interface Player {
  id: string;
  userCards: UserCard[];
}
```

### Validation

After implementing these three functions:

1. Test that `getHouseholdROI(testPlayers)` equals the SummaryStats calculateHouseholdROI() result on test data (should be identical)
2. Validate that the functions use the lower-level functions (getTotalValueExtracted, getNetAnnualFee) internally
3. Ensure TypeScript compilation passes with no errors

**Estimated Time:** 30-45 minutes

---

## BLOCKER #2: Player Interface Mismatch

### The Issue

The specification defines the Player interface as:

```typescript
interface Player {
  id: string;
  userCards: UserCard[];
}
```

But the actual codebase (SummaryStats.tsx, line 53-58) defines it as:

```typescript
interface Player {
  id: string;
  playerName: string;
  isActive: boolean;
  userCards: UserCard[];
}
```

### Why This Is a Blocker

1. **Test code won't compile** - All test fixtures in the spec use the minimal Player definition
2. **Function signatures wrong** - getHouseholdROI() designed for spec's Player won't work with real Player
3. **Type safety broken** - TypeScript will report errors when connecting spec code to real code

### Location

**File:** `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/src/components/SummaryStats.tsx`

**Lines 53-58:**
```typescript
interface Player {
  id: string;
  playerName: string;
  isActive: boolean;
  userCards: UserCard[];
}
```

### Resolution

**Option A: Update the Specification (RECOMMENDED)**

Update SPECIFICATION_ROI_CENTRALIZATION.md, section "Type Definitions" (around line 445) from:

```typescript
interface Player {
  id: string;
  userCards: UserCard[];
}
```

To:

```typescript
interface Player {
  id: string;
  playerName: string;
  isActive: boolean;
  userCards: UserCard[];
}
```

Then update all test fixtures to include playerName and isActive. Example:

```typescript
const players = [
  {
    id: 'p1',
    playerName: 'Alice',      // ADD
    isActive: true,           // ADD
    userCards: [
      {
        id: 'c1',
        actualAnnualFee: 9500,
        userBenefits: [...]
      },
    ],
  },
];
```

**Option B: Update the Implementation (NOT RECOMMENDED)**

Add the missing fields to the type definition in calculations.ts. This would be wrong because:
- playerName and isActive aren't used in calculations
- It couples calculation logic to the Player object structure
- If Player type changes, calculations.ts must change

**Recommended Action:** Go with Option A (update specification)

**Estimated Time:** 15-30 minutes (updating type definition and test fixtures)

---

## BLOCKER #3: Expiration Date Handling Documentation

### The Issue

The specification doesn't flag that SummaryStats.tsx has a bug in how it handles null expiration dates.

**Current Code (SummaryStats.tsx, line 100-110):**
```typescript
function getActiveCount(players: Player[]): number {
  let count = 0;
  const now = new Date();
  for (const player of players) {
    for (const card of player.userCards) {
      count += card.userBenefits.filter(
        (b) => !b.isUsed && b.expirationDate && b.expirationDate > now
      ).length;
      //                 ↑ This filter EXCLUDES null expirationDate
    }
  }
  return count;
}
```

**Correct Behavior (from spec edge case #12):**
Benefits with `expirationDate = null` (perpetual) should be INCLUDED in active count.

**Current behavior:** They're EXCLUDED.

**Proposed fix (what getHouseholdActiveCount will do):**
```typescript
(b) => !b.isUsed && (!b.expirationDate || b.expirationDate > now)
```

### Why This Matters

When you refactor SummaryStats to use the centralized getHouseholdActiveCount() function, the activeCount metric will **suddenly increase** for any household with perpetual benefits (lounge access, TSA precheck, Global Entry, etc.).

For example:
- **Before:** activeCount = 5 (only time-limited benefits counted)
- **After:** activeCount = 8 (includes 3 perpetual benefits)

This is technically a bug fix, but it appears as a behavior change.

### Resolution

**Update the specification to document this as a known bug fix:**

In SPECIFICATION_ROI_CENTRALIZATION.md, add a new section before "Consistency Guarantees" (around line 830):

```markdown
## Known Bug Fixes

### SummaryStats.tsx: Perpetual Benefits Excluded from Active Count

**Current Bug:** The getActiveCount() function in SummaryStats.tsx (line 106) requires
`b.expirationDate &&`, which excludes benefits with null expirationDate (perpetual benefits
like lounge access, Global Entry, TSA PreCheck).

**Impact:** Households with perpetual benefits show artificially low activeCount.

**Fix:** After centralization, getHouseholdActiveCount() correctly includes perpetual
benefits using: `!b.expirationDate || b.expirationDate > now`

**Result:** activeCount will increase for affected households. This is correct behavior.

**Acceptance Criteria:** Test that activeCount increases by N for household with N perpetual
benefits after refactoring.
```

**Also update Acceptance Criteria (line 1571-1584) to add:**

```markdown
- [ ] activeCount for perpetual benefits correctly increases after refactoring (bug fix)
```

**Estimated Time:** 15 minutes

---

## Summary: Resolution Checklist

Before implementation can begin, complete these tasks:

- [ ] **BLOCKER #1:** Create getHouseholdROI(), getHouseholdTotalCaptured(), getHouseholdActiveCount() in calculations.ts
  - [ ] Add the three function implementations
  - [ ] Add Player interface type definition
  - [ ] Run tests on the three functions
  - [ ] Validate results match old broken code
  - Estimated time: 30-45 minutes

- [ ] **BLOCKER #2:** Fix Player interface definition in specification
  - [ ] Update Player interface in spec to match actual code (add playerName, isActive)
  - [ ] Update all test fixtures to include new fields
  - [ ] Update type definitions section
  - Estimated time: 15-30 minutes

- [ ] **BLOCKER #3:** Document expiration date bug fix
  - [ ] Add "Known Bug Fixes" section to specification
  - [ ] Update acceptance criteria
  - [ ] Update SummaryStats.tsx integration notes
  - Estimated time: 15 minutes

**Total Time to Resolve All Blockers: 60-90 minutes (1-1.5 hours)**

After these blockers are resolved, implementation can proceed with high confidence.

---

## Testing the Fixes

After resolving all blockers, validate with this test data:

```typescript
// Test case: 1 player, 1 card with various benefits
const testPlayers = [
  {
    id: 'player1',
    playerName: 'Test User',
    isActive: true,
    userCards: [
      {
        id: 'card1',
        actualAnnualFee: 9500,
        masterCard: { defaultAnnualFee: 9500 },
        userBenefits: [
          // Used benefit
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
          // Fee-offsetting credit
          {
            id: 'b2',
            type: 'StatementCredit',
            resetCadence: 'CardmemberYear',
            stickerValue: 30000,
            userDeclaredValue: null,
            isUsed: false,
            expirationDate: null,
            timesUsed: 0,
          },
          // Perpetual benefit (should be in activeCount)
          {
            id: 'b3',
            type: 'UsagePerk',
            resetCadence: 'CardmemberYear',
            stickerValue: 0,
            userDeclaredValue: null,
            isUsed: false,
            expirationDate: null,
            timesUsed: 0,
          },
        ],
      },
    ],
  },
];

// Expected results after fixes:
// getHouseholdROI(testPlayers) = 20000 - (9500 - 30000) = 20000 - (-20500) = 40500 cents
// getHouseholdTotalCaptured(testPlayers) = 20000 cents
// getHouseholdActiveCount(testPlayers) = 2 (fee-offset credit + perpetual benefit)
```

---

## Next Steps

1. **Notify the implementation team** - Share this document
2. **Assign blockers to developer** - Estimated 1-1.5 hours work
3. **Review resolved blockers** - QA validates fixes
4. **Proceed to implementation** - Start Phase 1 after blockers resolved

---

**Document Version:** 1.0
**Created:** April 1, 2026
**Status:** BLOCKING - Must resolve before Phase 1 can start

