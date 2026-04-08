# Sprint 1 — Benefit Engine Remediation: QA Code Review Report

**Reviewer:** QA Code Reviewer (Automated)
**Date:** 2026-04-10
**Scope:** All 24 files changed/created in Sprint 1
**Build Status:** ✅ PASS — `npm run build` succeeds, no TypeScript errors
**Test Status:** ✅ All Sprint 1 tests pass (date-math: 40+, hydrate-period: 11, resolveClaimingAmount: 7)
**Pre-existing failures:** 91 tests in 17 files (all pre-existing, not caused by Sprint 1)

---

## Executive Summary

Sprint 1 implements period-based benefit tracking gated behind `BENEFIT_ENGINE_ENABLED`. The code quality is **generally strong** — feature flag gating is consistent, date math is well-tested, and the deduplication utilities are well-architected. However, I found **1 CRITICAL** issue (Prisma relation name mismatch that will crash at runtime when engine is ON), **2 HIGH** issues, and **4 MEDIUM** issues.

| Severity | Count |
|----------|-------|
| CRITICAL | 1     |
| HIGH     | 2     |
| MEDIUM   | 4     |
| LOW      | 4     |

**Overall Assessment: PASS WITH FIXES**
The CRITICAL issue must be fixed before enabling the feature flag in production. HIGH issues should be addressed in Sprint 2.

---

## CRITICAL Issues

### CRIT-1: Prisma Relation Name Mismatch in `hydrate-period.ts` — Runtime Crash

**File:** `src/lib/benefit-engine/hydrate-period.ts`, line 92
**Impact:** When `BENEFIT_ENGINE_ENABLED=true`, every manual add and import will throw a Prisma runtime error. The `hydratePeriodFields` function is dead code right now (engine is OFF), but will crash the moment the flag is turned ON.

**What's Wrong:**
```typescript
// Line 90-98: hydrate-period.ts
const masterBenefit = await db.masterBenefit.findFirst({
  where: {
    card: {  // ❌ WRONG: The relation is named "masterCard", not "card"
      userCards: { some: { id: userCardId } },
    },
    name: { equals: benefitName, mode: 'insensitive' } as Prisma.StringFilter,
    isActive: true,
  },
});
```

**Schema reference (prisma/schema.prisma):**
```prisma
model MasterBenefit {
  masterCard  MasterCard  @relation(fields: [masterCardId], references: [id], onDelete: Cascade)
  //          ↑ relation name is "masterCard", not "card"
}
```

**Fix:**
Change `card:` to `masterCard:` on line 92:
```typescript
const masterBenefit = await db.masterBenefit.findFirst({
  where: {
    masterCard: {  // ✅ Correct relation name
      userCards: { some: { id: userCardId } },
    },
    ...
  },
});
```

**Why tests pass:** The hydrate-period tests mock `db.masterBenefit.findFirst`, so the mock bypasses the actual Prisma query validation. This bug can only be caught by an integration test or by enabling the engine and exercising the code path.

**Affected callers:**
- `src/app/api/benefits/add/route.ts` (line 168)
- `src/lib/import/committer.ts` (line 152)
- `src/features/import-export/lib/committer.ts` (line 152)

---

## HIGH Priority Issues

### HIGH-1: `deduplicateBenefits()` Deduplicates Across Cards by `masterBenefitId` Only

**File:** `src/lib/benefit-utils.ts`, lines 50-60
**Impact:** If a user has two cards of the same type (e.g., personal + authorized user card, or spouse scenario via household aggregation), benefits from different cards sharing the same `masterBenefitId` will be incorrectly collapsed into a single benefit. This causes **data loss in the UI** — benefits from the second card disappear.

**What's Wrong:**
```typescript
// Line 54-61: Only deduplicates by masterBenefitId
if (benefit.masterBenefitId) {
  if (benefit.periodStatus === 'ACTIVE') {
    if (!seen.has(benefit.masterBenefitId)) {
      seen.add(benefit.masterBenefitId);
      result.push(benefit);
    }
  }
}
```

**The same issue exists in `getUniqueBenefitCount()`** (lines 107-110).

**Note:** `calculations.ts:getHouseholdActiveCount()` correctly uses a composite key `${card.id}:${benefit.masterBenefitId}` (line 433). The `deduplicateBenefits` utility does not include card context.

