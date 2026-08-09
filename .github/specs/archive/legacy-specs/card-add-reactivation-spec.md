# Card Add Reactivation — Technical Specification

## Executive Summary & Goals

When a user deletes a card and later re-adds the same card template, the system crashes with a Prisma P2002 unique constraint violation on `(playerId, masterCardId)`. The root cause is that `POST /api/cards/add` detects the DELETED row but falls through to a `create()` call instead of updating the existing row back to ACTIVE. This spec defines the primary fix (reactivation flow), documents audit findings across all card/benefit API routes, catalogs edge cases, and provides implementation tasks with test cases.

**Primary Objectives:**
- Fix the P2002 crash by reactivating DELETED cards via `update()` instead of `create()`
- Purge stale UserBenefits from the deleted era and regenerate fresh ones
- Ensure the reactivation path works correctly with both benefit engine ON and OFF
- Audit and harden all related card/benefit API routes against similar edge cases
- Preserve full data integrity across the card lifecycle (ACTIVE → DELETED → ACTIVE)

**Success Criteria:**
- `POST /api/cards/add` for a previously deleted card returns 201 with a reactivated card
- Zero P2002 errors in production logs for the cards/add endpoint
- All audit findings either resolved or documented with accepted-risk rationale
- Test suite covers reactivation, mid-period reactivation, and all identified edge cases

---

## Functional Requirements

### Core Feature: Card Reactivation

When a user calls `POST /api/cards/add` with a `masterCardId` that maps to an existing `UserCard` row with `status = 'DELETED'`:

1. The existing row is **updated** (not a new row created)
2. Card fields are reset: `isOpen = true`, `status = 'ACTIVE'`, `statusChangedAt = now()`, `statusChangedReason = 'Reactivated by user'`
3. User-provided fields are applied: `renewalDate`, `customName`, `actualAnnualFee`
4. All old `UserBenefit` rows tied to this card are **hard-deleted** (they carry stale period data, ARCHIVED status, and potentially stale `isUsed`/`claimedAt` values from the prior era)
5. Fresh `UserBenefit` rows are generated from the current MasterBenefit catalog

### User Roles & Permissions

- Only the authenticated user who owns the Player profile can reactivate their own cards
- Admin routes are not affected by this change (admin card management is a separate flow)

### System Constraints

- The `@@unique([playerId, masterCardId])` constraint on `UserCard` is **not** removed — it is correct and intentional
- The reactivation must happen inside a single Prisma `$transaction` for ACID compliance
- The response shape for a reactivated card must be identical to a newly created card (201 status, same JSON schema) so the frontend does not need changes

---

## Implementation Phases

### Phase 1: Primary Bug Fix (Card Reactivation)

**Objective:** Eliminate the P2002 crash and implement the reactivation flow.

**Key Deliverables:**
- Modified `POST /api/cards/add` handler in `src/app/api/cards/add/route.ts`
- Reactivation branch inside the existing transaction block
- Unit tests for the reactivation path

**Estimated Scope:** Small–Medium (1–2 days)

### Phase 2: Audit Remediation

**Objective:** Address findings from the card/benefit API audit.

**Key Deliverables:**
- Fix issues identified in DELETE card cleanup, cron reactivation handling
- Guard improvements for benefit status transitions

**Estimated Scope:** Small (1 day)

**Dependency:** Phase 1 (some fixes depend on understanding the reactivation data model)

### Phase 3: Test Coverage

**Objective:** Comprehensive test suite for reactivation and audit fixes.

**Key Deliverables:**
- Integration tests covering the full reactivation lifecycle
- Edge case tests for mid-period reactivation, concurrent requests, stale benefit cleanup

**Estimated Scope:** Medium (1–2 days)

**Dependency:** Phases 1 and 2

---

## Data Schema / State Management

### Affected Entities

#### UserCard — State Transitions

```
ACTIVE ──(DELETE /api/cards/[id])──► DELETED
                                        │
ACTIVE ◄──(POST /api/cards/add)─────────┘  (REACTIVATION — this spec)
```

**Fields modified during reactivation:**

| Field               | Before (DELETED)        | After (Reactivated)                   |
|---------------------|-------------------------|---------------------------------------|
| `isOpen`            | `true` (unchanged by delete) | `true`                             |
| `status`            | `'DELETED'`             | `'ACTIVE'`                            |
| `statusChangedAt`   | timestamp of deletion   | `new Date()` — now                    |
| `statusChangedReason` | (varies)              | `'Reactivated by user'`               |
| `customName`        | previous value          | request body value or `null`          |
| `actualAnnualFee`   | previous value          | request body value or `null`          |
| `renewalDate`       | previous value          | request body value or default +1 year |
| `version`           | N                       | N + 1 (increment)                     |
| `updatedAt`         | previous value          | auto-updated by Prisma `@updatedAt`   |

