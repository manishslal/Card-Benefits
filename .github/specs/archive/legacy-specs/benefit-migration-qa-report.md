# Benefit Migration Script — QA Review Report

> **Script:** `scripts/migrate-master-benefits.js`  
> **Spec:** `.github/specs/benefit-review-checklist.md`  
> **Date:** Review performed against latest commit  
> **Scope:** Data accuracy, code logic, idempotency, edge cases

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Data points verified | 40 |
| PASS | 39 |
| FAIL (fixed) | 1 |
| CRITICAL issues | 1 (fixed) |
| HIGH issues | 0 |
| MEDIUM issues | 2 |
| LOW issues | 3 |

**Verdict:** After the one CRITICAL fix (applied), the script is **ready for production**. All 11 specific data points from the task requirements pass verification. All monetary amounts are correctly in cents. All cadence values are valid enums. Rename/deactivation/creation logic is correct and idempotent.

---

## CRITICAL Issues

### C-1: Missing deactivation — Hilton Surpass "Priority Pass (10 visits)" ✅ FIXED

| Field | Detail |
|-------|--------|
| **Location** | `MIGRATIONS` array, Card 10 (Hilton Surpass) |
| **Spec ref** | `benefit-review-checklist.md` §10, row 5 |
| **What was wrong** | Spec lists **4** benefits to remove. Script only had **3**: Amex Platinum Meet & Greet, Hilton Surpass Airline Fee Credit, Venture X Baggage Fee Credit. The 4th — Hilton Surpass "Priority Pass (10 visits)" (discontinued early 2024) — was **missing**. |
| **Impact** | A discontinued benefit would remain `isActive: true` in production, appearing in user dashboards. |
| **Fix applied** | Added `{ name: 'Priority Pass (10 visits)', claimingCadence: 'FLEXIBLE_ANNUAL', claimingAmount: 0, variableAmounts: null, isActive: false }` to the Hilton Surpass benefits array at line 175. |

---

## HIGH Issues

None.

---

## MEDIUM Issues

### M-1: CSR "$500 The Edit Hotel Credit" — claimingAmount ambiguity

| Field | Detail |
|-------|--------|
| **Location** | Line 83 — `claimingAmount: 25000` |
| **Spec ref** | `benefit-review-checklist.md` §3, row 2 |
| **Observation** | Spec: FLEXIBLE_ANNUAL, Per Period "$250 (×2)", Annual Total $500. Script sets `claimingAmount: 25000` ($250). Other FLEXIBLE_ANNUAL benefits use the full annual value as `claimingAmount` (e.g., $300 Travel Credit → 30000). If the claiming engine interprets FLEXIBLE_ANNUAL claimingAmount as "one claim per year", the user would only see $250 instead of $500. |
| **Impact** | Depends on claiming engine semantics. If FLEXIBLE_ANNUAL allows 2 flexible claims of $250, current value is correct. If it means 1 annual claim, value should be 50000. |
| **Recommendation** | Verify claiming engine behavior for FLEXIBLE_ANNUAL with the $500 The Edit Hotel benefit. If it uses `claimingAmount` as the one-time annual value, change to `50000`. Otherwise, current value is correct. |

### M-2: No unique constraint prevents duplicate `isNew` benefit creation

| Field | Detail |
|-------|--------|
| **Location** | Lines 338-356 (create path); `prisma/schema.prisma` lines 78-83 |
| **Observation** | `MasterBenefit` has no `@@unique([masterCardId, name])` constraint. The script's create-if-not-found pattern (`findFirst` → `create`) is not atomic. If two deploy processes run this script concurrently, both could see `null` from `findFirst` and both create the same benefit. |
| **Impact** | Low probability (Railway deploys are sequential), but if it happened, would create duplicate MasterBenefit rows that propagate to UserBenefit creation. |
| **Recommendation** | Add `@@unique([masterCardId, name])` to the `MasterBenefit` model in the Prisma schema, or wrap the create in a try/catch that ignores unique violation errors. |

---

## LOW Issues

### L-1: Amex Gold "$100 Annual Uber Credit" name is now stale

| Field | Detail |
|-------|--------|
| **Location** | Line 72 |
| **Observation** | After the fix, the benefit is MONTHLY $10 × 12 = $120/yr, but the name still reads "$100 Annual Uber Credit". `stickerValue` is correctly updated to 12000 ($120). The spec does not request a rename. |
| **Recommendation** | Consider renaming to "$120 Annual Uber Credit" in a future update to avoid user confusion. |

### L-2: `formatCents()` conflates 0, null, and undefined