**Mitigating Factor:** Currently, the dashboard and card detail pages scope benefits to a single selected card, so this bug is unlikely to manifest in the current UI. However, it's a latent bug that will break when:
- A "all cards" view is added
- Household-level benefit lists are displayed
- The function is used in a new context

**Suggested Fix:**
Add `userCardId` (or a similar card identifier) to the `DeduplicatableBenefit` interface and use composite dedup key:
```typescript
export interface DeduplicatableBenefit {
  id: string;
  userCardId?: string;         // Add this
  masterBenefitId?: string | null;
  periodStatus?: string | null;
}

// In deduplication:
const dedupKey = `${benefit.userCardId}:${benefit.masterBenefitId}`;
if (!seen.has(dedupKey)) { ... }
```

---

### HIGH-2: DELETE Handler Missing Engine-Managed Benefit Guard

**File:** `src/app/api/benefits/[id]/route.ts`, lines 196-250
**Impact:** The PATCH handler correctly blocks editing catalog-managed fields (lines 139-151), but the DELETE handler has **no equivalent guard**. When the engine is ON, users can delete engine-managed benefits, which the cron job may then try to regenerate, creating inconsistencies.

**What's Wrong:**
The DELETE handler archives any benefit regardless of `masterBenefitId`. Engine-managed benefits should either:
1. Be prevented from deletion (with a clear error message), OR
2. Be marked as "user-dismissed" so the cron doesn't re-create them

**Suggested Fix (Option 1 — Prevent Deletion):**
Add a guard before line 236:
```typescript
// Guard engine-managed benefits
if (featureFlags.BENEFIT_ENGINE_ENABLED && benefit.masterBenefitId) {
  return NextResponse.json(
    { success: false, error: 'Cannot delete catalog-managed benefits. They will reset automatically.' },
    { status: 403 }
  );
}
```

**Suggested Fix (Option 2 — Allow with User-Dismiss Flag):**
Track dismissal so cron skips re-creation. Requires a schema addition.

---

## MEDIUM Priority Issues

### MED-1: Import Committer Hardcodes `'OneTime'` as Default Cadence

**File:** `src/lib/import/committer.ts`, line 156 (and `src/features/import-export/lib/committer.ts`, same line)
**Impact:** Every imported benefit defaults to `'OneTime'` cadence for period calculation, even if the CSV contains a different cadence. This means imported benefits with Monthly/Annual cadences get incorrect period calculations when the engine is ON.

**What's Wrong:**
```typescript
const periodFields = await hydratePeriodFields(
  tx,
  userCardId,
  benefitName,
  'OneTime' // ❌ Hardcoded — should use the benefit's actual cadence from the import data
);
```

**Suggested Fix:**
```typescript
const periodFields = await hydratePeriodFields(
  tx,
  userCardId,
  benefitName,
  normalizedData.resetCadence || 'OneTime'  // Use imported cadence with fallback
);
```

---

### MED-2: `PrismaClient` Type in `hydrate-period.ts` Uses `any` Extensively

**File:** `src/lib/benefit-engine/hydrate-period.ts`, lines 23-30
**Impact:** The custom `PrismaClient` type interface uses `any` for both function parameters and return types, defeating TypeScript's type safety. This is what allowed CRIT-1 to go undetected.

```typescript
type PrismaClient = {
  masterBenefit: {
    findFirst: (args: any) => Promise<any>;  // ❌ Loses type safety
  };
  userCard: {
    findUnique: (args: any) => Promise<any>; // ❌ Loses type safety
  };
};
```

**Suggested Fix:**
Use Prisma's actual delegate types or at minimum type the return values:
```typescript
import type { Prisma } from '@prisma/client';
type PrismaLike = {
  masterBenefit: Pick<Prisma.MasterBenefitDelegate, 'findFirst'>;
  userCard: Pick<Prisma.UserCardDelegate, 'findUnique'>;
};
```
This would have caught CRIT-1 at compile time.

---

### MED-3: `filters.ts` Doesn't Handle `'UPCOMING'` Period Status

**File:** `src/lib/filters.ts`, lines 70-77
**Impact:** When engine is ON, the filter only differentiates between `'expired'` → `EXPIRED` and everything else → `ACTIVE`. There's no way for users to see `UPCOMING` period benefits (e.g., next month's benefits that have been pre-generated by the cron job).