#### UserBenefit — Lifecycle During Reactivation

Old benefits (from the deleted era) are **hard-deleted** inside the transaction, then new benefits are generated. Rationale:

- Old benefits have `status = 'ARCHIVED'` (set by the DELETE card handler)
- They may carry stale `periodStart`/`periodEnd` values from months ago
- They may have `isUsed = true` / `claimedAt` set from before deletion
- Soft-deleting and creating new rows would leave orphaned ARCHIVED rows accumulating over repeated delete/re-add cycles
- Hard-delete is safe because the `onDelete: Cascade` relationship already implies these rows are considered disposable when the card is removed

```sql
-- Pseudocode for the reactivation transaction:
DELETE FROM "UserBenefit" WHERE "userCardId" = $cardId;
-- Then: generateBenefitsForCard() or legacy flat-copy creates fresh rows
```

#### Related Models — Cascade Considerations

| Model                  | Relation to UserBenefit     | Impact of Hard-Delete              |
|------------------------|-----------------------------|------------------------------------|
| `BenefitUsageRecord`   | FK `benefitId` → `UserBenefit.id`, `onDelete: Cascade` | ✅ Auto-cascades |
| `BenefitPeriod`        | FK `benefitId` → `UserBenefit.id`, `onDelete: Cascade` | ✅ Auto-cascades |
| `BenefitRecommendation`| FK `benefitId` → `UserBenefit.id`, `onDelete: Cascade` | ✅ Auto-cascades |

All three related models use `onDelete: Cascade`, so hard-deleting UserBenefit rows will automatically clean up associated records. No orphans.

### Indexes

No new indexes are required. The existing `@@unique([playerId, masterCardId])` on UserCard and `@@index([userCardId])` on UserBenefit are sufficient for the reactivation query patterns.

---

## User Flows & Workflows

### Primary Flow: Card Reactivation (Happy Path)

```
User calls POST /api/cards/add { masterCardId: "mc_123" }
  │
  ├─ Auth check → userId extracted from session cookie
  ├─ Validation → masterCardId present, renewalDate valid
  ├─ Player lookup → find active player for userId
  ├─ MasterCard lookup → verify mc_123 exists
  │
  ├─ Duplicate check: findUnique(playerId, masterCardId)
  │   ├─ No existing card → CREATE new UserCard (existing path, unchanged)
  │   ├─ Existing card, status ≠ DELETED → return 409 CARD_DUPLICATE
  │   └─ Existing card, status = DELETED → REACTIVATION PATH (new)
  │
  └─ REACTIVATION PATH:
      │
      ├─ BEGIN TRANSACTION
      │   ├─ 1. Hard-delete all UserBenefits for this card
      │   ├─ 2. Update UserCard: status→ACTIVE, isOpen→true, apply request fields
      │   ├─ 3a. (Engine ON)  generateBenefitsForCard(tx, card, playerId)
      │   └─ 3b. (Engine OFF) Legacy flat-copy of MasterBenefits
      ├─ COMMIT TRANSACTION
      │
      └─ Return 201 { success: true, userCard: {...}, benefitsCreated: N }
```

### Alternative Flow: Re-add While Card is Still Active

```
User calls POST /api/cards/add { masterCardId: "mc_123" }
  │
  ├─ Duplicate check finds existing card with status = 'ACTIVE'
  └─ Return 409 { error: "Card already in collection", code: "CARD_DUPLICATE" }
```

### Error Flow: MasterCard Template No Longer Exists

```
User calls POST /api/cards/add { masterCardId: "mc_deleted" }
  │
  ├─ MasterCard lookup returns null
  └─ Return 404 { error: "Card not found", code: "CARD_NOT_FOUND" }
```

---

## API Routes & Contracts

### `POST /api/cards/add` — Modified Contract

**No changes to the external API contract.** The request and response schemas remain identical. The only change is internal: when a DELETED card exists, the handler updates instead of creating.

**Request Body** (unchanged):
```json
{
  "masterCardId": "string (required)",
  "customName": "string (optional, max 100 chars)",
  "actualAnnualFee": "number (optional, cents, 0–999900)",
  "renewalDate": "string (optional, ISO 8601, must be future)"
}
```

**Response (201 Created)** (unchanged):
```json
{
  "success": true,
  "userCard": {
    "id": "existing-card-id",
    "playerId": "player_456",
    "masterCardId": "mc_123",
    "customName": "My Sapphire Reserve",
    "actualAnnualFee": 55000,
    "renewalDate": "2026-06-15T00:00:00.000Z",
    "isOpen": true,
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2025-06-15T12:00:00.000Z"
  },
  "benefitsCreated": 8,
  "message": "Card added with 8 benefits for the current period"
}
```

