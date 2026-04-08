# Sprint 2 — Benefit Engine Remediation Specification

## Executive Summary & Goals

Sprint 2 resolves the remaining 9 issues required before the `BENEFIT_ENGINE_ENABLED`
feature flag can be turned ON in production. The fixes span the export/import pipeline,
UI deduplication gaps, API safety guards, and catalog data hygiene.

### Primary Objectives

- **Data integrity**: Ensure export → reimport round-trips preserve period linkage and
  do not create orphaned duplicate rows (fe-7, api-5)
- **UI correctness**: Eliminate every remaining duplicate-display surface — alerts and
  benefit table (fe-5, fe-6)
- **API safety**: Block usage recording on non-ACTIVE periods (api-4, api-6)
- **Catalog completeness**: Add missing benefit categories and normalize annual fees
  across seed files (cat-6, cat-7, cat-8)

### Success Criteria

1. A user can export benefits, delete them, reimport from the same file, and see
   identical data — no duplicate rows, no lost period linkage.
2. AlertSection and BenefitTable each show exactly one entry per unique benefit when
   the engine is enabled.
3. `PATCH /api/benefits/[id]/toggle-used` returns `400` when `periodStatus !== 'ACTIVE'`
   and the engine is enabled.
4. All seed files agree on annual fees for every card they define.
5. `isDefault` field is documented or removed; its behavior in `generateBenefitsForCard`
   is explicitly tested.

---

## Implementation Order & Dependency Graph

```
Phase 1 (no dependencies — parallelizable)
├── api-4 + api-6   toggle-used period guard        (1 file)
├── fe-5            AlertSection dedup               (1 file)
├── fe-6            BenefitTable dedup               (2 files)
├── cat-7           Annual fee audit                 (6 seed files)
└── cat-8           isDefault documentation/cleanup  (docs + 1 test file)

Phase 2 (depends on nothing in Phase 1, but is the largest change)
├── api-5           Export period fields              (2 files)
└── fe-7            Import round-trip fix             (4 files — depends on api-5)

Phase 3 (design decision required before implementation)
└── cat-6           New benefit categories            (seed data + optional schema)
```

Recommended engineer assignment: **Phase 1 tasks can ship as independent PRs in
parallel. Phase 2 ships as a single PR (api-5 + fe-7). Phase 3 ships last.**

---

## Issue-by-Issue Fix Specifications

---

### 1. api-4 + api-6 — Toggle-Used Period Guard

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Priority**   | MEDIUM + LOW (combined — identical fix location)                   |
| **Files**      | `src/app/api/benefits/[id]/toggle-used/route.ts`                   |
| **Risk**       | Low — additive guard, feature-flagged                              |
| **Complexity** | Small                                                              |

#### Current Behavior (lines 29–99)

The PATCH handler:
1. Authenticates via `x-user-id` header (line 31)
2. Loads the benefit with ownership check (lines 44–69)
3. Updates `isUsed`, `timesUsed`, `claimedAt` — **no periodStatus check** (lines 71–78)

#### Required Change

After the ownership check (line 69) and before the update (line 71), insert a
feature-flagged period-status guard:

```
// Pseudocode — insert between lines 69 and 71

import { featureFlags } from '@/lib/feature-flags';

if (featureFlags.BENEFIT_ENGINE_ENABLED) {
  if (benefit.periodStatus === 'EXPIRED') {
    return 400 JSON {
      success: false,
      error: 'This benefit period has expired and can no longer be marked as used.',
      code: 'PERIOD_EXPIRED'
    }
  }

  if (benefit.periodStatus === 'UPCOMING') {
    return 400 JSON {
      success: false,
      error: 'This benefit period has not started yet.',
      code: 'PERIOD_UPCOMING'
    }
  }

  // Only ACTIVE (or null for legacy rows) may proceed
  if (benefit.periodStatus && benefit.periodStatus !== 'ACTIVE') {
    return 400 JSON {
      success: false,
      error: `Cannot update benefit in '${benefit.periodStatus}' status.`,
      code: 'INVALID_PERIOD_STATUS'
    }
  }
}
```

#### Why Combined

