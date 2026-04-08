# Sprint 1 — Benefit-Engine Remediation Spec

## Executive Summary & Goals

The benefit engine (gated by `BENEFIT_ENGINE_ENABLED=false`) introduces **period-based tracking** for user benefits — each `UserBenefit` row now represents a single period (e.g., "April 2026 Uber Credit") rather than the benefit itself. QA audit uncovered 9 issues (2 CRITICAL, 7 HIGH) where existing code assumes the legacy one-row-per-benefit model, causing double-counting, duplicate UI cards, and missing data on writes. This spec provides the exact remediation for each issue so the flag can be safely turned on.

**Primary Objectives:**
- Eliminate all double-counting and duplicate-display bugs caused by multi-period rows
- Ensure all write paths (manual add, import) populate period fields when the engine is enabled
- Lock down engine-managed benefits from user edits that would desync from the catalog
- Fix two catalog data errors (Uber December bonus, Saks/Resy cadence)
- Ensure all API read paths filter out `EXPIRED` period rows by default

**Success Criteria:**
- All 9 issues pass regression tests with `BENEFIT_ENGINE_ENABLED=true`
- Zero visual duplicates on dashboard or card detail pages
- Summary stats match unique-benefit counts, not row counts
- Manual-add and import flows produce fully-hydrated period rows
- Existing behavior with `BENEFIT_ENGINE_ENABLED=false` is unchanged (no regressions)

---

## Codebase Audit Results

### Files Verified to Exist

| Issue Ref | File Path | Exists? |
|-----------|-----------|---------|
| fe-1 | `src/features/cards/lib/calculations.ts` → `getHouseholdActiveCount()` (line 361) | ✅ |
| fe-2 | `src/app/dashboard/page.tsx` (1,213 lines) | ✅ |
| fe-3 | `src/app/(dashboard)/card/[id]/page.tsx` (699 lines) | ✅ |
| fe-4 | `src/features/benefits/components/modals/EditBenefitModal.tsx` (350 lines) | ✅ |
| api-1.1 | `src/app/api/dashboard/benefits/route.ts` | ✅ No periodStatus filter |
| api-1.2 | `src/app/api/mobile/sync/route.ts` | ✅ No periodStatus filter |
| api-1.3 | `src/app/api/benefits/recommendations/route.ts` (not `/api/recommendations/`) | ✅ No periodStatus filter |
| api-1.4 | `src/app/api/benefits/filters/route.ts` (not `/api/filters/`) | ✅ No periodStatus filter |
| api-1.5 | `src/app/api/benefits/progress/route.ts` | ✅ **Already filtered** via `getCurrentPeriod()` |
| api-1.6 | `src/app/api/admin/benefits/route.ts` | ✅ Queries MasterBenefit, not UserBenefit — **N/A** |
| api-1.7 | `src/app/api/benefits/[id]/status/route.ts` | ✅ **Already filtered** via `getPeriodBoundaries()` |
| api-2 | `src/app/api/benefits/add/route.ts` | ✅ No period fields set |
| api-3a | `src/lib/import/committer.ts` | ✅ No period fields set |
| api-3b | `src/features/import-export/lib/committer.ts` | ✅ No period fields set |
| cat-4 | `prisma/seed.ts` line 120-128 | ✅ Comment acknowledges Dec $35 but models $15/mo avg |
| cat-5 | `prisma/seed.ts` lines 84-100 (Resy) | ✅ Uses `FLEXIBLE_ANNUAL` not `SEMI_ANNUAL` |

### Routes Already Filtered (No Fix Needed)

| Route | Filtering Method |
|-------|-----------------|
| `/api/benefits/progress` | Uses `getCurrentPeriod()` — period-aware |
| `/api/benefits/[id]/status` | Uses `getPeriodBoundaries()` — period-aware |
| `/api/benefits/history` | Explicitly filters `periodStatus = 'EXPIRED'` |
| `/api/cron/reset-benefits` | Finds expired periods, creates new rows |
| `/api/admin/benefits` | Queries `MasterBenefit`, not `UserBenefit` |

### Revised API-1 Scope (4 endpoints, not 7)

Only these endpoints need the `periodStatus` filter added:
1. `src/app/api/dashboard/benefits/route.ts` — `findMany` at line 72, no filter
2. `src/app/api/mobile/sync/route.ts` — `findMany` at line 25, no filter
3. `src/app/api/benefits/recommendations/route.ts` — `findMany` at line 36, no filter
4. `src/app/api/benefits/filters/route.ts` — `buildBenefitWhereClause` at line 66, no filter

---

## Implementation Phases

### Phase 1 — Data & Catalog Fixes (no runtime behavior changes)
**Objective:** Correct catalog data so the engine calculates correct periods.
**Issues:** cat-4, cat-5
**Dependencies:** None
**Estimated scope:** 1 day

### Phase 2 — API Read-Path Fixes (server-side filtering)
**Objective:** All API endpoints filter out EXPIRED rows when engine is enabled.
**Issues:** api-1 (4 endpoints)
**Dependencies:** Phase 1 (correct catalog data for accurate testing)
**Estimated scope:** 1–2 days

### Phase 3 — API Write-Path Fixes (period hydration on creates)
**Objective:** Manual add and import flows populate period fields.
**Issues:** api-2, api-3
**Dependencies:** Phase 1 (correct catalog cadence values feed period calculation)
**Estimated scope:** 2 days

### Phase 4 — Frontend Deduplication & Display Fixes
**Objective:** Dashboard, card detail, and summary stats show unique benefits.
**Issues:** fe-1, fe-2, fe-3
**Dependencies:** Phase 2 (API already filters EXPIRED, reducing frontend work)
**Estimated scope:** 2 days

### Phase 5 — Edit Modal Lockdown
**Objective:** Prevent user edits that desync engine-managed benefits.
**Issues:** fe-4
**Dependencies:** None (can be done in parallel with Phase 4)
**Estimated scope:** 0.5 day

---

## Issue-by-Issue Fix Specifications

---

### CRITICAL: fe-1 — SummaryStats double-counts multi-period rows

**File:** `src/features/cards/lib/calculations.ts`
**Function:** `getHouseholdActiveCount()` (lines 361–408)

**Current Behavior (Buggy):**
```typescript
// Line 401: adds benefit.id to Set — each period row has a unique id
activeBenefits.add(benefit.id);
```
A benefit like "$15 Uber Cash" has 12 `UserBenefit` rows (one per month). Each has a unique `id`, so the Set counts 12 instead of 1.

**Expected Behavior (Fixed):**
When engine enabled, deduplicate by `masterBenefitId` and only count rows where `periodStatus === 'ACTIVE'`. Legacy benefits (no `masterBenefitId`) fall back to existing `id`-based logic.

**Pseudocode:**

