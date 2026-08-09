# Benefit Engine — QA & Integration Review Report

**Reviewer**: QA Code Reviewer (Automated)
**Date**: 2026-04-08
**Scope**: All files from the Benefit Engine implementation (Stage 4a)
**Verdict**: ❌ **NOT READY FOR PRODUCTION** — 1 Critical blocker found

---

## Executive Summary

The Benefit Engine is a well-structured implementation with clean separation of concerns, thorough date math logic, and 79 passing tests. The code quality is generally high. However, **one critical schema conflict** makes period rollover impossible, which means the cron job — a core part of the system — is silently broken. Additionally, a timezone bug in date formatting will confuse every US-based user.

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | Must fix before deployment |
| 🟠 HIGH | 3 | Should fix before deployment |
| 🟡 MEDIUM | 3 | Fix soon after deployment |
| 🟢 LOW | 2 | Nice to have |

---

## Verification Command Results

### 1. `npx vitest run src/lib/benefit-engine` — ✅ ALL PASS
```
Test Files  2 passed (2)
     Tests  79 passed (79)
  Duration  185ms
```

### 2. `npm run build` — ✅ BUILD SUCCEEDS
```
○ /dashboard  8.63 kB  188 kB   (static, prerendered)
ƒ /api/cron/reset-benefits  263 B  102 kB   (dynamic)
ƒ /api/benefits/history  263 B  102 kB   (dynamic)
```

### 3. `npx tsc --noEmit` — ✅ ZERO ERRORS IN BENEFIT ENGINE FILES
755 total errors, but **none** in any benefit engine file. All errors are in pre-existing test files (`src/__tests__/auth-cookie-*.test.ts`, `src/__tests__/components/custom-values/*`).

---

## 🔴 CRITICAL Issues (Must Fix Before Deployment)

### C-1: Unique Constraint `@@unique([userCardId, name])` Blocks Period Rollover

**Files**: `prisma/schema.prisma:241`, `src/app/api/cron/reset-benefits/route.ts:355-371`, `src/lib/benefit-engine/generate-benefits.ts:123-128`
**Impact**: **Period rollover is completely broken. Benefits will never advance to the next period.**

**What's wrong:**

The existing schema has:
```prisma
// prisma/schema.prisma, line 241
@@unique([userCardId, name])
```

The benefit engine's core design creates **multiple UserBenefit rows per benefit** — one per period. When the cron job rolls over an expired period, it:
1. Marks the existing row's `periodStatus` → `'EXPIRED'` (row stays in DB)
2. Tries to INSERT a new row with the **same `userCardId` and `name`** for the next period

This violates `@@unique([userCardId, name])`.

Because `skipDuplicates: true` is set on the `createMany` call (line 375-378 of `route.ts`), the INSERT is **silently skipped** — no error is thrown, no new period row is created.

**Evidence — code comments contradict the schema:**
```typescript
// generate-benefits.ts, line 124 (INCORRECT comment)
// The unique constraint (userCardId, masterBenefitId, periodStart) prevents duplicates
```
But `@@index([userCardId, masterBenefitId, periodStart])` at schema line 254 is an **INDEX**, not a **UNIQUE constraint**. The actual unique constraint is `@@unique([userCardId, name])`.

**Result**: After the first period expires, the cron job silently fails to create the next period. Users lose their benefits permanently after one period cycle. This is the **single biggest blocker** in the implementation.

**Suggested fix — two-part schema change:**

1. **Replace the unique constraint** to accommodate the period model:
```prisma
// REMOVE:
@@unique([userCardId, name])

// ADD: New unique constraint that includes periodStart
@@unique([userCardId, name, periodStart])
```

2. **Or, if backward compatibility with non-engine benefits is required**, add a conditional unique constraint:
```prisma
// Keep the existing one for non-engine rows (periodStart IS NULL):
@@unique([userCardId, name])  // legacy

// Add a new one for engine rows:
@@unique([userCardId, masterBenefitId, periodStart])  // engine
```
However, PostgreSQL doesn't support conditional unique constraints natively. The cleanest solution is option 1 — migrate the unique constraint.

