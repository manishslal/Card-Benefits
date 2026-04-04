# Comprehensive Audit: API Integration, Data Display, and 401 Errors

**Auditor**: QA Code Review Agent  
**Date**: 2025-07-18  
**Scope**: Full API authentication chain, monetary data flow, and display consistency  
**Verdict**: 🔴 **NOT production-ready** — 4 critical issues, 5 high-priority issues, 6 medium issues

---

## Executive Summary

| Severity | Count | Summary |
|----------|-------|---------|
| 🔴 Critical | 4 | Middleware auth gap blocks ALL non-auth API routes; Missing GET endpoints force stale mock data; AsyncLocalStorage breaks `/api/auth/user`; Card detail mock data uses wrong units |
| 🟠 High | 5 | BenefitsGrid uses raw dollar field bypassing cents conversion; frontend `fetch()` missing `credentials: 'include'`; `DELETE` returns JSON body with 204 status; validation mismatch across layers |
| 🟡 Medium | 6 | Duplicate `formatCurrency` implementations; heuristic currency parser is fragile; `await` on synchronous function; incomplete `select-all` checkbox; no error boundary on data fetch; `any` type usage in update handlers |
| 🔵 Low | 3 | Console logging in production middleware; generated last-four digits; `value` field shadows `stickerValue` in type hierarchy |

**Key Recommendation**: Fix the middleware route classification (Issue 1) before any other work — it is the single blocker that causes 401s for every authenticated API call outside of `/api/auth/*`.

---

## Issue 1: 401 Errors When Adding a Benefit

### Root Cause: Middleware Route Classification Gap

**Files**: `src/middleware.ts` (lines 54–95, 258–356)

The middleware classifies routes into three buckets:

| Bucket | Check | Action |
|--------|-------|--------|
| **Public** | `PUBLIC_ROUTES.has(pathname) \|\| isPublicApiRoute(pathname)` | Passes through with `userId: undefined` |
| **Protected** | `isProtectedRoute(pathname)` | Extracts JWT, verifies, sets `userId` in ALS |
| **Unclassified** | Falls through both checks | Passes through with `userId: undefined` |

**The bug**: All data-mutation API routes (`/api/benefits/*`, `/api/cards/*`, `/api/user/*`) are **unclassified** — they are NOT public (they don't start with `/api/auth`) and NOT protected (they don't match any entry in `PROTECTED_ROUTES`).

#### Proof by Trace

For a `POST /api/benefits/add` request:

```
Step 1 (middleware.ts:266):
  isPublic = PUBLIC_ROUTES.has('/api/benefits/add')    → false (set has /, /login, /signup...)
           || isPublicApiRoute('/api/benefits/add')    → false (doesn't start with '/api/auth')
  isPublic = false

Step 2 (middleware.ts:267):
  isProtected = isProtectedRoute('/api/benefits/add')
    PROTECTED_ROUTES.has('/api/benefits/add')           → false
    pathname.startsWith('/api/protected/')              → false
    pathname.startsWith('/dashboard/')                  → false
    pathname.startsWith('/account/')                    → false
    pathname.startsWith('/settings/')                   → false
    pathname.startsWith('/cards/')                      → false  ← NOTE: path is /api/cards/..., NOT /cards/...
    pathname.startsWith('/benefits/')                   → false  ← NOTE: path is /api/benefits/..., NOT /benefits/...
    pathname.startsWith('/wallet/')                     → false
  isProtected = false

Step 3 (middleware.ts:294): isPublic is false → skip
Step 4 (middleware.ts:306): isProtected is false → skip
Step 5 (middleware.ts:348-355): UNCLASSIFIED → sets userId: undefined
```

Then in the route handler:

```typescript
// src/app/api/benefits/add/route.ts:89-97
const authContext = await getAuthContext();  // returns { userId: undefined }
const userId = authContext?.userId;          // undefined
if (!userId) {
  return NextResponse.json(
    { success: false, error: 'Not authenticated' },
    { status: 401 }                         // ← THIS IS THE 401
  );
}
```

#### All Affected Routes