**Note:** `createdAt` retains the original card creation timestamp. `updatedAt` reflects the reactivation time. The `id` is the same as the original card — this is intentional and correct.

---

## Primary Fix: Exact Code Changes

### File: `src/app/api/cards/add/route.ts`

**Location:** Lines 226–299 (after the `existingCard` lookup, inside the transaction)

**Current Code (Buggy — lines 226–251):**
```typescript
// Return 409 if card already exists and is not deleted
if (existingCard && existingCard.status !== 'DELETED') {
  return NextResponse.json(
    {
      success: false,
      error: 'Card already in collection',
      code: 'CARD_DUPLICATE',
      details: 'You already own this card. View it in your collection.',
    } as ErrorResponse,
    { status: 409 }
  );
}

// Create the UserCard and UserBenefits in a transaction for ACID compliance
const { card: userCard, benefitCount, generatedBenefits } = await prisma.$transaction(async (tx) => {
  // Create the UserCard record
  const card = await tx.userCard.create({
    data: {
      playerId: player.id,
      masterCardId,
      customName: customName && customName.trim() ? customName.trim() : null,
      actualAnnualFee: actualAnnualFee !== undefined ? Math.round(actualAnnualFee) : null,
      renewalDate,
      isOpen: true,
      status: 'ACTIVE',
    },
  });
  // ... benefit generation follows
```

**Fixed Code:**
```typescript
// Return 409 if card already exists and is not deleted
if (existingCard && existingCard.status !== 'DELETED') {
  return NextResponse.json(
    {
      success: false,
      error: 'Card already in collection',
      code: 'CARD_DUPLICATE',
      details: 'You already own this card. View it in your collection.',
    } as ErrorResponse,
    { status: 409 }
  );
}

const isReactivation = existingCard?.status === 'DELETED';

// Create or reactivate the UserCard and UserBenefits in a transaction
const { card: userCard, benefitCount, generatedBenefits } = await prisma.$transaction(async (tx) => {
  let card;

  if (isReactivation) {
    // ── REACTIVATION PATH ──────────────────────────────────────────────
    // Step 1: Hard-delete all old UserBenefits (stale data from prior era)
    // Cascade will also clean up BenefitUsageRecord, BenefitPeriod,
    // and BenefitRecommendation rows.
    await tx.userBenefit.deleteMany({
      where: { userCardId: existingCard.id },
    });

    // Step 2: Reactivate the UserCard
    card = await tx.userCard.update({
      where: { id: existingCard.id },
      data: {
        isOpen: true,
        status: 'ACTIVE',
        statusChangedAt: new Date(),
        statusChangedReason: 'Reactivated by user',
        customName: customName && customName.trim() ? customName.trim() : null,
        actualAnnualFee: actualAnnualFee !== undefined ? Math.round(actualAnnualFee) : null,
        renewalDate,
        version: { increment: 1 },
      },
    });
  } else {
    // ── NEW CARD PATH (existing logic, unchanged) ──────────────────────
    card = await tx.userCard.create({
      data: {
        playerId: player.id,
        masterCardId,
        customName: customName && customName.trim() ? customName.trim() : null,
        actualAnnualFee: actualAnnualFee !== undefined ? Math.round(actualAnnualFee) : null,
        renewalDate,
        isOpen: true,
        status: 'ACTIVE',
      },
    });
  }

  // Step 3: Generate benefits (same for both paths)
  if (featureFlags.BENEFIT_ENGINE_ENABLED) {
    const generated = await generateBenefitsForCard(
      tx,
      { id: card.id, masterCardId, renewalDate },
      player.id,
      new Date()
    );
    return {
      card,
      benefitCount: generated.count,
      generatedBenefits: generated.benefits,
    };
  } else {
    const masterBenefits = await tx.masterBenefit.findMany({
      where: {
        masterCardId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const benefitsCreated = await tx.userBenefit.createMany({
      data: masterBenefits.map((masterBenefit) => ({
        userCardId: card.id,
        playerId: player.id,
        name: masterBenefit.name,
        type: masterBenefit.type,
        stickerValue: masterBenefit.stickerValue,
        resetCadence: masterBenefit.resetCadence,
        isUsed: false,
        timesUsed: 0,
        expirationDate: null,
        status: 'ACTIVE',
      })),
    });

    return {
      card,
      benefitCount: benefitsCreated.count,
      generatedBenefits: undefined,
    };
  }
});
```

**Key Design Decisions:**
1. **Hard-delete UserBenefits** rather than updating them in-place, because old benefits may reference stale `masterBenefitId` values (if MasterBenefits were added/removed since deletion), have outdated period boundaries, and carry usage data from the prior era.
2. **Benefit generation is shared** between the reactivation and new-card paths — both call the same `generateBenefitsForCard()` or legacy logic.
3. **`version` is incremented** on the UserCard to signal downstream that the card has been modified (useful for optimistic concurrency patterns).
4. **`statusChangedAt` and `statusChangedReason`** are set for audit trail purposes.

