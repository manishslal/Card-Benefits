# Benefit Engine Schema Redesign — Technical Specification

> **Version:** 1.0  
> **Author:** Tech-Spec-Architect  
> **Date:** April 2026  
> **Status:** DRAFT — Ready for Engineering Review  

---

## Executive Summary & Goals

Transform the Card-Benefits app from a manual, flat benefit-tracking model into an intelligent, auto-generating benefit engine. Today, `UserBenefit` duplicates `MasterBenefit` fields (name, type, stickerValue) without a foreign key reference and lacks period-based tracking. The cron job resets `isUsed` flags but never creates new period rows. This redesign introduces a proper `masterBenefitId` FK, first-class `periodStart`/`periodEnd` on every UserBenefit, automatic benefit generation when a card is added, and a period-rollover cron that creates fresh ledger entries for each new period.

### Primary Objectives
1. **Referential integrity** — UserBenefit references MasterBenefit via FK; display data is fetched via JOIN, not copied
2. **Period-based ledger** — Every UserBenefit row represents ONE period (April 2026, Q2 2026, etc.); tracking is explicit, not inferred
3. **Auto-generation on card add** — Adding a card instantly populates current-period UserBenefit rows for all associated MasterBenefits
4. **Auto-rollover via cron** — Daily cron creates next-period rows when current periods expire; old rows marked EXPIRED
5. **Zero disruption** — All existing UserBenefit data migrated safely; dashboard continues working during rollout

### Success Criteria
- All UserBenefit rows link to a MasterBenefit via `masterBenefitId`
- Dashboard loads benefit data via JOIN through `masterBenefitId` → `MasterBenefit` (no more local copies)
- Adding a card creates UserBenefit rows with correct `periodStart`/`periodEnd` within 200ms
- Cron rolls over 10,000+ benefits per run in under 30 seconds
- Existing users see identical benefit data after migration (no data loss)
- All 5 cadence types (MONTHLY, QUARTERLY, SEMI_ANNUAL, FLEXIBLE_ANNUAL, ONE_TIME) calculate correctly

---

## Table of Contents