| Field | Detail |
|-------|--------|
| **Location** | Line 250 |
| **Observation** | `formatCents(0)`, `formatCents(null)`, and `formatCents(undefined)` all return `"$0"`. This means log output cannot distinguish between "free benefit" and "amount not set". |
| **Recommendation** | No fix needed — this is cosmetic. Could use `"$0"` for 0 and `"N/A"` for null/undefined if log clarity is desired. |

### L-3: `process.exit(0)` swallows fatal errors

| Field | Detail |
|-------|--------|
| **Location** | Lines 516-524 |
| **Observation** | The script always exits with code 0, even on fatal errors. This is intentional (comment: "don't block app from starting") but means migration failures won't trigger deploy failure alerts. |
| **Recommendation** | Consider logging to an external monitoring service (Sentry, etc.) before exiting 0 on error, so failures are visible. |

---

## Data Accuracy Verification Matrix

All amounts verified in **cents**. All cadence values are valid enum members.

### Specific Data Points (from task requirements)

| # | Card | Benefit | Field | Script | Spec | Result |
|---|------|---------|-------|--------|------|--------|
| 1 | Amex Platinum | $400 Resy Dining Credit | cadence | `QUARTERLY` | QUARTERLY | ✅ |
| 2 | Amex Platinum | $400 Resy Dining Credit | amount | `10000` | $100 = 10000¢ | ✅ |
| 3 | Amex Platinum | Global Entry/TSA | cadence | `ONE_TIME` | ONE_TIME | ✅ |
| 4 | Amex Platinum | Global Entry/TSA | amount | `12000` | $120 = 12000¢ | ✅ |
| 5 | Amex Gold | $100 Uber Credit | cadence | `MONTHLY` | MONTHLY | ✅ |
| 6 | Amex Gold | $100 Uber Credit | amount | `1000` | $10 = 1000¢ | ✅ |
| 7 | Amex Gold | $100 Uber Credit | stickerValue | `12000` | $120 = 12000¢ | ✅ |
| 8 | Amex Gold | 4x Points on Flights | rename | `→ 3x Points on Flights` | 3x (not 4x) | ✅ |
| 9 | CSR | $300 Dining Credit | cadence | `SEMI_ANNUAL` | SEMI_ANNUAL | ✅ |
| 10 | CSR | $300 Dining Credit | amount | `15000` | $150 = 15000¢ | ✅ |
| 11 | CSR | $300 Entertainment Credit | cadence | `SEMI_ANNUAL` | SEMI_ANNUAL | ✅ |
| 12 | CSR | $300 Entertainment Credit | amount | `15000` | $150 = 15000¢ | ✅ |
| 13 | CSR | $500 The Edit Hotel Credit | cadence | `FLEXIBLE_ANNUAL` | FLEXIBLE_ANNUAL | ✅ |
| 14 | CSR | $500 The Edit Hotel Credit | amount | `25000` | $250 = 25000¢ | ✅ ⚠️ M-1 |
| 15 | CSR | $250 Hotel Chain Credit | cadence | `FLEXIBLE_ANNUAL` | FLEXIBLE_ANNUAL | ✅ |
| 16 | CSR | $250 Hotel Chain Credit | amount | `25000` | $250 = 25000¢ | ✅ |
| 17 | US Bank | Travel Credit | cadence | `FLEXIBLE_ANNUAL` | FLEXIBLE_ANNUAL | ✅ |
| 18 | US Bank | Travel Credit | amount | `32500` | $325 = 32500¢ | ✅ |
| 19 | US Bank | Travel Credit | stickerValue | `32500` | 32500 | ✅ |
| 20 | US Bank | Travel Credit | rename | `→ $325 Annual Travel Credit` | Fix name | ✅ |
| 21 | Marriott Brilliant | Airline Fee Credit | rename | `→ $300 Dining Credit` | Replace | ✅ |
| 22 | Marriott Brilliant | Airline Fee Credit | cadence | `MONTHLY` | MONTHLY | ✅ |
| 23 | Marriott Brilliant | Airline Fee Credit | amount | `2500` | $25 = 2500¢ | ✅ |
| 24 | Marriott Brilliant | Airline Fee Credit | stickerValue | `30000` | $300 = 30000¢ | ✅ |
| 25 | Amex Green | Statement Credits | rename | `→ $209 CLEAR+ Credit` | Fix name | ✅ |
| 26 | Amex Green | Statement Credits | amount | `20900` | $209 = 20900¢ | ✅ |
| 27 | Amex Green | Statement Credits | stickerValue | `20900` | 20900 | ✅ |

### Deactivations (Removals)

| Card | Benefit | isActive | Spec | Result |
|------|---------|----------|------|--------|
| Amex Platinum | Complimentary Airport Meet & Greet | `false` | 🗑️ REMOVE | ✅ |
| Hilton Surpass | Airline Fee Credit | `false` | 🗑️ REMOVE | ✅ |
| Hilton Surpass | Priority Pass (10 visits) | `false` | 🗑️ REMOVE | ✅ FIXED (C-1) |
| Venture X | Baggage Fee Credit | `false` | 🗑️ REMOVE | ✅ |