---

## Audit Findings

### Finding 1: DELETE Card — Benefits Not Cleaned Up for Engine-Generated Period Rows
**File:** `src/app/api/cards/[id]/route.ts`, lines 368–379  
**Severity:** Low (cosmetic data issue, not a crash)

**Current behavior:** When a card is deleted, all its UserBenefits are set to `status = 'ARCHIVED'`. This is correct and sufficient.

**Potential issue:** With the benefit engine enabled, there may be multiple period rows per benefit (ACTIVE + EXPIRED). The `updateMany` correctly archives all of them. However, the `periodStatus` field is **not** updated — archived benefits retain `periodStatus = 'ACTIVE'` even though the card is deleted. This creates a data inconsistency.

**Recommendation:** Also set `periodStatus = 'ARCHIVED'` in the updateMany:

```typescript
data: {
  status: 'ARCHIVED',
  periodStatus: 'ARCHIVED',  // ← Add this
},
```

**Risk if not fixed:** The cron job already filters by `status: { not: 'ARCHIVED' }` (line 189 of cron route), so this is defense-in-depth only. The cron also checks `userCard.status === 'DELETED'` and skips those. No production impact, but improves data hygiene.

---

### Finding 2: DELETE Card — `isOpen` Not Set to `false`
**File:** `src/app/api/cards/[id]/route.ts`, lines 368–379  
**Severity:** Low

**Current behavior:** When a card is deleted, `status` is set to `'DELETED'` but `isOpen` remains `true`.

**Impact:** The `isOpen` flag is used in the cron job's filter (`benefit.userCard.isOpen`). Since the cron also checks `status === 'DELETED'`, this is not a functional bug. However, it's semantically incorrect — a deleted card should not be "open."

**Recommendation:** Set `isOpen: false` during deletion:

```typescript
data: {
  status: 'DELETED',
  isOpen: false,           // ← Add this
  statusChangedAt: new Date(),
  statusChangedReason: 'Deleted by user',
  userBenefits: {
    updateMany: {
      where: { userCardId: cardId },
      data: {
        status: 'ARCHIVED',
        periodStatus: 'ARCHIVED',
      },
    },
  },
},
```

---

### Finding 3: Benefit Edit — Engine Guard Does Not Block `expirationDate` Override
**File:** `src/app/api/benefits/[id]/route.ts`, lines 139–151  
**Severity:** Medium

**Current behavior:** When the benefit engine is enabled and a benefit has a `masterBenefitId`, the PATCH handler blocks edits to `name`, `resetCadence`, `type`, and `stickerValue`. However, it does **not** block edits to `expirationDate`.

**Impact:** Since `expirationDate` is set to equal `periodEnd` by the benefit engine (for backward compatibility), a user could manually override `expirationDate` to a different value, creating a mismatch between `expirationDate` and `periodEnd`. This could confuse the cron job's legacy fallback path and the frontend's expiration display.

**Recommendation:** Add `expirationDate` to the blocked fields list for engine-managed benefits:

```typescript
const blockedFields = ['name', 'resetCadence', 'type', 'stickerValue', 'expirationDate'] as const;
```

Users can still edit `userDeclaredValue` (their own valuation of the benefit).

---

### Finding 4: Benefit Delete — No Guard Against Deleting Benefits on DELETED Cards
**File:** `src/app/api/benefits/[id]/route.ts`, lines 196–258  
**Severity:** Very Low

**Current behavior:** A user can attempt to delete a benefit on a DELETED card. The ownership check passes (the player still owns the card), and the benefit is soft-deleted to ARCHIVED.

**Impact:** Effectively a no-op since the benefit is already ARCHIVED (set when the card was deleted). The `update` to set `status = 'ARCHIVED'` on an already-ARCHIVED row is idempotent. No production impact.

**Recommendation:** Optional. Could add a guard checking `benefit.userCard.status !== 'DELETED'`, but the risk is negligible. Document as accepted.

---

### Finding 5: Toggle Used — Does Not Check Card Status
**File:** `src/app/api/benefits/[id]/toggle-used/route.ts`  
**Severity:** Low

**Current behavior:** A user could theoretically toggle `isUsed` on a benefit that belongs to a DELETED card. The `periodStatus` guard covers EXPIRED/UPCOMING, but not card-level deletion.

**Impact:** Low risk because the frontend hides deleted cards, so the user would need to craft a manual API call. The benefit is already ARCHIVED, so the toggle would succeed but has no visible effect.

**Recommendation:** Add a card-status guard:

```typescript
if (benefit.userCard.status === 'DELETED') {
  return NextResponse.json(
    { success: false, error: 'Cannot update benefits on a deleted card', code: 'CARD_DELETED' },
    { status: 400 }
  );
}
```

---

### Finding 6: Manual Benefit Add — Does Not Check Card Status
**File:** `src/app/api/benefits/add/route.ts`  
**Severity:** Medium

**Current behavior:** A user can add a manual benefit to a DELETED card. The ownership check passes, and the benefit is created with `status = 'ACTIVE'`.

**Impact:** Creates an orphaned ACTIVE benefit on a DELETED card. The cron job would skip it (card is deleted), but it creates data inconsistency. After reactivation (with our fix), this orphaned benefit would be hard-deleted — so data loss could occur if the user intended to keep it.

**Recommendation:** Add a card-status guard after the ownership check:

```typescript
if (card.status === 'DELETED') {
  return NextResponse.json(
    { success: false, error: 'Cannot add benefits to a deleted card' } as ErrorResponse,
    { status: 400 }
  );
}
```

---

### Finding 7: Cron Job — Reactivated Cards Are Handled Correctly ✅
**File:** `src/app/api/cron/reset-benefits/route.ts`, lines 295–299  
**Severity:** N/A (no issue found)

**Analysis:** The cron job checks `benefit.userCard.isOpen` and `benefit.userCard.status` before processing. After our reactivation fix, a reactivated card will have `status = 'ACTIVE'` and `isOpen = true`, and its fresh benefits will have valid `periodEnd` values. The cron will correctly process them when their periods expire.

**One minor consideration:** If a card is reactivated mid-period (e.g., on June 15 for a monthly benefit that runs June 1–30), the benefit engine generates a period starting from the reactivation date (or the current period start, depending on `calculatePeriodForBenefit`). The cron will pick up the benefit when `periodEnd < now`. This is correct behavior.

---

### Finding 8: GET Card — Shows Only ACTIVE Benefits ✅
**File:** `src/app/api/cards/[id]/route.ts`, line 139  
**Severity:** N/A (no issue found)

**Analysis:** The GET handler filters `where: { status: 'ACTIVE' }`. After reactivation, all new benefits are created with `status = 'ACTIVE'`, so they will appear. Old ARCHIVED benefits (from pre-deletion) are hard-deleted in our fix, so no ghost rows will appear.

---

### Finding 9: Benefit Status Route — Uses `createdAt` Instead of `renewalDate`
**File:** `src/app/api/benefits/[id]/status/route.ts`, lines 95–98  
**Severity:** Medium

**Current behavior:** The period boundary calculation uses `userCard.createdAt` as the anchor date:
```typescript
const { start: periodStart, end: periodEnd } = getPeriodBoundaries(
  resetCadence,
  userCard.createdAt || new Date(),  // ← Should be renewalDate for CardmemberYear
  new Date()
);
```

**Impact:** For `CardmemberYear` cadence, the period should be anchored to `renewalDate` (the card anniversary date), not `createdAt`. This gives incorrect period boundaries for CardmemberYear benefits.

**Recommendation:** Use `userCard.renewalDate` as the anchor:
```typescript
const anchorDate = resetCadence === 'CardmemberYear'
  ? userCard.renewalDate
  : userCard.createdAt || new Date();
```

**Note:** This finding is outside the scope of the reactivation fix but is worth addressing.

---

## Edge Cases & Error Handling

### Edge Case 1: Reactivation Mid-Period
**Scenario:** Card deleted on June 5. User re-adds on June 20. Monthly benefits should have period June 1–30.

**Handling:** `calculatePeriodForBenefit()` uses the reference date (now = June 20) to determine the current period. For MONTHLY cadence, it will calculate the current month boundaries (June 1–30). The benefit is created with `periodStart = June 1, periodEnd = June 30`, which is correct. The user gets the remaining ~10 days of the June period.

**Accepted behavior:** The user does not get a "full" month — they get the remainder of the current period. This is intentional. The cron job will roll them into July on July 1.

---

### Edge Case 2: Reactivation After MasterBenefits Changed
**Scenario:** Card deleted. Admin adds 2 new MasterBenefits and removes 1 old one. User re-adds card.

**Handling:** Old UserBenefits are hard-deleted. `generateBenefitsForCard()` queries the current MasterBenefit catalog (`isActive: true, isDefault: true`), so the user gets the current set of benefits. This is correct — the user should get the current catalog, not the stale one from when they first added the card.

---

### Edge Case 3: Rapid Delete-and-Readd (Race Condition)
**Scenario:** User deletes card, then immediately re-adds before the delete transaction commits.