3. **Migration SQL:**
```sql
-- Drop old constraint
ALTER TABLE "UserBenefit" DROP CONSTRAINT "UserBenefit_userCardId_name_key";

-- Add new constraint that allows multiple periods per benefit
CREATE UNIQUE INDEX "UserBenefit_userCardId_name_periodStart_key"
  ON "UserBenefit" ("userCardId", "name", COALESCE("periodStart", '1970-01-01'));
```

> ⚠️ **This must be tested** with existing production data before deployment. The COALESCE handles legacy rows where `periodStart` is NULL.

---

## 🟠 HIGH Issues (Should Fix Before Deployment)

### H-1: `formatPeriodRange` Uses Local Timezone — Off-by-One Date Display for US Users

**File**: `src/lib/format-period-range.ts:43, 48, 50-51, 56-57`
**Impact**: Period dates display incorrectly for all users west of UTC (includes all US timezones).

**What's wrong:**

The date math engine correctly calculates all dates in UTC (e.g., `periodStart = 2026-04-01T00:00:00.000Z`). But `formatPeriodRange` uses `toLocaleDateString()` and `getFullYear()` — both of which use the browser's **local timezone**.

For a user in EST (UTC-5):
```
Input:  "2026-04-01T00:00:00.000Z"
Parse:  new Date("2026-04-01T00:00:00.000Z") → March 31, 2026 7:00 PM EST
Format: toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) → "Mar 31"
```

So a monthly benefit period April 1–30 displays as **"Mar 31 – Apr 29"** for US users.

**Suggested fix** — add `timeZone: 'UTC'` to all format options:
```typescript
const SHORT_MONTH_DAY: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',  // ← ADD THIS
};

const FULL_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',  // ← ADD THIS
};
```

And on line 48, change `getFullYear()` to `getUTCFullYear()`:
```typescript
if (s.getUTCFullYear() === e.getUTCFullYear()) {
```

### H-2: Cron Job Loads ALL Expired Benefits Into Memory (No Query Pagination)

**File**: `src/app/api/cron/reset-benefits/route.ts:174-192`
**Impact**: OOM crash on Vercel serverless function if backlog is large.

**What's wrong:**

The initial query loads ALL expired benefits at once:
```typescript
const expiredBenefits = await prisma.userBenefit.findMany({
  where: {
    periodEnd: { not: null, lt: now },
    periodStatus: 'ACTIVE',
    status: { not: 'ARCHIVED' },
  },
  include: { userCard: { select: { ... } } },
});
```

While processing is chunked (line 326-387), the initial SELECT has no `take` limit. If the system goes down for a day and 10,000 benefits expire, this loads all 10,000 records + their UserCard join data into memory before processing starts.

Vercel serverless functions have 256MB–1024MB memory limits. A large backlog could exceed this.

**Suggested fix** — add a `take` limit and loop:
```typescript
const MAX_FETCH = 500;
let totalProcessed = 0;
let hasMore = true;

while (hasMore) {
  const expiredBenefits = await prisma.userBenefit.findMany({
    where: { ... },
    include: { ... },
    take: MAX_FETCH,
    orderBy: { periodEnd: 'asc' },
  });
  hasMore = expiredBenefits.length === MAX_FETCH;
  // ... process batch ...
  totalProcessed += expiredBenefits.length;
}
```

### H-3: Turning Feature Flag Off Leaks EXPIRED Period Rows Into Dashboard

**File**: `src/app/api/cards/my-cards/route.ts:165-173`
**Impact**: If the flag is toggled off after being on, users see duplicate/stale benefits.

**What's wrong:**

When `BENEFIT_ENGINE_ENABLED = true`, the cron job marks old period rows as `status: 'EXPIRED'`. If the flag is later set to `false` (e.g., for rollback), the query changes to:
```typescript
// Engine OFF:
{ status: { not: 'ARCHIVED' } }
```