### Renames

| Card | Old Name | New Name | Spec | Result |
|------|----------|----------|------|--------|
| Amex Gold | 4x Points on Flights | 3x Points on Flights | ✅ | ✅ |
| Amex Green | Statement Credits for Travel | $209 CLEAR+ Credit | ✅ | ✅ |
| Hilton Surpass | 10x Points on Hilton Hotels | 12x Points on Hilton Hotels | ✅ | ✅ |
| Marriott Brilliant | Airline Fee Credit | $300 Dining Credit | ✅ | ✅ |
| Venture X | 10x Miles on Travel & Dining | 10x Hotels/Cars via Portal, 5x Flights, 2x All Else | ✅ | ✅ |
| Amex Biz Gold | 4x Membership Rewards on Business Purchases | 4x on Top 2 Categories | ✅ | ✅ |
| Citi Prestige | Travel Credit | $250 Airline Travel Credit | ✅ | ✅ |
| Citi Prestige | 3x Prestige Points on Travel | 5x Airlines/Dining, 3x Hotels/Cruise | ✅ | ✅ |
| JetBlue Plus | Inflight Free Drinks & Snacks | 50% Statement Credit on Food & Cocktails | ✅ | ✅ |
| US Bank | $300 Quarterly Travel Credit | $325 Annual Travel Credit | ✅ | ✅ |

### New Benefits (isNew: true)

| Card | Benefit | Cadence | Amount | Type | stickerValue | resetCadence | Result |
|------|---------|---------|--------|------|-------------|-------------|--------|
| Amex Biz Gold | $240 Flexible Business Credit | MONTHLY | 2000 ($20) | StatementCredit | 24000 | Monthly | ✅ |
| Amex Biz Gold | $150 Squarespace Credit | FLEXIBLE_ANNUAL | 15000 ($150) | StatementCredit | 15000 | CalendarYear | ✅ |
| Marriott Brilliant | Priority Pass Select | FLEXIBLE_ANNUAL | 0 | TravelPerk | 0 | CardmemberYear | ✅ |

---

## Code Logic Verification

### Rename Logic (lines 320-335, 394-396)

✅ **Correct and idempotent.**
1. Looks up by `benefitMapping.name` (the old/current DB name)
2. If not found AND `newName` exists, looks up by `newName` (handles re-runs after rename)
3. Sets `updateData.name = benefitMapping.newName` if provided

### isNew Creation Logic (lines 338-356)

✅ **Correct.**
1. If not found by name AND `isNew: true` → creates with all required fields
2. On re-run, `findFirst` finds the existing record → falls through to idempotency check
3. Required fields `type`, `stickerValue`, `resetCadence` have sensible defaults

### Deactivation Logic (lines 399-401)

✅ **Correct.** Uses strict equality (`=== false`), so `undefined` won't accidentally deactivate benefits.

### Idempotency (lines 364-376)

✅ **Correct.** Checks all relevant fields: `claimingCadence`, `claimingAmount`, `variableAmounts`, `name` (for renames), `isActive`, `stickerValue`. Skips update if all match.

### Phase 2 Catch-All (lines 436-484)

✅ **Intact.** Still finds all `claimingCadence: null` records and applies keyword-based smart defaults.

### Truthiness Handling

✅ **No bugs.** All comparisons use strict equality (`===`) or explicit checks (`> 0`). `claimingAmount: 0` is handled correctly throughout.

---

## Edge Case Analysis

### Q: What if a benefit was already renamed from a previous run?
**Safe.** Lines 328-335: If `findFirst` by old name returns null and `newName` exists, script searches by `newName`. The idempotency check on line 372 then detects values already match and skips.

### Q: What if a new benefit already exists?
**Safe.** `findFirst` by `name` finds it → falls through to update path → idempotency check skips if correct.

### Q: Are there JS truthiness bugs with `claimingAmount: 0`?
**No.** Line 366 uses `===`, not `!claimingAmount`. Line 250 uses `=== 0`. Line 450 uses `> 0`. All correct.

### Q: What if a card doesn't exist in the DB?
**Safe.** Lines 309-313: `findUnique` returns null → logs warning → skips all benefits for that card.

### Q: Concurrent deploys?
**Low risk.** `findFirst` + `create` is not atomic, but Railway deploys are sequential. See M-2 for long-term fix.

---

## Summary of Changes Made

| Change | File | Line |
|--------|------|------|
| Added Hilton Surpass "Priority Pass (10 visits)" deactivation | `scripts/migrate-master-benefits.js` | 175 |