**Handling:** The add endpoint uses `findUnique` outside the transaction to check for existing cards. If the delete hasn't committed yet, `findUnique` returns the card with `status = 'ACTIVE'`, and the add returns 409 (duplicate). If the delete has committed, `findUnique` returns `status = 'DELETED'`, and reactivation proceeds.

**Risk:** In a narrow race window, the user might see a 409 even though deletion is in progress. This is acceptable — the user can retry.

**Mitigation:** The reactivation transaction uses `tx.userCard.update({ where: { id: existingCard.id } })`. If the card's status has changed between the `findUnique` and the transaction, Prisma will update the row regardless (it's identified by `id`, not by `status`). If the card was re-activated by a concurrent request, the second request's `deleteMany` + `update` would overwrite, resulting in a single ACTIVE card with fresh benefits. This is idempotent and safe.

---

### Edge Case 4: Benefits Marked as Used Before Deletion
**Scenario:** User uses 3 of 8 benefits, then deletes the card, then re-adds.

**Handling:** All old UserBenefits (including the 3 used ones) are hard-deleted. Fresh benefits are generated with `isUsed = false`. The user starts with a clean slate. Historical usage data in `BenefitUsageRecord` is cascaded-deleted as well.

**Accepted behavior:** Previous usage history is lost. This is intentional — the reactivation represents a fresh start. If historical tracking is needed in the future, the `BenefitUsageRecord` deletion could be reconsidered (skip cascade, keep orphaned records for analytics). For now, clean deletion is preferred.

---

### Edge Case 5: Card Has No Active MasterBenefits
**Scenario:** User re-adds a card whose MasterCard template now has zero active MasterBenefits.

**Handling:** `generateBenefitsForCard()` returns `{ count: 0, benefits: [] }` (line 79–84 of `generate-benefits.ts`). The card is still reactivated with `status = 'ACTIVE'`, but `benefitsCreated = 0`. The response message will say "Card added with 0 benefits for the current period". This is correct.

---

### Edge Case 6: MasterCard Template Archived/Deactivated
**Scenario:** Admin archives the MasterCard template while a user has a DELETED card for it. User tries to re-add.

**Handling:** The `POST /api/cards/add` handler checks `prisma.masterCard.findUnique({ where: { id: masterCardId } })` on line 199. If the MasterCard exists but is archived (`isActive = false`), the current code does **not** check `isActive` — it only checks existence. The user would be able to re-add a card for an archived template.

**Recommendation:** Add an `isActive` check after the MasterCard lookup:

```typescript
if (!masterCard || !masterCard.isActive) {
  return NextResponse.json(
    {
      success: false,
      error: 'Card not found',
      code: 'CARD_NOT_FOUND',
    },
    { status: 404 }
  );
}
```

This is a pre-existing issue, not caused by the reactivation change, but worth fixing.

---

### Edge Case 7: Database Transaction Failure Mid-Reactivation
**Scenario:** The transaction succeeds at deleting old UserBenefits but fails during `generateBenefitsForCard()`.

**Handling:** Prisma `$transaction` is all-or-nothing. If any step fails, the entire transaction is rolled back. The card remains `DELETED` and old benefits remain `ARCHIVED`. The user sees a 500 error and can retry.

---

### Edge Case 8: Concurrent Reactivation Attempts
**Scenario:** Two browser tabs both try to re-add the same deleted card simultaneously.

**Handling:** Both requests read `existingCard.status === 'DELETED'` from the initial `findUnique`. Both enter the reactivation path. Inside the transaction:
- Request A: `deleteMany` + `update` succeeds. Card is now ACTIVE.
- Request B: `deleteMany` finds 0 benefits to delete (A already deleted them). `update` sets the card to ACTIVE again with B's field values. `generateBenefitsForCard()` creates fresh benefits.

**Result:** Both requests succeed with 201. The card ends up ACTIVE with Request B's field values and Request B's benefits. No crash, no constraint violation. Effectively a "last write wins" scenario.

**Accepted behavior:** This is a rare edge case. The user ends up with a valid card. If strict serialization is needed, a `SELECT ... FOR UPDATE` lock could be added, but it's not warranted for this use case.

---

### Edge Case 9: OneTime Benefits on Reactivation
**Scenario:** Card has a "Welcome Bonus" MasterBenefit with `resetCadence = 'OneTime'` and `isDefault = true`.

**Handling:** `generateBenefitsForCard()` creates the OneTime benefit with `periodEnd = null`. The user gets the welcome bonus again on reactivation. This is correct for the "fresh start" model. If the product team decides OneTime benefits should NOT be regenerated on reactivation, a filter can be added:

```typescript
// In generateBenefitsForCard(), after querying masterBenefits:
// Optional: filter out OneTime benefits for reactivations
```

**Current decision:** Include OneTime benefits. Product can revisit.

---