```typescript
import { featureFlags } from '@/lib/feature-flags';

export function getHouseholdActiveCount(players: Player[]): number {
  const activeBenefits = new Set<string>();
  const now = new Date();

  if (!players || players.length === 0) return 0;

  const engineEnabled = featureFlags.BENEFIT_ENGINE_ENABLED;

  players.forEach((player) => {
    if (!player?.userCards) return;

    player.userCards.forEach((card) => {
      if (!card?.userBenefits) return;

      card.userBenefits.forEach((benefit) => {
        if (!benefit || benefit.isUsed) return;

        if (engineEnabled && benefit.masterBenefitId) {
          // ENGINE PATH: Only count ACTIVE period rows, dedup by masterBenefitId
          if (benefit.periodStatus === 'ACTIVE') {
            activeBenefits.add(benefit.masterBenefitId);
          }
        } else {
          // LEGACY PATH: Original behavior (dedup by id)
          const isPerpetual = benefit.expirationDate === null;
          const isNotExpired = benefit.expirationDate !== null
            && benefit.expirationDate > now;
          if (isPerpetual || isNotExpired) {
            activeBenefits.add(benefit.id);
          }
        }
      });
    });
  });

  return activeBenefits.size;
}
```

**Other functions in calculations.ts that also need the same dedup treatment:**

| Function | Line | Issue |
|----------|------|-------|
| `getHouseholdTotalCaptured()` | 317 | Sums value across all period rows — must sum only ACTIVE period |
| `getHouseholdROI()` | 272 | Aggregates across cards — indirectly affected if per-card value is inflated |
| `getTotalValueExtracted()` | 103 | Sums `resolveUnitValue()` — called per-card, needs ACTIVE filter |
| `getUncapturedValue()` | 130 | Same pattern — counts unused benefits, inflated by period rows |

**For each:** Apply the same branching pattern: if engine enabled and `masterBenefitId` exists, filter to `periodStatus === 'ACTIVE'` before aggregating. Legacy benefits process as-is.

**Type Changes Required:**
The `Player` → `UserCard` → `UserBenefit` type chain must include `periodStatus`, `masterBenefitId`, and `periodStart`/`periodEnd` optional fields. Check the existing type definition:

```typescript
// Ensure these fields exist on the benefit type used by calculations.ts
interface BenefitForCalc {
  id: string;
  isUsed: boolean;
  expirationDate: Date | null;
  stickerValue: number;
  userDeclaredValue: number | null;
  type: string | null;
  timesUsed: number;
  // NEW — must be added if missing
  masterBenefitId?: string | null;
  periodStatus?: string | null;
}
```

**Edge Cases:**
1. **Mixed household:** Player A has engine-enabled cards, Player B has legacy cards → both paths run within same loop, Set handles dedup correctly
2. **Benefit with masterBenefitId but no periodStatus:** Treat as legacy (fallback)
3. **All periods EXPIRED:** Benefit correctly excluded from active count
4. **UPCOMING periods:** Should NOT be counted as active — only `ACTIVE` counts
5. **Multiple cards with same MasterBenefit:** Each card is independent — dedup key should be `${userCardId}:${masterBenefitId}` to avoid cross-card dedup
6. **Zero benefits remaining after dedup:** Return 0 — no crash

**⚠️ Edge Case #5 is critical:** Two different cards (e.g., spouse's Amex Platinum + mine) both have "Uber Cash". These are separate benefits. Change dedup key to composite:

```typescript
activeBenefits.add(`${card.id}:${benefit.masterBenefitId}`);
```

**Tests Required:**
- Unit: `getHouseholdActiveCount` with engine ON, 12 period rows for 1 benefit → returns 1
- Unit: Same with 3 benefits × 12 periods each → returns 3
- Unit: Engine ON, mix of ACTIVE + EXPIRED + UPCOMING → only ACTIVE counted
- Unit: Engine OFF, same data → falls back to legacy count (12)
- Unit: Composite key — 2 cards same masterBenefitId → counts 2
- Unit: Legacy benefits (no masterBenefitId) counted by id as before

---

### CRITICAL: cat-4 — Amex Platinum Uber December $35 not modeled

**File:** `prisma/seed.ts` (line 120–128), `prisma/phase6c-cadence-mapping.ts` (line 60–63)
**Engine file:** `src/lib/benefit-engine/date-math.ts`

**Current Behavior (Buggy):**
```typescript
// seed.ts line 120-127
// $15×11 + $35 in Dec = $200/yr — modelled as a single CalendarYear benefit
{
  name: '$200 Uber Cash',
  stickerValue: 20000, // $200/yr
  claimingCadence: 'MONTHLY',
  claimingAmount: 1500, // $15/month average ← WRONG: Dec is $35
}
```

The comment even acknowledges the problem. The date-math engine uses `claimingAmount: 1500` for every month, meaning December generates a $15 period row instead of $35. The annual total appears correct ($200) but the per-period breakdown is wrong, causing users to think they only have $15 in December.

**Fix Strategy — Option A (Recommended): `variableAmounts` JSON field on MasterBenefit**

Add a nullable JSON field to `MasterBenefit` that overrides `claimingAmount` for specific months:

```prisma
model MasterBenefit {
  // ... existing fields ...
  variableAmounts Json?  // e.g., { "12": 3500 } → December = $35.00
}
```

**Migration:**
```sql
ALTER TABLE "MasterBenefit" ADD COLUMN "variableAmounts" JSONB;
```

**Seed data update:**
```typescript
{
  name: '$200 Uber Cash',
  stickerValue: 20000,
  claimingCadence: 'MONTHLY',
  claimingAmount: 1500, // default per-month
  variableAmounts: { "12": 3500 }, // December override: $35
}
```

**Date-math engine change:**
In `calculatePeriodForBenefit()` or wherever `claimingAmount` is read to set the period's value, add a lookup:

```typescript
function resolveClaimingAmount(
  baseAmount: number,
  variableAmounts: Record<string, number> | null,
  periodMonth: number // 1-12
): number {
  if (variableAmounts && String(periodMonth) in variableAmounts) {
    return variableAmounts[String(periodMonth)];
  }
  return baseAmount;
}
```

**Where to integrate:** The cron job at `src/app/api/cron/reset-benefits/route.ts` creates new period rows. When it calls `calculateNextPeriod()` and creates the `UserBenefit` row, it must use `resolveClaimingAmount()` to set the correct `stickerValue` for that period.

**Fix Strategy — Option B (Simpler but less flexible): Two separate MasterBenefit rows**

Split "$200 Uber Cash" into:
- "$15 Uber Cash (Jan–Nov)" — `claimingCadence: 'MONTHLY'`, `claimingAmount: 1500`
- "$35 Uber Cash (Dec)" — `claimingCadence: 'ONE_TIME'` with custom periodStart in December

**Recommendation:** Option A. It's more general (handles any future variable-amount benefits), keeps the catalog cleaner (one row per benefit), and the JSON field is low-cost.

