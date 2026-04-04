# Card Benefits Tracker - Wave 1 Auth/API Remediation Specification

**Status:** Critical Bug Fixes for MVP Release  
**Version:** 1.0  
**Date:** 2024  
**Priority:** 🔴 BLOCKER - All CRUD operations failing due to authentication gaps

---

## Executive Summary

Wave 1 addresses **5 critical authentication and API issues** that prevent all card and benefit CRUD operations from functioning. Four parallel security audits identified 45 total issues (9 critical, 16 high, 15 medium, 5 low). This specification focuses exclusively on the 5 critical issues blocking MVP: middleware route classification, protected route protection, fetch credential inclusion, missing API endpoints, and HTTP protocol violations.

**Impact:**
- ❌ POST `/api/benefits/add`, `/api/cards/add` → 401 Unauthorized
- ❌ PATCH `/api/benefits/[id]`, `/api/cards/[id]` → 401 Unauthorized
- ❌ DELETE `/api/benefits/[id]`, `/api/cards/[id]` → 204 with JSON body (HTTP violation)
- ❌ GET `/api/auth/user` → Public classification conflicts with JWT requirement
- ❌ GET `/api/cards/[id]` → Missing entirely (card detail page uses stale mock data)

**Fix scope:** No migrations needed. No database changes. No new tables. All fixes are API middleware, route handlers, and fetch call modifications. Fully backward compatible.

**Deployment:** Single rollout. Can revert middleware changes to restore previous behavior.

---

## Task 1A: Middleware Route Classification Fix

### Problem

**Lines 54-95 of `src/middleware.ts`:** The `isProtectedRoute()` function classifies `/api/benefits/*`, `/api/cards/*`, and `/api/user/*` as **unclassified** (falling through to Step 4 in middleware logic), not protected.

**Current middleware flow:**
```
Route: POST /api/benefits/add
└─ Is public? No (not in PUBLIC_ROUTES or PUBLIC_API_ROUTES)
└─ Is protected? No (not in PROTECTED_ROUTES or /api/protected/*)
└─ Falls through to Step 4 (unclassified routes)
└─ Proceeds with userId: undefined
└─ Route handler calls getAuthContext() → userId is undefined
└─ Returns 401 Unauthorized
```

**Root cause:** There is no `PROTECTED_API_PREFIXES` array. Only `/api/protected/*` pattern is recognized. All data-mutation API routes start with `/api/benefits/`, `/api/cards/`, or `/api/user/` but these prefixes are not listed.

**Affected routes (all return 401):**
- POST `/api/benefits/add`
- PATCH `/api/benefits/[id]`
- DELETE `/api/benefits/[id]`
- POST `/api/cards/add`
- PATCH `/api/cards/[id]`
- DELETE `/api/cards/[id]`
- GET `/api/cards/my-cards`
- POST `/api/user/profile`

### Solution

Add a `PROTECTED_API_PREFIXES` constant and update `isProtectedRoute()` to check these prefixes. This ensures all data-mutation endpoints classify as protected, extract JWT from cookies, and pass `userId` to route handlers.

### Implementation

**File:** `src/middleware.ts`

**Changes:**

1. **Add constant after PUBLIC_API_ROUTES (line 65):**
   ```typescript
   /** API route prefixes that REQUIRE authentication */
   const PROTECTED_API_PREFIXES = [
     '/api/benefits',   // POST /api/benefits/add, PATCH/DELETE /api/benefits/[id]
     '/api/cards',      // POST /api/cards/add, PATCH/DELETE /api/cards/[id], GET /api/cards/my-cards
     '/api/user',       // POST /api/user/profile, GET /api/user/profile
   ];
   ```

2. **Update isProtectedRoute() function (lines 82-95):**
   ```typescript
   /** Check if route requires authentication */
   function isProtectedRoute(pathname: string): boolean {
     // Exact match for protected page routes
     if (PROTECTED_ROUTES.has(pathname)) return true;
   
     // Protected dynamic page routes (e.g., /settings/profile, /cards/[id])
     for (const route of PROTECTED_ROUTES) {
       if (pathname.startsWith(route + '/')) return true;
     }
   
     // Protected API route prefixes (NEW)
     for (const prefix of PROTECTED_API_PREFIXES) {
       if (pathname.startsWith(prefix)) return true;
     }
   
     // Legacy pattern: /api/protected/*
     if (pathname.startsWith('/api/protected/')) return true;
   
     return false;
   }
   ```

### Before/After Code Comparison

**BEFORE (Middleware middleware.ts lines 82-95):**
```typescript
function isProtectedRoute(pathname: string): boolean {
  if (PROTECTED_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/api/protected/')) return true;
  for (const route of PROTECTED_ROUTES) {
    if (pathname.startsWith(route + '/')) return true;
  }
  return false;  // ❌ All /api/benefits/*, /api/cards/*, /api/user/* fall through here
}
```

**AFTER (Middleware middleware.ts):**
```typescript
const PROTECTED_API_PREFIXES = [
  '/api/benefits',
  '/api/cards',
  '/api/user',
];

function isProtectedRoute(pathname: string): boolean {
  if (PROTECTED_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/api/protected/')) return true;
  for (const route of PROTECTED_ROUTES) {
    if (pathname.startsWith(route + '/')) return true;
  }
  // ✅ NEW: Check protected API prefixes
  for (const prefix of PROTECTED_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}
```