### Edge Case 10: Card Reactivated with Different renewalDate
**Scenario:** Original card had renewalDate = Jan 15, 2025. User re-adds with renewalDate = July 1, 2026.

**Handling:** The new `renewalDate` is stored on the UserCard. `generateBenefitsForCard()` uses this new date for `CardmemberYear` period calculations. This is correct — the user may have negotiated a new renewal date with the issuer.

---

### Edge Case 11: Reactivation When Cron Is Running
**Scenario:** Cron job is processing expired benefits. Simultaneously, a user reactivates a card whose benefits are being processed.

**Handling:** The cron job processes benefits for cards with `status !== 'DELETED'`. If the card is still DELETED when the cron reads it, the cron skips it (line 297). If the card was reactivated between the cron's read and write, the cron might try to process the old (now-deleted) benefits — but those benefits were hard-deleted by the reactivation transaction, so the cron's `updateMany` by ID would update 0 rows. No crash, no data corruption.

---

### Edge Case 12: Stale `x-user-id` Header vs Session Cookie
**Scenario:** The `POST /api/cards/add` route uses `getUserIdFromRequest()` which reads the session cookie directly. Other routes (like PATCH/DELETE card) use `request.headers.get('x-user-id')` set by middleware.

**Handling:** This is a pre-existing architectural inconsistency, not caused by this fix. Both methods ultimately verify the user's identity. No action needed for this spec, but worth noting for future auth unification.

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      POST /api/cards/add                        │
│                     (route.ts handler)                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐  │
│  │ Auth Layer  │──▶│ Validation Layer │──▶│ Duplicate Check  │  │
│  │ (JWT/Cookie)│   │ (request body)   │   │ (findUnique)     │  │
│  └─────────────┘   └──────────────────┘   └────────┬─────────┘  │
│                                                     │            │
│                              ┌───────────────────────┤            │
│                              ▼                       ▼            │
│                    ┌─────────────────┐    ┌───────────────────┐  │
│                    │  409 DUPLICATE  │    │  REACTIVATION?    │  │
│                    │  (status≠DEL)   │    │  (status=DELETED) │  │
│                    └─────────────────┘    └────────┬──────────┘  │
│                                                    │             │
│                          ┌─────────────────────────┼──────────┐  │
│                          │     $transaction        │          │  │
│                          │                         ▼          │  │
│                          │  ┌─────────────────────────────┐   │  │
│                          │  │ IF reactivation:            │   │  │
│                          │  │  1. deleteMany(UserBenefit) │   │  │
│                          │  │  2. update(UserCard→ACTIVE) │   │  │
│                          │  │ ELSE:                       │   │  │
│                          │  │  1. create(UserCard)        │   │  │
│                          │  └────────────┬────────────────┘   │  │
│                          │               ▼                    │  │
│                          │  ┌─────────────────────────────┐   │  │
│                          │  │ Benefit Generation          │   │  │
│                          │  │ (engine ON → generate)      │   │  │
│                          │  │ (engine OFF → flat copy)    │   │  │
│                          │  └─────────────────────────────┘   │  │
│                          └────────────────────────────────────┘  │
│                                                                  │
│                          ┌─────────────────────────────────────┐ │
│                          │  201 Response (same shape always)   │ │
│                          └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Dependencies:
  route.ts → @/shared/lib/prisma (DB client)
  route.ts → @/features/auth/lib/jwt (getUserIdFromRequest)
  route.ts → @/lib/feature-flags (BENEFIT_ENGINE_ENABLED)
  route.ts → @/lib/benefit-engine (generateBenefitsForCard)
