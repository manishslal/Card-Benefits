# Card Reactivation QA Report

> **Date:** 2025-07-15  
> **Spec:** `.github/specs/card-add-reactivation-spec.md`  
> **Scope:** 5 modified files + comprehensive API audit (cards, benefits, dashboard, cron, mobile)

---

## 1. Verdict

### **PASS WITH FIXES**

The 5 modified files correctly implement the reactivation spec. The P2002 bug is eliminated and the reactivation flow is transactionally safe. However, the comprehensive API audit uncovered **1 CRITICAL security vulnerability**, **3 HIGH issues**, and **6 MEDIUM issues** elsewhere in the API surface that warrant attention before production confidence is high.

### Issue Summary

| Severity | Count | In Modified Files | In Other Files |
|----------|-------|-------------------|----------------|
| CRITICAL | 1     | 0                 | 1              |
| HIGH     | 3     | 1                 | 2              |
| MEDIUM   | 6     | 1                 | 5              |
| LOW      | 7     | 1                 | 6              |
| **Total** | **17** | **3**            | **14**         |

---

## 2. Modified Files — Spec Compliance

### 2.1 `src/app/api/cards/add/route.ts` — PRIMARY FIX

**Status: ✅ PASS (1 HIGH issue below)**

| Spec Requirement | Status | Evidence |
|------------------|--------|----------|
| DELETED card → `update()` not `create()` | ✅ | Line 254: `tx.userCard.update()` in reactivation branch |
| Hard-delete old UserBenefits before regeneration | ✅ | Line 249: `tx.userBenefit.deleteMany()` |
| Set `isOpen = true`, `status = 'ACTIVE'` | ✅ | Lines 256–257 |
| Set `statusChangedAt`, `statusChangedReason` | ✅ | Lines 259–260 |
| Apply request fields (`customName`, `actualAnnualFee`, `renewalDate`) | ✅ | Lines 261–263 |
| Increment `version` | ✅ | Line 264 |
| All steps inside `$transaction` | ✅ | Lines 241–329 |
| Benefit generation shared between reactivation and new-card paths | ✅ | Lines 282–328 |
| Return 201 with same response shape | ✅ | Line 363 |
| Response message distinguishes reactivation | ✅ | Lines 346–351 |
| MasterCard `isActive` guard | ❌ | **Missing — see HIGH-1** |

### 2.2 `src/app/api/benefits/add/route.ts` — DELETED card guard

**Status: ✅ PASS**

| Spec Requirement | Status | Evidence |
|------------------|--------|----------|
| Reject benefit creation on DELETED cards | ✅ | Lines 153–159: `card.status === 'DELETED'` → 400 |
| Correct HTTP status (400) | ✅ | Line 158 |
| Auth check present | ✅ | Lines 95–103 |
| Ownership check present | ✅ | Lines 146–151 |

### 2.3 `src/app/api/benefits/[id]/route.ts` — Engine-managed field guard

**Status: ✅ PASS**

| Spec Requirement | Status | Evidence |
|------------------|--------|----------|
| Block `expirationDate` on engine-managed benefits | ✅ | Line 140: `'expirationDate'` in `blockedFields` array |
| Also blocks `name`, `resetCadence`, `type`, `stickerValue` | ✅ | Line 140 |
| `userDeclaredValue` still editable | ✅ | Not in blocked list |
| DELETE blocks engine-managed benefits | ✅ | Lines 237–242 |

### 2.4 `src/app/api/cards/[id]/route.ts` — DELETE cleanup

**Status: ✅ PASS**

| Spec Requirement | Status | Evidence |
|------------------|--------|----------|
| Set `isOpen = false` on DELETE | ✅ | Line 373 |
| Set `periodStatus = 'ARCHIVED'` on all benefits | ✅ | Line 380 |
| Set benefit `status = 'ARCHIVED'` | ✅ | Line 379 |
| Nested `updateMany` inside card update | ✅ | Lines 375–383 |

### 2.5 `src/app/api/benefits/[id]/toggle-used/route.ts` — DELETED card guard

**Status: ✅ PASS**