| Route | Methods | Has Auth Check | Middleware Class | Result |
|-------|---------|---------------|-----------------|--------|
| `/api/benefits/add` | POST | ✅ `getAuthContext()` | ❌ Unclassified | **401 Always** |
| `/api/benefits/[id]` | PATCH, DELETE | ✅ `getAuthContext()` | ❌ Unclassified | **401 Always** |
| `/api/benefits/[id]/toggle-used` | PATCH | ✅ `getAuthContext()` | ❌ Unclassified | **401 Always** |
| `/api/cards/add` | POST | ✅ `getAuthContext()` | ❌ Unclassified | **401 Always** |
| `/api/cards/[id]` | PATCH, DELETE | ✅ `getAuthContext()` | ❌ Unclassified | **401 Always** |
| `/api/cards/my-cards` | GET | ✅ `getAuthContext()` | ❌ Unclassified | **401 Always** |
| `/api/user/profile` | POST | ✅ `getAuthContext()` | ❌ Unclassified | **401 Always** |
| `/api/auth/user` | GET | ✅ `getAuthContext()` | ❌ Public* | **401 Always** |
| `/api/cards/available` | GET | ❌ None | Unclassified | Works (no auth needed) |
| `/api/health` | GET | ❌ None | Unclassified | Works (no auth needed) |
| `/api/cron/reset-benefits` | GET | ❌ Own CRON_SECRET | Unclassified | Works (own auth) |

> *`/api/auth/user` starts with `/api/auth` so middleware classifies it as **public** and sets `userId: undefined`. But the route handler requires a userId via `getAuthContext()`.

#### Fix Required

In `src/middleware.ts`, add protected API route prefixes:

```typescript
// Line 64 area — Add this constant:
const PROTECTED_API_PREFIXES = [
  '/api/benefits',
  '/api/cards/add',
  '/api/cards/my-cards',
  '/api/user',
  '/api/auth/user',   // Needs auth despite /api/auth prefix
];

// Update isProtectedRoute() to also check API prefixes:
function isProtectedRoute(pathname: string): boolean {
  if (PROTECTED_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/api/protected/')) return true;
  
  // NEW: Check protected API prefixes
  if (PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix))) return true;
  
  for (const route of PROTECTED_ROUTES) {
    if (pathname.startsWith(route + '/')) return true;
  }
  return false;
}
```

Alternative (more defensive): Treat ALL `/api/*` routes as protected EXCEPT explicitly public ones:

```typescript
function isProtectedRoute(pathname: string): boolean {
  // ... existing checks ...
  
  // All API routes are protected unless explicitly public
  if (pathname.startsWith('/api/') && !isPublicApiRoute(pathname)) {
    // Exclude routes that handle their own auth
    const SELF_AUTH_ROUTES = ['/api/health', '/api/cron/'];
    if (!SELF_AUTH_ROUTES.some(r => pathname.startsWith(r))) {
      return true;
    }
  }
  
  return false;
}
```

### Secondary Issue: Missing `credentials: 'include'` on Fetch Calls

**Files**: `src/components/AddBenefitModal.tsx:123-135`, `src/components/EditBenefitModal.tsx:155-164`

Even after fixing the middleware, these fetch calls don't include `credentials: 'include'`:

```typescript
// AddBenefitModal.tsx:123 — Missing credentials
const response = await fetch('/api/benefits/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  // ← No credentials: 'include'
  body: JSON.stringify({ ... }),
});

// EditBenefitModal.tsx:155 — Missing credentials
const response = await fetch(`/api/benefits/${benefit.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  // ← No credentials: 'include'
  body: JSON.stringify({ ... }),
});
```

**Note**: For same-origin requests, `fetch()` defaults to `credentials: 'same-origin'`, which DOES send cookies. So this is not a blocking bug for same-origin deployments. However:
- If the app is deployed on a different subdomain than the API, cookies won't be sent.
- The `AddCardModal.tsx:66-70` explicitly sets `credentials: 'include'`, creating an inconsistency.
- Best practice: Always be explicit.

**Fix**: Add `credentials: 'include'` to all authenticated fetch calls for consistency and cross-origin safety.

---

## Issue 2: Sticker Value Shows "3.00" in Modal but "300" in Card View

### Root Cause: Multiple Interacting Problems

This is caused by a chain of three separate bugs that conspire to produce the mismatch.

### Bug 2A: Missing GET Endpoints Force Fallback to Incorrect Mock Data

**Files**: `src/app/api/cards/[id]/route.ts`, `src/app/(dashboard)/card/[id]/page.tsx:86-120`

The card detail page makes two API calls that **don't have corresponding route handlers**:

```typescript
// card/[id]/page.tsx:89 — No GET handler exists!
const response = await fetch(`/api/cards/${cardId}`);