**Edge Cases:**
1. **variableAmounts is null:** Use `claimingAmount` for all periods (backward compatible)
2. **variableAmounts has invalid month keys:** Validate on seed/admin write — keys must be "1"–"12"
3. **Quarterly/semi-annual cadence with variableAmounts:** The month key refers to the period's start month
4. **Non-monthly cadence:** `variableAmounts` only applies to MONTHLY cadence initially (validate)
5. **Historical periods already seeded with $15 in December:** Migration note — re-run period generation for affected benefits after schema change

**Tests Required:**
- Unit: `resolveClaimingAmount(1500, { "12": 3500 }, 12)` → 3500
- Unit: `resolveClaimingAmount(1500, { "12": 3500 }, 6)` → 1500
- Unit: `resolveClaimingAmount(1500, null, 12)` → 1500
- Integration: Cron job creates December period with $35 for Uber
- Integration: Cron job creates January period with $15 for Uber
- Seed: Re-seed produces correct variableAmounts for Uber

---

### HIGH: api-1 — 4 API endpoints missing periodStatus filter

#### api-1.1: `src/app/api/dashboard/benefits/route.ts`

**Current Query (line 72–79):**
```typescript
const userBenefits = await prisma.userBenefit.findMany({
  where: {
    userCardId: { in: cardIds },
  },
  take: 100,
});
```

**Fixed Query:**
```typescript
import { featureFlags } from '@/lib/feature-flags';

const whereClause: Prisma.UserBenefitWhereInput = {
  userCardId: { in: cardIds },
};

if (featureFlags.BENEFIT_ENGINE_ENABLED) {
  whereClause.OR = [
    { periodStatus: 'ACTIVE' },
    { periodStatus: null },  // legacy rows without period tracking
  ];
}

const userBenefits = await prisma.userBenefit.findMany({
  where: whereClause,
  take: 100,
});
```

**Response shape change:** None — existing fields remain the same. Fewer rows returned.

---

#### api-1.2: `src/app/api/mobile/sync/route.ts`

**Current Query (line 25–27):**
```typescript
const userBenefits = await prisma.userBenefit.findMany({
  where: { playerId: player.id },
});
```

**Fixed Query:**
```typescript
import { featureFlags } from '@/lib/feature-flags';

const benefitWhere: Prisma.UserBenefitWhereInput = {
  playerId: player.id,
};

if (featureFlags.BENEFIT_ENGINE_ENABLED) {
  benefitWhere.OR = [
    { periodStatus: 'ACTIVE' },
    { periodStatus: null },
  ];
}

const userBenefits = await prisma.userBenefit.findMany({
  where: benefitWhere,
});
```

---

#### api-1.3: `src/app/api/benefits/recommendations/route.ts`

**Current Query (line 36–38):**
```typescript
prisma.userBenefit.findMany({
  where: { playerId },
}),
```

**Fixed Query:**
```typescript
prisma.userBenefit.findMany({
  where: {
    playerId,
    ...(featureFlags.BENEFIT_ENGINE_ENABLED
      ? { OR: [{ periodStatus: 'ACTIVE' }, { periodStatus: null }] }
      : {}),
  },
}),
```

---

#### api-1.4: `src/app/api/benefits/filters/route.ts`

**Current:** Delegates to `buildBenefitWhereClause()` from `src/lib/filters.ts`.

**Fix location:** `src/lib/filters.ts` — the `buildBenefitWhereClause()` function.

Add to the where clause builder:

```typescript
import { featureFlags } from '@/lib/feature-flags';

export function buildBenefitWhereClause(
  criteria: FilterCriteria,
  playerId: string
): Prisma.UserBenefitWhereInput {
  const where: Prisma.UserBenefitWhereInput = {
    playerId,
    // ... existing filter logic ...
  };

  // Period filter: exclude EXPIRED when engine is on
  if (featureFlags.BENEFIT_ENGINE_ENABLED) {
    where.OR = [
      { periodStatus: 'ACTIVE' },
      { periodStatus: null },
    ];
    // If user explicitly filters for 'expired' status, override:
    if (criteria.status?.includes('expired')) {
      delete where.OR;
      where.periodStatus = 'EXPIRED';
    }
  }

  return where;
}
```

**Edge Cases for all api-1 fixes:**
1. **Legacy rows (periodStatus = NULL):** Always included — the `OR` clause handles this
2. **UPCOMING rows:** Excluded from default views — users see only current period
3. **Race condition — cron marks EXPIRED while API reads:** Prisma read snapshot is consistent within a query; no partial state
4. **Empty result after filtering:** Return empty array, not error
5. **Admin override:** Admin endpoints (already excluded from scope) should see all statuses
6. **Pagination interaction in filters route:** Count query must use same where clause as data query
7. **`take: 100` limit in dashboard route:** After filtering, could return <100 even when more ACTIVE rows exist — consider removing hard limit or adjusting

**Tests Required (per endpoint):**
- Unit: With engine OFF, returns all rows (no filter applied)
- Unit: With engine ON, excludes EXPIRED rows
- Unit: With engine ON, includes NULL periodStatus rows (legacy)
- Unit: With engine ON, includes ACTIVE rows
- Unit: With engine ON, excludes UPCOMING rows
- Integration: Dashboard shows correct count after filter

---

### HIGH: api-2 — POST /benefits/add doesn't set period fields

**File:** `src/app/api/benefits/add/route.ts`

**Current Behavior (line 173–185):**
```typescript
const benefit = await prisma.userBenefit.create({
  data: {
    userCardId,
    playerId: card.player.id,
    name,
    type,
    stickerValue,
    resetCadence,
    userDeclaredValue,
    expirationDate,
    status: 'ACTIVE',
    // ← NO periodStart, periodEnd, periodStatus
  },
});
```

**Expected Behavior:**
When engine enabled, calculate period fields using `calculatePeriodForBenefit()` and set them on the new row.

**Pseudocode:**
```typescript
import { featureFlags } from '@/lib/feature-flags';
import { calculatePeriodForBenefit } from '@/lib/benefit-engine/date-math';

// ... after validation, before prisma.create ...

let periodData: {
  periodStart?: Date;
  periodEnd?: Date | null;
  periodStatus?: string;
} = {};

if (featureFlags.BENEFIT_ENGINE_ENABLED) {
  // Look up if a MasterBenefit exists for this card + benefit name
  const masterBenefit = await prisma.masterBenefit.findFirst({
    where: {
      card: {
        userCards: { some: { id: userCardId } },
      },
      name: { equals: name, mode: 'insensitive' },
    },
  });

  const now = new Date();
  
  // Get card renewal date for cardmember year calculation
  const renewalDate = card.renewalDate || card.createdAt;
  
  // Use MasterBenefit cadence if available, otherwise map from user-supplied resetCadence
  const claimingCadence = masterBenefit?.claimingCadence || null;
  const effectiveResetCadence = masterBenefit?.resetCadence || resetCadence;
  const claimingWindowEnd = masterBenefit?.claimingWindowEnd || null;

  const period = calculatePeriodForBenefit(
    claimingCadence,
    effectiveResetCadence,
    now,
    renewalDate,
    claimingWindowEnd
  );

  periodData = {
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    periodStatus: 'ACTIVE',
  };
}

const benefit = await prisma.userBenefit.create({
  data: {
    userCardId,
    playerId: card.player.id,
    name,
    type,
    stickerValue,
    resetCadence,
    userDeclaredValue,
    expirationDate,
    status: 'ACTIVE',
    ...periodData,
    // Also link to MasterBenefit if found
    ...(masterBenefit ? { masterBenefitId: masterBenefit.id } : {}),
  },
});
```