### Test Cases

**Test Case 1A.1: POST /api/benefits/add with valid token**
- **Setup:** User authenticated, JWT in session cookie
- **Request:** `POST /api/benefits/add` with `{ userCardId, name, type, stickerValue, resetCadence }`
- **Expected:** Middleware classifies as protected → extracts JWT → verifies → sets userId → route handler returns 200
- **Assertion:** `response.status === 200 && response.body.success === true`

**Test Case 1A.2: PATCH /api/cards/[id] with valid token**
- **Setup:** User authenticated with card ownership
- **Request:** `PATCH /api/cards/{cardId}` with `{ customName }`
- **Expected:** 200 OK with updated card
- **Assertion:** `response.status === 200 && response.body.card.customName === 'newName'`

**Test Case 1A.3: DELETE /api/benefits/[id] with valid token**
- **Setup:** User authenticated with benefit ownership
- **Request:** `DELETE /api/benefits/{benefitId}`
- **Expected:** 204 No Content (soft delete)
- **Assertion:** `response.status === 204`

**Test Case 1A.4: GET /api/cards/my-cards with valid token**
- **Setup:** User authenticated
- **Request:** `GET /api/cards/my-cards`
- **Expected:** Middleware classifies as protected → returns user's cards
- **Assertion:** `response.status === 200 && response.body.cards.length >= 0`

**Test Case 1A.5: POST /api/user/profile without token**
- **Setup:** No session cookie
- **Request:** `POST /api/user/profile`
- **Expected:** Middleware classifies as protected → no token → returns 401
- **Assertion:** `response.status === 401`

**Test Case 1A.6: Route classification edge cases**
- `/api/benefits` (exact match) → Protected ✓
- `/api/benefits/` → Protected ✓
- `/api/benefits/add` → Protected ✓
- `/api/benefits/[id]` → Protected ✓
- `/api/card` (partial match) → NOT protected (correct) ✓
- `/api/cards/available` → Protected ✓

---

## Task 1B: Fix `/api/auth/user` Route Classification Conflict

### Problem

**File:** `src/app/api/auth/user/route.ts`  
**Issue:** Route path starts with `/api/auth`, so middleware classifies as **public** (line 64: `const PUBLIC_API_ROUTES = ['/api/auth']`). But the route handler calls `getAuthContext()` and requires `userId`, which will be `undefined` on public routes.

**Current behavior:**
```typescript
// Middleware sees: /api/auth/user starts with /api/auth
// Classification: PUBLIC
// Action: Sets userId: undefined

// Route handler:
const userId = authContext?.userId;
if (!userId) {
  return 401;  // ❌ Always fails
}
```

**Root cause:** The `/api/auth` prefix was intended for login/signup endpoints (which are public). But `/api/auth/user` (fetch current user profile) needs authentication.

### Solution

**Option A (Recommended):** Move route to `/api/user/profile` (path already exists in some versions).  
**Option B:** Have route extract and verify JWT itself, bypassing middleware classification.

**Implementing Option A** (cleanest, follows existing pattern):

1. Move file from `src/app/api/auth/user/route.ts` → `src/app/api/user/profile/route.ts`
2. Update import statements in components that call this endpoint
3. Middleware will classify `/api/user/profile` as protected (Task 1A)
4. Route handler remains unchanged