1. [Functional Requirements](#1-functional-requirements)
2. [Implementation Phases](#2-implementation-phases)
3. [Data Schema Changes](#3-data-schema-changes)
4. [Benefit Auto-Generation Service](#4-benefit-auto-generation-service)
5. [Date Math Engine](#5-date-math-engine)
6. [API Changes](#6-api-changes)
7. [Cron Job Specification](#7-cron-job-specification)
8. [Dashboard Query Changes](#8-dashboard-query-changes)
9. [Migration Plan](#9-migration-plan)
10. [Edge Cases & Error Handling](#10-edge-cases--error-handling)
11. [Component Architecture](#11-component-architecture)
12. [Security & Compliance](#12-security--compliance)
13. [Performance & Scalability](#13-performance--scalability)
14. [Implementation Tasks Breakdown](#14-implementation-tasks-breakdown)

---

## 1. Functional Requirements

### 1.1 Core Features

| Feature | Current State | Target State |
|---------|--------------|--------------|
| Benefit creation | Manual: user adds benefits via POST `/api/benefits/add` | Automatic: benefits auto-populate when card is added |
| MasterBenefit linkage | None — UserBenefit copies `name`, `type`, `stickerValue`, `resetCadence` | FK `masterBenefitId` on UserBenefit; display data via JOIN |
| Period tracking | Single `expirationDate` field; no `periodStart` | Explicit `periodStart` + `periodEnd` per row; each row = one period |
| Period rollover | Cron resets `isUsed`/`claimedAt`/`timesUsed` on same row | Cron creates NEW row for next period; old row status → `EXPIRED` |
| Historical view | No history — resetting clears previous period data | Full history — every past period is a row with its own usage data |
| Manual benefit add | Single endpoint, user fills all fields | Still supported (custom benefits without MasterBenefit link) |

### 1.2 User Roles & Permissions

| Role | Capabilities |
|------|-------------|
| USER | Add cards, view auto-generated benefits, mark benefits as used, view history |
| ADMIN | Manage MasterCard/MasterBenefit catalog, deactivate benefits, view all users |
| SUPER_ADMIN | All ADMIN capabilities + credential rotation, system settings |

### 1.3 System Constraints

- **Database:** PostgreSQL (via Prisma ORM on Vercel/Railway)
- **Runtime:** Vercel Edge + Serverless Functions (Node.js)
- **Cron:** Vercel Cron (configured via `vercel.json`), daily at midnight UTC
- **Auth:** JWT tokens via session cookies; timing-safe CRON_SECRET for cron
- **Monetary values:** Stored in cents (integers); UI converts to dollars for display
- **Dates:** All stored and calculated in UTC; displayed in user's local timezone on client
- **Player indirection:** UserCard links through `Player` (not directly to `User`). This is existing architecture that we preserve but note as future tech debt

---

## 2. Implementation Phases

### Phase 1: Schema Migration & Data Backfill (Database Layer)
**Objective:** Modify the schema and migrate existing data without breaking anything  
**Duration:** 2-3 days  
**Deliverables:**
- Prisma schema updated with new fields on UserBenefit
- Migration SQL for adding `masterBenefitId`, `periodStart`, `periodEnd`, `periodStatus`
- Backfill script that links existing UserBenefit rows to their MasterBenefit
- Backfill script that computes `periodStart`/`periodEnd` for existing rows
- Data validation report

**Dependencies:** None (first phase)

### Phase 2: Benefit Auto-Generation Service (Backend Engine)
**Objective:** Build the service that auto-populates UserBenefit rows when a card is added  
**Duration:** 3-4 days  
**Deliverables:**
- `BenefitEngine` service module (`src/lib/benefit-engine/`)
- Date math engine for all 5 cadence types + both reset cadences
- Integration into POST `/api/cards/add` route
- Unit tests for all cadence/date math scenarios

**Dependencies:** Phase 1 (schema must be deployed)

### Phase 3: Cron Job Redesign (Period Rollover)
**Objective:** Replace the reset-in-place cron with a create-new-period cron  
**Duration:** 2-3 days  
**Deliverables:**
- New cron handler: scans expired periods → creates next-period rows → marks old as EXPIRED
- Idempotency guard (unique constraint prevents duplicates on re-run)
- Batch processing with configurable chunk size
- Monitoring/alerting hooks

**Dependencies:** Phase 2 (engine functions for date math)

### Phase 4: API & Dashboard Updates (Frontend Integration)
**Objective:** Update all API routes and dashboard to use the new schema  
**Duration:** 3-4 days  
**Deliverables:**
- Updated dashboard queries (JOIN through `masterBenefitId`)
- Period selector in dashboard UI (current/historical)
- Updated benefit cards showing period dates
- Updated `/api/benefits/user`, `/api/dashboard/benefits`, `/api/cards/my-cards`
- Deprecation of manual benefit creation for catalog benefits

**Dependencies:** Phase 2 + Phase 3 (backend must be complete)

### Phase 5: Cleanup & Hardening
**Objective:** Remove legacy fields, add monitoring, performance tune  
**Duration:** 1-2 days  
**Deliverables:**
- Remove deprecated fields (or add `@deprecated` annotations)
- Query performance validation under load
- End-to-end integration tests
- Documentation updates

**Dependencies:** Phase 4 (all features working)

---

## 3. Data Schema Changes

### 3.1 UserBenefit — MODIFIED (Primary Change)

```prisma
model UserBenefit {
  id                String    @id @default(cuid())
  userCardId        String
  playerId          String

  // ─── NEW: Foreign key to MasterBenefit catalog ───────────────────
  // Nullable to support custom user-created benefits (no master template)
  masterBenefitId   String?

  // ─── PRESERVED: Denormalized display fields (kept for custom benefits & perf) ───
  // For catalog benefits (masterBenefitId != null), these are populated from
  // MasterBenefit at creation time but the canonical source is the FK join.
  // For custom benefits (masterBenefitId == null), these are user-provided.
  name              String
  type              String
  stickerValue      Int
  resetCadence      String

  // ─── NEW: Period tracking fields ──────────────────────────────────
  // Each UserBenefit row represents ONE period. periodStart + periodEnd
  // define the window this benefit instance covers.
  periodStart       DateTime?   // Start of this benefit period (UTC)
  periodEnd         DateTime?   // End of this benefit period (UTC)
  periodStatus      String      @default("ACTIVE")
  // Enum-like values: "ACTIVE" | "EXPIRED" | "UPCOMING"

  // ─── PRESERVED: Usage tracking ────────────────────────────────────
  userDeclaredValue Int?
  isUsed            Boolean   @default(false)
  timesUsed         Int       @default(0)
  claimedAt         DateTime?

  // ─── DEPRECATED but PRESERVED for backward compat ─────────────────
  // expirationDate is superseded by periodEnd but kept during migration
  // period. Will be removed in Phase 5.
  expirationDate    DateTime?

  // ─── PRESERVED: Metadata ──────────────────────────────────────────
  status            String    @default("ACTIVE")
  importedFrom      String?
  importedAt        DateTime?
  version           Int       @default(1)
  valueHistory      String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // ─── Relations ────────────────────────────────────────────────────
  masterBenefit     MasterBenefit? @relation(fields: [masterBenefitId], references: [id], onDelete: SetNull)
  player            Player    @relation(fields: [playerId], references: [id], onDelete: Cascade)
  userCard          UserCard  @relation(fields: [userCardId], references: [id], onDelete: Cascade)

  // Phase 2A relations (preserved)
  usagePeriods      BenefitPeriod[]
  recommendations   BenefitRecommendation[]
  usageRecords      BenefitUsageRecord[]

  // ─── Indexes ──────────────────────────────────────────────────────
  // CHANGED: Replace @@unique([userCardId, name]) with new compound unique
  // to support multiple period rows per benefit:
  @@unique([userCardId, masterBenefitId, periodStart])
  // Custom benefits (no masterBenefitId) still use name uniqueness:
  @@unique([userCardId, name, periodStart])

  @@index([userCardId])
  @@index([playerId])
  @@index([masterBenefitId])
  @@index([type])
  @@index([isUsed])
  @@index([periodEnd])
  @@index([periodStatus])
  @@index([userCardId, periodStatus])
  @@index([masterBenefitId, periodStart])
}
```

### 3.2 MasterBenefit — MODIFIED (Add Reverse Relation)

```prisma
model MasterBenefit {
  id              String          @id @default(cuid())
  masterCardId    String

  name            String
  type            String
  stickerValue    Int
  resetCadence    String

  isDefault       Boolean         @default(true)
  isActive        Boolean         @default(true)

  // Phase 6C fields (already exist — no change)
  claimingCadence   String?
  claimingAmount    Int?
  claimingWindowEnd String?

  // Audit fields (already exist — no change)
  createdByAdminId String?

  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  masterCard      MasterCard      @relation(fields: [masterCardId], references: [id], onDelete: Cascade)

  // ─── NEW: Reverse relation to UserBenefit ─────────────────────────
  userBenefits    UserBenefit[]

  @@index([masterCardId])
  @@index([type])
  @@index([resetCadence])
  @@index([claimingCadence])
  @@index([isDefault])
  @@index([isActive])
}
```

### 3.3 Unique Constraint Strategy

**Problem:** The existing `@@unique([userCardId, name])` prevents multiple period rows for the same benefit on the same card.

**Solution:** Replace with two compound unique constraints:

| Constraint | Purpose | Covers |
|-----------|---------|--------|
| `@@unique([userCardId, masterBenefitId, periodStart])` | Prevents duplicate periods for the same catalog benefit | Auto-generated benefits |
| `@@unique([userCardId, name, periodStart])` | Prevents duplicate periods for custom benefits | User-created benefits |

**Idempotency guarantee:** The cron job and auto-generation service can safely retry — inserting a duplicate `(userCardId, masterBenefitId, periodStart)` will fail with a unique constraint violation, which the service catches and skips.

### 3.4 Index Strategy

| Index | Purpose | Query Pattern |
|-------|---------|--------------|
| `[userCardId, periodStatus]` | Dashboard: "show all ACTIVE benefits for this card" | `WHERE userCardId = ? AND periodStatus = 'ACTIVE'` |
| `[masterBenefitId, periodStart]` | Cron: "does next period already exist for this benefit?" | `WHERE masterBenefitId = ? AND periodStart = ?` |
| `[periodEnd]` | Cron: "find all rows where periodEnd < now" | `WHERE periodEnd < NOW()` |
| `[periodStatus]` | Cron: "find all ACTIVE rows" | `WHERE periodStatus = 'ACTIVE'` |
| `[masterBenefitId]` | JOIN for display data | `JOIN MasterBenefit ON ...` |

### 3.5 Field Semantics Reference

| Field | Type | Null? | Default | Description |
|-------|------|-------|---------|-------------|
| `masterBenefitId` | String | Yes | null | FK to MasterBenefit. Null = custom user-created benefit |
| `periodStart` | DateTime | Yes | null | UTC start of this benefit period. Null = legacy/migrating row |
| `periodEnd` | DateTime | Yes | null | UTC end of this benefit period. Null = ONE_TIME (no expiry) |
| `periodStatus` | String | No | "ACTIVE" | "ACTIVE" (current), "EXPIRED" (past), "UPCOMING" (future) |
| `isUsed` | Boolean | No | false | Has this period's benefit been claimed/used? |
| `claimedAt` | DateTime | Yes | null | When was it marked used? Null = not yet claimed |
| `timesUsed` | Int | No | 0 | How many times claimed in this period |
| `expirationDate` | DateTime | Yes | null | **DEPRECATED** — kept for backward compat, mirrors `periodEnd` during transition |

---

## 4. Benefit Auto-Generation Service

### 4.1 Module Location

```
src/lib/benefit-engine/
├── index.ts                    # Public API exports
├── generate-benefits.ts        # Core auto-generation logic
├── date-math.ts                # Period calculation engine
├── types.ts                    # Shared types/interfaces
└── __tests__/
    ├── generate-benefits.test.ts
    └── date-math.test.ts
```

### 4.2 Core Function: `generateBenefitsForCard`

```typescript
/**
 * Generates UserBenefit period rows for a newly added UserCard.
 *
 * Called within the POST /api/cards/add transaction.
 * For each active MasterBenefit on this card, creates one UserBenefit
 * row representing the CURRENT period.
 *
 * @param tx - Prisma transaction client
 * @param userCard - The newly created UserCard
 * @param playerId - The player ID for ownership
 * @param referenceDate - When the card was added (defaults to now)
 * @returns Count of benefits created
 */
async function generateBenefitsForCard(
  tx: PrismaTransactionClient,
  userCard: { id: string; masterCardId: string; renewalDate: Date },
  playerId: string,
  referenceDate: Date = new Date()
): Promise<{ count: number; benefits: GeneratedBenefit[] }>
```

**Logic Flow:**

```
1. Query MasterBenefits:
   SELECT * FROM MasterBenefit
   WHERE masterCardId = userCard.masterCardId
     AND isActive = true
     AND isDefault = true
   ORDER BY createdAt ASC

2. If no MasterBenefits found:
   → Return { count: 0, benefits: [] }
   → Log info: "No benefits configured for card {masterCardId}"
   → This is NOT an error (some cards may legitimately have 0 benefits)

3. For each MasterBenefit:
   a. Calculate periodStart & periodEnd using date math engine
      → Input: claimingCadence (or resetCadence fallback), referenceDate, renewalDate
   b. Build UserBenefit data object:
      {
        userCardId: userCard.id,
        playerId: playerId,
        masterBenefitId: masterBenefit.id,
        name: masterBenefit.name,          // denormalized copy
        type: masterBenefit.type,          // denormalized copy
        stickerValue: masterBenefit.stickerValue,  // denormalized copy
        resetCadence: masterBenefit.resetCadence,  // denormalized copy
        periodStart: calculated.periodStart,
        periodEnd: calculated.periodEnd,
        periodStatus: "ACTIVE",
        isUsed: false,
        timesUsed: 0,
        claimedAt: null,
        expirationDate: calculated.periodEnd,  // backward compat
        status: "ACTIVE",
      }

4. Batch insert via prisma.userBenefit.createMany({ data: [...] })
   → Uses skipDuplicates: true for idempotency

5. Return { count: data.length, benefits: [...] }
```

### 4.3 Why Keep Denormalized Fields?

The spec adds `masterBenefitId` as a FK but also **preserves** the copied `name`, `type`, `stickerValue`, `resetCadence` fields on UserBenefit. Rationale:

1. **Custom benefits** — Users can still create benefits without a MasterBenefit template. These custom benefits need local fields.
2. **Historical immutability** — If an admin renames a MasterBenefit, past period rows should retain the name they were created with.
3. **Performance** — Dashboard list views avoid a JOIN for 90% of display data (name, value, cadence are right on the row).
4. **Migration safety** — Existing API consumers get the same response shape; no breaking changes.

The FK is for **validation, lookup, and claiming-limit enforcement** — not for replacing denormalized reads.

---

## 5. Date Math Engine

### 5.1 Function: `calculatePeriodForBenefit`

```typescript
/**
 * Calculates the periodStart and periodEnd for a benefit based on its cadence.
 *
 * Uses claimingCadence as the primary cadence source. Falls back to resetCadence
 * if claimingCadence is not configured (legacy MasterBenefits).
 *
 * @param cadence - MONTHLY | QUARTERLY | SEMI_ANNUAL | FLEXIBLE_ANNUAL | ONE_TIME
 * @param resetCadence - CalendarYear | CardmemberYear | Monthly | OneTime (legacy)
 * @param referenceDate - The date to calculate for (card add date or "today")
 * @param renewalDate - Card renewal/anniversary date (for CardmemberYear cadence)
 * @param claimingWindowEnd - Optional custom window marker (e.g., "0918")
 * @returns { periodStart: Date, periodEnd: Date | null }
 */
function calculatePeriodForBenefit(
  cadence: ClaimingCadence | null,
  resetCadence: string,
  referenceDate: Date,
  renewalDate: Date,
  claimingWindowEnd?: string | null
): { periodStart: Date; periodEnd: Date | null }
```

### 5.2 Cadence Calculation Rules

All dates are UTC. `ref` = referenceDate.

#### MONTHLY
```
periodStart = 1st of ref's month, 00:00:00.000 UTC
periodEnd   = last day of ref's month, 23:59:59.999 UTC

Example (ref = April 8, 2026):
  periodStart = 2026-04-01T00:00:00.000Z
  periodEnd   = 2026-04-30T23:59:59.999Z

Example (ref = February 15, 2028 — leap year):
  periodStart = 2028-02-01T00:00:00.000Z
  periodEnd   = 2028-02-29T23:59:59.999Z
```

#### QUARTERLY
```
Q1: Jan 1 – Mar 31
Q2: Apr 1 – Jun 30
Q3: Jul 1 – Sep 30
Q4: Oct 1 – Dec 31

periodStart = 1st of quarter's first month, 00:00:00.000 UTC
periodEnd   = last day of quarter's last month, 23:59:59.999 UTC

Example (ref = April 8, 2026 → Q2):
  periodStart = 2026-04-01T00:00:00.000Z
  periodEnd   = 2026-06-30T23:59:59.999Z

Example (ref = November 22, 2026 → Q4):
  periodStart = 2026-10-01T00:00:00.000Z
  periodEnd   = 2026-12-31T23:59:59.999Z
```

#### SEMI_ANNUAL
```
H1: Jan 1 – Jun 30
H2: Jul 1 – Dec 31

UNLESS claimingWindowEnd is set (e.g., "0918" for Amex Saks):
  H1: Jan 1 – Sep 17  (0918 = Sept 18 is H2 start)
  H2: Sep 18 – Dec 31

Standard example (ref = April 8, 2026 → H1):
  periodStart = 2026-01-01T00:00:00.000Z
  periodEnd   = 2026-06-30T23:59:59.999Z

Custom window example (claimingWindowEnd = "0918", ref = Oct 5, 2026 → H2):
  periodStart = 2026-09-18T00:00:00.000Z
  periodEnd   = 2026-12-31T23:59:59.999Z
```

#### FLEXIBLE_ANNUAL

Two sub-types based on `resetCadence`:

**Calendar Year (`resetCadence = "CalendarYear"` or "ANNUAL")**
```
periodStart = Jan 1 of ref's year, 00:00:00.000 UTC
periodEnd   = Dec 31 of ref's year, 23:59:59.999 UTC

Example (ref = April 8, 2026):
  periodStart = 2026-01-01T00:00:00.000Z
  periodEnd   = 2026-12-31T23:59:59.999Z
```

**Cardmember Anniversary (`resetCadence = "CardmemberYear"`)**
```
periodStart = renewalDate anniversary in the current cycle
periodEnd   = day before next renewalDate anniversary, 23:59:59.999 UTC

Algorithm:
  1. Get month/day from renewalDate (e.g., May 15)
  2. Build candidate = (ref's year, renewal month, renewal day)
  3. If ref >= candidate: period = candidate → (candidate + 1 year - 1 day)
  4. If ref < candidate: period = (candidate - 1 year) → (candidate - 1 day)

Example (renewalDate = May 15, ref = April 8, 2026):
  Candidate 2026-05-15; ref < candidate
  periodStart = 2025-05-15T00:00:00.000Z
  periodEnd   = 2026-05-14T23:59:59.999Z

Example (renewalDate = May 15, ref = July 20, 2026):
  Candidate 2026-05-15; ref >= candidate
  periodStart = 2026-05-15T00:00:00.000Z
  periodEnd   = 2027-05-14T23:59:59.999Z
```

#### ONE_TIME
```
periodStart = referenceDate (card add date), 00:00:00.000 UTC
periodEnd   = null (never expires)

Example (ref = April 8, 2026):
  periodStart = 2026-04-08T00:00:00.000Z
  periodEnd   = null
```

### 5.3 Cadence Resolution Priority

When determining which cadence to use for period calculation:

```
1. If MasterBenefit.claimingCadence is set → use claimingCadence
2. Else, map MasterBenefit.resetCadence to period type:
   "Monthly"        → MONTHLY
   "CalendarYear"   → FLEXIBLE_ANNUAL (calendar)
   "CardmemberYear" → FLEXIBLE_ANNUAL (anniversary)
   "OneTime"        → ONE_TIME
   other/null       → MONTHLY (safe default)
```

### 5.4 Next Period Calculation (for Cron Rollover)

```typescript
function calculateNextPeriod(
  currentPeriodEnd: Date,
  cadence: ClaimingCadence,
  resetCadence: string,
  renewalDate: Date,
  claimingWindowEnd?: string | null
): { periodStart: Date; periodEnd: Date | null }
```

**Rules:**
- **MONTHLY:** Next period starts on `currentPeriodEnd + 1 day` (1st of next month)
- **QUARTERLY:** Next period starts on 1st of next quarter
- **SEMI_ANNUAL:** H1→H2 (Jul 1), H2→H1 next year (Jan 1). Custom windows shift accordingly.
- **FLEXIBLE_ANNUAL (Calendar):** Jan 1 of next year
- **FLEXIBLE_ANNUAL (Anniversary):** Next renewalDate anniversary
- **ONE_TIME:** No next period (return null)

### 5.5 Mid-Period Card Addition

When a user adds a card mid-period (e.g., April 15 for a MONTHLY benefit):

**Decision: Use the FULL current period, not a prorated period.**

Rationale:
- Credit card issuers grant the full monthly credit regardless of when the card was opened
- Prorating would add complexity without reflecting real-world issuer behavior
- The `periodStart` is set to the period's natural start (April 1), not the card add date

Example: User adds Amex Gold on April 15, 2026
- Monthly $10 Dining Credit → periodStart: April 1, periodEnd: April 30
- The user has 15 days remaining to claim this month's credit (realistic)

---

## 6. API Changes

### 6.1 POST `/api/cards/add` — MODIFIED

**Change:** Replace the current `createMany` benefit cloning with `generateBenefitsForCard()`.

**Current flow:**
```
1. Create UserCard
2. Find MasterBenefits for card
3. createMany UserBenefits (copy name/type/stickerValue/resetCadence; expirationDate = null)
```

**New flow:**
```
1. Create UserCard
2. Call generateBenefitsForCard(tx, userCard, playerId, now)
   → internally queries MasterBenefits
   → calculates periods
   → creates UserBenefits with masterBenefitId, periodStart, periodEnd
3. Return response with benefitsCreated count
```

**Request body:** No change.

**Response body:** Extended with period info:
```json
{
  "success": true,
  "userCard": { /* unchanged */ },
  "benefitsCreated": 8,
  "benefitsGenerated": [
    {
      "name": "$10 Monthly Dining Credit",
      "periodStart": "2026-04-01T00:00:00.000Z",
      "periodEnd": "2026-04-30T23:59:59.999Z",
      "masterBenefitId": "clx..."
    }
  ],
  "message": "Card added with 8 benefits for the current period"
}
```

### 6.2 GET `/api/cards/my-cards` — MODIFIED

**Change:** Include `masterBenefitId` and period fields in benefit sub-objects. Filter to `periodStatus = 'ACTIVE'` by default.

**Updated Prisma query:**
```typescript
userBenefits: {
  where: {
    status: { not: 'ARCHIVED' },
    periodStatus: 'ACTIVE',            // NEW: only current period
  },
  include: {
    masterBenefit: {                    // NEW: join for claiming data
      select: {
        id: true,
        claimingCadence: true,
        claimingAmount: true,
        claimingWindowEnd: true,
      },
    },
  },
}
```

**Response change per benefit:**
```json
{
  "id": "clx...",
  "name": "$10 Monthly Dining Credit",
  "type": "StatementCredit",
  "stickerValue": 1000,
  "isUsed": false,
  "masterBenefitId": "clx...",
  "periodStart": "2026-04-01T00:00:00.000Z",
  "periodEnd": "2026-04-30T23:59:59.999Z",
  "periodStatus": "ACTIVE",
  "claimingCadence": "MONTHLY",
  "claimingAmount": 1000
}
```

### 6.3 POST `/api/dashboard/benefits` — MODIFIED

**Change:** Query includes `periodStatus` filter and returns period metadata.

**Updated query:**
```typescript
const benefits = await prisma.userBenefit.findMany({
  where: {
    userCardId: { in: cardIds },
    status: { not: 'ARCHIVED' },
    periodStatus: 'ACTIVE',           // NEW
  },
  include: {
    masterBenefit: {                   // NEW
      select: {
        claimingCadence: true,
        claimingAmount: true,
      },
    },
  },
  take: 100,
});
```

### 6.4 GET `/api/benefits/[id]` — MODIFIED

**Change:** Return `masterBenefitId`, `periodStart`, `periodEnd`, `periodStatus` in response.

### 6.5 PATCH `/api/benefits/[id]` — MODIFIED

**Change:** Prevent editing `name`, `type`, `stickerValue` on catalog benefits (those with `masterBenefitId`). Only allow editing `userDeclaredValue`, `isUsed`.

```typescript
// If benefit has masterBenefitId, block catalog field edits
if (benefit.masterBenefitId && (body.name || body.type || body.stickerValue)) {
  return NextResponse.json({
    success: false,
    error: 'Cannot edit catalog fields on auto-generated benefits',
    code: 'CATALOG_BENEFIT_READONLY',
  }, { status: 400 });
}
```

### 6.6 POST `/api/benefits/add` — MODIFIED (Deprecation Path)

**Change:** This endpoint continues to work for **custom benefits** (user-created, no MasterBenefit link). But if the user tries to add a benefit that matches an existing MasterBenefit for their card, return an error directing them to use the card-add flow.

```typescript
// Check if this benefit name matches a MasterBenefit for this card
const matchingMaster = await prisma.masterBenefit.findFirst({
  where: {
    masterCardId: userCard.masterCardId,
    name: body.name,
    isActive: true,
  },
});

if (matchingMaster) {
  return NextResponse.json({
    success: false,
    error: 'This benefit is auto-managed. It was generated when you added this card.',
    code: 'BENEFIT_AUTO_MANAGED',
    details: 'Auto-managed benefits cannot be manually created.',
  }, { status: 409 });
}
```

### 6.7 POST `/api/benefits/usage` — MODIFIED

**Change:** Use `masterBenefitId` directly instead of the current name-matching workaround.

**Current (lines 140-158 of usage/route.ts):**
```typescript
// WORKAROUND: Try to find matching master benefit by name/type/resetCadence
const masterBenefits = await prisma.masterBenefit.findMany({
  where: {
    masterCardId: userBenefit.userCard.masterCardId,
    name: userBenefit.name,
    type: userBenefit.type,
  },
  take: 1,
});
```

**New:**
```typescript
// DIRECT: Use the FK
let masterBenefit = null;
if (userBenefit.masterBenefitId) {
  masterBenefit = await prisma.masterBenefit.findUnique({
    where: { id: userBenefit.masterBenefitId },
  });
}
```

### 6.8 NEW: GET `/api/benefits/history` (New Endpoint)

**Purpose:** Fetch historical (expired) benefit periods for a card or all cards.

**Query parameters:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `userCardId` | string | No | — | Filter to specific card |
| `masterBenefitId` | string | No | — | Filter to specific benefit type |
| `page` | number | No | 1 | Pagination |
| `limit` | number | No | 20 | Results per page (max 100) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clx...",
      "name": "$10 Monthly Dining Credit",
      "periodStart": "2026-03-01T00:00:00.000Z",
      "periodEnd": "2026-03-31T23:59:59.999Z",
      "periodStatus": "EXPIRED",
      "isUsed": true,
      "claimedAt": "2026-03-15T12:00:00.000Z",
      "stickerValue": 1000,
      "cardName": "American Express Gold Card"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

**Prisma query:**
```typescript
await prisma.userBenefit.findMany({
  where: {
    playerId: player.id,
    periodStatus: 'EXPIRED',
    ...(userCardId && { userCardId }),
    ...(masterBenefitId && { masterBenefitId }),
  },
  include: {
    userCard: { include: { masterCard: { select: { cardName: true } } } },
  },
  orderBy: { periodEnd: 'desc' },
  skip: (page - 1) * limit,
  take: limit,
});
```

---

## 7. Cron Job Specification

### 7.1 Overview

**Endpoint:** GET `/api/cron/reset-benefits` (same URL, redesigned handler)  
**Trigger:** Vercel Cron, daily at `0 0 * * *` (midnight UTC)  
**Auth:** `Authorization: Bearer <CRON_SECRET>` (timing-safe comparison — preserved)  

### 7.2 New Behavior

**OLD behavior (current):** Finds used+expired benefits → resets `isUsed`/`claimedAt`/`timesUsed` in-place → advances `expirationDate`

**NEW behavior:** Finds ALL benefits (used or unused) where `periodEnd < now` AND `periodStatus = 'ACTIVE'` → marks them `EXPIRED` → creates NEW `UserBenefit` rows for the next period

### 7.3 Detailed Logic

```
1. QUERY: Find all benefits whose period has ended
   SELECT * FROM UserBenefit
   WHERE periodEnd IS NOT NULL
     AND periodEnd < NOW()
     AND periodStatus = 'ACTIVE'
     AND status != 'ARCHIVED'
   INCLUDE userCard (need renewalDate, isOpen, status)
   INCLUDE masterBenefit (need claimingCadence, claimingWindowEnd)

2. FILTER: Only process benefits for active cards
   Filter out where:
   - userCard.isOpen = false
   - userCard.status = 'DELETED' or 'CLOSED'
   → Log count of skipped (inactive card) benefits

3. BATCH: Process in chunks of 100 (configurable)
   For each chunk:

   a. MARK OLD: Update all chunk rows:
      SET periodStatus = 'EXPIRED'
      SET status = 'EXPIRED' (for backward compat)

   b. CALCULATE NEXT: For each benefit in chunk:
      nextPeriod = calculateNextPeriod(
        benefit.periodEnd,
        masterBenefit.claimingCadence || benefit.resetCadence,
        benefit.resetCadence,
        userCard.renewalDate,
        masterBenefit.claimingWindowEnd
      )

   c. GUARD: Skip ONE_TIME benefits (nextPeriod returns null)

   d. GUARD: Check for deactivated MasterBenefit
      If masterBenefit.isActive = false:
        → Skip (do not generate next period)
        → Log: "Skipping deactivated benefit {id}"

   e. INSERT NEXT: createMany with skipDuplicates: true
      {
        userCardId: benefit.userCardId,
        playerId: benefit.playerId,
        masterBenefitId: benefit.masterBenefitId,
        name: benefit.name,
        type: benefit.type,
        stickerValue: benefit.stickerValue,
        resetCadence: benefit.resetCadence,
        periodStart: nextPeriod.periodStart,
        periodEnd: nextPeriod.periodEnd,
        periodStatus: 'ACTIVE',
        isUsed: false,
        timesUsed: 0,
        claimedAt: null,
        expirationDate: nextPeriod.periodEnd,  // backward compat
        status: 'ACTIVE',
      }

4. REPORT: Return summary
   {
     ok: true,
     expiredCount: <rows marked expired>,
     generatedCount: <new rows created>,
     skippedInactiveCard: <count>,
     skippedDeactivatedBenefit: <count>,
     skippedOneTime: <count>,
     processedAt: <ISO timestamp>,
     durationMs: <elapsed>
   }
```

### 7.4 Idempotency

The cron is idempotent due to the unique constraint `@@unique([userCardId, masterBenefitId, periodStart])`:

- **First run:** Marks expired rows, creates next-period rows → succeeds
- **Second run (same day):** `periodEnd < now` query returns nothing (old rows already `EXPIRED`, new rows have future `periodEnd`) → `expiredCount: 0, generatedCount: 0`
- **Crash mid-run:** If the DB transaction fails, nothing is committed. Re-run picks up where it left off.

For non-transactional batching (if chunks are committed independently):
- Marking `periodStatus = 'EXPIRED'` is idempotent (setting same value twice is safe)
- `createMany` with `skipDuplicates: true` skips rows that already exist

### 7.5 Batch Processing Strategy

```
CHUNK_SIZE = 100  (configurable via env CRON_BATCH_SIZE)
PAUSE_MS = 50     (configurable via env CRON_BATCH_PAUSE_MS)

for each chunk of CHUNK_SIZE:
  await prisma.$transaction([
    ...markExpiredOps,
    ...createNextPeriodOps,
  ])
  await sleep(PAUSE_MS)  // prevent DB connection exhaustion
```

### 7.6 Monitoring & Alerting

Log each run with structured JSON:
```json
{
  "event": "cron_complete",
  "timestamp": "2026-04-09T00:00:12.345Z",
  "durationMs": 1234,
  "expiredCount": 847,
  "generatedCount": 845,
  "skippedInactiveCard": 2,
  "skippedDeactivatedBenefit": 0,
  "errorCount": 0
}
```

**Alert conditions (integrate with monitoring):**
- `durationMs > 60000` (>1 minute) → warning
- `errorCount > 0` → error alert
- `generatedCount` differs significantly from `expiredCount` → warning (data inconsistency)
- Cron hasn't run in 25+ hours → critical (missed run)

---

## 8. Dashboard Query Changes

### 8.1 Primary Dashboard Query

**Current:** Fetches UserBenefits directly, uses local `name`/`type`/`stickerValue` fields.

**New:** Same fields (denormalized), but filtered by `periodStatus = 'ACTIVE'` and enriched with `masterBenefitId` for claiming validation.

```typescript
// Dashboard benefit query
const benefits = await prisma.userBenefit.findMany({
  where: {
    playerId: player.id,
    status: { not: 'ARCHIVED' },
    periodStatus: 'ACTIVE',
  },
  include: {
    userCard: {
      include: {
        masterCard: {
          select: { issuer: true, cardName: true, cardImageUrl: true },
        },
      },
    },
    masterBenefit: {
      select: {
        claimingCadence: true,
        claimingAmount: true,
        claimingWindowEnd: true,
      },
    },
  },
  orderBy: [
    { periodEnd: 'asc' },    // Expiring soonest first
    { name: 'asc' },
  ],
});
```

### 8.2 Dashboard Response Shape

Each benefit card displays:

```
┌─────────────────────────────────────┐
│ $10 Monthly Dining Credit           │
│ American Express Gold Card          │
│                                     │
│ Period: Apr 1 – Apr 30, 2026        │  ← NEW: period dates
│ Status: ○ Unclaimed                 │
│ Value: $10.00                       │
│ Claiming: $10.00 remaining          │  ← from MasterBenefit JOIN
│ Expires in: 22 days                 │
└─────────────────────────────────────┘
```

### 8.3 Period Filter (UI Enhancement)

Add a period selector to the dashboard:

```
[Current Period ▾]
├── Current Period (default)
├── Previous Period
├── All History
└── Custom Range...
```

**"Current Period"** → `WHERE periodStatus = 'ACTIVE'`  
**"Previous Period"** → `WHERE periodStatus = 'EXPIRED' ORDER BY periodEnd DESC LIMIT by unique (masterBenefitId, max periodEnd)`  
**"All History"** → No periodStatus filter; paginated  

### 8.4 Summary Calculations

The dashboard summary (total value, active count) should only consider ACTIVE period benefits:

```typescript
const summary = {
  totalCards: cards.length,
  activeCards: cards.filter(c => c.isOpen).length,
  totalBenefitValue: activeBenefits.reduce((sum, b) => sum + b.stickerValue, 0),
  activeBenefits: activeBenefits.length,
  usedBenefits: activeBenefits.filter(b => b.isUsed).length,
  unusedBenefits: activeBenefits.filter(b => !b.isUsed).length,
  // NEW: Period-aware metrics
  expiringToday: activeBenefits.filter(b => isExpiringToday(b.periodEnd)).length,
  expiringSoon: activeBenefits.filter(b => getDaysUntilExpiration(b.periodEnd) <= 3).length,
};
```

---

## 9. Migration Plan

### 9.1 Pre-Migration: Schema Deployment

**Step 1: Add new columns (non-breaking)**

```sql
-- Migration: add_benefit_engine_fields
ALTER TABLE "UserBenefit" ADD COLUMN "masterBenefitId" TEXT;
ALTER TABLE "UserBenefit" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "UserBenefit" ADD COLUMN "periodEnd" TIMESTAMP(3);
ALTER TABLE "UserBenefit" ADD COLUMN "periodStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Add foreign key
ALTER TABLE "UserBenefit"
  ADD CONSTRAINT "UserBenefit_masterBenefitId_fkey"
  FOREIGN KEY ("masterBenefitId")
  REFERENCES "MasterBenefit"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "UserBenefit_masterBenefitId_idx" ON "UserBenefit"("masterBenefitId");
CREATE INDEX "UserBenefit_periodEnd_idx" ON "UserBenefit"("periodEnd");
CREATE INDEX "UserBenefit_periodStatus_idx" ON "UserBenefit"("periodStatus");
CREATE INDEX "UserBenefit_userCardId_periodStatus_idx" ON "UserBenefit"("userCardId", "periodStatus");
CREATE INDEX "UserBenefit_masterBenefitId_periodStart_idx" ON "UserBenefit"("masterBenefitId", "periodStart");
```

This migration is **non-breaking** because:
- All new columns are nullable or have defaults
- The FK is nullable (SET NULL on delete)
- No existing columns are removed or renamed
- Existing queries continue to work without modification

**Step 2: Deploy new API code that reads both old and new fields**

Code must handle `masterBenefitId = null` and `periodStart = null` gracefully during the transition window.

### 9.2 Data Backfill

**Step 3: Run backfill script**

```typescript
async function backfillMasterBenefitIds() {
  // Find all UserBenefits without masterBenefitId
  const orphanBenefits = await prisma.userBenefit.findMany({
    where: { masterBenefitId: null },
    include: { userCard: true },
  });

  let linked = 0;
  let unlinked = 0;

  for (const ub of orphanBenefits) {
    // Try to match by name + type + card
    const match = await prisma.masterBenefit.findFirst({
      where: {
        masterCardId: ub.userCard.masterCardId,
        name: ub.name,
        type: ub.type,
        isActive: true,
      },
    });

    if (match) {
      await prisma.userBenefit.update({
        where: { id: ub.id },
        data: { masterBenefitId: match.id },
      });
      linked++;
    } else {
      // No match — this is a custom benefit or orphaned data
      console.log(`No MasterBenefit match for: ${ub.name} on card ${ub.userCard.masterCardId}`);
      unlinked++;
    }
  }

  console.log(`Backfill complete: ${linked} linked, ${unlinked} unmatched`);
}
```

**Step 4: Backfill period dates**

```typescript
async function backfillPeriodDates() {
  const benefits = await prisma.userBenefit.findMany({
    where: { periodStart: null },
    include: {
      userCard: true,
      masterBenefit: true,
    },
  });

  for (const ub of benefits) {
    const cadence = ub.masterBenefit?.claimingCadence || ub.resetCadence;
    const { periodStart, periodEnd } = calculatePeriodForBenefit(
      cadence,
      ub.resetCadence,
      new Date(), // Current period for all existing rows
      ub.userCard.renewalDate
    );

    await prisma.userBenefit.update({
      where: { id: ub.id },
      data: {
        periodStart,
        periodEnd,
        periodStatus: periodEnd && periodEnd < new Date() ? 'EXPIRED' : 'ACTIVE',
        expirationDate: periodEnd, // sync deprecated field
      },
    });
  }
}
```

### 9.3 Unique Constraint Swap

**Step 5: Drop old unique, add new unique constraints**

```sql
-- CAUTION: This must happen AFTER backfill and AFTER verifying no duplicates

-- Check for violations first:
-- SELECT "userCardId", "masterBenefitId", "periodStart", COUNT(*)
-- FROM "UserBenefit"
-- GROUP BY "userCardId", "masterBenefitId", "periodStart"
-- HAVING COUNT(*) > 1;

-- Drop old constraint
ALTER TABLE "UserBenefit" DROP CONSTRAINT "UserBenefit_userCardId_name_key";

-- Add new constraints
CREATE UNIQUE INDEX "UserBenefit_userCardId_masterBenefitId_periodStart_key"
  ON "UserBenefit"("userCardId", "masterBenefitId", "periodStart")
  WHERE "masterBenefitId" IS NOT NULL;

CREATE UNIQUE INDEX "UserBenefit_userCardId_name_periodStart_key"
  ON "UserBenefit"("userCardId", "name", "periodStart")
  WHERE "masterBenefitId" IS NULL;
```

### 9.4 Rollback Strategy

If migration fails at any step:

| Step | Rollback Action |
|------|----------------|
| Step 1 (add columns) | `ALTER TABLE DROP COLUMN` for each new column |
| Step 2 (deploy code) | Revert to previous deployment (Vercel instant rollback) |
| Step 3 (backfill IDs) | Set `masterBenefitId = null` for all affected rows |
| Step 4 (backfill dates) | Set `periodStart = null, periodEnd = null, periodStatus = 'ACTIVE'` |
| Step 5 (constraints) | Re-add old `@@unique([userCardId, name])`, drop new constraints |

### 9.5 Zero-Downtime Approach

1. **Phase 1 migration is additive** — no columns removed, no renames, no constraint changes
2. **Dual-read code** — API routes handle both `masterBenefitId = null` (legacy) and `masterBenefitId = 'clx...'` (new)
3. **Backfill runs as a one-time script** — does not lock tables (individual row updates)
4. **Constraint swap** is the only brief risk window — run during low-traffic period
5. **Feature flag** `BENEFIT_ENGINE_ENABLED` controls whether auto-generation is active:
   - `false` (default during migration): cards/add uses old clone logic
   - `true` (after backfill verified): cards/add uses new generateBenefitsForCard

---

## 10. Edge Cases & Error Handling

### EC-1: Card Added Mid-Period
**Scenario:** User adds Amex Gold on April 15 (mid-month)  
**Handling:** Generate UserBenefit with `periodStart = April 1, periodEnd = April 30`. Full period is granted. User has 15 days to claim.  
**Rationale:** Matches real-world issuer behavior (full credit available immediately).

### EC-2: Card Deleted With Active Benefits
**Scenario:** User deletes/closes card that has ACTIVE period benefits  
**Handling:**
- UserCard status → 'DELETED'
- All associated UserBenefits: `status → 'ARCHIVED'`, `periodStatus → 'EXPIRED'`
- Cron skips archived benefits (no future periods generated)
- Historical records preserved for reporting

### EC-3: Benefit Marked "Used" Then Card Cancelled
**Scenario:** User claims $10 dining credit, then cancels Amex Gold next day  
**Handling:** The claimed benefit stays as-is (`isUsed = true`). Card deletion archives future periods but does not undo past claims. Usage records in `BenefitUsageRecord` remain intact.

### EC-4: Two Cards With Same MasterBenefit
**Scenario:** User has two Amex cards that both offer "$10 Monthly Dining Credit"  
**Handling:** Each UserCard generates its own UserBenefit rows independently. The unique constraint is `(userCardId, masterBenefitId, periodStart)` — different userCardIds mean no conflict. Both appear in dashboard as separate benefit instances.

### EC-5: Leap Year / Feb 28-29 Boundaries
**Scenario:** Monthly benefit in February  
**Handling:** `Date.UTC(year, month + 1, 0)` correctly returns Feb 28 in non-leap years and Feb 29 in leap years. Already handled by existing `calcExpirationDate` logic.

**Test cases:**
- Feb 2026 (non-leap): periodEnd = Feb 28, 23:59:59.999Z
- Feb 2028 (leap): periodEnd = Feb 29, 23:59:59.999Z

### EC-6: Anniversary Date on Month Boundary
**Scenario:** Card renewal date is Feb 29 (leap day), now it's a non-leap year  
**Handling:** `Date.UTC(2027, 1, 29)` → JavaScript rolls to March 1. The period math must normalize: if renewal is Feb 29 and year is non-leap, treat as Feb 28.

```typescript
// Normalize renewal date for non-leap years
function normalizeDate(year: number, month: number, day: number): Date {
  const candidate = new Date(Date.UTC(year, month, day));
  // If JavaScript rolled the month forward, use last day of intended month
  if (candidate.getUTCMonth() !== month) {
    return new Date(Date.UTC(year, month + 1, 0)); // last day of month
  }
  return candidate;
}
```

### EC-7: User With No Cards
**Scenario:** User account exists but no UserCards  
**Handling:** Dashboard returns empty array. No UserBenefits to generate or roll over. Cron skips this user (no matching rows).

### EC-8: MasterBenefit Deactivated After User Has It
**Scenario:** Admin sets `MasterBenefit.isActive = false` while users have active periods  
**Handling:**
- **Current period:** The existing UserBenefit row remains ACTIVE and functional. User can still claim it.
- **Next period:** Cron checks `masterBenefit.isActive` before generating next period. If false, skips generation and logs it.
- **UserBenefit.masterBenefitId** still points to the deactivated MasterBenefit (FK with `ON DELETE SET NULL`).
- If MasterBenefit is deleted entirely, `masterBenefitId` becomes null (graceful degradation).

### EC-9: Timezone Considerations
**Scenario:** User in UTC-12 (Baker Island) sees "April 30" as their local date, but it's already May 1 UTC  
**Handling:**
- All period calculations use UTC exclusively (server-side)
- `periodEnd` stored as `2026-04-30T23:59:59.999Z`
- Client-side display converts to local timezone via `Intl.DateTimeFormat`
- The cron runs at midnight UTC; users in late timezones may see their benefit "expire" before midnight local time
- **Decision:** Accept UTC-based period boundaries as the standard. Document this for users.

### EC-10: Concurrent Cron Job Runs
**Scenario:** Vercel accidentally triggers cron twice at midnight (rare but possible)  
**Handling:**
- **Idempotency via unique constraint:** `@@unique([userCardId, masterBenefitId, periodStart])` prevents duplicate rows
- **createMany with skipDuplicates:** Second run's inserts silently skip existing rows
- **Marking EXPIRED is idempotent:** Setting `periodStatus = 'EXPIRED'` on already-expired rows is a no-op

### EC-11: MasterBenefit Added to Card After Users Already Have It
**Scenario:** Admin adds new "Free Checked Bag" benefit to Amex Gold. Users already have the card.  
**Handling:**
- New MasterBenefit does NOT retroactively create UserBenefit rows
- **Future enhancement:** Admin action "push benefit to existing cardholders" (out of scope for this spec)
- Users who re-add the card (delete + re-add) would get the new benefit
- Consider a one-time admin script for mass-backfill

### EC-12: Benefit With `claimingCadence` That Differs From `resetCadence`
**Scenario:** MasterBenefit has `resetCadence = "CalendarYear"` but `claimingCadence = "MONTHLY"` (e.g., Amex Platinum Uber Cash: $200/year but dispensed $15/month)  
**Handling:**
- `claimingCadence` takes priority for period calculation (generates monthly rows)
- `resetCadence` is preserved on UserBenefit for backward compatibility
- `stickerValue` on UserBenefit reflects the annual value (from MasterBenefit)
- `claimingAmount` on MasterBenefit reflects the per-period limit ($15/month = 1500 cents)

### EC-13: Custom Benefit (No MasterBenefit Link) Period Handling
**Scenario:** User manually creates a benefit not in the catalog  
**Handling:**
- `masterBenefitId = null`
- User must specify `periodStart`/`periodEnd` manually, OR the system defaults:
  - If `resetCadence = "Monthly"` → auto-calculate current month period
  - If `resetCadence = "OneTime"` → periodEnd = null
- Cron rolls over custom benefits using the same date math (keyed by resetCadence)
- Unique constraint uses `(userCardId, name, periodStart)` for custom benefits

### EC-14: Very Old Expired Periods (Data Volume)
**Scenario:** After 2 years, a monthly benefit has 24+ EXPIRED rows  
**Handling:**
- Dashboard only queries `periodStatus = 'ACTIVE'` (fast)
- History endpoint is paginated (max 100 per page)
- **Future enhancement:** Archive/purge periods older than N months (out of scope for this spec)
- Index on `periodEnd` ensures cron queries remain fast regardless of total row count

---

## 11. Component Architecture

### 11.1 System Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────┐ │
│  │Dashboard │  │Card Add  │  │ Benefit   │  │ History View  │ │
│  │Component │  │Flow      │  │ Cards     │  │               │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └──────┬────────┘ │
└───────┼──────────────┼──────────────┼───────────────┼──────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API LAYER (Next.js Routes)                  │
│  ┌──────────────┐  ┌───────────┐  ┌──────────┐  ┌───────────┐ │
│  │GET /dashboard│  │POST /cards│  │GET /my-  │  │GET /history│ │
│  │  /benefits   │  │   /add    │  │  cards   │  │  (NEW)     │ │
│  └──────┬───────┘  └─────┬─────┘  └────┬─────┘  └─────┬─────┘ │
│         │                │              │              │        │
│         └────────┬───────┘──────────────┘──────────────┘        │
│                  ▼                                              │
│  ┌──────────────────────────────────────────┐                   │
│  │         BENEFIT ENGINE SERVICE            │                   │
│  │  ┌──────────────────┐  ┌──────────────┐  │                   │
│  │  │ generateBenefits │  │ Date Math    │  │                   │
│  │  │ ForCard()        │  │ Engine       │  │                   │
│  │  └────────┬─────────┘  └──────┬───────┘  │                   │
│  │           │                   │           │                   │
│  │  ┌────────┴───────────────────┴────────┐  │                   │
│  │  │    calculatePeriodForBenefit()      │  │                   │
│  │  │    calculateNextPeriod()            │  │                   │
│  │  └────────────────────────────────────┘  │                   │
│  └──────────────────────────────────────────┘                   │
│                  │                                              │
│  ┌───────────────┴───────────────────────────────┐              │
│  │            CRON JOB (Daily Midnight UTC)       │              │
│  │  1. Find expired ACTIVE periods                │              │
│  │  2. Mark as EXPIRED                            │              │
│  │  3. Generate next period rows                  │              │
│  │  4. Log results                                │              │
│  └───────────────┬───────────────────────────────┘              │
└──────────────────┼──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                         │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │MasterCard│◄─┤MasterBenefit │◄─┤UserBenefit  │               │
│  │          │  │              │  │(period rows)│               │
│  └──────────┘  └──────────────┘  └──────┬──────┘               │
│                                         │                       │
│  ┌──────┐  ┌──────┐  ┌────────┐  ┌─────┴──────┐               │
│  │ User │──┤Player│──┤UserCard│──┤             │               │
│  │      │  │      │  │        │  │             │               │
│  └──────┘  └──────┘  └────────┘  └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Component Responsibilities

| Component | Responsibility | Dependencies |
|-----------|---------------|-------------|
| **Benefit Engine Service** | Core business logic: period calculation, benefit generation | Date Math Engine, Prisma Client |
| **Date Math Engine** | Pure functions for period boundary calculation | None (pure math) |
| **Card Add Route** | Orchestrates card creation + benefit generation | Benefit Engine Service |
| **Cron Handler** | Period rollover, expiration marking | Benefit Engine Service, Rate Limiter |
| **Dashboard Query** | Fetches current-period benefits with JOINs | Prisma Client |
| **History Endpoint** | Fetches expired periods with pagination | Prisma Client |
| **Migration Scripts** | One-time data backfill | Prisma Client, Benefit Engine |

### 11.3 Integration Points

```
Card Add Route ──calls──► Benefit Engine ──calls──► Date Math Engine
                                │
                                └──writes──► PostgreSQL (UserBenefit table)

Cron Handler ──calls──► Benefit Engine ──calls──► Date Math Engine
                              │
                              ├──reads──► PostgreSQL (expired periods)
                              └──writes──► PostgreSQL (new periods + mark expired)

Dashboard Route ──reads──► PostgreSQL (JOIN UserBenefit + MasterBenefit)

Usage Route ──reads──► PostgreSQL (UserBenefit.masterBenefitId → MasterBenefit)
```

---

## 12. Security & Compliance

### 12.1 Authentication & Authorization

| Endpoint | Auth Method | Authorization |
|----------|------------|---------------|
| POST `/api/cards/add` | JWT session cookie | User owns the Player |
| GET `/api/cards/my-cards` | JWT session cookie | User owns the Player |
| POST `/api/dashboard/benefits` | JWT session cookie | User owns the Player |
| GET `/api/benefits/history` | JWT session cookie | User owns the Player |
| GET `/api/cron/reset-benefits` | Bearer CRON_SECRET | Timing-safe comparison |

No changes to auth model. All existing middleware applies.

### 12.2 Data Protection

- **No PII in benefit data** — UserBenefit contains card references and usage flags, not personal information
- **Cascading deletes** — When a User is deleted, Player → UserCard → UserBenefit cascade ensures no orphaned data
- **Soft deletes** — Card deletion archives benefits (status = 'ARCHIVED'), does not hard-delete
- **Audit trail** — AdminAuditLog tracks MasterBenefit changes (already exists)

### 12.3 Cron Security (Preserved)

- CRON_SECRET in environment variables (never in code)
- Timing-safe comparison prevents secret inference
- Rate limiting: 10 requests/hour/IP
- All attempts logged with IP, timestamp, outcome

---

## 13. Performance & Scalability

### 13.1 Expected Load

| Metric | Current | Year 1 Target | Year 3 Target |
|--------|---------|---------------|---------------|
| Users | ~100 | ~5,000 | ~50,000 |
| Cards per user | ~3 | ~3 | ~5 |
| Benefits per card | ~8 | ~8 | ~10 |
| UserBenefit rows | ~2,400 | ~120,000 | ~2,500,000 |
| Cron rows/run | ~800 | ~40,000 | ~500,000 |

### 13.2 Query Performance

**Dashboard query (most frequent):**
```sql
SELECT ub.*, mb."claimingCadence", mb."claimingAmount"
FROM "UserBenefit" ub
LEFT JOIN "MasterBenefit" mb ON ub."masterBenefitId" = mb.id
WHERE ub."playerId" = $1
  AND ub."status" != 'ARCHIVED'
  AND ub."periodStatus" = 'ACTIVE'
ORDER BY ub."periodEnd" ASC, ub."name" ASC
```

**Index coverage:** `[playerId]` + `[periodStatus]` → index scan, not table scan.

**Estimated performance:**
- 100 users: <5ms
- 5,000 users: <10ms (filtered by playerId, small result set)
- 50,000 users: <15ms (index-only scan on playerId)

### 13.3 Cron Performance

**At 50,000 users (worst case):**
- ~500,000 UserBenefit rows, ~40,000 expire daily (monthly benefits)
- Batch size: 100, pause: 50ms
- 400 batches × (50ms pause + ~20ms query) = ~28 seconds total
- Well within the 30-second target

**Optimization levers:**
1. Increase CHUNK_SIZE for faster processing (trade-off: larger transactions)
2. Decrease PAUSE_MS if DB can handle more load
3. Add partial index: `CREATE INDEX ON "UserBenefit" ("periodEnd") WHERE "periodStatus" = 'ACTIVE'`

### 13.4 Caching Strategy

- **No server-side caching** for benefit data (stale data risk with period transitions)
- **Client-side caching:** Dashboard can cache for 60 seconds (SWR pattern)
- **MasterBenefit data:** Can be cached (changes rarely). TTL: 1 hour.
- **Period calculations:** Pure functions, deterministic — can be memoized in-memory

### 13.5 Rate Limiting

No changes to existing rate limiting. The cron endpoint already has a 10/hour limiter.

---

## 14. Implementation Tasks Breakdown

### Phase 1: Schema Migration & Data Backfill

| # | Task | Complexity | Agent | Dependencies | Acceptance Criteria |
|---|------|-----------|-------|-------------|-------------------|
| 1.1 | Write Prisma schema changes (add masterBenefitId, periodStart, periodEnd, periodStatus to UserBenefit; add userBenefits relation to MasterBenefit) | Medium | PostgreSQL DBA | None | Schema compiles with `prisma generate`. No breaking changes to existing models. |
| 1.2 | Generate and review migration SQL | Small | PostgreSQL DBA | 1.1 | Migration runs against dev DB without errors. All new columns nullable or defaulted. |
| 1.3 | Write backfill script: link existing UserBenefits to MasterBenefits via name/type matching | Medium | SWE | 1.2 | Script links ≥90% of existing rows. Unmatched rows logged. Script is idempotent. |
| 1.4 | Write backfill script: calculate and populate periodStart/periodEnd for existing rows | Medium | SWE | 1.2, 1.3 | All existing rows have periodStart/periodEnd. ONE_TIME benefits have periodEnd=null. |
| 1.5 | Write data validation report query | Small | PostgreSQL DBA | 1.4 | Query confirms: 0 duplicate (userCardId, masterBenefitId, periodStart) tuples. |
| 1.6 | Swap unique constraints (drop old, add new partial uniques) | Medium | PostgreSQL DBA | 1.5 | New constraints in place. Old constraint dropped. No duplicate violations. |

### Phase 2: Benefit Auto-Generation Service

| # | Task | Complexity | Agent | Dependencies | Acceptance Criteria |
|---|------|-----------|-------|-------------|-------------------|
| 2.1 | Create `src/lib/benefit-engine/date-math.ts` with `calculatePeriodForBenefit()` and `calculateNextPeriod()` | Large | SWE | None | Pure functions handle all 5 cadences + anniversary + custom windows. |
| 2.2 | Write unit tests for date-math: all cadences, leap years, mid-period, boundary dates | Large | SWE | 2.1 | ≥40 test cases. All pass. Covers EC-1, EC-5, EC-6, EC-9, EC-12. |
| 2.3 | Create `src/lib/benefit-engine/generate-benefits.ts` with `generateBenefitsForCard()` | Medium | SWE | 2.1 | Function generates correct UserBenefit rows within a transaction. |
| 2.4 | Write unit tests for generate-benefits: empty catalog, full catalog, custom benefits | Medium | SWE | 2.3 | ≥15 test cases covering EC-7, EC-8, EC-11, EC-13. |
| 2.5 | Integrate `generateBenefitsForCard()` into POST `/api/cards/add` (replace old createMany logic) | Medium | SWE | 2.3, 1.6 | Card add creates benefits with masterBenefitId, periodStart, periodEnd. Response includes period info. |
| 2.6 | Add feature flag `BENEFIT_ENGINE_ENABLED` to control new vs old logic | Small | SWE | 2.5 | Flag=false uses old logic. Flag=true uses new engine. |

### Phase 3: Cron Job Redesign

| # | Task | Complexity | Agent | Dependencies | Acceptance Criteria |
|---|------|-----------|-------|-------------|-------------------|
| 3.1 | Rewrite `GET /api/cron/reset-benefits` with new period-rollover logic | Large | SWE | 2.1 | Cron marks expired, creates next period, handles all cadences. |
| 3.2 | Add batch processing with configurable chunk size and pause | Medium | SWE | 3.1 | Processes 1000+ benefits in chunks without timeout. |
| 3.3 | Write idempotency tests: run cron twice, verify no duplicates | Medium | SWE | 3.1 | Second run produces 0 new rows, 0 errors. |
| 3.4 | Add structured logging and monitoring hooks | Small | SWE | 3.1 | JSON log output with expiredCount, generatedCount, durationMs. |
| 3.5 | Write integration test: full lifecycle (add card → claim benefit → cron → verify new period) | Large | SWE | 3.1, 2.5 | End-to-end test passes. Historical row preserved. New row is ACTIVE. |

### Phase 4: API & Dashboard Updates

| # | Task | Complexity | Agent | Dependencies | Acceptance Criteria |
|---|------|-----------|-------|-------------|-------------------|
| 4.1 | Update GET `/api/cards/my-cards` to filter by periodStatus and include masterBenefit JOIN | Medium | SWE | 1.6 | Response includes periodStart, periodEnd, claimingCadence for each benefit. Only ACTIVE periods shown. |
| 4.2 | Update POST `/api/dashboard/benefits` with periodStatus filter | Small | SWE | 1.6 | Dashboard shows only current-period benefits. |
| 4.3 | Update POST `/api/benefits/usage` to use masterBenefitId FK directly | Small | SWE | 1.6 | No more name-matching workaround. Direct FK lookup. |
| 4.4 | Update PATCH `/api/benefits/[id]` to block catalog field edits | Small | SWE | 1.6 | Returns 400 if user tries to edit name/type/stickerValue on catalog benefit. |
| 4.5 | Update POST `/api/benefits/add` with auto-managed benefit guard | Small | SWE | 1.6 | Returns 409 if benefit name matches MasterBenefit for that card. |
| 4.6 | Create GET `/api/benefits/history` endpoint | Medium | SWE | 1.6 | Returns paginated expired periods. Filters by card and benefit type. |
| 4.7 | Update dashboard benefit cards to display period dates | Medium | Frontend Engineer | 4.1, 4.2 | Cards show "Apr 1 – Apr 30, 2026" period label. |
| 4.8 | Add period selector dropdown to dashboard | Medium | Frontend Engineer | 4.6, 4.7 | User can switch between Current/Previous/History views. |

### Phase 5: Cleanup & Hardening

| # | Task | Complexity | Agent | Dependencies | Acceptance Criteria |
|---|------|-----------|-------|-------------|-------------------|
| 5.1 | Remove feature flag; make new engine the default | Small | SWE | All Phase 4 | Feature flag removed. All code paths use new engine. |
| 5.2 | Add `@deprecated` JSDoc annotations to `expirationDate` field usage | Small | SWE | 5.1 | All references annotated. No new code uses expirationDate. |
| 5.3 | Performance test: simulate 50,000 users, run cron, measure timing | Medium | SWE | 5.1 | Cron completes in <30 seconds for 500K rows. |
| 5.4 | Write end-to-end integration test suite | Large | SWE | 5.1 | ≥20 E2E tests covering all user flows and edge cases. |
| 5.5 | Update all documentation (README, API docs, deployment guide) | Medium | SWE | 5.1 | Docs reflect new schema, API changes, and cron behavior. |

### Task Dependency Graph

```
Phase 1:  1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6
                                              │
Phase 2:  2.1 → 2.2                           │
           │                                   │
           └→ 2.3 → 2.4 → 2.5 ───────────────┘
                           │
                           └→ 2.6
                              │
Phase 3:  ────────────────── 3.1 → 3.2 → 3.3
                              │         → 3.4
                              └→ 3.5
                                 │
Phase 4:  4.1, 4.2, 4.3, 4.4, 4.5 ──(can start after 1.6)
                                      │
                              4.6 ────┘
                              │
                         4.7 → 4.8
                              │
Phase 5:  ──────────── 5.1 → 5.2 → 5.3 → 5.4 → 5.5
```

### Critical Path

```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 2.5 → 3.1 → 3.5 → 5.1
```

**Estimated total duration:** 11-16 days (with parallel work on Phases 2 and 4)

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **MasterBenefit** | Template/catalog entry for a card benefit (e.g., "$10 Monthly Dining Credit on Amex Gold") |
| **UserBenefit** | A specific period instance of a benefit for a user's card (e.g., "April 2026 Dining Credit") |
| **Period** | A time window (month, quarter, half-year, year) during which a benefit can be claimed |
| **Claiming Cadence** | How frequently a benefit can be claimed (MONTHLY, QUARTERLY, etc.) |
| **Reset Cadence** | Legacy field; how frequently a benefit resets (Monthly, CalendarYear, CardmemberYear) |
| **Rollover** | The cron process of creating a new period row when the current period expires |
| **Catalog Benefit** | A UserBenefit linked to a MasterBenefit via masterBenefitId |
| **Custom Benefit** | A UserBenefit with masterBenefitId = null (user-created) |

## Appendix B: Backward Compatibility Matrix

| Feature | Before | After | Breaking? |
|---------|--------|-------|-----------|
| POST `/api/cards/add` response | `{ benefitsCreated: N }` | `{ benefitsCreated: N, benefitsGenerated: [...] }` | No (additive) |
| GET `/api/cards/my-cards` benefits | `{ name, type, stickerValue }` | `{ name, type, stickerValue, masterBenefitId, periodStart, periodEnd }` | No (additive) |
| POST `/api/benefits/add` | Always succeeds for valid input | Returns 409 if benefit matches catalog | Yes (intentional) |
| UserBenefit.expirationDate | Primary date field | Deprecated; mirrors periodEnd | No (preserved) |
| Cron behavior | Resets in-place | Creates new rows | Yes (internal) |
| Dashboard data | All benefits shown | Only ACTIVE period benefits | Yes (intentional, better UX) |

## Appendix C: Feature Flag Configuration

```typescript
// src/lib/feature-flags.ts
export const FEATURE_FLAGS = {
  // ... existing flags ...
  BENEFIT_ENGINE_ENABLED: process.env.BENEFIT_ENGINE_ENABLED === 'true',
} as const;
```

**Rollout plan:**
1. Deploy with `BENEFIT_ENGINE_ENABLED=false` → old behavior, new schema columns exist
2. Run backfill scripts → populate new fields
3. Verify data integrity → run validation queries
4. Set `BENEFIT_ENGINE_ENABLED=true` → new engine active
5. Monitor for 48 hours → check cron logs, dashboard data
6. Remove feature flag (Phase 5.1)