**Response Shape Change:**
Add period fields to the response:

```typescript
return NextResponse.json({
  success: true,
  benefit: {
    // ... existing fields ...
    periodStart: benefit.periodStart?.toISOString() || null,
    periodEnd: benefit.periodEnd?.toISOString() || null,
    periodStatus: benefit.periodStatus || null,
    masterBenefitId: benefit.masterBenefitId || null,
  },
}, { status: 201 });
```

**Edge Cases:**
1. **No matching MasterBenefit:** User adds a custom benefit not in catalog → set period from resetCadence alone, no masterBenefitId
2. **Engine ON but resetCadence is 'OneTime':** Period is perpetual (periodEnd = null, periodStart = now)
3. **Duplicate check with periods:** Current duplicate check (line 148–157) uses `name + status: 'ACTIVE'`. Must also consider periodStart to avoid blocking legitimate multi-period creation. Add `periodStart: periodData.periodStart || null` to the uniqueness query.
4. **User adds benefit mid-period:** Period boundaries snap to current period (e.g., adding June 15 → period is June 1–30)
5. **Card has no renewalDate:** Fall back to `card.createdAt`

**Tests Required:**
- Unit: Engine ON → created benefit has periodStart, periodEnd, periodStatus
- Unit: Engine OFF → created benefit has null period fields
- Unit: Matching MasterBenefit found → masterBenefitId set
- Unit: No matching MasterBenefit → masterBenefitId null, period still calculated
- Unit: OneTime cadence → periodEnd is null
- Integration: Created benefit appears in dashboard (not filtered out)

---

### HIGH: api-3 — Import committer doesn't set period fields

**Files:**
- `src/lib/import/committer.ts` (primary — line 150–168)
- `src/features/import-export/lib/committer.ts` (duplicate — same code)

**Current Behavior (line 150–168 in committer.ts):**
```typescript
const benefit = await tx.userBenefit.create({
  data: {
    userCardId,
    playerId,
    name: benefitName,
    type: normalizedData.benefitType,
    stickerValue: normalizedData.stickerValue,
    // ... no periodStart, periodEnd, periodStatus
    resetCadence: 'OneTime', // hardcoded default
  },
});
```

**Expected Behavior:**
When engine enabled, resolve cadence from matched MasterBenefit and calculate period fields.

**Pseudocode:**

```typescript
import { featureFlags } from '@/lib/feature-flags';
import { calculatePeriodForBenefit } from '@/lib/benefit-engine/date-math';

// Inside commitBenefit(), before tx.userBenefit.create():

let periodData: Record<string, any> = {};
let resolvedResetCadence = 'OneTime';
let resolvedMasterBenefitId: string | undefined;

if (featureFlags.BENEFIT_ENGINE_ENABLED) {
  // Try to match imported benefit name to MasterBenefit catalog
  const masterBenefit = await tx.masterBenefit.findFirst({
    where: {
      card: {
        userCards: { some: { id: userCardId } },
      },
      name: { equals: benefitName, mode: 'insensitive' },
      isActive: true,
    },
  });

  if (masterBenefit) {
    resolvedResetCadence = masterBenefit.resetCadence || 'OneTime';
    resolvedMasterBenefitId = masterBenefit.id;

    // Get card for renewal date
    const card = await tx.userCard.findUnique({
      where: { id: userCardId },
      select: { renewalDate: true, createdAt: true },
    });
    const renewalDate = card?.renewalDate || card?.createdAt || new Date();

    const period = calculatePeriodForBenefit(
      masterBenefit.claimingCadence,
      resolvedResetCadence,
      new Date(),
      renewalDate,
      masterBenefit.claimingWindowEnd
    );

    periodData = {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      periodStatus: 'ACTIVE',
      masterBenefitId: masterBenefit.id,
    };
  }
}

const benefit = await tx.userBenefit.create({
  data: {
    userCardId,
    playerId,
    name: benefitName,
    type: normalizedData.benefitType,
    stickerValue: normalizedData.stickerValue,
    userDeclaredValue: normalizedData.declaredValue,
    expirationDate: normalizedData.expirationDate
      ? new Date(normalizedData.expirationDate)
      : null,
    isUsed: normalizedData.usage === 'Claimed',
    resetCadence: resolvedResetCadence,
    importedFrom: importJobId,
    importedAt: new Date(),
    version: 1,
    ...periodData,
  },
});
```

**⚠️ Important:** Both files must be updated identically. Consider extracting a shared `hydratePeriodFields()` utility used by both add and import paths.

**Shared utility proposal:**

```typescript
// src/lib/benefit-engine/hydrate-period.ts
export async function hydratePeriodFields(
  tx: Prisma.TransactionClient | typeof prisma,
  userCardId: string,
  benefitName: string,
  resetCadence: string
): Promise<{
  periodStart: Date | null;
  periodEnd: Date | null;
  periodStatus: string | null;
  masterBenefitId: string | null;
  resolvedResetCadence: string;
}> {
  if (!featureFlags.BENEFIT_ENGINE_ENABLED) {
    return {
      periodStart: null,
      periodEnd: null,
      periodStatus: null,
      masterBenefitId: null,
      resolvedResetCadence: resetCadence,
    };
  }
  // ... lookup MasterBenefit, calculate period, return fields
}
```

**Edge Cases:**
1. **Imported benefit name doesn't match any MasterBenefit:** Create without period fields (legacy row) — still functional
2. **Case sensitivity on name match:** Use `mode: 'insensitive'` in Prisma query
3. **Import within transaction:** MasterBenefit lookup must use `tx` (transaction client), not global `prisma`
4. **Batch import with 100+ benefits:** Each goes through MasterBenefit lookup — consider caching the catalog in memory at the start of the transaction
5. **Duplicate unique constraint:** Import may create a row with same `(userCardId, name, periodStart)` — handle with upsert or check-before-create
6. **Two committer files:** Both must be updated. Long-term: deduplicate to a single module.

**Tests Required:**
- Unit: Engine ON + MasterBenefit match → period fields populated
- Unit: Engine ON + no MasterBenefit match → period fields null, no crash
- Unit: Engine OFF → period fields null
- Integration: Import 5 benefits, verify period fields on each
- Integration: Import same benefit twice → no unique constraint violation

---

### HIGH: fe-2 — Dashboard shows duplicate benefit cards per period

**File:** `src/app/dashboard/page.tsx`

**Current Behavior:**
`BenefitsGrid` (line 1148) renders `displayBenefits` directly. The `displayBenefits` array contains one entry per `UserBenefit` row. With engine enabled, "$15 Uber Cash" appears as 12 cards (Jan–Dec).