// card/[id]/page.tsx:129 — This endpoint doesn't exist at all!
const response = await fetch(`/api/cards/${cardId}/benefits`);
```

`src/app/api/cards/[id]/route.ts` only exports `PATCH` and `DELETE` — **no `GET` handler**. There is also no `src/app/api/cards/[id]/benefits/route.ts` file.

**Result**: Both fetches fail (405/404), and the page falls back to mock data.

### Bug 2B: Mock Data Uses Dollar Values Instead of Cent Values

**File**: `src/app/(dashboard)/card/[id]/page.tsx:139-199`

The fallback mock data uses **dollar** values for `stickerValue`, contradicting the database schema where `stickerValue` is in **cents**:

```typescript
// card/[id]/page.tsx:144 — WRONG: 300 dollars, should be 30000 cents
stickerValue: 300,

// card/[id]/page.tsx:153 — WRONG: 150 dollars, should be 15000 cents
stickerValue: 150,

// card/[id]/page.tsx:162 — WRONG: 100 dollars, should be 10000 cents
stickerValue: 100,
```

Compare with the dashboard page mock data which is CORRECT:

```typescript
// (dashboard)/page.tsx:274 — CORRECT: 30000 cents = $300
stickerValue: 30000,
```

### Bug 2C: BenefitsGrid Uses `value` Field Instead of `stickerValue`

**File**: `src/components/features/BenefitsGrid.tsx:188-194`

BenefitsGrid renders monetary values using a separate `value` field (in dollars) rather than `stickerValue` (in cents):

```typescript
// BenefitsGrid.tsx:188-194
{benefit.value && (
  <span className="font-mono font-semibold" style={{ color: 'var(--color-success)' }}>
    ${benefit.value}   // ← Renders raw dollar value: "$300"
  </span>
)}
```

The dashboard page sets both fields:

```typescript
// (dashboard)/page.tsx:274,279
stickerValue: 30000,  // cents (correct)
value: 300,           // dollars (separate display field)
```

### The Complete Data Flow Producing the Mismatch

**Scenario**: User views card detail page → clicks Edit on a $300 benefit

```
1. Card detail page loads
2. fetch(`/api/cards/${cardId}`) → 405 (no GET handler)
3. Falls back to mock data: stickerValue: 300 (DOLLARS, not cents)
4. BenefitsGrid displays: ${benefit.value} → "$300" (from value field, in dollars)
5. User clicks "Edit" → opens EditBenefitModal with benefit.stickerValue = 300
6. EditBenefitModal line 203: stickerValueInDollars = (300 / 100).toFixed(2) = "3.00"
7. Modal shows: "Sticker Value: $3.00" ← WRONG, should be $300.00
```

### Fix Required (Three-Part)

**Part 1**: Add GET handler to `/api/cards/[id]/route.ts` that returns card data with benefits.

**Part 2**: Create `/api/cards/[id]/benefits/route.ts` OR have the GET handler include benefits in the card response.

**Part 3**: Fix mock data units. In `src/app/(dashboard)/card/[id]/page.tsx`, change all mock stickerValues from dollars to cents:

```typescript
// Line 144: Change 300 → 30000
stickerValue: 30000,   // $300 in cents

// Line 153: Change 150 → 15000
stickerValue: 15000,   // $150 in cents