| Spec Requirement | Status | Evidence |
|------------------|--------|----------|
| Block toggle on DELETED card benefits | ✅ | Lines 78–83 |
| Period-status guard (EXPIRED, UPCOMING) | ✅ | Lines 88–129 |
| Catch-all for unknown period statuses | ✅ | Lines 119–129 |

---

## 3. Issues Found

### CRITICAL-1: IDOR in `POST /api/benefits/usage` — Missing Ownership Check

| Field | Detail |
|-------|--------|
| **Severity** | 🔴 CRITICAL |
| **File** | `src/app/api/benefits/usage/route.ts` |
| **Lines** | 104–120 |
| **Impact** | Any authenticated user can create usage records on ANY user's benefits |

**Description:** The route authenticates the user (`getAuthUserId()`) and verifies `userBenefit.userCardId === userCardId`, but **never verifies** that the UserCard belongs to the authenticated user. The `userId` from auth is only used to populate `BenefitUsageRecord.userId` — it is never compared to the card/player owner.

**Attack vector:** An attacker who knows (or brute-forces) another user's `userBenefitId` and `userCardId` can:
1. Create fraudulent usage records on their benefits
2. Potentially trigger "CLAIMING_LIMIT_EXCEEDED" errors that block the real owner from using their benefit
3. Pollute another user's usage history

**Code (vulnerable):**
```typescript
// Line 105-120: No ownership verification
const userBenefit = await prisma.userBenefit.findUnique({
  where: { id: userBenefitId },
  include: { userCard: true },  // ← Does NOT include player.userId
});

if (!userBenefit || userBenefit.userCardId !== userCardId) {
  // Only checks card-benefit relationship, NOT ownership
}
```

**Fix:** Add ownership verification after fetching the benefit:
```typescript
const userBenefit = await prisma.userBenefit.findUnique({
  where: { id: userBenefitId },
  include: {
    userCard: {
      include: {
        player: { select: { userId: true } },
      },
    },
  },
});

if (!userBenefit || userBenefit.userCardId !== userCardId) {
  return NextResponse.json({ ... }, { status: 404 });
}

// ADD THIS: Verify ownership
if (userBenefit.userCard.player.userId !== userId) {
  return NextResponse.json(
    { success: false, error: 'FORBIDDEN', message: 'Not authorized', statusCode: 403 },
    { status: 403 }
  );
}
```

---

### HIGH-1: `POST /api/cards/add` — Missing MasterCard `isActive` Guard

| Field | Detail |
|-------|--------|
| **Severity** | 🟠 HIGH |
| **File** | `src/app/api/cards/add/route.ts` |
| **Lines** | 199–213 |
| **Impact** | Users can add/reactivate cards for archived MasterCard templates |