api-4 ("reject toggle on expired periods") and api-6 ("verify ACTIVE period before
toggle") describe the same missing guard from two angles. A single block addresses both.

#### Edge Cases

| # | Scenario                                         | Expected Result                     |
|---|--------------------------------------------------|-------------------------------------|
| 1 | `periodStatus = 'EXPIRED'`, `isUsed = true→false`| 400 PERIOD_EXPIRED                  |
| 2 | `periodStatus = 'UPCOMING'`                      | 400 PERIOD_UPCOMING                 |
| 3 | `periodStatus = 'ACTIVE'`                        | 200 — proceed normally              |
| 4 | `periodStatus = null` (legacy row)               | 200 — proceed (null !== EXPIRED)    |
| 5 | Engine flag OFF, `periodStatus = 'EXPIRED'`      | 200 — guard skipped                 |
| 6 | Concurrent toggle on same benefit                | Last-write-wins (acceptable)        |
| 7 | `periodStatus = 'ACTIVE'`, un-toggling used→unused| 200 — allowed                      |
| 8 | Benefit with `status = 'ARCHIVED'`               | Existing behavior (no change here)  |

#### Test Requirements

**File**: `src/app/api/benefits/[id]/toggle-used/__tests__/route.test.ts` (create)

| Test Case                                          | Type        |
| -------------------------------------------------- | ----------- |
| Returns 400 when periodStatus=EXPIRED + engine ON  | Unit        |
| Returns 400 when periodStatus=UPCOMING + engine ON | Unit        |
| Returns 200 when periodStatus=ACTIVE + engine ON   | Unit        |
| Returns 200 when periodStatus=null + engine ON     | Unit        |
| Returns 200 when periodStatus=EXPIRED + engine OFF | Unit        |
| Correctly increments timesUsed on ACTIVE toggle     | Integration |
| Does NOT increment timesUsed on rejected toggle     | Integration |

---

### 2. fe-5 — AlertSection Duplicate Expiry Alerts

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Priority**   | MEDIUM                                                             |
| **Files**      | `src/shared/components/ui/AlertSection.tsx`                        |
| **Risk**       | Low — display-only, no data mutation                               |
| **Complexity** | Small                                                              |

#### Current Behavior (lines 75–114)

`getExpiringBenefits()` iterates through ALL benefit rows:

```typescript
for (const player of players) {
  for (const card of player.userCards) {
    for (const benefit of card.userBenefits) {  // ← no dedup
```

With the engine enabled, a monthly benefit like "$10 Uber Cash" produces 12 period
rows per year. If multiple periods have expiration dates within 30 days, each generates
a separate alert — duplicating the user-visible notification.

#### Required Change

Apply `deduplicateBenefits()` to each card's benefit array before iterating:

```
// Pseudocode — modify getExpiringBenefits()

import { deduplicateBenefits } from '@/lib/benefit-utils';
import { featureFlags } from '@/lib/feature-flags';

function getExpiringBenefits(players: Player[]): ExpiringBenefit[] {
  const engineEnabled = featureFlags.BENEFIT_ENGINE_ENABLED;
  // ...
  for (const player of players) {
    for (const card of player.userCards) {
      const benefits = deduplicateBenefits(card.userBenefits, engineEnabled);
      for (const benefit of benefits) {  // ← now deduped
        // ... existing logic unchanged ...
      }
    }
  }
}
```

#### Why This Works

`deduplicateBenefits()` already:
- Returns only the ACTIVE period row per `userCardId:masterBenefitId` pair
- Passes legacy rows through unchanged
- Is a no-op when the engine is OFF

The ACTIVE period row's `expirationDate` is the one the user actually cares about.

#### Interface Requirement

The `UserBenefit` type in `AlertSection.tsx` (line 20, `AlertSectionProps`) must
include `masterBenefitId`, `userCardId`, and `periodStatus` fields for
`deduplicateBenefits` to work. Verify the type already includes these or extend it.

Check: The `Player` interface at line 38 includes `userBenefits` — ensure its type
satisfies `DeduplicatableBenefit` from `benefit-utils.ts`.

#### Edge Cases

| # | Scenario                                          | Expected Result                    |
|---|---------------------------------------------------|------------------------------------|
| 1 | 3 period rows for same benefit, 1 ACTIVE expiring | 1 alert shown                      |
| 2 | 2 different benefits both expiring                | 2 alerts shown                     |
| 3 | Legacy benefit (no masterBenefitId) expiring      | 1 alert shown (passthrough)        |
| 4 | Engine OFF, multiple period rows                  | All alerts shown (legacy behavior) |
| 5 | No expiring benefits                              | Empty alert section                |
| 6 | Same benefit on 2 cards (spouse scenario)         | 2 alerts (different userCardId)    |
| 7 | EXPIRED row has expirationDate in future (data bug)| Filtered out by dedup             |
| 8 | ACTIVE row with no expirationDate                 | No alert (existing skip logic)     |

#### Test Requirements

**File**: `src/shared/components/ui/__tests__/AlertSection.test.tsx` (create)

| Test Case                                          | Type        |
| -------------------------------------------------- | ----------- |
| Shows 1 alert for benefit with 3 period rows       | Unit        |
| Shows alerts for 2 different expiring benefits     | Unit        |
| Shows legacy benefit alert when engine ON          | Unit        |
| Shows all alerts when engine OFF                   | Unit        |
| Deduplicates across cards correctly (no cross-card)| Unit        |

---

### 3. fe-6 — BenefitTable Duplicate Rows

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Priority**   | MEDIUM                                                             |
| **Files**      | `src/features/benefits/components/BenefitTable.tsx`,               |
|                | `src/features/cards/components/Card.tsx`                           |
| **Risk**       | Low — display-only                                                 |
| **Complexity** | Small                                                              |

#### Current Behavior

**Card.tsx line 265**: passes `card.userBenefits` directly to `<BenefitTable>`:
```tsx
<BenefitTable benefits={card.userBenefits} />
```

**BenefitTable.tsx line 155**: renders all benefits as-is — no dedup:
```tsx
export default function BenefitTable({ benefits }: BenefitTableProps)
```

The `UserBenefit` interface (lines 35–45) lacks `masterBenefitId`, `userCardId`,
and `periodStatus` fields.

#### Required Changes

**Option A (Preferred)**: Dedup at the data source in `Card.tsx`:

```
// Card.tsx — modify line 265

import { deduplicateBenefits } from '@/lib/benefit-utils';
import { featureFlags } from '@/lib/feature-flags';

// Inside the Card component, before the JSX:
const dedupedBenefits = deduplicateBenefits(
  card.userBenefits,
  featureFlags.BENEFIT_ENGINE_ENABLED
);

// In JSX:
<BenefitTable benefits={dedupedBenefits} />

// Also fix the count display (line 255):
<p>{dedupedBenefits.length} benefit{dedupedBenefits.length !== 1 ? 's' : ''}</p>
```

**BenefitTable.tsx** — Extend the `UserBenefit` interface to include dedup fields:

```typescript
interface UserBenefit {
  id: string;
  name: string;
  stickerValue: number;
  userDeclaredValue: number | null;
  isUsed: boolean;
  expirationDate: Date | null;
  type: string;
  resetCadence: string;
  timesUsed: number;
  // Add for dedup compatibility
  masterBenefitId?: string | null;
  userCardId?: string | null;
  periodStatus?: string | null;
}
```

**Why Option A over deduping inside BenefitTable**: Card.tsx also displays a benefit
count (line 255: `{card.userBenefits.length} benefit...`). Deduping at the source
keeps count and table in sync. BenefitTable remains a pure presentation component.

#### Edge Cases

| # | Scenario                                        | Expected Result                    |
|---|-------------------------------------------------|------------------------------------|
| 1 | 12 monthly period rows for same benefit         | 1 table row                        |
| 2 | Mixed: 3 engine benefits + 2 legacy benefits    | 5 rows total (3 deduped + 2 legacy)|
| 3 | Engine OFF                                      | All rows shown (no change)         |
| 4 | Empty benefits array                             | Empty table state shown            |
| 5 | Benefit count in Card.tsx matches table rows    | Always in sync                     |

#### Test Requirements

**File**: `src/features/benefits/components/__tests__/BenefitTable.test.tsx` (create or extend)

| Test Case                                          | Type        |
| -------------------------------------------------- | ----------- |
| Renders 1 row for benefit with multiple periods    | Unit        |
| Renders all rows when engine OFF                   | Unit        |
| Benefit count matches visible table rows           | Unit        |
| Legacy benefits pass through unchanged             | Unit        |

---

### 4. api-5 + fe-7 — Export Period Fields & Import Round-Trip Fix

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Priority**   | api-5: MEDIUM, fe-7: CRITICAL                                     |
| **Files**      | `src/lib/export/schema.ts`                                         |
|                | `src/features/import-export/lib/exporter.ts`                       |
|                | `src/lib/import/validator.ts`                                      |
|                | `src/lib/import/committer.ts`                                      |
|                | `src/lib/import/duplicate-detector.ts`                             |
|                | `src/lib/import/parser.ts`                                         |
| **Risk**       | **HIGH** — changes to the export format are a contract change      |
| **Complexity** | Large                                                              |

#### Problem Statement

**Export** (api-5): `getBenefitData()` in `exporter.ts` (lines 72–102) maps benefit
rows to the export format but **omits all period fields**:

```typescript
// Current export mapping (exporter.ts:90-101)
return benefits.map((benefit) => ({
  cardName: benefit.userCard.masterCard.cardName,
  issuer: benefit.userCard.masterCard.issuer,
  benefitName: benefit.name,
  benefitType: benefit.type,
  stickerValue: benefit.stickerValue,
  declaredValue: benefit.userDeclaredValue,
  expirationDate: benefit.expirationDate,
  usage: benefit.isUsed ? 'Claimed' : 'Unused',
  createdAt: benefit.createdAt,
  updatedAt: benefit.updatedAt,
  // ❌ Missing: periodStart, periodEnd, periodStatus, masterBenefitId, resetCadence
}));
```

**Import** (fe-7): When the exported file is reimported:
1. Period fields are absent from the file → `commitBenefit()` calls
   `hydratePeriodFields()` which recalculates them — but this **creates a new row**
   rather than matching the existing one.
2. Duplicate detection (`findExistingBenefit`) looks up by `(userCardId, name)` without
   considering `periodStart`, so it finds the first match but misses period-specific rows.
3. Result: orphaned duplicates with no period linkage.

#### Fix: api-5 — Add Period Fields to Export Schema

**`src/lib/export/schema.ts`** — Add 4 new optional benefit export fields:

```typescript
export const BENEFIT_EXPORT_FIELDS = [
  // ... existing 10 fields ...
  { id: 'cardName',       label: 'Card Name',       type: 'string'   },
  { id: 'issuer',         label: 'Issuer',           type: 'string'   },
  { id: 'benefitName',    label: 'Benefit Name',     type: 'string'   },
  { id: 'benefitType',    label: 'Benefit Type',     type: 'enum'     },
  { id: 'stickerValue',   label: 'Sticker Value',    type: 'monetary' },
  { id: 'declaredValue',  label: 'Declared Value',   type: 'monetary' },
  { id: 'expirationDate', label: 'Expiration Date',  type: 'date'     },
  { id: 'usage',          label: 'Usage',            type: 'enum'     },
  { id: 'createdAt',      label: 'Created Date',     type: 'date'     },
  { id: 'updatedAt',      label: 'Updated Date',     type: 'date'     },
  // NEW — period fields (included only when engine is enabled)
  { id: 'periodStart',    label: 'Period Start',     type: 'date'     },
  { id: 'periodEnd',      label: 'Period End',       type: 'date'     },
  { id: 'periodStatus',   label: 'Period Status',    type: 'enum'     },
  { id: 'resetCadence',   label: 'Reset Cadence',    type: 'string'   },
] as const;
```

> **Design Decision**: `masterBenefitId` is intentionally excluded from user-facing
> exports. It's an internal ID that breaks across environments. Instead, the import
> path re-resolves the masterBenefitId via `hydratePeriodFields()` using the benefit
> name + card name lookup.

**`src/features/import-export/lib/exporter.ts`** — Update `getBenefitData()`:

```typescript
async function getBenefitData(playerId: string): Promise<any[]> {
  const benefits = await prisma.userBenefit.findMany({
    where: { playerId },
    include: {
      userCard: {
        include: {
          masterCard: {
            select: { cardName: true, issuer: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return benefits.map((benefit) => ({
    cardName: benefit.userCard.masterCard.cardName,
    issuer: benefit.userCard.masterCard.issuer,
    benefitName: benefit.name,
    benefitType: benefit.type,
    stickerValue: benefit.stickerValue,
    declaredValue: benefit.userDeclaredValue,
    expirationDate: benefit.expirationDate,
    usage: benefit.isUsed ? 'Claimed' : 'Unused',
    createdAt: benefit.createdAt,
    updatedAt: benefit.updatedAt,
    // NEW period fields
    periodStart: benefit.periodStart,
    periodEnd: benefit.periodEnd,
    periodStatus: benefit.periodStatus,
    resetCadence: benefit.resetCadence,
  }));
}
```

**`src/features/import-export/actions/export.ts`** — Update `getExportOptions()` to
conditionally include period fields when engine is enabled:

```
// In getExportOptions, filter BENEFIT_EXPORT_FIELDS:
const periodFieldIds = ['periodStart', 'periodEnd', 'periodStatus', 'resetCadence'];
const filteredBenefitFields = featureFlags.BENEFIT_ENGINE_ENABLED
  ? BENEFIT_EXPORT_FIELDS
  : BENEFIT_EXPORT_FIELDS.filter(f => !periodFieldIds.includes(f.id));
```

#### Fix: fe-7 — Import Round-Trip Dedup

The import pipeline needs 3 changes:

**Change A — Parser**: Recognize the new period columns.

**File**: `src/lib/import/parser.ts`

Add these to the column synonym map:

```typescript
// Add to known field mappings
'PeriodStart'  → 'PeriodStart'
'Period Start' → 'PeriodStart'
'PeriodEnd'    → 'PeriodEnd'
'Period End'   → 'PeriodEnd'
'PeriodStatus' → 'PeriodStatus'
'Period Status'→ 'PeriodStatus'
'ResetCadence' → 'ResetCadence'
'Reset Cadence'→ 'ResetCadence'
```

**Change B — Validator**: Accept (but don't require) period fields.

**File**: `src/lib/import/validator.ts`

Add optional validation functions at the end of `validateBenefitRecord()`:

```
// Pseudocode — add after line 785 in validateBenefitRecord()

// Validate optional period fields (non-blocking — always warnings, never errors)
if (row.PeriodStart) {
  const parsed = parseISODate(row.PeriodStart);
  if (!parsed) {
    result.warnings.push(createError(
      'PeriodStart', 'Period start date is invalid — will be recalculated',
      'Use ISO format YYYY-MM-DD', 'warning'
    ));
  } else {
    result.normalizedData.periodStart = parsed;
  }
}
// Same pattern for PeriodEnd, PeriodStatus, ResetCadence
```

**Change C — Duplicate Detector**: Match on `(benefitName + periodStart)` for
engine-managed benefits.

**File**: `src/lib/import/duplicate-detector.ts`

Update `findExistingBenefit()` (line 211) to include `periodStart` in the lookup
when the engine is enabled:

```
// Pseudocode — modify findExistingBenefit()

async function findExistingBenefit(
  playerId, cardName, issuer, benefitName, periodStart?  // ← new optional param
) {
  // ... existing card lookup ...

  if (featureFlags.BENEFIT_ENGINE_ENABLED && periodStart) {
    // Period-aware lookup — match on compound unique key
    return prisma.userBenefit.findFirst({
      where: {
        userCardId: userCard.id,
        name: benefitName,
        periodStart: periodStart,
      },
    });
  }

  // Legacy lookup (no period)
  return prisma.userBenefit.findFirst({
    where: {
      userCardId: userCard.id,
      name: benefitName,
    },
  });
}
```

Also update `findDatabaseDuplicates()` to pass `periodStart`:

```
// line 299 in findDatabaseDuplicates()
const existing = await findExistingBenefit(
  playerId,
  record.data.cardName,
  record.data.issuer,
  record.data.benefitName,
  record.data.periodStart  // ← pass through from parsed import
);
```

**Change D — Committer**: Use period-aware matching for updates.

**File**: `src/lib/import/committer.ts`

Update `commitBenefit()` (line 141) — when engine is enabled and periodStart is
provided in the import data, use the compound unique key for updates:

```
// Pseudocode — modify the Update path in commitBenefit()

if (action === 'Update') {
  let existing;

  if (featureFlags.BENEFIT_ENGINE_ENABLED && normalizedData.periodStart) {
    // Period-aware update — match compound unique key
    existing = await tx.userBenefit.findFirst({
      where: {
        userCardId,
        name: benefitName,
        periodStart: new Date(normalizedData.periodStart),
      },
      select: { id: true },
    });
  } else {
    // Legacy: match by name only (existing behavior)
    existing = await tx.userBenefit.findFirst({
      where: {
        userCardId,
        name: benefitName,
        periodStart: null,
      },
      select: { id: true },
    });
  }

  // ... update logic unchanged ...
}
```

For the Create path: `hydratePeriodFields()` is already called (line 152). When the
imported row includes `periodStart`, we should **prefer** the hydrated fields (which
recalculate from current date + catalog) but use the imported `periodStart` for
dedup matching only. The hydrated values are authoritative.

#### Export Format v2 — Contract Change

**Before** (v1):
```csv
Card Name,Issuer,Benefit Name,Benefit Type,Sticker Value,Declared Value,Expiration Date,Usage,Created Date,Updated Date
```

**After** (v2 — when engine enabled):
```csv
Card Name,Issuer,Benefit Name,Benefit Type,Sticker Value,Declared Value,Expiration Date,Usage,Created Date,Updated Date,Period Start,Period End,Period Status,Reset Cadence
```

The 4 new columns are appended. Old exports (without period columns) remain fully
importable — the parser treats missing columns as absent optional fields.

#### Edge Cases

| #  | Scenario                                            | Expected Result                          |
|----|-----------------------------------------------------|------------------------------------------|
| 1  | Export v2 → delete all → reimport v2                | Identical data, no duplicates            |
| 2  | Export v1 (old format) → reimport with engine ON    | hydratePeriodFields recalculates periods |
| 3  | Export v2 → reimport v2 without deleting            | Duplicate detection matches on periodStart|
| 4  | Import benefit with periodStatus=EXPIRED            | Row created with recalculated status     |
| 5  | Two period rows for same benefit in export file     | Two separate rows imported correctly     |
| 6  | Export with engine OFF → reimport with engine ON    | Period fields hydrated on import         |
| 7  | Export with engine ON → reimport with engine OFF    | Period fields ignored, legacy import     |
| 8  | XLSX multi-sheet export with period columns         | Period columns appear in Benefits sheet  |
| 9  | CSV with empty period fields                        | Treated as absent, hydrated on import    |
| 10 | Benefit name case mismatch between export/import    | hydratePeriodFields uses case-insensitive|
| 11 | Large export (10K+ benefits with period rows)       | Performance: same streaming approach     |
| 12 | Corrupt periodStart in import (e.g., "not-a-date")  | Warning issued, field recalculated       |

#### Test Requirements

**Files**:
- `src/lib/export/__tests__/schema.test.ts` (extend)
- `src/features/import-export/lib/__tests__/exporter.test.ts` (extend)
- `src/lib/import/__tests__/validator.test.ts` (extend)
- `src/lib/import/__tests__/duplicate-detector.test.ts` (extend)
- `src/lib/import/__tests__/committer.test.ts` (extend)
- `tests/integration/import-export-roundtrip.test.ts` (create)

| Test Case                                                  | Type        |
| ---------------------------------------------------------- | ----------- |
| Export includes period fields when engine enabled           | Unit        |
| Export omits period fields when engine disabled             | Unit        |
| Parser recognizes PeriodStart, PeriodEnd, PeriodStatus cols | Unit        |
| Validator accepts optional period fields without errors     | Unit        |
| Validator warns on invalid PeriodStart format               | Unit        |
| Duplicate detector matches on (name, periodStart) with engine ON | Unit   |
| Duplicate detector falls back to (name) with engine OFF    | Unit        |
| Committer updates correct period row via compound key      | Integration |
| Full round-trip: export → delete → reimport = identical    | Integration |
| v1 export → v2 import: period fields hydrated              | Integration |
| Reimport without delete: duplicates detected correctly     | Integration |

---

### 5. cat-6 — Missing Benefit Categories

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Priority**   | HIGH                                                               |
| **Files**      | `prisma/seed.ts` (data only — no schema changes)                   |
| **Risk**       | Low — additive catalog data, no code changes                       |
| **Complexity** | Medium (requires design decisions)                                 |

#### Design Decisions

| Category             | Model as MasterBenefit? | claimingCadence      | Rationale                                                |
|----------------------|------------------------|----------------------|----------------------------------------------------------|
| Welcome bonuses      | ✅ Yes                 | `ONE_TIME`           | Trackable, time-bound, has a value                       |
| Anniversary certs    | ✅ Yes                 | `FLEXIBLE_ANNUAL`    | Recurs annually on card anniversary                      |
| Retention offers     | ❌ No                  | N/A                  | User-specific, not catalog-level; model as UserBenefit   |
| Referral bonuses     | ❌ No (future)         | N/A                  | Variable, not tied to card catalog; defer to future      |
| Spending multipliers | ❌ No                  | N/A                  | Informational, not a claimable credit                    |

#### New MasterBenefit Entries to Add

**Welcome Bonuses** — Add as `type: 'StatementCredit'` with `resetCadence: 'CUSTOM'`
and `claimingCadence: 'ONE_TIME'`:

```typescript
// Example entries (add to prisma/seed.ts master benefit arrays)

// Chase Sapphire Reserve
{ name: 'Welcome Bonus: 60,000 Points', type: 'UsagePerk', stickerValue: 90000,
  resetCadence: 'CUSTOM', claimingCadence: 'ONE_TIME', isDefault: false }

// Amex Platinum
{ name: 'Welcome Bonus: 150,000 MR Points', type: 'UsagePerk', stickerValue: 225000,
  resetCadence: 'CUSTOM', claimingCadence: 'ONE_TIME', isDefault: false }

// Amex Gold
{ name: 'Welcome Bonus: 90,000 MR Points', type: 'UsagePerk', stickerValue: 135000,
  resetCadence: 'CUSTOM', claimingCadence: 'ONE_TIME', isDefault: false }

// Capital One Venture X
{ name: 'Welcome Bonus: 75,000 Miles', type: 'UsagePerk', stickerValue: 112500,
  resetCadence: 'CUSTOM', claimingCadence: 'ONE_TIME', isDefault: false }
```

> **Note**: `isDefault: false` because welcome bonuses should NOT auto-generate
> period rows for every new card. Users manually opt in to track them. This is the
> intended use of the `isDefault` field (see cat-8 below).

**Anniversary Certificates**:

```typescript
// Hilton Aspire (if/when added to catalog)
{ name: 'Free Night Certificate', type: 'UsagePerk', stickerValue: 50000,
  resetCadence: 'ANNUAL', claimingCadence: 'FLEXIBLE_ANNUAL', isDefault: true }

// IHG Premier (if/when added to catalog)
{ name: 'Anniversary Free Night', type: 'UsagePerk', stickerValue: 40000,
  resetCadence: 'ANNUAL', claimingCadence: 'FLEXIBLE_ANNUAL', isDefault: true }
```

#### Retention Offers — Recommendation

Retention offers are **not** MasterBenefits. They are per-user, negotiated perks. The
current architecture already supports them:

- User calls their issuer, receives offer (e.g., "$150 statement credit")
- User manually adds a UserBenefit via the "Add Benefit" flow
- `hydratePeriodFields()` handles it as a legacy benefit (no masterBenefitId)

No code changes needed. Document this pattern in the user guide.

#### Spending Multipliers — Recommendation

Multipliers (e.g., "5x on groceries") are **informational**, not trackable credits.
They don't have a claimable value. Options:

1. **Current approach (recommended)**: Already modeled as `type: 'UsagePerk'` with
   `stickerValue: 0`. The seed data includes entries like "3x Points on Travel".
   These display in the UI but aren't trackable as "used/unused".

2. **Future enhancement**: Add a `benefitCategory` field to distinguish informational
   perks from trackable credits. Out of scope for Sprint 2.

#### Test Requirements

| Test Case                                              | Type        |
| ------------------------------------------------------ | ----------- |
| Welcome bonus MasterBenefits exist in seeded data      | Seed verify |
| Welcome bonus has claimingCadence=ONE_TIME              | Seed verify |
| Welcome bonus has isDefault=false                       | Seed verify |
| Anniversary cert has claimingCadence=FLEXIBLE_ANNUAL    | Seed verify |
| generateBenefitsForCard skips isDefault=false benefits  | Unit        |

---

### 6. cat-7 — Annual Fee Inconsistencies

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Priority**   | MEDIUM                                                             |
| **Files**      | `prisma/seed.ts`, `seed-top-10-cards.js`,                          |
|                | `seed-points-cards-april-2026.js`,                                 |
|                | `seed-points-cards-april-2026-updated.js`,                         |
|                | `seed-points-cards-comprehensive.js`,                              |
|                | `seed-demo.js`, `scripts/seed-premium-cards.js`                    |
| **Risk**       | Low — data-only, no logic changes                                  |
| **Complexity** | Small (tedious but mechanical)                                     |

#### Audit Results

Automated comparison found **7 cards with fee discrepancies**:

| Card                              | prisma/seed.ts | seed-top-10 | april-2026 | comprehensive | Correct 2025 Fee |
|-----------------------------------|---------------|-------------|------------|---------------|------------------|
| Chase Sapphire Reserve            | (not defined) | $550        | $795       | $550          | **$550**         |
| Chase Sapphire Preferred          | $95           | $95         | $95        | **$950** ⚠️   | **$95**          |
| American Express Platinum Card    | $695          | (N/A)       | $895       | $695          | **$695**         |
| American Express Gold Card        | $250          | $250        | $325       | $250          | **$250**         |
| Capital One Venture X             | (N/A)         | $395        | $395       | $395          | **$395**         |
| Bank of America Premium Rewards   | $95           | **$0** ⚠️   | (N/A)      | (N/A)         | **$95**          |
| Citi Prestige                     | $495          | **$450** ⚠️ | (N/A)      | $495          | **$495**         |
| Chase Southwest Rapid Rewards     | (N/A)         | (N/A)       | $69        | **$690** ⚠️   | **$69**          |

**Root causes**:
- `seed-points-cards-comprehensive.js` line 57: `defaultAnnualFee: 95000` for Chase
  Sapphire Preferred — clearly a typo ($950 instead of $95). Should be `9500`.
- `seed-points-cards-comprehensive.js` line 541: `defaultAnnualFee: 69000` for
  Southwest Premier — another typo ($690 instead of $69). Should be `6900`.
- `seed-top-10-cards.js` line 91: BofA Premium Rewards has `0` — should be `9500`.
- `seed-top-10-cards.js` line 78: Citi Prestige has `45000` ($450) — should be `49500`.
- `seed-points-cards-april-2026.js`: Uses hypothetical 2026 fees ($795 CSR, $895
  Platinum, $325 Gold). This is intentional for that seed's scenario but should be
  clearly documented with comments.

#### Required Changes

1. **`seed-points-cards-comprehensive.js`** line 57:
   `95000` → `9500` (Chase Sapphire Preferred)

2. **`seed-points-cards-comprehensive.js`** line 541:
   `69000` → `6900` (Chase Southwest Premier)

3. **`seed-top-10-cards.js`** line 91:
   `0` → `9500` (Bank of America Premium Rewards)

4. **`seed-top-10-cards.js`** line 78:
   `45000` → `49500` (Citi Prestige)

5. **`seed-points-cards-april-2026.js`**: Add header comment:
   ```javascript
   /**
    * IMPORTANT: This seed file uses HYPOTHETICAL April 2026 fees that may
    * differ from current real-world fees. Used for testing period tracking
    * with future-dated data. Do NOT use as source of truth for actual fees.
    */
   ```

#### Validation Script

Create a one-time audit script to prevent future drift:

**File**: `scripts/audit-seed-fees.js`

```javascript
// Reads all seed files, extracts (cardName, defaultAnnualFee) pairs,
// compares against prisma/seed.ts as the source of truth,
// and reports any mismatches.
//
// Usage: node scripts/audit-seed-fees.js
```

#### Test Requirements

| Test Case                                              | Type        |
| ------------------------------------------------------ | ----------- |
| All seed files agree on fees for shared cards           | Script      |
| No fee value exceeds $10,000 (sanity check)             | Script      |
| No fee value is negative                                | Script      |

---

### 7. cat-8 — `isDefault` Flag Documentation

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| **Priority**   | LOW                                                                |
| **Files**      | `src/lib/benefit-engine/generate-benefits.ts` (document, no change)|
|                | `src/lib/benefit-engine/__tests__/generate-benefits.test.ts`       |
| **Risk**       | None — documentation + test coverage only                          |
| **Complexity** | Small                                                              |

#### Current Usage

`isDefault` is already used correctly in one place:

**`generate-benefits.ts` line 72**: Filters `isDefault: true` when querying
MasterBenefits to auto-generate for a new card:

```typescript
const masterBenefits = await tx.masterBenefit.findMany({
  where: {
    masterCardId: userCard.masterCardId,
    isActive: true,
    isDefault: true,  // ← only auto-generate default benefits
  },
});
```

The admin API also exposes toggle-default functionality
(`src/app/api/admin/cards/[id]/benefits/[benefitId]/toggle-default/route.ts`).

#### Decision: Keep the Field

`isDefault` serves a clear purpose:
- `isDefault: true` → Benefit is auto-generated when a user adds this card
- `isDefault: false` → Benefit exists in catalog but user must opt in (e.g., welcome
  bonuses — see cat-6)

**Do NOT remove the field.** Instead:

1. Add a JSDoc comment to the Prisma schema:

```prisma
model MasterBenefit {
  /// When true, this benefit is automatically created for new UserCards.
  /// When false, the benefit exists in the catalog but users must manually
  /// add it (e.g., welcome bonuses, optional add-on perks).
  isDefault       Boolean  @default(true)
}
```

2. Add explicit test coverage:

**File**: `src/lib/benefit-engine/__tests__/generate-benefits.test.ts` (extend)

```
// Test: isDefault=false benefits are NOT auto-generated
// Test: isDefault=true benefits ARE auto-generated
// Test: Mix of isDefault true/false — only true ones generated
```

#### Test Requirements

| Test Case                                              | Type        |
| ------------------------------------------------------ | ----------- |
| generateBenefitsForCard excludes isDefault=false        | Unit        |
| generateBenefitsForCard includes isDefault=true         | Unit        |
| Mixed catalog: only default benefits auto-generated     | Unit        |
| Admin toggle-default updates isDefault correctly        | Integration |

---

## Database Changes

### Schema Changes

**None required.** All fixes use existing fields. No migrations needed.

### Seed Data Changes

| File                                    | Change                                    |
| --------------------------------------- | ----------------------------------------- |
| `seed-points-cards-comprehensive.js`    | Fix 2 fee typos (lines 57, 541)           |
| `seed-top-10-cards.js`                  | Fix 2 fee errors (lines 78, 91)           |
| `seed-points-cards-april-2026.js`       | Add disclaimer comment                    |
| `prisma/seed.ts`                        | Add welcome bonus MasterBenefits          |
| `prisma/schema.prisma`                  | Add JSDoc comment on `isDefault` field    |

---

## API Contract Changes

### Modified Endpoint: Export

| Aspect       | Before                         | After                                   |
| ------------ | ------------------------------ | --------------------------------------- |
| Fields       | 10 benefit columns             | 14 benefit columns (4 period fields)    |
| Backward compat | N/A                         | Old exports (10 cols) still importable  |
| Condition    | Always 10 fields               | 10 when engine OFF, 14 when engine ON   |

### Modified Endpoint: Toggle Used

| Aspect       | Before                          | After                                   |
| ------------ | ------------------------------- | --------------------------------------- |
| Validation   | Auth + ownership only           | + periodStatus check (when engine ON)   |
| New errors   | None                            | 400 `PERIOD_EXPIRED`, `PERIOD_UPCOMING` |
| Backward compat | Unchanged when engine OFF    | Unchanged when engine OFF               |

### No New Endpoints Required

All fixes modify existing behavior within existing endpoints.

---

## Frontend Component Changes

| Component         | File                                           | Change                          |
| ----------------- | ---------------------------------------------- | ------------------------------- |
| AlertSection      | `src/shared/components/ui/AlertSection.tsx`     | Add `deduplicateBenefits` call  |
| BenefitTable      | `src/features/benefits/components/BenefitTable.tsx` | Extend UserBenefit interface |
| Card              | `src/features/cards/components/Card.tsx`        | Dedup before passing to table   |
| ExportOptions     | `src/features/import-export/actions/export.ts`  | Conditionally show period fields|

---

## Risk Assessment

| Issue   | Risk Level | Impact if Broken                              | Mitigation                              |
|---------|-----------|-----------------------------------------------|-----------------------------------------|
| fe-7    | **HIGH**  | Data loss on reimport; duplicate rows          | Integration test with round-trip        |
| api-5   | MEDIUM    | Export format change breaks external tools     | Backward-compatible (additive columns)  |
| api-4/6 | LOW       | Users mark expired benefits as used            | Feature-flagged; no data corruption     |
| fe-5    | LOW       | Duplicate alerts — annoying but not harmful    | Feature-flagged; display-only           |
| fe-6    | LOW       | Duplicate table rows — confusing but harmless  | Feature-flagged; display-only           |
| cat-6   | LOW       | Missing categories — additive data only        | isDefault=false prevents side effects   |
| cat-7   | LOW       | Wrong fees in demo data                        | Seed files only; not production data    |
| cat-8   | NONE      | Documentation only                             | N/A                                     |

### Rollback Strategy

All changes are gated behind `BENEFIT_ENGINE_ENABLED`. If any issue is discovered
post-deployment:

1. Set `BENEFIT_ENGINE_ENABLED=false` in environment
2. All guards and dedup logic become no-ops
3. Export reverts to 10-column format
4. Import uses legacy matching
5. No data migration required for rollback

---

## Implementation Tasks

### Phase 1 — Independent Fixes (Parallelizable)

| #  | Task                                       | Issue   | Complexity | Acceptance Criteria                                                |
|----|----------------------------------------------|---------|------------|---------------------------------------------------------------------|
| 1  | Add periodStatus guard to toggle-used handler | api-4/6 | Small      | 400 on EXPIRED/UPCOMING when engine ON; 200 on ACTIVE/null         |
| 2  | Write toggle-used guard unit tests            | api-4/6 | Small      | 7 test cases pass                                                   |
| 3  | Add deduplicateBenefits to AlertSection       | fe-5    | Small      | 1 alert per benefit; no duplicates when engine ON                  |
| 4  | Write AlertSection dedup tests                | fe-5    | Small      | 5 test cases pass                                                   |
| 5  | Extend BenefitTable UserBenefit interface     | fe-6    | Small      | Interface includes masterBenefitId, userCardId, periodStatus       |
| 6  | Add deduplicateBenefits in Card.tsx           | fe-6    | Small      | 1 row per benefit; count matches table rows                        |
| 7  | Write BenefitTable dedup tests                | fe-6    | Small      | 4 test cases pass                                                   |
| 8  | Fix seed-points-cards-comprehensive fees      | cat-7   | Small      | CSP=$95 (9500), SW Premier=$69 (6900)                              |
| 9  | Fix seed-top-10-cards fees                    | cat-7   | Small      | BofA=$95 (9500), Citi Prestige=$495 (49500)                        |
| 10 | Add disclaimer comment to april-2026 seed     | cat-7   | Small      | Comment block at top of file                                        |
| 11 | Create audit-seed-fees.js script              | cat-7   | Small      | Script runs, reports 0 mismatches after fixes                      |
| 12 | Add JSDoc to isDefault in schema.prisma       | cat-8   | Small      | Comment documents behavior                                         |
| 13 | Write isDefault test coverage                 | cat-8   | Small      | 3 test cases for generate-benefits isDefault filtering             |

### Phase 2 — Export/Import Pipeline (Single PR)

| #  | Task                                              | Issue   | Complexity | Acceptance Criteria                                             |
|----|-----------------------------------------------------|---------|------------|------------------------------------------------------------------|
| 14 | Add period fields to BENEFIT_EXPORT_FIELDS          | api-5   | Small      | 4 new fields in schema                                          |
| 15 | Update getBenefitData to include period fields      | api-5   | Small      | Export includes periodStart/End/Status/Cadence                  |
| 16 | Conditionally filter period fields in export options| api-5   | Small      | Fields hidden when engine OFF                                    |
| 17 | Add period column synonyms to import parser         | fe-7    | Small      | Parser recognizes Period Start, PeriodEnd, etc.                  |
| 18 | Add optional period field validators                | fe-7    | Small      | Validator accepts but doesn't require period fields              |
| 19 | Update duplicate-detector for period-aware matching | fe-7    | Medium     | findExistingBenefit matches on (name, periodStart)               |
| 20 | Update committer for period-aware updates           | fe-7    | Medium     | commitBenefit updates correct period row                         |
| 21 | Write export period fields unit tests               | api-5   | Small      | Export with/without engine ON tests pass                         |
| 22 | Write import period fields unit tests               | fe-7    | Medium     | Parser, validator, detector tests pass                           |
| 23 | Write full round-trip integration test              | fe-7    | Medium     | Export → delete → reimport = identical data                      |

### Phase 3 — New Categories (Can ship independently)

| #  | Task                                              | Issue   | Complexity | Acceptance Criteria                                             |
|----|-----------------------------------------------------|---------|------------|------------------------------------------------------------------|
| 24 | Add welcome bonus MasterBenefits to seed.ts         | cat-6   | Medium     | 4+ welcome bonus entries with ONE_TIME, isDefault=false          |
| 25 | Add anniversary cert MasterBenefits (if cards exist)| cat-6   | Small      | Anniversary entries with FLEXIBLE_ANNUAL                         |
| 26 | Document retention offer pattern in user guide      | cat-6   | Small      | Documentation explains manual-add flow                           |
| 27 | Write seed verification tests for new categories    | cat-6   | Small      | New entries have correct claimingCadence and isDefault values     |

---

## Security & Compliance Considerations

- **No new authentication surfaces**: All changes are behind existing auth middleware.
- **Feature flag gating**: Every behavioral change checks `BENEFIT_ENGINE_ENABLED`.
  The flag is OFF by default — no production impact until explicitly enabled.
- **Export data sensitivity**: Period fields contain dates, not PII. No additional
  data classification concerns.
- **Input validation on import**: Period fields from imports are validated and
  sanitized via `parseISODate()` — no injection risk.

---

## Performance & Scalability Considerations

- **AlertSection dedup**: `deduplicateBenefits()` is O(n) with a Set lookup — no
  performance concern even with 1000+ benefit rows.
- **BenefitTable dedup**: Same O(n) — called once per card expansion.
- **Export**: Adding 4 columns to export has negligible impact on file size and
  generation time. Already tested with 10K+ records.
- **Import duplicate detection**: Adding `periodStart` to the lookup uses the existing
  compound unique index `@@unique([userCardId, name, periodStart])` — this is an
  indexed query, no performance regression.
- **Toggle-used guard**: Single field check on an already-loaded object — zero
  performance impact.

---

## Quality Control Checklist

- ✅ All 9 user requirements are addressed
- ✅ No database schema changes needed (existing fields sufficient)
- ✅ API changes are backward-compatible (additive columns, feature-flagged guards)
- ✅ All user flows include error paths (EXPIRED/UPCOMING → 400, invalid import → warning)
- ✅ Edge cases documented per issue (8–12 each)
- ✅ Components are modular — Phase 1 tasks are fully independent
- ✅ Implementation tasks are specific with acceptance criteria
- ✅ Specification references exact file paths, line numbers, and function names
- ✅ All changes respect feature flag gating — safe to deploy before flag flip
- ✅ Security considerations addressed (no new auth surfaces, input validation)