// Line 162: Change 100 → 10000  
stickerValue: 10000,   // $100 in cents
```

Also fix `actualAnnualFee` in mock card data:

```typescript
// Line 103: Change 550 → 55000
actualAnnualFee: 55000,  // $550 in cents
```

**Part 4**: BenefitsGrid should use `stickerValue` with proper cents→dollars conversion instead of a separate `value` field, OR the `value` field should be computed from `stickerValue` at the point of usage.

---

## Issue 3: API Routes Authentication Consistency

### Complete Route Authentication Audit

#### Authentication Architecture

```
Browser → Middleware (JWT verify) → AsyncLocalStorage → Route Handler (getAuthContext())
         │                          │                    │
         │ Sets userId in ALS       │                    │ Reads userId from ALS
         │ for protected routes     │                    │ Returns 401 if undefined
         │                          │                    │
         └──────────────────────────┘                    └──────────────────────────
```

#### Per-Route Analysis

##### `/api/auth/*` Routes (Classified: Public)

| Route | Method | Own Auth | Uses `getAuthContext()` | Status |
|-------|--------|----------|----------------------|--------|
| `/api/auth/login` | POST | N/A (creates session) | No | ✅ Correct |
| `/api/auth/signup` | POST | N/A (creates user) | No | ✅ Correct |
| `/api/auth/session` | GET | Own JWT verification via `cookies()` | No | ✅ Correct |
| `/api/auth/logout` | POST | Reads cookie directly | No | ✅ Correct |
| `/api/auth/verify` | GET | Own JWT verification | No | ✅ Correct |
| `/api/auth/user` | GET | None | **Yes** | 🔴 **BROKEN**: classified as public, getAuthContext() returns undefined → 401 |
| `/api/auth/debug-verify` | GET | Own verification | No | ✅ Correct (debug route) |
| `/api/auth/test-session-lookup` | GET | Own verification | No | ✅ Correct (test route) |

**Issue**: `/api/auth/user` is broken because it starts with `/api/auth` (classified as public → no JWT verification) but uses `getAuthContext()` which needs the middleware to populate userId.

**Impact**: The dashboard greeting always falls back to "User" instead of showing the real name (error is caught silently at `src/app/(dashboard)/page.tsx:145-159`).

##### `/api/benefits/*` Routes (Classified: Unclassified)

| Route | Method | Uses Auth | Middleware Class | Status |
|-------|--------|-----------|-----------------|--------|
| `/api/benefits/add` | POST | `getAuthContext()` | Unclassified | 🔴 **401 always** |
| `/api/benefits/[id]` | PATCH | `getAuthContext()` | Unclassified | 🔴 **401 always** |
| `/api/benefits/[id]` | DELETE | `getAuthContext()` | Unclassified | 🔴 **401 always** |
| `/api/benefits/[id]/toggle-used` | PATCH | `getAuthContext()` | Unclassified | 🔴 **401 always** |

##### `/api/cards/*` Routes (Classified: Unclassified)

| Route | Method | Uses Auth | Middleware Class | Status |
|-------|--------|-----------|-----------------|--------|
| `/api/cards/add` | POST | `getAuthContext()` | Unclassified | 🔴 **401 always** |
| `/api/cards/[id]` | PATCH | `getAuthContext()` | Unclassified | 🔴 **401 always** |
| `/api/cards/[id]` | DELETE | `getAuthContext()` | Unclassified | 🔴 **401 always** |
| `/api/cards/[id]` | GET | ❌ **Missing handler** | Unclassified | 🟠 **405 (no handler)** |
| `/api/cards/my-cards` | GET | `getAuthContext()` | Unclassified | 🔴 **401 always** |
| `/api/cards/available` | GET | None (public catalog) | Unclassified | ✅ Works correctly |

##### `/api/user/*` Routes (Classified: Unclassified)

| Route | Method | Uses Auth | Middleware Class | Status |
|-------|--------|-----------|-----------------|--------|
| `/api/user/profile` | POST | `getAuthContext()` | Unclassified | 🔴 **401 always** |

##### Infrastructure Routes (Classified: Unclassified)

| Route | Method | Uses Auth | Middleware Class | Status |
|-------|--------|-----------|-----------------|--------|
| `/api/health` | GET, HEAD | None | Unclassified | ✅ Correct |
| `/api/cron/reset-benefits` | GET | Own `CRON_SECRET` | Unclassified | ✅ Correct |

### Summary of Route Authentication Mismatches

**10 routes** have a mismatch between middleware classification and route handler expectations:

1. `/api/benefits/add` — needs protected, classified as unclassified
2. `/api/benefits/[id]` (PATCH) — needs protected, classified as unclassified
3. `/api/benefits/[id]` (DELETE) — needs protected, classified as unclassified
4. `/api/benefits/[id]/toggle-used` — needs protected, classified as unclassified
5. `/api/cards/add` — needs protected, classified as unclassified
6. `/api/cards/[id]` (PATCH) — needs protected, classified as unclassified
7. `/api/cards/[id]` (DELETE) — needs protected, classified as unclassified
8. `/api/cards/my-cards` — needs protected, classified as unclassified
9. `/api/user/profile` — needs protected, classified as unclassified
10. `/api/auth/user` — needs protected, classified as public (false public)

---

## Issue 4: Database Schema Alignment

### Schema Summary

**File**: `prisma/schema.prisma`

All monetary fields use `Int` (cents):

| Model | Field | Type | Unit | Comment |
|-------|-------|------|------|---------|
| `MasterCard` | `defaultAnnualFee` | `Int` | Cents | e.g., 55000 = $550 |
| `MasterBenefit` | `stickerValue` | `Int` | Cents | e.g., 30000 = $300 |
| `UserCard` | `actualAnnualFee` | `Int?` | Cents | Override fee; null = use default |
| `UserBenefit` | `stickerValue` | `Int` | Cents | Original benefit value |
| `UserBenefit` | `userDeclaredValue` | `Int?` | Cents | User's estimated value |

### Schema-to-API Field Alignment

| Schema Field | API Route | API Field Name | Match | Notes |
|-------------|-----------|----------------|-------|-------|
| `UserBenefit.stickerValue` | POST `/api/benefits/add` | `stickerValue` | ✅ | |
| `UserBenefit.userDeclaredValue` | POST `/api/benefits/add` | `userDeclaredValue` | ✅ | |
| `UserBenefit.name` | POST `/api/benefits/add` | `name` | ✅ | |
| `UserBenefit.type` | POST `/api/benefits/add` | `type` | ✅ | |
| `UserBenefit.resetCadence` | POST `/api/benefits/add` | `resetCadence` | ✅ | |
| `UserBenefit.expirationDate` | POST `/api/benefits/add` | `expirationDate` | ✅ | String → DateTime conversion |
| `UserBenefit.isUsed` | PATCH `/api/benefits/[id]/toggle-used` | `isUsed` | ✅ | |
| `UserBenefit.timesUsed` | GET `/api/cards/my-cards` | **Not returned** | 🟡 | BenefitTable expects `timesUsed` in its interface (line 44) but API doesn't return it |
| `UserCard.customName` | POST `/api/cards/add` | `customName` | ✅ | |
| `UserCard.actualAnnualFee` | POST `/api/cards/add` | `customAnnualFee` | 🟡 | **Name mismatch**: API uses `customAnnualFee`, DB uses `actualAnnualFee` |

### Frontend-to-Schema Field Mismatches

**BenefitTable expects `timesUsed` but API omits it:**
- `src/components/BenefitTable.tsx:44` — `timesUsed: number` in interface
- `src/app/api/cards/my-cards/route.ts:224-234` — `timesUsed` is **not included** in the select
- **Impact**: `timesUsed` will always be `undefined`, no runtime error but logically incomplete

**BenefitsGrid uses `value` field that doesn't exist in schema:**
- `src/components/features/BenefitsGrid.tsx:15` — `value?: number` (in dollars)
- This field does NOT exist in `UserBenefit` schema
- It's only populated in mock data (`(dashboard)/page.tsx:279`)
- **Impact**: With real data, `benefit.value` would be `undefined` and the value display would be blank

**Dashboard `BenefitData` has fields not in schema:**
- `src/app/(dashboard)/page.tsx:56-58`:
  - `description?: string` — Not in UserBenefit schema
  - `value?: number` — Not in schema (dollar-denominated display field)
  - `usage?: number` — Not in schema (percentage field)
- **Impact**: These fields are only populated by mock data

### Type Safety Issue in Update Handlers

**File**: `src/app/api/benefits/[id]/route.ts:138`

```typescript
const updateData: any = {};  // ← Using `any` bypasses all type checking
```

Same in `src/app/api/cards/[id]/route.ts:121`:

```typescript
const updateData: any = {};  // ← Using `any`
```

**Impact**: No compile-time protection against sending incorrect field names to Prisma.

**Fix**: Use `Prisma.UserBenefitUpdateInput` and `Prisma.UserCardUpdateInput` types.

---

## Additional Issues Found During Audit

### Bug 5: DELETE Returns JSON Body with 204 Status (HTTP Violation)

**Files**: `src/app/api/benefits/[id]/route.ts:226`, `src/app/api/cards/[id]/route.ts:210`

```typescript
// benefits/[id]/route.ts:226
return NextResponse.json({ success: true }, { status: 204 });

// cards/[id]/route.ts:210
return NextResponse.json({ success: true }, { status: 204 });
```

HTTP 204 (No Content) **must not** include a response body per RFC 7231 §6.3.5. Some clients and proxies may strip the body, causing `response.json()` to throw on the frontend.

**Fix**: Either return 200 with JSON body, or return 204 with no body:

```typescript
return new NextResponse(null, { status: 204 });
```

### Bug 6: Heuristic Currency Parser is Fragile

**File**: `src/lib/custom-values/validation.ts:134-149`

```typescript
if (parsed >= 1000) {
  cents = Math.round(parsed);  // Assumes cents
} else {
  cents = Math.round(parsed * 100);  // Assumes dollars
}
```

**Problem**: A value of `$10.00` entered as `1000` would be treated as 1000 cents ($10.00) — correct by accident. But `$9.99` entered as `999` would be treated as dollars and converted to 99900 cents ($999.00) — **wildly wrong**.

**Impact**: Any value input between 100-999 is ambiguous and the heuristic guesses wrong for cent inputs in that range.

### Bug 7: Frontend Validation Mismatch in AddBenefitModal

**File**: `src/components/AddBenefitModal.tsx:85-92`

The frontend compares `declaredValue > stickerValue` in **dollars**:

```typescript
} else if (declaredValue > stickerValue) {
  newErrors.userDeclaredValue = 'User declared value cannot exceed sticker value';
}
```

The API validates the same constraint in **cents** (after frontend conversion):

```typescript
// benefits/add/route.ts:264
} else if (body.stickerValue && body.userDeclaredValue > body.stickerValue) {
```

This works correctly because both conversions happen consistently. However, there's a floating-point edge case: if the user enters `3.005` dollars, `Math.round(3.005 * 100)` = `301` (not `300.5` rounded). The frontend comparison in dollars would pass but the cents comparison could behave differently due to floating-point precision.

**Severity**: Low — practically unlikely to cause visible issues.

---

## Test Coverage Recommendations

### Priority 1: Middleware Route Classification Tests

```
Test: POST /api/benefits/add with valid session → should return 201, not 401
Test: POST /api/benefits/add without session → should return 401
Test: PATCH /api/benefits/{id} with valid session → should return 200
Test: GET /api/cards/my-cards with valid session → should return 200
Test: POST /api/cards/add with valid session → should return 201
Test: GET /api/auth/user with valid session → should return 200
Test: GET /api/cards/available without session → should return 200
Test: GET /api/health without session → should return 200
```

### Priority 2: Currency Unit Consistency Tests

```
Test: POST /api/benefits/add with stickerValue=30000 → DB stores 30000
Test: GET /api/cards/my-cards returns stickerValue in cents
Test: EditBenefitModal pre-fills (30000/100).toFixed(2) = "300.00"
Test: AddBenefitModal converts $300 input → 30000 cents in API call
Test: BenefitTable.formatCurrency(30000) → "$300.00"
Test: CardTrackerPanel.formatCents(30000) → "$300.00"
```

### Priority 3: Missing Endpoint Tests

```
Test: GET /api/cards/{id} → should return card with benefits
Test: GET /api/cards/{id}/benefits → should return benefits array
Test: Verify no mock data fallback occurs when API endpoints exist
```

### Priority 4: Edge Case Tests

```
Test: DELETE /api/benefits/{id} → response has no body (204 compliance)
Test: Add benefit with userDeclaredValue > stickerValue → 400 error
Test: Add benefit with stickerValue = 0 → 400 error
Test: Toggle benefit isUsed increments timesUsed only on false→true
Test: Edit benefit on a card owned by different user → 403
```

---

## Data Flow Diagrams

### Add Benefit Flow (Current — Broken)

```
User enters $300 in AddBenefitModal
        │
        ▼
Frontend: Math.round(300 * 100) = 30000 (cents)
        │
        ▼
fetch('/api/benefits/add', { body: { stickerValue: 30000 } })
        │  ← No credentials: 'include' (works same-origin)
        ▼
Middleware: /api/benefits/add → NOT public, NOT protected → UNCLASSIFIED
        │
        ▼
runWithAuthContext({ userId: undefined }, () => NextResponse.next())
        │
        ▼
Route Handler: getAuthContext() → { userId: undefined }
        │
        ▼
return 401 "Not authenticated"  ← REQUEST DIES HERE
```

### Display Benefit Flow (Card Detail Page — Broken Mock)

```
Browser navigates to /card/abc123
        │
        ▼
fetch('/api/cards/abc123')
        │
        ▼
405 Method Not Allowed (no GET handler)
        │
        ▼
Falls back to mock: stickerValue: 300  ← WRONG UNIT (dollars, not cents)
        │
        ├──► BenefitsGrid: ${benefit.value} → "$300"  (from value field, correct display)
        │
        └──► EditBenefitModal: (300 / 100).toFixed(2) → "$3.00"  ← WRONG
```

### Display Benefit Flow (Dashboard — Correct)

```
Browser navigates to /dashboard
        │
        ▼
fetch('/api/cards/my-cards') → 401 (middleware issue)
        │
        ▼
Falls back to mock: stickerValue: 30000  ← CORRECT (cents)
        │
        ├──► BenefitsGrid: ${benefit.value} → "$300"  (from separate value field)
        │
        └──► If edit opened: (30000 / 100).toFixed(2) → "$300.00"  ← CORRECT
```

---

## Summary of Required Fixes (Priority Order)

| # | Severity | Fix | File(s) | Est. Effort |
|---|----------|-----|---------|-------------|
| 1 | 🔴 Critical | Add protected API route prefixes to middleware | `src/middleware.ts` | 30 min |
| 2 | 🔴 Critical | Add GET handler to `/api/cards/[id]` returning card + benefits | `src/app/api/cards/[id]/route.ts` | 2 hrs |
| 3 | 🔴 Critical | Fix `/api/auth/user` classification (needs special handling — public prefix but needs auth) | `src/middleware.ts` | 30 min |
| 4 | 🔴 Critical | Fix card detail mock data units from dollars to cents | `src/app/(dashboard)/card/[id]/page.tsx` | 15 min |
| 5 | 🟠 High | Unify currency display in BenefitsGrid to use `stickerValue` with cents conversion | `src/components/features/BenefitsGrid.tsx` | 1 hr |
| 6 | 🟠 High | Add `credentials: 'include'` to all authenticated fetch calls | `AddBenefitModal.tsx`, `EditBenefitModal.tsx` | 15 min |
| 7 | 🟠 High | Fix 204 responses to not include JSON body | `benefits/[id]/route.ts`, `cards/[id]/route.ts` | 15 min |
| 8 | 🟠 High | Include `timesUsed` in my-cards API response | `src/app/api/cards/my-cards/route.ts` | 15 min |
| 9 | 🟠 High | Replace `any` type in update data with Prisma input types | `benefits/[id]/route.ts`, `cards/[id]/route.ts` | 30 min |
| 10 | 🟡 Medium | Consolidate duplicate `formatCurrency` functions into shared utility | Multiple component files | 1 hr |
| 11 | 🟡 Medium | Remove or fix heuristic currency parser | `src/lib/custom-values/validation.ts` | 1 hr |
| 12 | 🟡 Medium | Remove `value`, `description`, `usage` fields from BenefitData type or compute from schema fields | `(dashboard)/page.tsx`, `BenefitsGrid.tsx` | 1 hr |

---

*End of audit. All findings are based on static analysis of the source code as of the audit date.*