**If Option B required** (don't move file):

Modify route handler to extract and verify JWT directly:
```typescript
import { verifySessionToken, isSessionExpired } from '@/lib/auth-utils';
import { getSessionByToken } from '@/lib/auth-server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract JWT directly (bypass middleware classification)
    const token = request.cookies.get('session')?.value;
    if (!token) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    // Verify JWT
    const payload = verifySessionToken(token);
    if (isSessionExpired(payload)) {
      return NextResponse.json({ success: false, error: 'Session expired' }, { status: 401 });
    }

    // Check session in database
    const dbSession = await getSessionByToken(token);
    if (!dbSession) {
      return NextResponse.json({ success: false, error: 'Session revoked' }, { status: 401 });
    }

    const userId = payload.userId;

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user }, { status: 200 });
  } catch (error) {
    console.error('[Get User Error]', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch user profile' }, { status: 500 });
  }
}
```

### Implementation Decision

**Recommend Option A:** Move the route to `/api/user/profile`.

**Changes:**
1. `mv src/app/api/auth/user/route.ts src/app/api/user/profile/route.ts`
2. Update fetch calls in components (if they call `/api/auth/user`, change to `/api/user/profile`)
3. Route handler code remains identical
4. Middleware automatically protects via PROTECTED_API_PREFIXES

**Rationale:**
- Cleaner separation: `/api/auth/*` = login/signup (public), `/api/user/*` = user profile (protected)
- No JWT verification duplication in route handler
- Consistent with existing `/api/user/profile` pattern
- Middleware handles all auth uniformly

### Test Cases

**Test Case 1B.1: GET /api/user/profile with valid token**
- **Setup:** User authenticated
- **Request:** `GET /api/user/profile`
- **Expected:** 200 OK with user profile
- **Assertion:** `response.status === 200 && response.body.user.email === 'test@example.com'`

**Test Case 1B.2: GET /api/user/profile without token**
- **Setup:** No session cookie
- **Request:** `GET /api/user/profile`
- **Expected:** Middleware blocks (protected route) → 401
- **Assertion:** `response.status === 401`

**Test Case 1B.3: GET /api/user/profile with expired token**
- **Setup:** Session cookie exists but token is expired
- **Request:** `GET /api/user/profile`
- **Expected:** Middleware rejects → 401
- **Assertion:** `response.status === 401`

**Test Case 1B.4: GET /api/user/profile after user deletion**
- **Setup:** Token valid, but user deleted from database
- **Request:** `GET /api/user/profile`
- **Expected:** Middleware's Step 4 detects user not found → 401
- **Assertion:** `response.status === 401`

---

## Task 1C: Add `credentials: 'include'` to Modal Fetch Calls

### Problem

**Files affected:**
- `src/components/AddBenefitModal.tsx` (line ~123-135)
- `src/components/EditBenefitModal.tsx` (line ~155-164)
- `src/components/AddCardModal.tsx` (line ~260-270)
- `src/components/EditCardModal.tsx` (line ~118-128)

**Issue:** Fetch calls to mutation endpoints don't include `credentials: 'include'`, so session cookie is NOT sent to the server. Browser's same-origin policy blocks automatic cookie inclusion in fetch requests (unlike XHR or form submissions).

**Current (broken) fetch call:**
```typescript
const response = await fetch('/api/benefits/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({...}),
  // ❌ MISSING: credentials: 'include'
});
```

**Middleware receives request without cookie:**
```
Request: POST /api/benefits/add
Cookies: (none)  // ❌ Session cookie was NOT sent
Middleware extracts: sessionToken = null
Result: 401 Unauthorized
```

**The fix:** Add `credentials: 'include'` to tell browser to include cookies with this cross-site request (but since it's same-origin, it just works normally).

### Solution

Add `credentials: 'include'` to all fetch() calls that:
1. Send data to protected API routes (POST, PATCH, DELETE)
2. Need user authentication

### Implementation

**File:** `src/components/AddBenefitModal.tsx`

**Change (around line 123-135):**
```typescript
const response = await fetch('/api/benefits/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ✅ NEW: Include session cookie
  body: JSON.stringify({
    userCardId: cardId,
    name: formData.name.trim(),
    type: formData.type,
    stickerValue,
    resetCadence: formData.resetCadence,
    userDeclaredValue,
    expirationDate: formData.expirationDate || undefined,
  }),
});
```

**File:** `src/components/EditBenefitModal.tsx`

**Change (around line 155-164):**
```typescript
const response = await fetch(`/api/benefits/${benefit.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ✅ NEW: Include session cookie
  body: JSON.stringify({
    name: formData.name,
    userDeclaredValue,
    expirationDate: formData.expirationDate || undefined,
    resetCadence: formData.resetCadence,
  }),
});
```

**File:** `src/components/AddCardModal.tsx`

**Change 1 (around line 260-270, add card):**
```typescript
const response = await fetch('/api/cards/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ✅ NEW: Include session cookie
  body: JSON.stringify({
    masterCardId: selectedCard.id,
    renewalDate: formData.renewalDate,
    actualAnnualFee: formData.actualAnnualFee,
  }),
});
```

**Note:** Line 117-126 (fetch available cards) already has `credentials: 'include'` ✓

**File:** `src/components/EditCardModal.tsx`

**Change (around line 118-128):**
```typescript
const response = await fetch(`/api/cards/${card.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ✅ NEW: Include session cookie
  body: JSON.stringify({
    customName: formData.customName,
    actualAnnualFee: formData.actualAnnualFee,
    renewalDate: formData.renewalDate,
  }),
});
```

### Complete Fetch Call Template

Use this template for all authenticated API calls:

```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',  // or PATCH, DELETE, GET
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ✅ Always include for authenticated routes
  body: JSON.stringify({...}),  // Only for POST/PATCH/DELETE
});

if (!response.ok) {
  const error = await response.json();
  console.error('API Error:', error);
  // Handle error (show in UI)
  return;
}

const data = await response.json();
// Handle success
```

### Affected API Routes

The following routes now work correctly with `credentials: 'include'`:

| Route | Method | Component |
|-------|--------|-----------|
| `/api/benefits/add` | POST | AddBenefitModal |
| `/api/benefits/[id]` | PATCH | EditBenefitModal |
| `/api/benefits/[id]` | DELETE | Benefit delete button |
| `/api/cards/add` | POST | AddCardModal |
| `/api/cards/[id]` | PATCH | EditCardModal |
| `/api/cards/[id]` | DELETE | Card delete button |
| `/api/cards/available` | GET | AddCardModal (already fixed) |
| `/api/user/profile` | GET/POST | User profile fetch |

### Test Cases

**Test Case 1C.1: POST /api/benefits/add with credentials**
- **Setup:** User authenticated, session cookie in browser
- **Request:** `POST /api/benefits/add` from AddBenefitModal with `credentials: 'include'`
- **Expected:** Browser sends session cookie → middleware extracts JWT → sets userId → 200 OK
- **Assertion:** `response.status === 200 && response.body.success === true`

**Test Case 1C.2: PATCH /api/cards/[id] with credentials**
- **Setup:** User authenticated, session cookie in browser
- **Request:** `PATCH /api/cards/{id}` from EditCardModal with `credentials: 'include'`
- **Expected:** Cookie sent → auth succeeds → 200 OK
- **Assertion:** `response.status === 200`

**Test Case 1C.3: POST /api/cards/add without credentials (should fail)**
- **Setup:** Remove `credentials: 'include'` from fetch (testing fix)
- **Request:** `POST /api/cards/add` without credentials
- **Expected:** Cookie NOT sent → no JWT in middleware → 401
- **Assertion:** `response.status === 401`

**Test Case 1C.4: DELETE /api/benefits/[id] with credentials**
- **Setup:** User authenticated
- **Request:** `DELETE /api/benefits/{id}` with `credentials: 'include'`
- **Expected:** 204 No Content
- **Assertion:** `response.status === 204`

---

## Task 1D: Add GET `/api/cards/[id]` Endpoint

### Problem

**File:** `src/app/api/cards/[id]/route.ts`  
**Issue:** File exists with PATCH and DELETE handlers, but **no GET handler**. When card detail page loads, no API exists, so frontend falls back to mock data (hardcoded, stale, wrong units).

**Example mock data issue:**
```javascript
// Current mock (dollars)
{
  id: 'card-1',
  customName: 'Chase Sapphire',
  actualAnnualFee: 550,  // ❌ Should be 55000 cents ($550)
}
```

**Database stores values in cents (Prisma schema confirms):**
```prisma
actualAnnualFee   Int?     // In cents
stickerValue      Int      // In cents
userDeclaredValue Int?     // In cents
```

**When mock returns dollars instead of cents, the UI displays wrong values:**
- Card shows $5.50 annual fee instead of $550
- Benefits show wrong sticker values

### Solution

Add GET handler to `/api/cards/[id]/route.ts` that:
1. Extracts card ID from URL
2. Verifies user owns the card
3. Fetches card with benefits from database
4. Returns JSON with all card details (values in cents)
5. Handles errors (404 not found, 403 permission denied, 500 server error)

### Implementation

**File:** `src/app/api/cards/[id]/route.ts`

**Add GET handler (insert before PATCH):**

```typescript
/**
 * GET /api/cards/[id] - Fetch card details with benefits
 * 
 * Returns:
 * - Card details: id, customName, actualAnnualFee (in cents), renewalDate, status
 * - Associated benefits: array of UserBenefit objects
 * 
 * Note: All monetary values are in CENTS (e.g., 55000 = $550)
 */

interface GetCardResponse {
  success: true;
  card: {
    id: string;
    masterCardId: string;
    customName: string | null;
    actualAnnualFee: number | null;  // In cents
    renewalDate: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    benefits: {
      id: string;
      name: string;
      type: string;
      stickerValue: number;  // In cents
      userDeclaredValue: number | null;  // In cents
      resetCadence: string;
      expirationDate: string | null;
      isUsed: boolean;
      status: string;
    }[];
  };
}

interface GetCardErrorResponse {
  success: false;
  error: string;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authContext = await getAuthContext();
    const userId = authContext?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as GetCardErrorResponse,
        { status: 401 }
      );
    }

    // Extract card ID from URL path: /api/cards/[id]
    const cardId = request.nextUrl.pathname.split('/')[3];

    if (!cardId) {
      return NextResponse.json(
        { success: false, error: 'Card ID required' } as GetCardErrorResponse,
        { status: 400 }
      );
    }

    // Fetch card with benefits from database
    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: {
        player: {
          select: { userId: true },
        },
        userBenefits: {
          where: { status: 'ACTIVE' },  // Only active benefits
          select: {
            id: true,
            name: true,
            type: true,
            stickerValue: true,  // Returned in cents
            userDeclaredValue: true,  // Returned in cents
            resetCadence: true,
            expirationDate: true,
            isUsed: true,
            status: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' } as GetCardErrorResponse,
        { status: 404 }
      );
    }

    // Verify user owns this card
    if (card.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view this card' } as GetCardErrorResponse,
        { status: 403 }
      );
    }

    // Return card with benefits
    return NextResponse.json(
      {
        success: true,
        card: {
          id: card.id,
          masterCardId: card.masterCardId,
          customName: card.customName,
          actualAnnualFee: card.actualAnnualFee,  // In cents
          renewalDate: card.renewalDate.toISOString(),
          status: card.status,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
          benefits: card.userBenefits.map((benefit) => ({
            id: benefit.id,
            name: benefit.name,
            type: benefit.type,
            stickerValue: benefit.stickerValue,  // In cents
            userDeclaredValue: benefit.userDeclaredValue,  // In cents
            resetCadence: benefit.resetCadence,
            expirationDate: benefit.expirationDate?.toISOString() || null,
            isUsed: benefit.isUsed,
            status: benefit.status,
          })),
        },
      } as GetCardResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error('[Get Card Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch card details' } as GetCardErrorResponse,
      { status: 500 }
    );
  }
}
```

### Prisma Query Explanation

```typescript
const card = await prisma.userCard.findUnique({
  where: { id: cardId },
  include: {
    // Include player to verify ownership
    player: {
      select: { userId: true },  // Only fetch userId (not sensitive fields)
    },
    // Include benefits (only active ones)
    userBenefits: {
      where: { status: 'ACTIVE' },  // Exclude archived/deleted
      select: {
        // Select only necessary fields
        id: true,
        name: true,
        type: true,
        stickerValue: true,  // In cents
        userDeclaredValue: true,  // In cents
        resetCadence: true,
        expirationDate: true,
        isUsed: true,
        status: true,
      },
    },
  },
});
```

### Request/Response Schema

**Request:**
```
GET /api/cards/{cardId}
Headers:
  - Cookie: session={jwt}
  - Content-Type: application/json
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "card": {
    "id": "card-123",
    "masterCardId": "master-456",
    "customName": "My Chase Sapphire",
    "actualAnnualFee": 55000,
    "renewalDate": "2024-12-15T00:00:00.000Z",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T00:00:00.000Z",
    "benefits": [
      {
        "id": "benefit-789",
        "name": "Earn 5x on flights",
        "type": "UsagePerk",
        "stickerValue": 0,
        "userDeclaredValue": null,
        "resetCadence": "OneTime",
        "expirationDate": null,
        "isUsed": false,
        "status": "ACTIVE"
      },
      {
        "id": "benefit-790",
        "name": "Trip delay reimbursement",
        "type": "InsuranceBenefit",
        "stickerValue": 30000,
        "userDeclaredValue": 25000,
        "resetCadence": "CardmemberYear",
        "expirationDate": "2025-12-15T00:00:00.000Z",
        "isUsed": true,
        "status": "ACTIVE"
      }
    ]
  }
}
```

**Error Responses:**

401 Unauthorized (no session):
```json
{
  "success": false,
  "error": "Not authenticated"
}
```

404 Not Found:
```json
{
  "success": false,
  "error": "Card not found"
}
```

403 Forbidden (user doesn't own card):
```json
{
  "success": false,
  "error": "You do not have permission to view this card"
}
```

### Test Cases

**Test Case 1D.1: GET /api/cards/[id] with valid card**
- **Setup:** User authenticated, card exists and belongs to user
- **Request:** `GET /api/cards/valid-card-id`
- **Expected:** 200 OK with card + benefits
- **Assertion:** `response.status === 200 && response.body.card.id === 'valid-card-id' && response.body.card.benefits.length > 0`

**Test Case 1D.2: GET /api/cards/[id] with missing card**
- **Setup:** User authenticated, card ID doesn't exist
- **Request:** `GET /api/cards/nonexistent-id`
- **Expected:** 404 Not Found
- **Assertion:** `response.status === 404 && response.body.error.includes('not found')`

**Test Case 1D.3: GET /api/cards/[id] with unowned card**
- **Setup:** User A authenticated, trying to view User B's card
- **Request:** User A: `GET /api/cards/user-b-card-id`
- **Expected:** 403 Forbidden
- **Assertion:** `response.status === 403 && response.body.error.includes('permission')`

**Test Case 1D.4: GET /api/cards/[id] returns values in cents**
- **Setup:** Card with actualAnnualFee = $550 (55000 cents) in DB
- **Request:** `GET /api/cards/{id}`
- **Expected:** Response includes `actualAnnualFee: 55000`
- **Assertion:** `response.body.card.actualAnnualFee === 55000`

**Test Case 1D.5: GET /api/cards/[id] returns only active benefits**
- **Setup:** Card with 5 total benefits (3 active, 2 archived)
- **Request:** `GET /api/cards/{id}`
- **Expected:** Response includes only 3 benefits
- **Assertion:** `response.body.card.benefits.length === 3 && response.body.card.benefits.every(b => b.status === 'ACTIVE')`

**Test Case 1D.6: GET /api/cards/[id] without authentication**
- **Setup:** No session cookie
- **Request:** `GET /api/cards/{id}`
- **Expected:** Middleware blocks → 401
- **Assertion:** `response.status === 401`

---

## Task 1E: Fix DELETE HTTP 204 + JSON Body Protocol Violation

### Problem

**Files:**
- `src/app/api/cards/[id]/route.ts` (DELETE handler, line ~168)
- `src/app/api/benefits/[id]/route.ts` (DELETE handler, line ~158)

**Issue:** DELETE endpoints return HTTP 204 (No Content) status code BUT also return a JSON response body `{ success: true }`. This violates the HTTP specification:

- **HTTP 204 (No Content):** Response MUST NOT include a message body. The server is informing the client that the request was successful, but there's nothing to send back.
- **HTTP 200 (OK):** Response CAN include a message body with details about the successful operation.

**Current (incorrect) implementation:**
```typescript
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // ... validation and soft delete logic ...

  return NextResponse.json({ success: true }, { status: 204 });
  // ❌ HTTP 204 with JSON body violates RFC 7231
}
```

**Why this is a problem:**
1. Some HTTP clients (proxies, CDNs, libraries) may strip the body on 204 responses
2. Some parsers expect no body on 204 and may throw errors
3. Browser DevTools flags this as a protocol violation
4. Type checking tools (TypeScript REST clients) reject it

### Solution

**Recommendation:** Return **204 No Content with empty body** (most RESTful).

**Rationale:**
- DELETE is an idempotent, destructive operation
- Client doesn't need a response body (request succeeded or failed)
- Follows HTTP specification exactly
- Status code is sufficient indication of success

**Alternative:** Return 200 OK with body (if client needs confirmation details) — NOT recommended for simple DELETE.

### Implementation

**File:** `src/app/api/cards/[id]/route.ts`

**Change DELETE handler (around line 168):**

```typescript
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const authContext = await getAuthContext();
    const userId = authContext?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    const cardId = request.nextUrl.pathname.split('/')[3];

    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: {
        player: {
          select: { userId: true },
        },
      },
    });

    if (!card) {
      return NextResponse.json(
        { success: false, error: 'Card not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    if (card.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete this card' } as ErrorResponse,
        { status: 403 }
      );
    }

    // Soft delete: mark as deleted and archive benefits
    await prisma.userCard.update({
      where: { id: cardId },
      data: {
        status: 'DELETED',
        userBenefits: {
          updateMany: {
            where: { userCardId: cardId },
            data: { status: 'ARCHIVED' },
          },
        },
      },
    });

    // ✅ FIXED: Return 204 with NO BODY
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Delete Card Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete card' } as ErrorResponse,
      { status: 500 }
    );
  }
}
```

**File:** `src/app/api/benefits/[id]/route.ts`

**Change DELETE handler (around line 158):**

```typescript
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const authContext = await getAuthContext();
    const userId = authContext?.userId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' } as ErrorResponse,
        { status: 401 }
      );
    }

    const benefitId = request.nextUrl.pathname.split('/')[3];

    const benefit = await prisma.userBenefit.findUnique({
      where: { id: benefitId },
      include: {
        userCard: {
          include: {
            player: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!benefit) {
      return NextResponse.json(
        { success: false, error: 'Benefit not found' } as ErrorResponse,
        { status: 404 }
      );
    }

    if (benefit.userCard.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete this benefit' } as ErrorResponse,
        { status: 403 }
      );
    }

    // Soft delete: archive benefit
    await prisma.userBenefit.update({
      where: { id: benefitId },
      data: { status: 'ARCHIVED' },
    });

    // ✅ FIXED: Return 204 with NO BODY
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[Delete Benefit Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete benefit' } as ErrorResponse,
      { status: 500 }
    );
  }
}
```

### Before/After Comparison

**BEFORE (Incorrect):**
```typescript
return NextResponse.json({ success: true }, { status: 204 });
// ❌ 204 with JSON body violates HTTP spec
```

**AFTER (Correct):**
```typescript
return new NextResponse(null, { status: 204 });
// ✅ 204 with empty body conforms to RFC 7231
```

### Client-Side Handling

**Frontend code remains the same:**
```typescript
const response = await fetch(`/api/cards/${cardId}`, {
  method: 'DELETE',
  credentials: 'include',
});

if (response.ok) {
  // Status is 204 No Content
  console.log('Card deleted successfully');
  // No need to parse response.json() (no body)
  // Optionally check: if (response.status === 204) { ... }
} else if (response.status === 404) {
  console.error('Card not found');
} else if (response.status === 403) {
  console.error('Permission denied');
} else {
  const error = await response.json();
  console.error('Delete failed:', error.error);
}
```

### Test Cases

**Test Case 1E.1: DELETE /api/cards/[id] returns 204**
- **Setup:** User authenticated, card owned by user
- **Request:** `DELETE /api/cards/{cardId}` with `credentials: 'include'`
- **Expected:** 204 No Content, no response body
- **Assertion:** `response.status === 204 && response.headers.get('content-length') === '0'`

**Test Case 1E.2: DELETE /api/benefits/[id] returns 204**
- **Setup:** User authenticated, benefit owned by user
- **Request:** `DELETE /api/benefits/{benefitId}`
- **Expected:** 204 No Content, no response body
- **Assertion:** `response.status === 204 && !response.body`

**Test Case 1E.3: DELETE /api/cards/[id] card marked as DELETED**
- **Setup:** User authenticated, card exists
- **Request:** `DELETE /api/cards/{cardId}`
- **Expected:** 204 OK, card.status changed to 'DELETED' in DB
- **Assertion:** Query DB: `card.status === 'DELETED'`

**Test Case 1E.4: DELETE /api/cards/[id] archives all benefits**
- **Setup:** Card with 3 active benefits
- **Request:** `DELETE /api/cards/{cardId}`
- **Expected:** 204 OK, all benefits archived in DB
- **Assertion:** Query DB: `benefits.every(b => b.status === 'ARCHIVED')`

**Test Case 1E.5: DELETE /api/benefits/[id] benefit marked ARCHIVED**
- **Setup:** User authenticated, benefit exists with status ACTIVE
- **Request:** `DELETE /api/benefits/{benefitId}`
- **Expected:** 204 OK, benefit.status changed to 'ARCHIVED'
- **Assertion:** Query DB: `benefit.status === 'ARCHIVED'`

**Test Case 1E.6: DELETE /api/cards/[id] returns 404 if card not found**
- **Setup:** User authenticated, card doesn't exist
- **Request:** `DELETE /api/cards/nonexistent`
- **Expected:** 404 Not Found with error body
- **Assertion:** `response.status === 404 && (await response.json()).error === 'Card not found'`

---

## Integration Diagram: How All 5 Tasks Work Together

```
User: POST /api/benefits/add from AddBenefitModal
│
├─ Step 1: Browser fetch()
│  ├─ Includes credentials: 'include' ✓ [Task 1C]
│  └─ Sends session cookie with request
│
├─ Step 2: Middleware (src/middleware.ts)
│  ├─ Route: POST /api/benefits/add
│  ├─ Classify route as protected [Task 1A]
│  │  └─ Check: startsWith('/api/benefits') → Yes, protected
│  ├─ Extract session cookie from request
│  ├─ Verify JWT signature (Node.js crypto)
│  ├─ Check database for valid session
│  ├─ Verify user still exists
│  └─ Set userId in AsyncLocalStorage
│
├─ Step 3: Route Handler (src/app/api/benefits/add/route.ts)
│  ├─ Call getAuthContext() → returns userId ✓
│  ├─ Validate request body
│  ├─ Insert UserBenefit into database (values in cents)
│  └─ Return 200 OK with created benefit
│
└─ Step 4: Browser handles response
   └─ AddBenefitModal shows success message

──────────────────────────────────────────────────────────────

User: GET /api/cards/{id} from card detail page
│
├─ Step 1: Browser fetch()
│  ├─ Includes credentials: 'include' ✓ [Task 1C]
│  └─ Sends session cookie
│
├─ Step 2: Middleware
│  ├─ Route: GET /api/cards/{id}
│  ├─ Classify as protected [Task 1A]
│  └─ Verify JWT and set userId
│
├─ Step 3: Route Handler (NEW in Task 1D) ✓
│  ├─ GET /api/cards/[id]/route.ts added
│  ├─ Fetch card + benefits from database
│  ├─ Verify user ownership
│  └─ Return 200 with card data (values in cents)
│
└─ Step 4: Card detail page renders with real data
   └─ No more mock data bugs!

──────────────────────────────────────────────────────────────

User: DELETE /api/cards/{id} from card list
│
├─ Step 1: Browser fetch()
│  ├─ Includes credentials: 'include' ✓ [Task 1C]
│  └─ Sends session cookie
│
├─ Step 2: Middleware
│  ├─ Route: DELETE /api/cards/{id}
│  ├─ Classify as protected [Task 1A]
│  └─ Verify JWT and set userId
│
├─ Step 3: Route Handler
│  ├─ Soft delete card (status: DELETED)
│  ├─ Archive all benefits (status: ARCHIVED)
│  └─ Return 204 No Content (empty body) [Task 1E] ✓
│
└─ Step 4: Browser handles 204
   └─ Card removed from list

──────────────────────────────────────────────────────────────

Special Case: GET /api/user/profile
│
├─ Old path: /api/auth/user (public → 401 error) ✗
├─ New path: /api/user/profile (protected) ✓ [Task 1B]
│
├─ Step 1: Middleware
│  ├─ Route: GET /api/user/profile
│  ├─ Classify as protected [Task 1A]
│  └─ Extract JWT and verify
│
├─ Step 2: Route Handler
│  ├─ getAuthContext() returns userId ✓
│  ├─ Fetch user profile from database
│  └─ Return 200 with user data
│
└─ Step 3: App header displays user email/name
```

---

## Deployment & Rollout

### Pre-Deployment Checklist

- [ ] All middleware changes in `src/middleware.ts` committed
- [ ] All route files updated (`/api/cards/[id]`, `/api/benefits/[id]`, `/api/user/profile`)
- [ ] All modal components updated with `credentials: 'include'`
- [ ] No database migrations needed
- [ ] No schema changes needed
- [ ] Tests pass locally
- [ ] Code review completed

### Deployment Steps

1. **Deploy middleware.ts changes:**
   - Add `PROTECTED_API_PREFIXES` constant
   - Update `isProtectedRoute()` function
   - No downtime (can be deployed during business hours)

2. **Deploy route handler changes:**
   - Update DELETE handlers in both `/api/cards/[id]` and `/api/benefits/[id]`
   - Add GET `/api/cards/[id]` handler
   - Move or update `/api/auth/user` to `/api/user/profile`
   - All changes backward compatible

3. **Deploy frontend changes:**
   - Add `credentials: 'include'` to all modal fetch calls
   - Test in QA environment first
   - Then deploy to production

### Backward Compatibility

✅ **Fully backward compatible:**
- Existing public routes unaffected
- Existing login/signup flows unchanged
- Database schema unchanged (no migrations)
- No API breaking changes
- Old fetch calls without `credentials: 'include'` still work on same-origin (just less secure)

### Rollback Plan

**If critical issue discovered:**

1. **Revert middleware:**
   ```bash
   git revert <commit-hash-middleware>
   # All protected API routes will fail again (return 401)
   # But at least UI won't crash
   ```

2. **Revert DELETE responses:**
   ```bash
   git revert <commit-hash-delete-handlers>
   # DELETE will return `{ success: true }` with 204 again (HTTP violation, but works)
   ```

3. **Revert fetch credentials:**
   ```bash
   git revert <commit-hash-fetch-calls>
   # Fetch calls will fail to send cookie, but old behavior restored
   ```

**Rollback time:** < 2 minutes (single commit revert + redeploy)

---

## Testing Strategy

### Unit Tests (Per Task)

**Task 1A - Middleware Classification:**
- Test each protected API prefix in isolation
- Test mixed routes (protected + unprotected in same request)
- Test wildcard patterns

**Task 1B - Route Classification:**
- Test `/api/user/profile` with valid token → 200
- Test `/api/user/profile` without token → 401
- Test old `/api/auth/user` path (if still exists) → redirects or deprecated

**Task 1C - Fetch Credentials:**
- Test fetch with `credentials: 'include'` → cookie sent → auth succeeds
- Test fetch without credentials → cookie NOT sent → 401

**Task 1D - GET /api/cards/[id]:**
- Test valid card ownership → 200 with card
- Test card not found → 404
- Test unowned card → 403
- Test response values in cents

**Task 1E - DELETE 204 Fix:**
- Test DELETE returns 204 with NO body (not 204 with JSON)
- Test card marked DELETED in DB
- Test benefits marked ARCHIVED in DB

### Integration Tests

- Full flow: Login → Add card → Add benefit → Edit card → Delete benefit → Logout
- Test all 4 modals (Add/Edit Benefit, Add/Edit Card) in sequence
- Test card detail page loads real data (no more mocks)
- Test concurrent requests (multiple modals open simultaneously)

### Regression Tests

- All existing auth flows unchanged
- Public routes still public
- Login/signup unaffected
- Card list page still works
- Benefits list still works

---

## FAQ & Troubleshooting

**Q: Why add `credentials: 'include'` if fetch is same-origin?**
A: Even on same-origin, without `credentials: 'include'`, browser doesn't send cookies. It's explicit opt-in. Needed for middleware to read session cookie.

**Q: Why move `/api/auth/user` to `/api/user/profile`?**
A: Cleaner separation of concerns. `/api/auth` is for login/signup (public). `/api/user` is for profile operations (protected). Reduces code duplication and classification ambiguity.

**Q: Can we keep `/api/auth/user` instead of moving?**
A: Yes, with Option B: Route extracts JWT itself (duplicates middleware logic). Not recommended, but works.

**Q: Why 204 instead of 200 for DELETE?**
A: RFC 7231 says 204 (No Content) is most appropriate for successful DELETE with no response body. 200 would require body (more verbose). 204 is cleaner.

**Q: Are old clients with missing `credentials: 'include'` broken?**
A: Yes. They'll fail on protected routes (401). Migration is required. But same-origin fetch typically works fine without it on many browsers (implementation dependent). To be safe, all must include it.

**Q: What if user session expires during a fetch?**
A: Middleware returns 401. UI should redirect to login. Frontend error handler should catch 401 and redirect.

**Q: Can we update multiple cards/benefits in parallel?**
A: Yes. Each request is independent. Database handles concurrent writes (standard transaction isolation).

---

## Security Considerations

**AuthN:** All protected API routes require valid JWT + database session validation. No changes to auth logic, only classification.

**AuthZ:** All routes verify user ownership before returning data or allowing mutations. Unchanged.

**HTTP Security:** Switching from 204 with body to 204 without body improves security (no accidental data leaks in no-content responses).

**CSRF:** SameSite=Strict cookie policy unchanged. `credentials: 'include'` doesn't bypass CSRF protection (same origin).

**XSS:** HttpOnly cookie unchanged. JavaScript can't access token. Session cookie required for all API calls.

---

## File Manifest

| File | Change | Type |
|------|--------|------|
| `src/middleware.ts` | Add PROTECTED_API_PREFIXES, update isProtectedRoute() | Modify |
| `src/app/api/user/profile/route.ts` | Move from `/api/auth/user/route.ts` or ensure protected classification | Move/Modify |
| `src/app/api/cards/[id]/route.ts` | Add GET handler, fix DELETE response | Add/Modify |
| `src/app/api/benefits/[id]/route.ts` | Fix DELETE response | Modify |
| `src/components/AddBenefitModal.tsx` | Add credentials: 'include' to fetch | Modify |
| `src/components/EditBenefitModal.tsx` | Add credentials: 'include' to fetch | Modify |
| `src/components/AddCardModal.tsx` | Add credentials: 'include' to fetch | Modify |
| `src/components/EditCardModal.tsx` | Add credentials: 'include' to fetch | Modify |

---

## Success Criteria

✅ All post-Wave 1 success criteria:

1. **Middleware Classification:**
   - `isProtectedRoute()` returns `true` for `/api/benefits/*`, `/api/cards/*`, `/api/user/*`
   - Protected routes extract JWT and set userId in context
   - All other middleware behavior unchanged

2. **API Authentication:**
   - POST `/api/benefits/add` returns 200 OK (not 401)
   - PATCH `/api/cards/[id]` returns 200 OK (not 401)
   - DELETE routes work without 401
   - GET `/api/cards/[id]` returns real card data with benefits

3. **HTTP Compliance:**
   - DELETE routes return 204 with NO response body
   - All other routes follow spec

4. **Frontend Integration:**
   - All modal fetch calls include `credentials: 'include'`
   - Card detail page renders with live data (not mocks)
   - Add/Edit/Delete operations work end-to-end

5. **Backward Compatibility:**
   - No breaking changes to existing APIs
   - No database migrations
   - No schema changes
   - Existing auth flows unaffected

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2024 | Initial Wave 1 specification (5 critical fixes) | Architecture Team |

---

## Document Metadata

**Classification:** Technical Specification  
**Audience:** Engineering Team (Backend, Frontend, DevOps)  
**Maintainer:** Architecture Team  
**Review Cycle:** Post-deployment verification  
**Related Documents:**
- AUDIT-MODALS-DIALOGS.md
- AUDIT-API-DATA-INTEGRATION.md
- AUDIT-THEME-STYLING.md
- Middleware Architecture Documentation
- API Design Guidelines