This matches **both** `status: 'ACTIVE'` (new period) **and** `status: 'EXPIRED'` (old period). Users would see duplicate benefits — once for each historical period — all mixed together.

**Suggested fix** — when engine is off, explicitly filter to only ACTIVE status:
```typescript
const benefitWhereClause = engineEnabled
  ? {
      status: { not: 'ARCHIVED' },
      periodStatus: 'ACTIVE',
    }
  : {
      status: 'ACTIVE',  // ← Change from { not: 'ARCHIVED' } to explicit 'ACTIVE'
    };
```

Or alternatively, add `periodStatus: { in: ['ACTIVE', null] }` to exclude rows the engine created.

---

## 🟡 MEDIUM Issues (Fix Soon After Deployment)

### M-1: Dashboard Period Filter Uses Local Dates vs API's UTC Dates

**File**: `src/app/dashboard/page.tsx:230-293`
**Impact**: Benefit filtering on "This Month", "This Quarter" boundaries may include/exclude wrong benefits near midnight UTC.

The `getDateRange()` functions use local timezone:
```typescript
getDateRange: () => {
  const now = new Date();
  const year = now.getFullYear();    // local
  const month = now.getMonth();       // local
  return {
    start: new Date(year, month, 1),  // local midnight
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
},
```

But the benefit dates from the API are UTC. A benefit with `createdDate: "2026-04-01T00:00:00.000Z"` would be treated as March 31 in US timezones, potentially falling outside the "April" filter range.

**Suggested fix**: Use `Date.UTC()` or add `timeZone: 'UTC'` consistently in date comparisons.

### M-2: `ExpiredBenefitData` Interface Is Dead Code

**File**: `src/lib/benefit-engine/generate-benefits.ts:200-217`
**Impact**: Dead code adds maintenance burden and confusion.

The `ExpiredBenefitData` interface is exported but never used. The cron job defines its own inline `ProcessableBenefit` interface instead (line 256-269 of `route.ts`). This creates two separate type definitions for the same concept.

**Suggested fix**: Either use `ExpiredBenefitData` in the cron job (move the processing helper into `generate-benefits.ts`) or remove it.

### M-3: `timingSafeEqual` Throws on Length Mismatch — Silently Catches

**File**: `src/app/api/cron/reset-benefits/route.ts:106-113`
**Impact**: Low — correctly handled but could mask other errors.

```typescript
try {
  isValidSecret = timingSafeEqual(
    Buffer.from(authHeader),
    Buffer.from(expectedHeader)
  );
} catch {
  isValidSecret = false;
}
```

`timingSafeEqual` throws if buffer lengths differ. The `catch` block correctly sets `isValidSecret = false`, but it also silently catches any other possible error. This is acceptable for security code but could mask bugs during development.

---

## 🟢 LOW Issues (Nice To Have)

### L-1: Comment in `generate-benefits.ts` Claims Wrong Unique Constraint

**File**: `src/lib/benefit-engine/generate-benefits.ts:124`
**Impact**: Misleading documentation that hides the C-1 bug.

```typescript
// The unique constraint (userCardId, masterBenefitId, periodStart) prevents duplicates
```
This constraint does not exist. The actual unique constraint is `@@unique([userCardId, name])`.

### L-2: Duplicated Card Transformation Logic in Dashboard

**File**: `src/app/dashboard/page.tsx:427-456` and `614-641`
**Impact**: Two identical card transformation blocks that must be kept in sync.

The `loadUserCards` and `handleCardAdded` functions both contain identical 30-line card transformation blocks. If one is updated without the other, they'll drift apart.

**Suggested fix**: Extract a `transformApiCard(apiCard: ApiCard): CardData` utility function.

---

## Specification Alignment Analysis