The `benefits` state is populated from `/api/cards/my-cards` response (line 405+), which includes all UserBenefit rows per card.

**Expected Behavior:**
When engine enabled, group benefits by `masterBenefitId` and display only the ACTIVE period row. Benefits without `masterBenefitId` display as-is.

**Fix Location:** Add a deduplication step in the `filteredBenefits` `useMemo` (line 345) or add a new `useMemo` after it.

**Pseudocode:**

```typescript
// After filteredBenefits useMemo (around line 392)

const deduplicatedBenefits = useMemo(() => {
  if (!benefitEngineEnabled) return filteredBenefits;

  const seen = new Map<string, BenefitData>();   // masterBenefitId → ACTIVE row
  const result: BenefitData[] = [];

  for (const benefit of filteredBenefits) {
    if (benefit.masterBenefitId) {
      // Engine-managed: keep only the ACTIVE period row
      if (benefit.periodStatus === 'ACTIVE') {
        const key = `${benefit.masterBenefitId}`;
        if (!seen.has(key)) {
          seen.set(key, benefit);
          result.push(benefit);
        }
        // If duplicate ACTIVE rows exist (shouldn't, but defensive),
        // keep the first one encountered
      }
      // Skip EXPIRED and UPCOMING — already filtered by API,
      // but double-safe here
    } else {
      // Legacy benefit: show as-is
      result.push(benefit);
    }
  }

  return result;
}, [filteredBenefits, benefitEngineEnabled]);

// Update displayBenefits to use deduplicatedBenefits
const displayBenefits = viewMode === 'history'
  ? historyBenefits
  : deduplicatedBenefits; // ← was filteredBenefits
```

**Summary stats (line 803):** Already computed from `displayBenefits`, so fixing `displayBenefits` fixes the stats automatically.

**Where `benefitEngineEnabled` comes from:** Already in state (line 67 of dashboard page declares the field in `BenefitData`, and the API response includes `benefitEngineEnabled` flag at line 108). Verify it's being read:

```typescript
// Around line 440-460 in the loadUserCards effect:
if (data.benefitEngineEnabled) {
  setBenefitEngineEnabled(true);
}
```

**Edge Cases:**
1. **Two ACTIVE rows for same masterBenefitId:** Shouldn't happen (cron ensures one ACTIVE per benefit), but keep first seen
2. **Benefit transitions from ACTIVE to EXPIRED during user session:** Stale data until next API fetch — acceptable
3. **ViewMode = 'history':** History view should show ALL expired periods (not deduplicated) — the dedup only applies to 'current' view
4. **Period selector interaction:** If user selects "This Month" and no ACTIVE row falls in that month, benefit disappears — correct behavior
5. **Card switching:** When user switches cards, benefits array reloads — dedup re-runs

**Tests Required:**
- Component: 12 period rows with same masterBenefitId, 1 ACTIVE → renders 1 card
- Component: 3 unique masterBenefitIds, each with 12 rows → renders 3 cards
- Component: Engine OFF → all rows rendered
- Component: Mix of engine + legacy benefits → correct count
- Component: History view → no dedup applied

---

### HIGH: fe-3 — Card detail page inflates benefit count

**File:** `src/app/(dashboard)/card/[id]/page.tsx`

**Current Behavior (line 610):**
```jsx
({status === 'all' ? benefits.length : benefits.filter(b => getBenefitStatus(b) === status).length})
```
`benefits.length` counts all rows including multiple periods.

**Expected Behavior:**
Count unique benefits (by `masterBenefitId` for engine-managed, by `id` for legacy).

**Pseudocode:**

```typescript
// Add a utility function at the top of the file:
function getUniqueBenefitCount(
  benefits: BenefitData[],
  engineEnabled: boolean,
  statusFilter?: string
): number {
  if (!engineEnabled) {
    // Legacy: count rows, optionally filtered by status
    if (!statusFilter || statusFilter === 'all') return benefits.length;
    return benefits.filter(b => getBenefitStatus(b) === statusFilter).length;
  }

  // Engine: deduplicate by masterBenefitId, count only ACTIVE
  const seen = new Set<string>();
  let count = 0;

  for (const b of benefits) {
    if (b.masterBenefitId) {
      if (b.periodStatus !== 'ACTIVE') continue;
      const key = b.masterBenefitId;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    // Legacy benefit or first ACTIVE engine benefit
    if (!statusFilter || statusFilter === 'all' || getBenefitStatus(b) === statusFilter) {
      count++;
    }
  }

  return count;
}

// Replace line 610:
// Before: benefits.length
// After:  getUniqueBenefitCount(benefits, benefitEngineEnabled, 'all')

// And for filtered counts:
// Before: benefits.filter(b => getBenefitStatus(b) === status).length
// After:  getUniqueBenefitCount(benefits, benefitEngineEnabled, status)
```

**Also fix the benefits list/grid rendering** — apply the same dedup as fe-2:

```typescript
const deduplicatedBenefits = useMemo(() => {
  if (!benefitEngineEnabled) return benefits;

  const seen = new Map<string, BenefitData>();
  const result: BenefitData[] = [];

  for (const benefit of benefits) {
    if (benefit.masterBenefitId && benefit.periodStatus === 'ACTIVE') {
      if (!seen.has(benefit.masterBenefitId)) {
        seen.set(benefit.masterBenefitId, benefit);
        result.push(benefit);
      }
    } else if (!benefit.masterBenefitId) {
      result.push(benefit);
    }
  }

  return result;
}, [benefits, benefitEngineEnabled]);
```

**State Changes:** Need to load `benefitEngineEnabled` — either from API response or from a client-accessible config endpoint. The `/api/cards/my-cards` response may already include it; verify and pass through.

**Edge Cases:**
1. **All filter tab count:** Must use dedup count, not raw `benefits.length`
2. **getBenefitStatus() with periodStatus:** The function (line 140) uses `expirationDate` — for engine benefits, `periodEnd` is the effective expiration. Map `periodEnd` to `expirationDate` or update `getBenefitStatus()`.
3. **benefitCount prop (line 662):** `benefitCount={benefits.length}` — replace with dedup count

**Tests Required:**
- Component: 36 total rows (3 benefits × 12 periods) → "All" tab shows 3
- Component: Per-status counts are accurate after dedup
- Component: Engine OFF → counts match raw `benefits.length`

---

### HIGH: fe-4 — EditBenefitModal allows editing engine-managed fields

**File:** `src/features/benefits/components/modals/EditBenefitModal.tsx`

**Current Behavior:**
All benefits have editable `name` (line 249), `resetCadence` (line 299), `userDeclaredValue` (line 284), and `expirationDate` (line 311). The `type` and `stickerValue` fields are already read-only (lines 264, 274).

**Expected Behavior:**
When a benefit has `masterBenefitId` (engine-managed), make `name`, `resetCadence`, and `expirationDate` read-only. Only `userDeclaredValue` (personal valuation) and `isUsed` remain editable.