```typescript
if (featureFlags.BENEFIT_ENGINE_ENABLED) {
  if (criteria.status?.includes('expired')) {
    where.periodStatus = 'EXPIRED';
  } else {
    where.periodStatus = 'ACTIVE';  // UPCOMING is never queryable
  }
}
```

**Suggested Fix:**
Add an `'upcoming'` status mapping:
```typescript
if (criteria.status?.includes('expired')) {
  where.periodStatus = 'EXPIRED';
} else if (criteria.status?.includes('upcoming')) {
  where.periodStatus = 'UPCOMING';
} else {
  where.periodStatus = 'ACTIVE';
}
```

---

### MED-4: Dashboard Benefits API (`/api/dashboard/benefits`) Doesn't Return Period/Engine Fields

**File:** `src/app/api/dashboard/benefits/route.ts`, lines 89-99
**Impact:** This API filters by `periodStatus = 'ACTIVE'` when engine is on (correct), but the response doesn't include `periodStatus`, `masterBenefitId`, `periodStart`, or `periodEnd`. If any client consumes this endpoint for deduplication or engine-aware display, it won't have the data it needs.

```typescript
const benefits = userBenefits.map((ub) => ({
  id: ub.id,
  name: ub.name,
  type: ub.type || 'credit_card',
  stickerValue: ub.stickerValue,
  // Missing: periodStatus, masterBenefitId, periodStart, periodEnd
}));
```

**Mitigating Factor:** The dashboard page currently uses the `cards/my-cards` and `cards/[id]` APIs which DO return these fields. But this endpoint should be consistent.

---

## LOW Priority Issues

### LOW-1: Verbose Debug Logging in Dashboard Benefits API

**File:** `src/app/api/dashboard/benefits/route.ts`, lines 23-26, 36, 57
**Impact:** `console.log` statements with full header dumps remain in production code. These should be removed or gated behind `featureFlags.DEBUG`.

```typescript
console.log('[Dashboard Benefits API] Request received', {
  userId: userId || 'MISSING',
  headerKeys: Array.from(request.headers.keys()),  // Potential info leak in logs
});
```

---

### LOW-2: Duplicate Committer Files

**Files:** `src/lib/import/committer.ts` and `src/features/import-export/lib/committer.ts`
**Impact:** These files are identical except for one import path. Maintenance burden — any fix must be applied to both. Consider consolidating to a single source of truth with re-export.

---

### LOW-3: `resolveClaimingAmount` Tests Use Dynamic Import Unnecessarily

**File:** `src/lib/benefit-engine/__tests__/date-math.test.ts`, lines 501-507
**Impact:** Minor — `resolveClaimingAmount` is already statically imported at the top of `date-math.ts`. The dynamic `beforeAll` import is unnecessary and inconsistent with how other functions in the same file are tested.

```typescript
// Unnecessarily uses dynamic import
let resolveClaimingAmount: typeof import('../date-math').resolveClaimingAmount;
beforeAll(async () => {
  const mod = await import('../date-math');
  resolveClaimingAmount = mod.resolveClaimingAmount;
});
```

---

### LOW-4: `EditBenefitModal` Doesn't Visually Distinguish Engine-Managed State When `benefitEngineEnabled` is False but `masterBenefitId` Exists

**File:** `src/features/benefits/components/modals/EditBenefitModal.tsx`, line 211
**Impact:** The `isEngineManaged` check is `!!benefit.masterBenefitId` which doesn't consider the `BENEFIT_ENGINE_ENABLED` flag. If a benefit was created while the engine was ON (has `masterBenefitId`) but then the engine is turned OFF, the modal will still show read-only fields. This is arguably correct from a data integrity perspective but could confuse users during a rollback scenario.

---

## Specification Alignment Analysis

| Spec Item | Status | Notes |
|-----------|--------|-------|
| cat-4: variableAmounts JSON field | ✅ Aligned | Schema, migration, seed, and resolution logic all correct |
| cat-4: resolveClaimingAmount | ✅ Aligned | Handles null, undefined, empty object, month 1-12 |
| cat-5: Resy → SEMI_ANNUAL | ✅ Aligned | Migration and seed both updated |
| cat-6: periodStatus filter | ✅ Aligned | Dashboard, mobile, recommendations all filter correctly |
| cat-7: hydratePeriodFields | ⚠️ Partial | Logic correct but CRIT-1 prevents it from working |
| cat-8: Edit guard | ✅ Aligned | Server-side PATCH blocks catalog fields correctly |
| cat-9: Deduplication | ⚠️ Partial | Works for single-card views but HIGH-1 cross-card issue |
| Feature flag gating | ✅ Aligned | All paths return legacy behavior when OFF |
| Tests ≥40 for date-math | ✅ Aligned | 40+ test cases covering all cadences |