| Spec Requirement | Status | Notes |
|---|---|---|
| Auto-create UserBenefit rows on card add | ✅ Pass | Works correctly for initial card add |
| Period calculation for 5 cadence types | ✅ Pass | All cadences calculate correctly, 61 tests pass |
| Anniversary-based calculations use renewalDate | ✅ Pass | CardmemberYear correctly uses renewal month/day |
| Leap year handling | ✅ Pass | Feb 29 → Feb 28 normalization works |
| Cron rolls over expired periods | ❌ **FAIL** | Blocked by C-1 (unique constraint) |
| skipDuplicates for idempotency | ⚠️ Partial | Works for initial generation; counterproductive for rollover (masks C-1) |
| CRON_SECRET auth preserved | ✅ Pass | Timing-safe comparison + rate limiting |
| Legacy path works when flag off | ⚠️ Partial | Legacy cron works; H-3 causes stale data in dashboard |
| Feature flag controls all new behavior | ⚠️ Partial | Correctly gates API+UI; H-3 shows data leakage on flag-off |
| History endpoint with pagination | ✅ Pass | Proper skip/take + count |
| Period badge on benefit cards | ✅ Pass | Conditional on `periodStart` existence |
| Edit/delete disabled in history view | ✅ Pass | `onEdit/onDelete/onMarkUsed` set to `undefined` |
| Loading/empty states | ✅ Pass | Both current and history views handle all states |

---

## Test Coverage Assessment

### What's Well-Tested (79 tests passing)
- ✅ All 5 cadence calculations with boundary values
- ✅ Leap year edge cases (Feb 28/29, century years)
- ✅ Mid-month card addition
- ✅ `calculateNextPeriod` for all cadence types
- ✅ `resolveCadence` fallback logic
- ✅ Empty catalog handling
- ✅ Mixed cadence types in one card
- ✅ `skipDuplicates` configuration verified
- ✅ Database error propagation
- ✅ Custom `claimingWindowEnd` (Amex Saks "0918" split)

### Missing Test Coverage (Recommended Additions)
1. **CRITICAL**: Integration test that simulates a full cron cycle (create benefit → expire → rollover) against the actual schema to catch the C-1 unique constraint issue
2. **HIGH**: `formatPeriodRange` tests with explicit UTC vs local timezone scenarios
3. **HIGH**: Test that toggling `BENEFIT_ENGINE_ENABLED` off doesn't expose expired period rows
4. **MEDIUM**: Cron job test with > CHUNK_SIZE expired benefits (batch boundary)
5. **MEDIUM**: Cron job test with concurrent invocations
6. **LOW**: `formatPeriodRange` with cross-year dates
7. **LOW**: Dashboard `transformBenefitForGrid` with various period field combinations

---

## Security Findings

| Check | Result |
|---|---|
| Auth on `/api/cards/add` | ✅ Direct JWT verification from session cookie |
| Auth on `/api/cards/my-cards` | ✅ Middleware injects `x-user-id` after JWT verification |
| Auth on `/api/benefits/history` | ✅ Same middleware pattern as my-cards |
| Auth on `/api/cron/reset-benefits` | ✅ CRON_SECRET with timing-safe comparison + rate limiting |
| SQL injection | ✅ All queries use Prisma parameterized queries |
| Input validation on card add | ✅ Validates masterCardId, renewalDate, customName, annualFee |
| Data exposure | ✅ History endpoint scoped to authenticated user's player |
| Feature flag can be spoofed | ✅ Server-side env var, not client-controllable |

---

## Summary of Required Actions

### Before Deployment (Blockers)
1. **C-1**: Migrate `@@unique([userCardId, name])` → `@@unique([userCardId, name, periodStart])` or equivalent
2. **H-1**: Add `timeZone: 'UTC'` to `formatPeriodRange` options
3. **H-2**: Add pagination to cron job's initial expired benefits query
4. **H-3**: Fix `my-cards` query to not expose expired period rows when flag is off

### After Deployment
5. **M-1**: Fix dashboard period filter timezone mismatch
6. **M-2**: Remove or use `ExpiredBenefitData` dead code
7. **M-3**: Consider more specific error handling in cron auth

### Nice To Have
8. **L-1**: Fix misleading comment about unique constraint
9. **L-2**: Extract shared card transformation utility