**Interface Change:**

```typescript
interface UserBenefit {
  id: string;
  name: string;
  type: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  resetCadence: string;
  expirationDate: Date | string | null;
  // NEW
  masterBenefitId?: string | null;
}
```

**Props Change:**

```typescript
interface EditBenefitModalProps {
  benefit: UserBenefit | null;
  isOpen: boolean;
  onClose: () => void;
  onBenefitUpdated?: (benefit: any) => void;
}
```

**Rendering Logic:**

```tsx
const isEngineManaged = !!benefit?.masterBenefitId;

// Benefit Name — conditionally read-only
{isEngineManaged ? (
  <div>
    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
      Benefit Name
      <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
        (managed by catalog)
      </span>
    </label>
    <div className="p-3 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text)]">
      {benefit.name}
    </div>
  </div>
) : (
  <Input
    label="Benefit Name"
    type="text"
    name="name"
    value={formData.name}
    onChange={handleChange}
    error={errors.name}
    disabled={isLoading}
    required
  />
)}

// Reset Cadence — conditionally read-only
{isEngineManaged ? (
  <div>
    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
      Reset Cadence
      <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
        (managed by catalog)
      </span>
    </label>
    <div className="p-3 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text)]">
      {cadenceOptions.find(o => o.value === benefit.resetCadence)?.label || benefit.resetCadence}
    </div>
  </div>
) : (
  <UnifiedSelect ... />
)}

// Expiration Date — conditionally read-only
{isEngineManaged ? (
  <div>
    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
      Period End
    </label>
    <div className="p-3 rounded-md bg-[var(--color-bg-secondary)] text-[var(--color-text)]">
      {benefit.expirationDate
        ? new Date(benefit.expirationDate).toLocaleDateString()
        : 'No expiration'}
    </div>
  </div>
) : (
  <Input type="date" ... />
)}
```

**Submit handler change:**
When engine-managed, only send `userDeclaredValue` in the PATCH body:

```typescript
const patchBody = isEngineManaged
  ? { userDeclaredValue }  // only allowed field
  : {
      name: formData.name.trim(),
      userDeclaredValue,
      expirationDate: formData.expirationDate || undefined,
      resetCadence: formData.resetCadence,
    };
```

**Server-side enforcement (PATCH `/api/benefits/[id]`):**
Also add server-side validation — if the benefit has `masterBenefitId`, reject attempts to change `name`, `resetCadence`, `type`, or `stickerValue`:

```typescript
// In PATCH handler:
if (existingBenefit.masterBenefitId) {
  const blockedFields = ['name', 'resetCadence', 'type', 'stickerValue'];
  const attempted = blockedFields.filter(f => body[f] !== undefined);
  if (attempted.length > 0) {
    return NextResponse.json({
      success: false,
      error: `Cannot modify catalog-managed fields: ${attempted.join(', ')}`,
    }, { status: 400 });
  }
}
```

**Edge Cases:**
1. **Benefit transitions from legacy to engine-managed:** After linking to MasterBenefit, modal switches to read-only mode
2. **User clicks edit on a benefit that was just engine-linked:** Modal re-renders correctly with `masterBenefitId` present
3. **Admin users:** May need an override — out of scope for this sprint, but add a TODO
4. **userDeclaredValue higher than stickerValue:** Existing validation handles this (line 264 in current code)
5. **Cancel without saving:** No state change — correct

**Tests Required:**
- Component: Benefit with masterBenefitId → name field is read-only div, not input
- Component: Benefit without masterBenefitId → name field is editable input
- Component: Engine-managed submit → only userDeclaredValue in request body
- Component: Legacy submit → all fields in request body
- API: PATCH with masterBenefitId + name change → 400 error
- API: PATCH with masterBenefitId + userDeclaredValue change → 200 success

---

### HIGH: cat-5 — Semi-annual benefits marked as ANNUAL

**File:** `prisma/seed.ts` (lines 84–100)

**Current Behavior:**
Resy Credit entries use `claimingCadence: 'FLEXIBLE_ANNUAL'`:

```typescript
// Line 86-100
{
  name: 'Resy Credit (Jan–Jun)',
  claimingCadence: 'FLEXIBLE_ANNUAL', // ← WRONG
  claimingAmount: 5000,
},
{
  name: 'Resy Credit (Jul–Dec)',
  claimingCadence: 'FLEXIBLE_ANNUAL', // ← WRONG
  claimingAmount: 5000,
},
```

Saks Credit entries (lines 131–146) already use `claimingCadence: 'SEMI_ANNUAL'` — these are correct.

**Fix:**
Update Resy entries to use `SEMI_ANNUAL`:

```typescript
{
  name: 'Resy Credit (Jan–Jun)',
  claimingCadence: 'SEMI_ANNUAL',    // ← FIXED
  claimingAmount: 5000,
},
{
  name: 'Resy Credit (Jul–Dec)',
  claimingCadence: 'SEMI_ANNUAL',    // ← FIXED
  claimingAmount: 5000,
},
```

**Also update `prisma/phase6c-cadence-mapping.ts`** (lines 43–48):
```typescript
// Verify these match — currently:
{ name: 'Resy Credit (Jan–Jun)', ... }
{ name: 'Resy Credit (Jul–Dec)', ... }
// Ensure claimingCadence is 'SEMI_ANNUAL' here too
```

**Database Migration:**
No schema change needed — `claimingCadence` is an existing string field. However, existing MasterBenefit records in production need a data migration:

```sql
-- Data migration: Fix Resy cadence
UPDATE "MasterBenefit"
SET "claimingCadence" = 'SEMI_ANNUAL'
WHERE "name" LIKE 'Resy Credit%'
  AND "claimingCadence" = 'FLEXIBLE_ANNUAL';
```

**Edge Cases:**
1. **Existing UserBenefit period rows generated with wrong cadence:** May need to be regenerated — the cron job will create correct periods going forward, but historical periods have wrong boundaries
2. **`claimingWindowEnd` for Resy:** Resy doesn't use a custom window (unlike Saks with '0918') — verify no `claimingWindowEnd` is set for Resy
3. **Gold Card Resy vs Platinum Resy:** Check if both cards have Resy — apply fix to all

**Tests Required:**
- Seed: Re-seed and verify Resy MasterBenefit has `claimingCadence = 'SEMI_ANNUAL'`
- Unit: `calculatePeriodForBenefit('SEMI_ANNUAL', ...)` for January → returns Jan 1–Jun 30
- Unit: Same for July → returns Jul 1–Dec 31
- Integration: Cron generates correct semi-annual periods for Resy

---

## Database Changes Summary

### New Migration: Add `variableAmounts` to MasterBenefit