---

## Feature Flag Gating Verification

| Component | Engine OFF Behavior | Verified |
|-----------|-------------------|----------|
| `hydratePeriodFields` | Returns all-null fields, no DB calls | ✅ |
| `deduplicateBenefits` | Returns input array unchanged | ✅ |
| `getUniqueBenefitCount` | Returns `benefits.length` | ✅ |
| `filterToActivePeriod` | Returns input array unchanged | ✅ |
| `buildBenefitWhereClause` | No `periodStatus` filter added | ✅ |
| Dashboard benefits API | No `periodStatus` filter | ✅ |
| Mobile sync API | No `periodStatus` filter | ✅ |
| Recommendations API | No `periodStatus` filter | ✅ |
| PATCH edit guard | No blocked fields check | ✅ |
| Dashboard dedup | No-op passthrough | ✅ |
| Card detail dedup | No-op passthrough | ✅ |
| `calculations.ts` functions | All use `filterToActivePeriod` → no-op | ✅ |
| `EditBenefitModal` | All fields editable (Note: LOW-4 edge case) | ⚠️ |

**Conclusion:** When `BENEFIT_ENGINE_ENABLED=false`, behavior is identical to pre-Sprint 1. No regressions detected.

---

## Test Coverage Analysis

### New Test Files
| File | Tests | Pass | Coverage Assessment |
|------|-------|------|---------------------|
| `date-math.test.ts` | 47 | ✅ 47/47 | Excellent — all cadences, leap years, boundaries |
| `hydrate-period.test.ts` | 11 | ✅ 11/11 | Good — engine on/off, variable amounts, edge cases |

### Coverage Gaps (Recommended Additional Tests)

1. **Integration test for `hydratePeriodFields` with real Prisma client** — Would have caught CRIT-1
2. **`deduplicateBenefits` unit tests** — No test file exists for `benefit-utils.ts`
3. **Cross-card dedup scenario test** — To validate HIGH-1 fix
4. **DELETE endpoint test for engine-managed benefits** — To validate HIGH-2 guard
5. **Import committer test with engine ON** — To verify period hydration works end-to-end
6. **`filters.ts` tests for `periodStatus` filtering** — No tests for Sprint 1 filter changes

---

## Build & Test Results

### Build
```
npm run build → ✅ SUCCESS
No TypeScript errors, all pages compile
```

### Tests
```
npm test → Test Files: 17 failed | 34 passed (51)
           Tests: 91 failed | 1656 passed | 59 skipped (1806)
```

**Sprint 1-specific tests:** All passing (58/58)
**Pre-existing failures (17 files, 91 tests):** Not caused by Sprint 1:
- `import-e2e.test.ts` — 12 failures (pre-existing mock issues)
- `admin-api.test.ts` — Skipped tests
- `edge-runtime-auth-fix.test.ts` — 2 failures (unrelated middleware test)
- `benefits/progress/route.test.ts` — 5 failures (pre-existing Prisma mock issue)
- `useCards.test.ts` — 1 failure (module resolution)

---

## Final Verdict

### PASS WITH FIXES

**Before enabling `BENEFIT_ENGINE_ENABLED=true`:**
1. ✅ Fix **CRIT-1** — Change `card:` to `masterCard:` in `hydrate-period.ts:92` (1-line fix)
2. ⚠️ Address **HIGH-1** — Add card context to dedup key (prevents future data loss)
3. ⚠️ Address **HIGH-2** — Add DELETE guard for engine-managed benefits

**Before Sprint 2:**
4. Fix **MED-1** — Use imported cadence instead of hardcoded `'OneTime'`
5. Fix **MED-2** — Strengthen `PrismaClient` type to prevent future relation mismatches
6. Add unit tests for `benefit-utils.ts` (deduplication functions)
7. Add integration test for `hydratePeriodFields` with actual Prisma query validation

---

*Report generated by QA Code Review Agent*