```

---

## Implementation Tasks

### Phase 1: Primary Bug Fix

| #  | Task | Description | Complexity | Acceptance Criteria |
|----|------|-------------|-----------|---------------------|
| 1  | Implement reactivation branch in `POST /api/cards/add` | Add `isReactivation` flag, reactivation path with `deleteMany` + `update` + benefit generation inside the transaction as specified in "Primary Fix" section | Medium | P2002 error no longer occurs; reactivated card has `status = 'ACTIVE'`, `isOpen = true`, fresh benefits |
| 2  | Add MasterCard `isActive` guard | After MasterCard lookup (line 199), reject if `masterCard.isActive === false` | Small | Archived MasterCards return 404 on add |
| 3  | Write unit test: reactivation with engine ON | Test that a DELETED card is reactivated, old benefits purged, new engine-generated benefits created with correct periods | Medium | Test passes; benefit count matches active MasterBenefits; old benefits do not exist in DB |
| 4  | Write unit test: reactivation with engine OFF | Test that a DELETED card is reactivated, old benefits purged, new legacy flat-copy benefits created | Small | Test passes; benefit count matches active MasterBenefits; no period fields set |
| 5  | Write unit test: reactivation preserves original `createdAt` | Verify `createdAt` is not changed, `updatedAt` is refreshed | Small | Assertions pass |

### Phase 2: Audit Remediation

| #  | Task | Description | Complexity | Acceptance Criteria |
|----|------|-------------|-----------|---------------------|
| 6  | Fix DELETE card: set `periodStatus = 'ARCHIVED'` and `isOpen = false` | Update `DELETE /api/cards/[id]` to also set `periodStatus` and `isOpen` | Small | Deleted cards have `isOpen = false` and all benefits have `periodStatus = 'ARCHIVED'` |
| 7  | Fix benefit edit: block `expirationDate` for engine-managed benefits | Add `'expirationDate'` to `blockedFields` array in `PATCH /api/benefits/[id]` | Small | PATCH with `expirationDate` on engine-managed benefit returns 403 |
| 8  | Add card-status guard to `POST /api/benefits/add` | Reject benefit creation for DELETED cards with 400 | Small | Adding benefit to DELETED card returns 400 |
| 9  | Add card-status guard to `PATCH /api/benefits/[id]/toggle-used` | Reject toggle for benefits on DELETED cards with 400 | Small | Toggling benefit on DELETED card returns 400 |

### Phase 3: Test Coverage

| #  | Task | Description | Complexity | Acceptance Criteria |
|----|------|-------------|-----------|---------------------|
| 10 | Integration test: full lifecycle (add → delete → re-add) | End-to-end test covering card creation, benefit usage, card deletion, and reactivation | Large | All assertions pass; no orphaned data |
| 11 | Test: mid-period reactivation | Delete card on day 15, re-add on day 20, verify period boundaries | Medium | Period boundaries are correct for the current period |
| 12 | Test: reactivation with changed MasterBenefits | Modify MasterBenefit catalog between delete and re-add | Medium | New benefits reflect current catalog, not old one |
| 13 | Test: concurrent reactivation | Two simultaneous POST requests for the same deleted card | Medium | Both succeed or one succeeds with no crash; card is ACTIVE with valid benefits |
| 14 | Test: reactivation of card with no MasterBenefits | Re-add card whose MasterCard has zero active default benefits | Small | Card reactivated with `benefitsCreated = 0` |

---

## Security & Compliance Considerations

### Authentication
- No changes to the auth flow. The `getUserIdFromRequest()` function remains the auth gate.
- The reactivation path verifies card ownership via the `Player → userId` chain, same as the new-card path.

### Authorization
- Only the card owner can reactivate their own cards. The `player.userId === userId` check covers this.
- No admin escalation risk — admin routes are separate.

### Audit Trail
- `statusChangedAt` and `statusChangedReason` are set on reactivation, providing a clear audit trail.
- The `version` field is incremented, enabling optimistic concurrency detection.
- Server-side `console.info` logs the reactivation event (existing benefit engine logging).

### Data Protection
- No PII is exposed or logged beyond what's already in the existing codebase.
- Hard-deleting UserBenefits and cascading to BenefitUsageRecord is consistent with data minimization principles.

---

## Performance & Scalability Considerations

### Transaction Size
The reactivation transaction performs:
1. `deleteMany` — one bulk DELETE statement
2. `update` — one UPDATE statement
3. `createMany` or `generateBenefitsForCard` — one bulk INSERT

For a typical card with 8–15 benefits, this is 3 SQL statements in one transaction. Well within Prisma's transaction timeout (default 5s).

### Query Performance
- `findUnique` on `@@unique([playerId, masterCardId])` uses the unique index — O(1) lookup.
- `deleteMany` on `userCardId` uses the `@@index([userCardId])` — efficient.
- `generateBenefitsForCard` queries `MasterBenefit` by `masterCardId` using `@@index([masterCardId])` — efficient.

### Caching
No caching changes needed. The reactivation path writes to the DB and returns fresh data.

### Rate Limiting
No additional rate limiting needed. The existing auth gate and general API rate limits apply. A user cannot reactivate cards faster than they can authenticate.

---

## Appendix: Files Modified

| File | Change Type | Summary |
|------|-------------|---------|
| `src/app/api/cards/add/route.ts` | **Modified** | Add reactivation branch inside transaction; add `isActive` guard on MasterCard |
| `src/app/api/cards/[id]/route.ts` | **Modified** | Set `isOpen = false` and `periodStatus = 'ARCHIVED'` on DELETE |
| `src/app/api/benefits/[id]/route.ts` | **Modified** | Block `expirationDate` edit for engine-managed benefits |
| `src/app/api/benefits/add/route.ts` | **Modified** | Add card-status guard (reject DELETED cards) |
| `src/app/api/benefits/[id]/toggle-used/route.ts` | **Modified** | Add card-status guard (reject DELETED cards) |