```sql
-- prisma/migrations/YYYYMMDD_add_variable_amounts/migration.sql

-- cat-4: Support variable per-period amounts (e.g., Uber December $35)
ALTER TABLE "MasterBenefit" ADD COLUMN "variableAmounts" JSONB;

-- cat-5: Fix Resy cadence data
UPDATE "MasterBenefit"
SET "claimingCadence" = 'SEMI_ANNUAL'
WHERE "name" LIKE 'Resy Credit%'
  AND "claimingCadence" = 'FLEXIBLE_ANNUAL';
```

**Prisma schema change:**
```prisma
model MasterBenefit {
  // ... existing fields ...
  variableAmounts Json?  // NEW: { "monthNumber": amountInCents }
}
```

**No other schema changes needed** — `UserBenefit` already has `periodStart`, `periodEnd`, `periodStatus`, `masterBenefitId`.

---

## API Contract Changes

| Endpoint | Change | Breaking? |
|----------|--------|-----------|
| `POST /api/benefits/add` | Response adds `periodStart`, `periodEnd`, `periodStatus`, `masterBenefitId` fields (nullable) | ❌ Additive |
| `POST /api/dashboard/benefits` | Returns fewer rows (EXPIRED filtered out) when engine ON | ⚠️ Behavioral — clients get fewer items |
| `GET /api/mobile/sync` | Returns fewer rows when engine ON | ⚠️ Behavioral |
| `GET /api/benefits/recommendations` | Returns fewer rows when engine ON | ⚠️ Behavioral |
| `POST /api/benefits/filters` | Returns fewer rows when engine ON; `expired` status now maps to `periodStatus = 'EXPIRED'` | ⚠️ Behavioral |
| `PATCH /api/benefits/[id]` | Rejects name/resetCadence/type/stickerValue changes when benefit has masterBenefitId | ⚠️ New 400 error |

**None are breaking** because all changes are gated behind `BENEFIT_ENGINE_ENABLED=true`. When false, all behavior is identical to current.

---

## Frontend Component Changes Summary

| Component | Props Change | State Change | Render Change |
|-----------|-------------|-------------|---------------|
| `calculations.ts` | `BenefitForCalc` type adds `masterBenefitId`, `periodStatus` | — | Dedup logic in 5 functions |
| `dashboard/page.tsx` | — | New `deduplicatedBenefits` useMemo | `displayBenefits` uses deduped data |
| `card/[id]/page.tsx` | — | New `deduplicatedBenefits` useMemo | Count displays use dedup utility |
| `EditBenefitModal.tsx` | `UserBenefit` adds `masterBenefitId` | `isEngineManaged` derived | Conditional read-only fields |

---

## Edge Cases & Error Handling (Cross-Cutting)

| # | Edge Case | Handling Strategy |
|---|-----------|-------------------|
| 1 | **Flag toggled mid-session** | Feature flag is read server-side per request. Client gets `benefitEngineEnabled` from API and uses it locally. No session inconsistency. |
| 2 | **Cron runs during API request** | Prisma query snapshot isolation — API reads consistent state |
| 3 | **User has zero engine-managed benefits** | All code paths have `masterBenefitId` null-checks; legacy behavior activates |
| 4 | **MasterBenefit deleted while UserBenefit exists** | `masterBenefitId` is nullable FK — benefit stays, just loses catalog link. Display as legacy. |
| 5 | **Two ACTIVE periods for same benefit** | Cron should prevent this. Frontend dedup picks first seen. Add logging/monitoring. |
| 6 | **Import then enable engine** | Legacy rows (no period) remain. Cron can be extended to backfill. Out of scope for this sprint. |
| 7 | **Very large household (10+ cards, 100+ benefits)** | Dedup operations are O(n) with Set — performance is fine up to thousands |
| 8 | **variableAmounts with invalid JSON** | Prisma validates JSON on write. Add application-level validation in seed and admin endpoints. |
| 9 | **Mobile sync during period transition** | Mobile gets ACTIVE rows. If period just expired, cron creates new ACTIVE. Brief window where mobile gets empty — acceptable, retry resolves. |
| 10 | **Rollback: disable engine flag** | All changes are gated. Setting `BENEFIT_ENGINE_ENABLED=false` immediately restores legacy behavior. Period data remains in DB but is ignored. |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Feature flag bypass** — engineer forgets to gate a change | HIGH | Code review checklist item: every conditional block must check `featureFlags.BENEFIT_ENGINE_ENABLED` or `benefitEngineEnabled` |
| **Shared utility inconsistency** — `hydratePeriodFields()` used by add and import diverges | MEDIUM | Extract to single file, add integration test that exercises both paths |
| **Two committer files** — fix applied to one but not the other | HIGH | Both files are identical duplicates. Apply same change to both. Long-term: delete one and re-export. |
| **variableAmounts migration on production** | LOW | Additive column, nullable, no data loss. Run in a maintenance window with `prisma migrate deploy`. |
| **Resy data fix** — UPDATE on production MasterBenefit rows | LOW | Data migration is idempotent. Can be re-run safely. |
| **Frontend dedup hides data** — user can't see other periods | MEDIUM | Period selector and history view still show all periods. Only "current" view deduplicates. |
| **Performance** — extra MasterBenefit lookups on add/import | LOW | Single `findFirst` per benefit. Import could batch with `findMany` + in-memory map. |

**Rollback Strategy:**
1. Set `BENEFIT_ENGINE_ENABLED=false` in environment
2. Deploy — all code paths fall back to legacy behavior immediately
3. Period data stays in database but is invisible to users
4. No data migration rollback needed (additive only)

---

## Implementation Order & Task List

### Dependency Graph

```
cat-5 (seed fix)
  ↓
cat-4 (schema + seed) ──→ api-2 (add hydration) ──→ fe-2 (dashboard dedup)
  ↓                         ↓                         ↓
api-1 (read filters)     api-3 (import hydration)   fe-3 (card detail dedup)
                                                      ↓
                                                    fe-1 (calculations dedup)
                                                      ↓
                                                    fe-4 (modal lockdown)
```

### Task List