**Description:** The spec (Finding 6, Edge Case 6, Task #2) explicitly requires checking `masterCard.isActive`. The current code only checks `!masterCard` (existence). An admin who archives a card template would expect no new users can add it, but the code allows it.

**Code (current):**
```typescript
if (!masterCard) {  // ← Only checks existence, not isActive
  return NextResponse.json(..., { status: 404 });
}
```

**Fix:**
```typescript
if (!masterCard || !masterCard.isActive) {
  return NextResponse.json(
    {
      success: false,
      error: 'Card not found',
      code: 'CARD_NOT_FOUND',
      fieldErrors: { masterCardId: 'This card is no longer available' },
    } as ErrorResponse,
    { status: 404 }
  );
}
```

---

### HIGH-2: `POST /api/mobile/sync` — Missing Ownership Check on Usage Creation

| Field | Detail |
|-------|--------|
| **Severity** | 🟠 HIGH |
| **File** | `src/app/api/mobile/sync/route.ts` |
| **Lines** | 108–118 |
| **Impact** | Authenticated user can create usage records on any user's benefits via mobile sync |

**Description:** The POST handler creates `BenefitUsageRecord` with `benefitId` taken directly from the request body (`data.benefitId`) without verifying the benefit belongs to the authenticated user. The `userId` from auth is stored on the record but is never used for authorization.

**Fix:** Before creating the usage record, verify the benefit belongs to the user:
```typescript
if (resource === 'usage' && type === 'create') {
  // Verify ownership
  const benefit = await prisma.userBenefit.findUnique({
    where: { id: data.benefitId },
    select: { playerId: true },
  });
  if (!benefit || benefit.playerId !== player.id) {
    errors.push({ id, error: 'Benefit not found or not owned by user' });
    continue;
  }
  // ... then create
}
```

---

### HIGH-3: Dashboard Benefits Route — Includes DELETED Cards' Benefits

| Field | Detail |
|-------|--------|
| **Severity** | 🟠 HIGH |
| **File** | `src/app/api/dashboard/benefits/route.ts` |
| **Lines** | 60–62 |
| **Impact** | Benefits from DELETED cards appear on the dashboard |

**Description:** The query fetches ALL UserCards for the player (`where: { playerId: player.id }`) with no status filter. When the benefit engine is enabled, `periodStatus: 'ACTIVE'` partially mitigates this (since the DELETE fix now sets `periodStatus = 'ARCHIVED'`). However, if a card was deleted before the `periodStatus` fix was deployed, those benefits would still have `periodStatus: 'ACTIVE'` and would leak through.

**Fix:**
```typescript
const userCards = await prisma.userCard.findMany({
  where: {
    playerId: player.id,
    status: { not: 'DELETED' },  // ← Add this filter
  },
});
```

---

### MEDIUM-1: `PATCH /api/cards/[id]` — No DELETED Card Guard

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **File** | `src/app/api/cards/[id]/route.ts` |
| **Lines** | 244–265 |
| **Impact** | Users can edit fields on a DELETED card (via manual API calls) |

**Description:** The PATCH handler does not check `card.status === 'DELETED'` before allowing edits. While the frontend hides deleted cards, a crafted API request could modify `customName`, `actualAnnualFee`, or `renewalDate` on a DELETED card. These changes would then carry over if the card is later reactivated.

**Fix:** Add guard after ownership check:
```typescript
if (card.status === 'DELETED') {
  return NextResponse.json(
    { success: false, error: 'Cannot edit a deleted card' } as ErrorResponse,
    { status: 400 }
  );
}
```

---

### MEDIUM-2: `PATCH /api/benefits/[id]` — No DELETED Card Guard

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **File** | `src/app/api/benefits/[id]/route.ts` |
| **Lines** | 111–136 |
| **Impact** | Can edit benefits on a DELETED card |

**Description:** The PATCH handler checks for engine-managed benefit guards but never checks if the parent card is DELETED. A user could modify `userDeclaredValue` or (for non-engine benefits) `name`, `resetCadence`, etc. on benefits that belong to a DELETED card.

**Fix:** Add after ownership check (line 136):
```typescript
if (benefit.userCard.status === 'DELETED') {
  return NextResponse.json(
    { success: false, error: 'Cannot edit benefits on a deleted card' } as ErrorResponse,
    { status: 400 }
  );
}
```

---

### MEDIUM-3: `POST /api/benefits/usage` — No DELETED Card Guard

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **File** | `src/app/api/benefits/usage/route.ts` |
| **Lines** | 104–120 |
| **Impact** | Usage records can be created for benefits on DELETED cards |

**Description:** Beyond the CRITICAL ownership issue, even after that is fixed, there is no check for `userCard.status === 'DELETED'`. A user could record usage on a card they deleted.

**Fix:** Add after ownership check:
```typescript
if (userBenefit.userCard.status === 'DELETED') {
  return NextResponse.json(
    { success: false, error: 'CARD_DELETED', message: 'Cannot record usage on a deleted card', statusCode: 400 },
    { status: 400 }
  );
}
```

---

### MEDIUM-4: `GET /api/mobile/sync` — Does Not Filter DELETED Cards

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **File** | `src/app/api/mobile/sync/route.ts` |
| **Lines** | 28–38 |
| **Impact** | Mobile app receives benefits from DELETED cards |

**Description:** The GET handler queries `userBenefit.findMany({ where: { playerId: player.id } })` with only `periodStatus: 'ACTIVE'` filtering. It does not filter out benefits whose parent card is DELETED. With the DELETE fix in place, `periodStatus` would be `'ARCHIVED'` for DELETED cards' benefits, but pre-fix data could leak through.

**Fix:** Join and filter:
```typescript
const benefitWhere: Prisma.UserBenefitWhereInput = {
  playerId: player.id,
  userCard: { status: { not: 'DELETED' } },  // ← Add this
};
```

---

### MEDIUM-5: Inconsistent Authentication Patterns Across API Routes

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **File** | Multiple |
| **Impact** | Maintenance risk; potential auth bypass if middleware is misconfigured |

**Description:** Three distinct authentication patterns are used across the API surface:

| Pattern | Used By | Mechanism |
|---------|---------|-----------|
| `request.headers.get('x-user-id')` | benefits/add, benefits/[id], toggle-used, cards/[id], dashboard, benefits/history | Middleware-injected header |
| `getUserIdFromRequest(request)` | cards/add | Direct JWT cookie parsing |
| `getAuthUserId()` | benefits/usage, mobile/sync, benefits/filters, benefits/periods | AsyncLocalStorage context |

If middleware fails to set the `x-user-id` header (e.g., middleware is bypassed for new routes), routes using pattern 1 would silently return 401 while routes using pattern 3 might read stale context. The `POST /api/cards/add` route uses a unique pattern (pattern 2) that is inconsistent with all other routes.

**Recommendation:** Standardize on one pattern. Given the existing codebase, `x-user-id` header is the majority pattern. Document which pattern is canonical and audit that middleware covers all routes.

---

### MEDIUM-6: Multiple `any` Type Annotations

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **File** | Multiple |
| **Impact** | Type-safety holes; potential runtime errors not caught at compile time |

| File | Line | Usage |
|------|------|-------|
| `cards/add/route.ts` | 128 | `(payload as Record<string, any>).userId` |
| `benefits/[id]/route.ts` | 153 | `const updateData: any = {}` |
| `cards/[id]/route.ts` | 267 | `const updateData: any = {}` |
| `benefits/usage/route.ts` | 144 | `let masterBenefit: any = null` |
| `benefits/usage/route.ts` | 210, 321, 363–366 | Multiple `any` annotations |
| `benefits/usage/[id]/route.ts` | 74 | `Record<string, any>` |

**Recommendation:** Replace with proper types. Example for `updateData`:
```typescript
const updateData: Partial<Pick<Prisma.UserBenefitUpdateInput, 'name' | 'userDeclaredValue' | 'expirationDate' | 'resetCadence'>> = {};
```

---

### LOW-1: `PATCH /api/benefits/[id]` — Engine Guard Bypasses `type` and `stickerValue` Block

| Field | Detail |
|-------|--------|
| **Severity** | 🟢 LOW |
| **File** | `src/app/api/benefits/[id]/route.ts` |
| **Lines** | 139–151 |
| **Impact** | Theoretical inconsistency; blocked fields include `type` and `stickerValue` which are not in `PatchBenefitRequest` interface |

**Description:** The `blockedFields` array includes `'type'` and `'stickerValue'`, but the `PatchBenefitRequest` interface does not include these fields. They would never appear in `body`, so the guard can never trigger for them. This is dead code — harmless but misleading.

**Recommendation:** Either add `type` and `stickerValue` to `PatchBenefitRequest` (for defense-in-depth against future changes) or remove them from `blockedFields` and add a comment explaining why.

---

### LOW-2: Dashboard Benefits — Excessive Production Logging

| Field | Detail |
|-------|--------|
| **Severity** | 🟢 LOW |
| **File** | `src/app/api/dashboard/benefits/route.ts` |
| **Lines** | 23–37 |
| **Impact** | Log noise; userId logged in plaintext |

**Description:** Multiple `console.log` statements log the `userId`, header keys, and player ID on every request. In production, this creates excessive log volume and exposes user IDs in plaintext logs.

**Recommendation:** Remove or gate behind a debug flag:
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[Dashboard Benefits API] Request received', { userId });
}
```

---

### LOW-3: Error Response Format Inconsistency

| Field | Detail |
|-------|--------|
| **Severity** | 🟢 LOW |
| **File** | Multiple |
| **Impact** | Frontend must handle 3+ error response shapes |

**Description:** At least three distinct error response shapes are in use:

| Shape | Routes |
|-------|--------|
| `{ success: false, error: string }` | cards/add, cards/[id], benefits/add, benefits/[id], toggle-used |
| `{ error: string }` (no `success` field) | mobile/sync, benefits/periods, benefits/progress, benefits/recommendations |
| `{ success: false, error: string, message: string, statusCode: number }` | benefits/usage, benefits/usage/[id] |

**Recommendation:** Standardize all error responses to a single shape and create a shared error response helper.

---

### LOW-4: `POST /api/benefits/usage` — `error` Uses Error Code, Not Message

| Field | Detail |
|-------|--------|
| **Severity** | 🟢 LOW |
| **File** | `src/app/api/benefits/usage/route.ts` |
| **Lines** | 47, 303 |
| **Impact** | Frontend cannot display `error` field directly to user; must parse `message` field instead |

**Description:** The `error` field contains machine-readable codes (`'UNAUTHORIZED'`, `'VALIDATION_ERROR'`) while the human-readable text is in `message`. Other routes use `error` for the human-readable message. This creates frontend confusion about which field to display.

---

### LOW-5: `DELETE /api/benefits/[id]` — No DELETED Card Guard

| Field | Detail |
|-------|--------|
| **Severity** | 🟢 LOW |
| **File** | `src/app/api/benefits/[id]/route.ts` |
| **Lines** | 196–258 |
| **Impact** | Can soft-delete an already-ARCHIVED benefit on a DELETED card (no-op, idempotent) |

**Description:** Per spec Finding 4 — this is accepted behavior. The update to `status: 'ARCHIVED'` on an already-ARCHIVED row is idempotent. No production risk.

---

### LOW-6: `POST /api/mobile/sync` — No Input Validation on Queue Items

| Field | Detail |
|-------|--------|
| **Severity** | 🟢 LOW |
| **File** | `src/app/api/mobile/sync/route.ts` |
| **Lines** | 104–128 |
| **Impact** | Invalid data could cause unhandled Prisma errors |

**Description:** Individual queue items have no schema validation. The destructured `{ id, type, resource, data }` are used without type checking. If `data.benefitId` is missing or `data.usageAmount` is not a number, the Prisma `create` will throw an unhandled error that becomes a generic error response.

**Recommendation:** Add validation per queue item type.

---

### LOW-7: Concurrent Reactivation — Double Benefit Generation

| Field | Detail |
|-------|--------|
| **Severity** | 🟢 LOW |
| **File** | `src/app/api/cards/add/route.ts` |
| **Lines** | 216–329 |
| **Impact** | Last-write-wins is correct but may create duplicate benefits briefly before overwrite |

**Description:** Per spec Edge Case 8 — two concurrent reactivation requests both read `status === 'DELETED'` and both enter the reactivation path. The `generateBenefitsForCard` uses `skipDuplicates: true` (line 138 of `generate-benefits.ts`), which mitigates duplicate benefit rows via the unique constraint `(userCardId, name, periodStart)`. However, the second request's `deleteMany` + `update` would reset the card and regenerate benefits, creating a "last write wins" scenario. This is accepted per spec and functionally safe.

---

## 4. Specification Alignment Analysis

### ✅ Correctly Implemented

| Spec Section | Implementation Status |
|-------------|----------------------|
| Core Feature: Card Reactivation | ✅ Fully implemented |
| Hard-delete old UserBenefits | ✅ `deleteMany` inside transaction |
| Benefit regeneration (engine ON) | ✅ Calls `generateBenefitsForCard()` |
| Benefit regeneration (engine OFF) | ✅ Legacy flat-copy path preserved |
| Finding 1 (DELETE → periodStatus ARCHIVED) | ✅ Fixed |
| Finding 2 (DELETE → isOpen false) | ✅ Fixed |
| Finding 3 (Block expirationDate edit) | ✅ Fixed |
| Finding 5 (Toggle guard for DELETED cards) | ✅ Fixed |
| Finding 6 (Add benefit guard for DELETED cards) | ✅ Fixed |
| Edge Case 1 (Mid-period reactivation) | ✅ Handled by date-math engine |
| Edge Case 5 (No active MasterBenefits) | ✅ Returns `benefitsCreated: 0` |
| Edge Case 7 (Transaction failure) | ✅ $transaction provides rollback |

### ❌ Not Implemented (Spec Deviations)

| Spec Section | Status | Detail |
|-------------|--------|--------|
| Task #2: MasterCard `isActive` guard | ❌ | `!masterCard.isActive` check not added (see HIGH-1) |
| Finding 9 (Benefit Status uses `createdAt` vs `renewalDate`) | ❌ | Not in scope of this PR but called out in spec |

---

## 5. Edge Case Analysis

| Edge Case | Handling | Verified |
|-----------|----------|----------|
| Card with no old benefits to delete | `deleteMany` returns 0, continues | ✅ Safe |
| Benefit engine fails during regeneration | `$transaction` rolls back all changes | ✅ Safe |
| Concurrent reactivation (same card) | Last-write-wins via `skipDuplicates` | ✅ Acceptable |
| MasterCard deleted after UserCard created | `masterCard.findUnique` returns existing row (not null) since master cards are not hard-deleted | ✅ Safe |
| Empty `customName` (whitespace only) | Validation rejects empty-after-trim on line 419–421 | ✅ Safe |
| `actualAnnualFee` = 0 | Allowed (0 ≤ fee ≤ 999900), rounds to integer | ✅ Safe |
| `renewalDate` exactly now | Rejected by `date < new Date()` check (line 409) | ⚠️ Edge: Fails if request takes <1ms. Acceptable. |

---

## 6. Test Recommendations

### Priority 1: Security (must write)

| # | Test | Category | What to Validate |
|---|------|----------|-----------------|
| T1 | IDOR on `POST /api/benefits/usage` | Security | User A cannot create usage on User B's benefit. Should return 403. |
| T2 | IDOR on `POST /api/mobile/sync` | Security | User A cannot create usage records for User B's benefits via sync queue. |

### Priority 2: Reactivation Flow (must write)

| # | Test | Category | What to Validate |
|---|------|----------|-----------------|
| T3 | Reactivation happy path (engine ON) | Integration | DELETED card → POST /api/cards/add → 201, `status: 'ACTIVE'`, old benefits gone, new engine-generated benefits present |
| T4 | Reactivation happy path (engine OFF) | Integration | Same as T3 but with legacy flat-copy benefits (no period fields) |
| T5 | Reactivation preserves `createdAt` | Unit | `createdAt` unchanged, `updatedAt` refreshed |
| T6 | Reactivation increments `version` | Unit | Version N → N+1 after reactivation |
| T7 | Full lifecycle: add → use → delete → re-add | Integration | Benefits reset to `isUsed: false`, old usage records cascade-deleted |
| T8 | Mid-period reactivation | Integration | Delete June 5, re-add June 20 → Monthly benefit has correct June period |

### Priority 3: Guard Tests (should write)

| # | Test | Category | What to Validate |
|---|------|----------|-----------------|
| T9 | Reject benefit creation on DELETED card | Unit | `POST /api/benefits/add` with DELETED card → 400 |
| T10 | Reject toggle-used on DELETED card | Unit | `PATCH /api/benefits/[id]/toggle-used` with DELETED card → 400 |
| T11 | Reject `expirationDate` edit on engine benefit | Unit | `PATCH /api/benefits/[id]` with engine-managed benefit + `expirationDate` → 403 |
| T12 | Reject add for archived MasterCard | Unit | `POST /api/cards/add` with `masterCard.isActive = false` → 404 |
| T13 | Dashboard excludes DELETED card benefits | Integration | After card delete, dashboard API returns 0 benefits for that card |

### Priority 4: Edge Cases (nice to have)

| # | Test | Category | What to Validate |
|---|------|----------|-----------------|
| T14 | Reactivation with changed MasterBenefits | Integration | Old benefits: A,B,C. Admin removes B, adds D. Re-add → benefits: A,C,D |
| T15 | Reactivation with zero MasterBenefits | Edge | Re-add card with no active default MasterBenefits → 201, `benefitsCreated: 0` |
| T16 | Concurrent reactivation (race) | Concurrency | Two simultaneous POSTs for same DELETED card → both succeed or one succeeds, card is ACTIVE with valid benefits |
| T17 | OneTime benefit on reactivation | Edge | Welcome bonus regenerated on re-add (fresh start model) |

---

## 7. Comprehensive API Audit Summary

### Cards Routes (`/api/cards/`)

| Route | Auth | DELETED Guard | Transaction | Prisma Errors | `any` Types |
|-------|------|--------------|-------------|---------------|-------------|
| `POST /cards/add` | ✅ JWT Cookie | ✅ Reactivation path | ✅ | ❌ | ⚠️ 1 use |
| `GET /cards/[id]` | ✅ x-user-id | ❌ (returns DELETED cards) | N/A | ❌ | ✅ None |
| `PATCH /cards/[id]` | ✅ x-user-id | ❌ **Can edit DELETED** | ❌ | ❌ | ⚠️ `any` |
| `DELETE /cards/[id]` | ✅ x-user-id | ✅ Sets DELETED | ✅ Nested update | ❌ | ✅ None |
| `GET /cards/available` | ✅ None (public) | N/A (MasterCard catalog) | N/A | ❌ | ⚠️ 1 use |
| `GET /cards/my-cards` | ✅ x-user-id | ✅ Filters DELETED | N/A | ❌ | ⚠️ `any` |
| `GET /cards/user-cards` | ✅ x-user-id | ✅ Filters DELETED | N/A | ❌ | ✅ None |

### Benefits Routes (`/api/benefits/`)

| Route | Auth | DELETED Card Guard | Engine Guard | Prisma Errors | `any` Types |
|-------|------|--------------------|-------------|---------------|-------------|
| `POST /benefits/add` | ✅ x-user-id | ✅ | N/A (manual benefit) | ❌ | ✅ None |
| `PATCH /benefits/[id]` | ✅ x-user-id | ❌ **Missing** | ✅ | ❌ | ⚠️ `any` |
| `DELETE /benefits/[id]` | ✅ x-user-id | ❌ (idempotent) | ✅ | ❌ | ✅ None |
| `PATCH /benefits/[id]/toggle-used` | ✅ x-user-id | ✅ | ✅ Period guard | ❌ | ✅ None |
| `POST /benefits/usage` | ✅ getAuthUserId | ❌ **Missing** | ❌ **Missing ownership** | ✅ P2002 | ⚠️ 5+ uses |
| `PATCH /benefits/usage/[id]` | ✅ getAuthUserId | ❌ | N/A | ❌ | ⚠️ 1 use |
| `GET /benefits/history` | ✅ x-user-id | ❌ | N/A (read-only) | ❌ | ✅ None |

### Other Routes

| Route | Auth | DELETED Card Filter | Prisma Errors | Notable Issue |
|-------|------|-------------------|---------------|---------------|
| `POST /dashboard/benefits` | ✅ x-user-id | ❌ **Missing** | ❌ | Includes DELETED card benefits |
| `GET /cron/reset-benefits` | ✅ Bearer (CRON_SECRET) | ✅ | ❌ | Properly filters; timing-safe auth ✅ |
| `GET /mobile/sync` | ✅ getAuthUserId | ❌ | ❌ | Returns DELETED card benefits |
| `POST /mobile/sync` | ✅ getAuthUserId | ❌ **Missing ownership** | ❌ | IDOR on usage creation |

---

## 8. Recommendations Summary

### Must Fix Before Merge

1. **CRITICAL-1:** Add ownership check in `POST /api/benefits/usage` (security vulnerability)
2. **HIGH-1:** Add `masterCard.isActive` guard in `POST /api/cards/add` (spec requirement)

### Should Fix Before Production

3. **HIGH-2:** Add ownership check in `POST /api/mobile/sync`
4. **HIGH-3:** Filter DELETED cards in `POST /dashboard/benefits`
5. **MEDIUM-1:** Add DELETED card guard in `PATCH /api/cards/[id]`
6. **MEDIUM-2:** Add DELETED card guard in `PATCH /api/benefits/[id]`
7. **MEDIUM-3:** Add DELETED card guard in `POST /api/benefits/usage`

### Nice to Have

8. **MEDIUM-4:** Filter DELETED cards in `GET /api/mobile/sync`
9. **MEDIUM-5:** Standardize authentication patterns
10. **MEDIUM-6:** Remove `any` type annotations
11. **LOW-1 through LOW-7:** Address when convenient

---

*Report generated by QA review of commit changes against spec `.github/specs/card-add-reactivation-spec.md`*