| # | Task | Issue | Phase | Complexity | Dependencies | Acceptance Criteria |
|---|------|-------|-------|------------|--------------|---------------------|
| 1 | Fix Resy `claimingCadence` to `SEMI_ANNUAL` in `prisma/seed.ts` and `prisma/phase6c-cadence-mapping.ts` | cat-5 | 1 | Small | — | Resy MasterBenefit records have `claimingCadence = 'SEMI_ANNUAL'`; `calculatePeriodForBenefit` produces Jan–Jun / Jul–Dec boundaries |
| 2 | Write data migration SQL for Resy fix in production | cat-5 | 1 | Small | #1 | Idempotent UPDATE runs without error |
| 3 | Add `variableAmounts Json?` field to `MasterBenefit` in Prisma schema | cat-4 | 1 | Small | — | `prisma migrate dev` succeeds; field is nullable JSONB |
| 4 | Create `resolveClaimingAmount()` utility in `src/lib/benefit-engine/date-math.ts` | cat-4 | 1 | Small | #3 | Returns override amount for December, default otherwise |
| 5 | Update Uber Cash seed entry with `variableAmounts: { "12": 3500 }` | cat-4 | 1 | Small | #3 | Seed produces correct December amount |
| 6 | Integrate `resolveClaimingAmount()` into cron job period creation | cat-4 | 1 | Medium | #4 | Cron creates December Uber period with `stickerValue: 3500` |
| 7 | Add `periodStatus` filter to `/api/dashboard/benefits/route.ts` | api-1 | 2 | Small | — | Engine ON: no EXPIRED rows. Engine OFF: all rows returned. |
| 8 | Add `periodStatus` filter to `/api/mobile/sync/route.ts` | api-1 | 2 | Small | — | Same as #7 |
| 9 | Add `periodStatus` filter to `/api/benefits/recommendations/route.ts` | api-1 | 2 | Small | — | Same as #7 |
| 10 | Add `periodStatus` filter to `src/lib/filters.ts` (`buildBenefitWhereClause`) | api-1 | 2 | Medium | — | Filters route excludes EXPIRED; explicit 'expired' filter overrides |
| 11 | Create shared `hydratePeriodFields()` utility | api-2/3 | 3 | Medium | #3, #4 | Accepts tx client + benefit name + card id, returns period fields |
| 12 | Integrate `hydratePeriodFields()` into `POST /api/benefits/add` | api-2 | 3 | Medium | #11 | Manual add with engine ON produces benefit with period fields |
| 13 | Integrate `hydratePeriodFields()` into `src/lib/import/committer.ts` | api-3 | 3 | Medium | #11 | Import with engine ON produces benefit with period fields |
| 14 | Integrate `hydratePeriodFields()` into `src/features/import-export/lib/committer.ts` | api-3 | 3 | Medium | #11 | Same as #13 — both files updated identically |
| 15 | Add period response fields to `POST /api/benefits/add` response | api-2 | 3 | Small | #12 | Response includes periodStart, periodEnd, periodStatus, masterBenefitId |
| 16 | Add `deduplicatedBenefits` useMemo to `dashboard/page.tsx` | fe-2 | 4 | Medium | #7 | Dashboard shows 1 card per unique benefit with engine ON |
| 17 | Add `getUniqueBenefitCount()` + dedup to `card/[id]/page.tsx` | fe-3 | 4 | Medium | — | Card detail filter tabs show deduped counts |
| 18 | Update `getHouseholdActiveCount()` in `calculations.ts` with dedup by `masterBenefitId` | fe-1 | 4 | Medium | — | Household count reflects unique benefits, not period rows |
| 19 | Update remaining aggregation functions in `calculations.ts` (`getTotalValueExtracted`, `getUncapturedValue`, `getHouseholdTotalCaptured`) | fe-1 | 4 | Medium | #18 | All value calculations use ACTIVE period only |
| 20 | Add `masterBenefitId` to `EditBenefitModal` props/interface | fe-4 | 5 | Small | — | Interface accepts `masterBenefitId` |
| 21 | Implement conditional read-only fields in `EditBenefitModal` | fe-4 | 5 | Medium | #20 | Engine-managed benefits show name/cadence as read-only |
| 22 | Add server-side edit guard to `PATCH /api/benefits/[id]` | fe-4 | 5 | Small | — | 400 error when modifying catalog-managed fields |
| 23 | Pass `masterBenefitId` through transform functions in dashboard and card detail pages | fe-4 | 5 | Small | #16, #17 | `transformBenefitForModal()` includes `masterBenefitId` |
| 24 | Write unit tests for `getHouseholdActiveCount` dedup logic | fe-1 | 4 | Medium | #18 | 6 test cases pass (see spec above) |
| 25 | Write unit tests for `resolveClaimingAmount` | cat-4 | 1 | Small | #4 | 3 test cases pass |
| 26 | Write integration tests for API period filters | api-1 | 2 | Medium | #7–#10 | Engine ON/OFF verified for 4 endpoints |
| 27 | Write integration tests for add + import period hydration | api-2/3 | 3 | Medium | #12–#14 | Created benefits have period fields |
| 28 | Write component tests for dashboard + card detail dedup | fe-2/3 | 4 | Medium | #16, #17 | Render tests verify card count |
| 29 | Write component tests for EditBenefitModal read-only mode | fe-4 | 5 | Small | #21 | Read-only rendering verified |

**Total estimated effort:** 8–10 engineering days

---

## Security & Compliance Considerations

- **No new authentication changes** — all endpoints already require auth via `x-user-id` header or `getAuthUserId()`
- **Server-side edit guard (Task #22)** is critical — frontend read-only is cosmetic; the API must enforce it
- **Import path** must use transaction client (`tx`) for MasterBenefit lookups to stay within the transaction boundary — no data leakage
- **variableAmounts JSON field** — validate on write to prevent injection of unexpected keys. Only keys "1"–"12" with integer values allowed.
- **Audit logging** — existing audit log system captures benefit updates. No changes needed.

---

## Performance & Scalability Considerations

- **API filtering with `periodStatus`:** The `UserBenefit` table already has an index on `periodStatus` (schema line 250: `@@index([periodStatus])`). No new indexes needed.
- **MasterBenefit lookups in import:** For batch imports with 50+ benefits, cache the MasterBenefit catalog at the start of the transaction: `const catalog = await tx.masterBenefit.findMany({ where: { isActive: true } })` → lookup from in-memory array.
- **Frontend dedup:** O(n) with Map/Set — negligible for <1000 benefits per user.
- **variableAmounts JSON parsing:** Only read during cron execution (background) and admin seeding. No user-facing performance impact.
- **Feature flag evaluation:** Static process.env read, cached at module load. No per-request cost.

---

## Appendix: Shared Utility API Design

### `src/lib/benefit-engine/hydrate-period.ts`

```typescript
/**
 * Hydrates period fields for a new UserBenefit row.
 * Used by both manual-add and import paths.
 *
 * @param client - Prisma client or transaction client
 * @param userCardId - The card this benefit belongs to
 * @param benefitName - Name to match against MasterBenefit catalog
 * @param fallbackResetCadence - Used if no MasterBenefit match found
 * @returns Period fields to spread into prisma.create({ data: ... })
 */
export async function hydratePeriodFields(
  client: PrismaClient | Prisma.TransactionClient,
  userCardId: string,
  benefitName: string,
  fallbackResetCadence: string
): Promise<HydratedPeriodFields>
```

### `src/lib/benefit-engine/date-math.ts` — New Export

```typescript
/**
 * Resolves the per-period claiming amount, handling variable overrides.
 *
 * @param baseAmount - Default claimingAmount in cents
 * @param variableAmounts - JSON overrides keyed by month number
 * @param periodMonth - 1-12 month of the period start
 * @returns Resolved amount in cents
 */
export function resolveClaimingAmount(
  baseAmount: number,
  variableAmounts: Record<string, number> | null | undefined,
  periodMonth: number
): number
```

### `src/features/cards/lib/calculations.ts` — Updated Exports

All existing functions remain with same signatures but internal logic branches on engine state. No API changes for consumers.
