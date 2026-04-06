# Production Bugs Fix Specification
## Admin Dashboard Deployment Issues

**Document Version**: 1.0  
**Created**: 2024-12-19  
**Status**: Ready for Implementation  
**Priority**: P0 (Critical - Production Blocker)

---

## Executive Summary

Three critical bugs were introduced in the recent admin dashboard deployment. The root causes stem from incomplete auth refactoring during the security hardening phase (commits efbede3, 94f19b4, 859c3da) and missing API endpoints for the admin UI.

| Bug # | Issue | Impact | Severity | Affected Users |
|-------|-------|--------|----------|----------------|
| **1** | Admin Benefits Page 404 | Cannot manage benefits | **Critical** | Admin users (100% blocked) |
| **2** | Back Button Goes to Wrong Page | Poor UX, context loss | **High** | Admin users (all benefit/card detail pages) |
| **3** | Add Card Returns 401 | Cannot add cards to dashboard | **Critical** | Regular users (100% blocked) |

**Combined Impact**: All core workflows are broken across both admin and user surfaces. This requires immediate hotfix deployment.

---

## Functional Requirements Analysis

### Current Broken Workflows

1. **Admin Benefits Management** (Bug #1)
   - **Workflow**: Admin Dashboard → Manage Benefits → View/Edit/Delete Benefits
   - **Break Point**: Benefits page loads but fails to fetch benefits list
   - **Root Cause**: Missing `/api/admin/benefits` (list endpoint) - only PATCH/DELETE on individual benefits exist

2. **Admin Navigation** (Bug #2)
   - **Workflow**: Admin Dashboard → Navigate to sub-pages → Use back button → Return to admin
   - **Break Point**: Back button always navigates to `/dashboard` (user area) instead of `/admin`
   - **Root Cause**: Hard-coded navigation link in admin layout, no context-aware routing

3. **User Card Addition** (Bug #3)
   - **Workflow**: My Dashboard → Add New Card → Select Card → Confirm
   - **Break Point**: POST request fails with 401 Unauthorized
   - **Root Cause**: API route uses `getAuthContext()` which depends on AsyncLocalStorage, but AsyncLocalStorage context is not available in API route handler execution context

---

## Root Cause Analysis

### Bug #1: Missing Admin Benefits List Endpoint

**Affected Files**:
- **Client**: `src/app/admin/benefits/page.tsx` (line 124)
- **Client**: `src/app/admin/page.tsx` (line 59)
- **API Missing**: `src/app/api/admin/benefits/route.ts` (GET and POST handlers)
- **API Exists**: `src/app/api/admin/benefits/[id]/route.ts` (PATCH and DELETE only - lines 79-404)

**Current API Endpoints**:
```
✓ GET  /api/admin/cards                    - List master cards
✓ POST /api/admin/cards                    - Create master card
✓ GET  /api/admin/cards/[id]              - Get master card details
✓ GET  /api/admin/cards/[id]/benefits     - Get benefits for a card
✓ POST /api/admin/cards/[id]/benefits     - Add benefit to card
✗ GET  /api/admin/benefits                - MISSING - List all benefits
✗ POST /api/admin/benefits                - MISSING - Create benefit
✓ PATCH /api/admin/benefits/[id]          - Update benefit
✓ DELETE /api/admin/benefits/[id]         - Delete benefit
```

**Why It Broke**:
- Admin UI calls `apiClient.get('/benefits', ...)` expecting a list endpoint
- This translates to `/api/admin/benefits`
- The endpoint was never created during the admin API build-out
- Only card-specific benefit endpoints exist (`/api/admin/cards/[id]/benefits/*`)

**How to Reproduce**:
1. Log in as admin user
2. Click "Manage Benefits" button
3. Page loads but immediately shows 404 error or "Failed to load benefits"
4. Check browser console: `[BenefitsPage] Failed to fetch benefits {error: 'HTTP 404: ', endpoint: '/api/admin/benefits', ...}`

---

### Bug #2: Back Button Hard-Coded to User Dashboard

**Affected Files**:
- **Navigation**: `src/app/admin/layout.tsx` (lines 94-100)
- **Sub-pages**: `/src/app/admin/cards/[id]/page.tsx` (no back button)
- **Sub-pages**: `/src/app/admin/benefits/[id]/page.tsx` (no back button)

**Current Code**:
```typescript
// admin/layout.tsx lines 94-100
<Link
  href="/dashboard"  // ❌ ALWAYS goes to /dashboard (USER area)
  className="flex items-center justify-center gap-2 w-full px-4 py-2..."
>
  <span>←</span>
  <span>Back to Dashboard</span>
</Link>
```

**Why It's Wrong**:
- Admin is at `/admin` (separate from user `/dashboard`)
- Admin navigation is hierarchical: `/admin` → `/admin/cards` → `/admin/cards/[id]`
- The "Back to Dashboard" button should navigate back to `/admin` or parent admin page
- Current behavior ejects users from admin section to user dashboard

**Navigation Context Problem**:
```
Expected Flow:
  /admin 
    → /admin/cards 
      → /admin/cards/123 
        → [BACK] → /admin/cards

Actual Flow:
  /admin 
    → /admin/cards 
      → /admin/cards/123 
        → [BACK] → /dashboard (USER AREA - WRONG!)
```

**How to Reproduce**:
1. Log in as admin
2. Navigate: Admin Dashboard → Manage Cards → Click a card detail
3. Click "← Back to Dashboard" button
4. **Expected**: Return to `/admin/cards`
5. **Actual**: Redirected to `/dashboard` (user dashboard)

---

### Bug #3: Add Card Returns 401 Unauthorized

**Affected Files**:
- **API Route**: `src/app/api/cards/add/route.ts` (lines 100-112)
- **Auth Module**: `src/features/auth/context/auth-context.ts` (lines 99-101)
- **Working Reference**: `src/app/api/admin/cards/route.ts` (lines 49, 79-85)

**Current Broken Code**:
```typescript
// src/app/api/cards/add/route.ts lines 97-112
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ❌ BUG: getAuthContext() returns empty object for API routes
    const authContext = getAuthContext();
    const userId = authContext?.userId;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        } as ErrorResponse,
        { status: 401 }
      );
    }
```

**Root Cause - Architectural Mismatch**:

The authentication context is stored in `AsyncLocalStorage` which is designed for:
- **Server Actions**: `runWithAuthContext()` wraps the entire server action execution
- **React Components**: Components run within the async context of the server action/page render

But API routes have a **different execution context**:
```
Request Flow for Server Actions:
middleware sets userId
  → runWithAuthContext({ userId }, async () => {
      → page/component renders (has userId via AsyncLocalStorage)
      → server action executes (still has userId via AsyncLocalStorage)
    })

Request Flow for API Routes:
middleware sets userId
  → API route handler executes (AsyncLocalStorage is DIFFERENT context)
  → route.ts getAuthContext() returns EMPTY OBJECT
```

**Why This Happened**:
The security fixes (commits efbede3, 859c3da) updated admin routes to extract JWT directly from request cookies:
```typescript
// ✓ CORRECT - Admin route (src/app/api/admin/cards/route.ts line 79)
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await verifyAdminRole(request);  // ✓ Passes request to extract JWT
```

But user routes still use the broken AsyncLocalStorage approach:
```typescript
// ❌ BROKEN - User route (src/app/api/cards/add/route.ts line 100)
const authContext = getAuthContext();  // ❌ Empty in API routes
```

**How to Reproduce**:
1. Log in as regular user
2. Go to "My Dashboard"
3. Click "Add New Card" button
4. Modal opens, select a card
5. Click "Add Card" to submit
6. **Expected**: Card is added, modal closes, page updates
7. **Actual**: Error in browser console: `POST https://...railway.app/api/cards/add 401 Unauthorized`

---

## Solution Design

### Fix #1: Create Missing Admin Benefits List Endpoint

**What Needs to be Fixed**:
- Create `/api/admin/benefits/route.ts` with GET and POST handlers
- Implement benefits listing with pagination (to match admin API patterns)
- Implement benefits creation endpoint

**Files to Create**:
1. **`src/app/api/admin/benefits/route.ts`** (NEW)

**Implementation Details**:

#### GET Handler Specification
```
Method: GET /api/admin/benefits
Auth: Admin role required (use verifyAdminRole(request))
Query Parameters:
  - page: number (default: 1, min: 1)
  - limit: number (default: 20, min: 1, max: 100)
  - search?: string (search by name, max 255 chars)
  - cardId?: string (filter by card, return only benefits on this card)
  - isActive?: boolean (filter by active status)
  - sortBy?: 'name' | 'createdAt' | 'resetCadence' (default: 'name')
  - sortDirection?: 'asc' | 'desc' (default: 'asc')

Response 200 (Success):
{
  "success": true,
  "data": [
    {
      "id": "benefit_123",
      "masterCardId": "card_456",
      "name": "Cash Back on Dining",
      "type": "CASH_BACK",
      "stickerValue": 500,
      "resetCadence": "ANNUAL",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 145,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasMore": true
  }
}

Response 400 (Validation Error):
{
  "success": false,
  "error": "Invalid query parameters",
  "code": "VALIDATION_ERROR",
  "details": [
    { "field": "limit", "message": "must be <= 100" }
  ]
}

Response 401 (Not Authenticated):
{
  "success": false,
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}

Response 403 (Not Admin):
{
  "success": false,
  "error": "Admin access required",
  "code": "FORBIDDEN"
}

Response 500 (Server Error):
{
  "success": false,
  "error": "Failed to fetch benefits",
  "code": "DATABASE_ERROR",
  "details": "Error: ..." 
}
```

#### POST Handler Specification
```
Method: POST /api/admin/benefits
Auth: Admin role required (use verifyAdminRole(request))
Content-Type: application/json

Request Body:
{
  "masterCardId": string (required, must be valid MasterCard ID),
  "name": string (required, max 200 chars),
  "type": enum (required, one of: CASH_BACK, POINTS, MILES, STATEMENT_CREDIT, LOUNGE_ACCESS, TRAVEL_INSURANCE, other...),
  "stickerValue": number (required, >= 0, in cents),
  "resetCadence": enum (required, one of: ANNUAL, MONTHLY, ONCE, PERPETUAL),
  "description": string (optional, max 1000 chars),
  "isDefault": boolean (optional, default: false)
}

Response 201 (Created):
{
  "success": true,
  "data": {
    "id": "benefit_789",
    "masterCardId": "card_456",
    "name": "Lounge Access",
    "type": "LOUNGE_ACCESS",
    "stickerValue": 0,
    "resetCadence": "ANNUAL",
    "isDefault": false,
    "isActive": true,
    "createdAt": "2024-12-19T14:20:00Z",
    "updatedAt": "2024-12-19T14:20:00Z"
  },
  "message": "Benefit created successfully"
}

Response 400 (Validation Error):
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "fieldErrors": {
    "name": "required field",
    "stickerValue": "must be >= 0"
  }
}

Response 404 (Card Not Found):
{
  "success": false,
  "error": "Master card not found",
  "code": "NOT_FOUND"
}

Response 409 (Duplicate):
{
  "success": false,
  "error": "Benefit already exists for this card",
  "code": "CONFLICT"
}
```

**Reference Implementation**:
- Model after: `src/app/api/admin/cards/route.ts` (lines 1-200)
- Use validation schemas: `src/features/admin/validation/schemas.ts`
- Use audit logging: `src/features/admin/lib/audit.ts` (logResourceCreation)
- Use auth: `src/features/admin/middleware/auth.ts` (verifyAdminRole)

---

### Fix #2: Implement Context-Aware Navigation

**What Needs to be Fixed**:
- Replace hard-coded `/dashboard` link with context-aware navigation
- Add back buttons to detail pages
- Implement breadcrumb navigation

**Files to Update**:
1. **`src/app/admin/layout.tsx`** (lines 94-100)
2. **`src/app/admin/cards/[id]/page.tsx`** (add back button)
3. **`src/app/admin/benefits/[id]/page.tsx`** (if exists, add back button)

**Implementation Options** (choose one):

#### Option A: Use Browser History (Recommended - Simplest)
```typescript
// admin/layout.tsx
'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Determine "back" destination based on current location
  const getBackUrl = () => {
    if (pathname === '/admin') return null; // Don't show back on main admin page
    if (pathname.startsWith('/admin/cards/')) return '/admin/cards';
    if (pathname.startsWith('/admin/benefits/')) return '/admin/benefits';
    if (pathname.startsWith('/admin/users/')) return '/admin/users';
    if (pathname.startsWith('/admin/audit-logs/')) return '/admin/audit-logs';
    return '/admin'; // Default to admin home
  };

  const backUrl = getBackUrl();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="...">
        {/* Back Button - Only show if not on main admin page */}
        {backUrl && (
          <Link
            href={backUrl}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <span>←</span>
            <span>Back</span>
          </Link>
        )}
      </aside>
      
      {/* Rest of layout */}
      {children}
    </div>
  );
}
```

#### Option B: Breadcrumb Navigation (More Robust)
```typescript
// Add breadcrumb component: src/components/admin/breadcrumb.tsx
export function AdminBreadcrumb() {
  const pathname = usePathname();
  
  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    ...generateBreadcrumbsFromPath(pathname)
  ];

  return (
    <nav className="flex gap-2 text-sm">
      {breadcrumbs.map((crumb, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span>/</span>}
          {idx === breadcrumbs.length - 1 ? (
            <span className="font-semibold">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="text-blue-600 hover:underline">
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
```

**Recommended Approach**: Use Option A (browser history based). It's simpler, requires no new components, and matches the existing pattern.

---

### Fix #3: Replace AsyncLocalStorage with Direct Session Verification

**What Needs to be Fixed**:
- Replace `getAuthContext()` with direct session/JWT verification from request
- Match the pattern used in admin routes (commit 859c3da)
- Apply fix to all user API routes that do authentication

**Files to Update**:
1. **`src/app/api/cards/add/route.ts`** (lines 100-112)
2. **Check & Update**: Any other user API routes that use `getAuthContext()`

**Implementation Pattern**:

Look at how admin routes do it correctly (src/app/api/admin/cards/route.ts):
```typescript
// ✓ CORRECT PATTERN (from admin routes)
import { verifyAdminRole } from '@/features/admin/middleware/auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Pass request to extract JWT/session from cookies
    await verifyAdminRole(request);
    // Now we're authenticated...
```

The `verifyAdminRole()` function extracts JWT from request cookies and verifies it. We need equivalent for user routes.

**Create Helper Function**:
```typescript
// src/features/auth/utils/verify-session.ts (NEW)
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/shared/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

/**
 * Verify session token from request and return authenticated user ID
 * 
 * @param request - NextRequest to extract session/JWT from
 * @returns userId if authenticated, throws error if not
 * 
 * Usage in API route:
 * ```
 * export async function POST(request: NextRequest) {
 *   const userId = await verifySessionToken(request);
 *   // userId is guaranteed to be non-null here
 * ```
 */
export async function verifySessionToken(request: NextRequest): Promise<string> {
  try {
    // Try to get JWT from cookies
    const token = request.cookies.get('sessionToken')?.value 
      || request.cookies.get('jwt')?.value;
    
    if (!token) {
      throw new Error('No session token found');
    }

    // Verify JWT signature
    const verified = await jwtVerify(token, JWT_SECRET);
    const userId = verified.payload.userId as string;

    if (!userId) {
      throw new Error('Invalid token payload');
    }

    // Optional: Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true }
    });

    if (!user || user.status === 'INACTIVE') {
      throw new Error('User not found or inactive');
    }

    return userId;
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}
```

**Update API Route**:
```typescript
// src/app/api/cards/add/route.ts - UPDATED
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/features/auth/utils/verify-session';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ✓ NEW: Extract and verify session from request
    let userId: string;
    try {
      userId = await verifySessionToken(request);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        } as ErrorResponse,
        { status: 401 }
      );
    }

    // Parse and validate request
    const body = await request.json().catch(() => ({})) as AddCardRequest;
    const validation = validateAddCardRequest(body);
    
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          fieldErrors: validation.errors,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // Rest of handler logic...
```

**Apply to Other Routes**:
Search for all uses of `getAuthContext()` in API routes:
```bash
grep -r "getAuthContext\|getAuthUserId" src/app/api --include="*.ts" | grep -v admin | grep -v auth
```

Update each one to use `verifySessionToken(request)` instead.

---

## Implementation Phases

### Phase 1: Fix Bug #3 (Critical - Blocks All Users)
**Estimated Time**: 2-3 hours  
**Priority**: First (highest impact, affects all regular users)

**Tasks**:
1. Create `src/features/auth/utils/verify-session.ts` with `verifySessionToken()` function
2. Update `src/app/api/cards/add/route.ts` to use `verifySessionToken(request)`
3. Find and update all other user API routes using `getAuthContext()`
4. Test: Add Card workflow end-to-end
5. Test: Verify admin routes still work
6. Test: Verify error handling (invalid token, expired token, missing cookie)

**Success Criteria**:
- ✓ POST /api/cards/add returns 201 with new card
- ✓ POST /api/cards/add returns 401 when not authenticated
- ✓ Regular users can add cards to dashboard
- ✓ No regression in admin API routes

---

### Phase 2: Fix Bug #1 (Critical - Admin Blocked)
**Estimated Time**: 3-4 hours  
**Priority**: Second (blocks admin users, but fewer affected than Phase 1)

**Tasks**:
1. Create `src/app/api/admin/benefits/route.ts` with:
   - GET handler with pagination, filtering, search
   - POST handler with validation and audit logging
2. Reference existing admin patterns from `/api/admin/cards/route.ts`
3. Add validation schemas (if not already present)
4. Test: Browse benefits list with pagination
5. Test: Create new benefit
6. Test: Filtering and search
7. Test: Permission checks (non-admin gets 403)

**Success Criteria**:
- ✓ GET /api/admin/benefits returns paginated list of benefits
- ✓ POST /api/admin/benefits creates new benefit
- ✓ Pagination works (page, limit parameters)
- ✓ Filtering works (search, isActive, cardId)
- ✓ Audit logging records creation
- ✓ Non-admin users get 403 Forbidden

---

### Phase 3: Fix Bug #2 (High Priority - UX Issue)
**Estimated Time**: 1-2 hours  
**Priority**: Third (poor UX but doesn't fully block workflows)

**Tasks**:
1. Update `src/app/admin/layout.tsx` (lines 94-100) to use context-aware back navigation
2. Add back buttons to detail pages (cards/[id], benefits/[id] if exists)
3. Test: Navigation from each admin page
4. Test: Verify users stay in admin context
5. Test: Verify mobile responsiveness

**Success Criteria**:
- ✓ Back button navigates to parent page (not /dashboard)
- ✓ Detail pages have back buttons
- ✓ Users stay in admin context
- ✓ Back button hidden on main admin page

---

## Testing Strategy

### Bug #1 Testing (Benefits List Endpoint)

**Reproduction Steps**:
1. Log in as admin user
2. Navigate to Admin Dashboard
3. Click "Manage Benefits"
4. Verify benefits list loads

**Verification Checklist**:
- [ ] GET /api/admin/benefits returns 200 with list
- [ ] Pagination works (page=2, limit=10)
- [ ] Search filters benefits by name
- [ ] isActive filter works
- [ ] cardId filter works
- [ ] Sorting by name/createdAt/resetCadence works
- [ ] Response includes pagination metadata (total, page, totalPages, hasMore)
- [ ] Non-admin user gets 403 Forbidden
- [ ] Unauthenticated request gets 401 Unauthorized
- [ ] Invalid query params return 400 with details
- [ ] Create benefit endpoint works (POST)
- [ ] Audit logs record benefit creation

**Edge Cases**:
- [ ] Empty result set (no benefits match filter)
- [ ] Pagination edge cases (page=1 of 1, page=999 of 10)
- [ ] Large search strings (>255 chars)
- [ ] Invalid enum values (sortBy=invalid)
- [ ] Negative limit/page numbers
- [ ] Non-existent cardId filter
- [ ] Concurrent requests don't cause duplicates

---

### Bug #2 Testing (Navigation)

**Reproduction Steps**:
1. Log in as admin
2. Go to Admin Dashboard (/admin)
3. Click "Manage Cards"
4. Click on a card to view details
5. Click "Back" button
6. Verify destination is `/admin/cards` (not `/dashboard`)

**Verification Checklist**:
- [ ] From /admin/cards → Back → /admin (if we add breadcrumb)
- [ ] From /admin/cards/123 → Back → /admin/cards
- [ ] From /admin/benefits → Back → /admin
- [ ] From /admin/benefits/456 → Back → /admin/benefits
- [ ] From /admin/users → Back → /admin
- [ ] Back button not shown on /admin main page
- [ ] Mobile view responsive
- [ ] Keyboard navigation works (Tab to back button, Enter activates)

**Edge Cases**:
- [ ] Direct navigation to detail page (back button still appears)
- [ ] Multiple back clicks (doesn't cause loops)
- [ ] Admin with limited permissions (back button still works)

---

### Bug #3 Testing (Add Card Auth)

**Reproduction Steps**:
1. Log in as regular user
2. Go to My Dashboard
3. Click "Add New Card"
4. Select a card from the list
5. Click "Add Card"
6. Verify POST /api/cards/add succeeds

**Verification Checklist**:
- [ ] POST /api/cards/add returns 201 with card data
- [ ] Card appears in user's dashboard
- [ ] Duplicate card returns 409 Conflict
- [ ] Non-existent card returns 404 Not Found
- [ ] Missing required fields returns 400 Validation Error
- [ ] Unauthenticated request returns 401 Unauthorized
- [ ] Expired JWT returns 401 Unauthorized
- [ ] Malformed JWT returns 401 Unauthorized
- [ ] Missing session cookie returns 401 Unauthorized
- [ ] Benefits are auto-created for card
- [ ] Correct number of benefits created

**Edge Cases**:
- [ ] Very large custom name (>100 chars)
- [ ] Negative annual fee override
- [ ] Invalid renewal date format
- [ ] Card with no benefits (should still create)
- [ ] User adds same card twice (returns 409)
- [ ] Card archived/inactive (handle appropriately)
- [ ] User's card limit exceeded (if enforced)
- [ ] Concurrent add requests from same user (no duplicate)
- [ ] Session expires mid-request (graceful error)

---

### Integration Testing

**Cross-Feature Verification**:
- [ ] Admin can add benefits, users can see them on cards
- [ ] Admin can manage cards and benefits, users can add them
- [ ] Navigation works in both admin and user areas
- [ ] Role-based access control enforced (admin vs user)
- [ ] Audit logs recorded for all admin operations
- [ ] No auth context leakage between requests

**Regression Testing**:
- [ ] Existing admin card endpoints still work
- [ ] Existing user card endpoints still work
- [ ] Session/JWT verification still works
- [ ] Role-based access control still works
- [ ] No breaking changes to other endpoints

---

## Detailed Implementation Tasks

### Task 1.1: Create verify-session utility
**Phase**: Phase 1  
**Complexity**: Small  
**Depends On**: None  
**Acceptance Criteria**:
- ✓ Function extracts JWT from request cookies
- ✓ Function verifies JWT signature
- ✓ Function validates user exists and is active
- ✓ Function throws descriptive errors
- ✓ Unit tests verify happy path and error cases
- ✓ Works with both 'sessionToken' and 'jwt' cookie names

**Files**:
- Create: `src/features/auth/utils/verify-session.ts`
- Create: `src/features/auth/utils/verify-session.test.ts`

---

### Task 1.2: Update /api/cards/add endpoint
**Phase**: Phase 1  
**Complexity**: Small  
**Depends On**: Task 1.1  
**Acceptance Criteria**:
- ✓ Calls `verifySessionToken(request)` instead of `getAuthContext()`
- ✓ Handles auth errors gracefully (401 response)
- ✓ All existing validation still works
- ✓ Returns correct response format
- ✓ Unit tests pass
- ✓ Integration test: can add card as authenticated user

**Files**:
- Update: `src/app/api/cards/add/route.ts` (lines 97-112)

---

### Task 1.3: Find and update all other user API routes
**Phase**: Phase 1  
**Complexity**: Medium  
**Depends On**: Task 1.1  
**Acceptance Criteria**:
- ✓ All user API routes updated to use `verifySessionToken()`
- ✓ No more uses of `getAuthContext()` in user routes
- ✓ All user API routes still work
- ✓ No regression in functionality

**Files**:
- Search for: `grep -r "getAuthContext\|getAuthUserId" src/app/api --include="*.ts" | grep -v admin | grep -v auth`
- Update as needed

---

### Task 1.4: Test Phase 1 fixes
**Phase**: Phase 1  
**Complexity**: Medium  
**Depends On**: Tasks 1.1, 1.2, 1.3  
**Acceptance Criteria**:
- ✓ Add card workflow works end-to-end
- ✓ 401 errors for unauthenticated requests
- ✓ No regression in admin APIs
- ✓ Audit logs record add card operations
- ✓ Error handling tested (invalid JWT, expired token, etc.)

---

### Task 2.1: Create /api/admin/benefits endpoint
**Phase**: Phase 2  
**Complexity**: Medium  
**Depends On**: None (independent from Phase 1)  
**Acceptance Criteria**:
- ✓ GET /api/admin/benefits implemented with:
  - Pagination (page, limit)
  - Filtering (search, cardId, isActive, type)
  - Sorting (name, createdAt, resetCadence)
  - Proper response format matching spec
- ✓ POST /api/admin/benefits implemented with:
  - Request validation (masterCardId, name, type, stickerValue, resetCadence)
  - Duplicate check
  - Audit logging
  - 201 response with created benefit
- ✓ Both endpoints require admin role
- ✓ Proper error responses (400, 401, 403, 404, 409, 500)
- ✓ Query parameter validation
- ✓ Unit tests for both handlers

**Files**:
- Create: `src/app/api/admin/benefits/route.ts`
- Reference: `src/app/api/admin/cards/route.ts` for patterns
- Reference: `src/features/admin/validation/schemas.ts` for validation patterns
- Reference: `src/features/admin/lib/audit.ts` for audit logging

---

### Task 2.2: Create validation schemas for benefits
**Phase**: Phase 2  
**Complexity**: Small  
**Depends On**: Task 2.1  
**Acceptance Criteria**:
- ✓ Schema validates benefit fields
- ✓ Schema validates query parameters
- ✓ Schema provides helpful error messages
- ✓ Schema enforces min/max values
- ✓ Schema validates enum values

**Files**:
- Update: `src/features/admin/validation/schemas.ts` (if needed)

---

### Task 2.3: Test Phase 2 fixes
**Phase**: Phase 2  
**Complexity**: Medium  
**Depends On**: Tasks 2.1, 2.2  
**Acceptance Criteria**:
- ✓ Benefits list page loads without 404 error
- ✓ Pagination works correctly
- ✓ Filtering and search work
- ✓ Admin can create new benefits
- ✓ Non-admin gets 403 Forbidden
- ✓ Audit logs record operations
- ✓ Error handling correct

---

### Task 3.1: Update admin layout navigation
**Phase**: Phase 3  
**Complexity**: Small  
**Depends On**: None  
**Acceptance Criteria**:
- ✓ Back button uses context-aware navigation
- ✓ Back button hidden on /admin main page
- ✓ Back button links to correct parent page
- ✓ Works for all admin sub-pages
- ✓ Mobile responsive
- ✓ Keyboard accessible

**Files**:
- Update: `src/app/admin/layout.tsx` (lines 94-100)

---

### Task 3.2: Add back buttons to detail pages
**Phase**: Phase 3  
**Complexity**: Small  
**Depends On**: None  
**Acceptance Criteria**:
- ✓ Detail pages have back buttons
- ✓ Back buttons navigate to parent list page
- ✓ Consistent styling with main back button
- ✓ Mobile responsive

**Files**:
- Update: `src/app/admin/cards/[id]/page.tsx` (add back button)
- Update: `src/app/admin/benefits/[id]/page.tsx` if exists (add back button)

---

### Task 3.3: Test Phase 3 fixes
**Phase**: Phase 3  
**Complexity**: Small  
**Depends On**: Tasks 3.1, 3.2  
**Acceptance Criteria**:
- ✓ Navigation flows work correctly
- ✓ Back button takes to correct page
- ✓ Users stay in admin context
- ✓ No loops or unexpected navigation
- ✓ Mobile navigation works

---

## Security & Compliance Considerations

### Authentication Architecture
- **Pattern**: Direct JWT/session verification from request cookies
- **Rationale**: AsyncLocalStorage context not available in API route handlers
- **Implementation**: Extract JWT from request, verify signature, validate user exists
- **Consistency**: Match admin route pattern from commit 859c3da

### Authorization
- **Admin Routes**: All admin endpoints require `verifyAdminRole(request)`
- **User Routes**: All user endpoints require `verifySessionToken(request)`
- **Validation**: Both functions throw on invalid auth, causing 401/403 responses

### Audit Logging
- **Admin Operations**: All admin CRUD operations logged via `logResourceCreation()`, `logResourceUpdate()`, `logResourceDeletion()`
- **User Operations**: User card additions logged (if implemented - check existing code)
- **Data**: Logs include resource ID, user ID, IP, timestamp, operation type

### CORS & Rate Limiting
- **Review**: Ensure admin routes have rate limiting (mentioned in comments: 50-100 req/min)
- **Check**: Ensure user routes have rate limiting

### Sensitive Data
- **JWT Secrets**: Never log full tokens
- **User Data**: Returned data validated for minimum necessary fields
- **Session Cookies**: HttpOnly, Secure, SameSite flags should be set

---

## Performance & Scalability Considerations

### Database Query Optimization
- **Benefits List Endpoint**: Add indexes for:
  - `masterCardId` (for card-specific filters)
  - `isActive` (for status filtering)
  - `createdAt` (for sorting)
  - Composite index on `(masterCardId, isActive)` for common filters

- **Query Pattern**: Use pagination to limit result set
  - Default limit: 20, max: 100
  - Prevents N+1 queries when including related data

### Caching Strategy
- **Admin Endpoints**: No client-side caching (data changes frequently)
- **List Endpoints**: Consider ETag headers for client validation
- **Master Data**: Benefits data relatively static, could cache with 5-minute TTL

### Pagination Implementation
- **Offset-based**: Current pattern (works for admin)
- **Cursor-based**: Consider if list grows >10k items
- **Consistency**: Apply same pagination pattern to benefits endpoint as used in cards endpoint

---

## Risk Assessment

### Implementation Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Auth regression in other endpoints | Medium | Critical | Comprehensive testing of all user/admin routes |
| Missed API routes using getAuthContext | Medium | High | Grep search for all occurrences, code review |
| Navigation context loss | Low | Medium | Client-side testing of all nav flows |
| JWT signature mismatch | Low | High | Verify JWT_SECRET matches between services |
| AsyncLocalStorage not fully replaced | Low | Critical | Code review of all API routes |

### Data Consistency Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Duplicate benefits created on concurrent adds | Low | Medium | Database unique constraint on (cardId, benefitName) |
| Duplicate cards in user wallet | Low | Medium | Existing unique constraint validation |
| Orphaned benefits after card deletion | Low | Low | Cascade delete implemented in schema |

### Deployment Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Cache invalidation issues | Low | Medium | Deploy with cache flush, monitor cache hit rates |
| Middleware context not applied to all routes | Medium | High | Verify middleware applies to all api/* routes |
| Session cookie name mismatch | Low | High | Verify cookie names match between auth and routes |

---

## Deployment Considerations

### Pre-Deployment Checklist
- [ ] All code changes reviewed and approved
- [ ] All tests passing (unit, integration, e2e)
- [ ] No breaking changes to API contracts
- [ ] Audit logging working correctly
- [ ] Error messages are user-friendly
- [ ] Performance testing shows no degradation
- [ ] Security review completed
- [ ] Database migrations applied (if any)
- [ ] Environment variables configured
- [ ] Rollback plan documented

### Rollout Strategy
**Recommended**: Phased rollout with monitoring

1. **Phase 0 - Staging**: Deploy all fixes to staging, run full test suite
2. **Phase 1 - Canary**: Deploy to 10% of production instances
3. **Phase 2 - Verification**: Monitor error rates, logs, user reports for 30 minutes
4. **Phase 3 - Rollout**: If stable, deploy to remaining 90%
5. **Phase 4 - Monitoring**: Monitor for 2 hours, be ready to rollback

### Monitoring After Deployment
- **Error Rate**: /api/cards/add and /api/admin/benefits success rate
- **Auth Failures**: 401/403 response rate (should be low)
- **Latency**: API response times
- **User Feedback**: Monitor support channels for new issues
- **Logs**: Check for unexpected errors or exceptions

### Rollback Plan
If issues detected post-deployment:
1. Revert commits to previous known-good state
2. Clear CDN/browser caches
3. Verify navigation returns to normal
4. Investigate root cause
5. Plan fix and retry deployment

**Rollback Commands**:
```bash
git revert <commit-hash>  # Revert specific commit
npm run build && npm run test  # Verify build
# Deploy to staging, test, then production
```

---

## File Change Summary

### New Files (Create)
1. **`src/app/api/admin/benefits/route.ts`** (200-300 lines)
   - GET handler with pagination, filtering, search
   - POST handler with validation
   - Follows pattern of src/app/api/admin/cards/route.ts

2. **`src/features/auth/utils/verify-session.ts`** (50-80 lines)
   - Helper function for session verification in API routes
   - Extracts JWT from cookies, verifies signature
   - Returns userId or throws error

3. **`src/features/auth/utils/verify-session.test.ts`** (100+ lines)
   - Unit tests for verify-session function
   - Tests valid JWT, expired JWT, invalid token, missing cookie

### Files to Update (Edit)
1. **`src/app/admin/layout.tsx`** (lines 94-100)
   - Replace hard-coded href="/dashboard" with context-aware back navigation
   - Use usePathname() to determine back URL

2. **`src/app/api/cards/add/route.ts`** (lines 100-112)
   - Replace getAuthContext() with verifySessionToken(request)
   - Update error handling for auth verification

3. **Additional user API routes** (TBD based on grep results)
   - Search for getAuthContext() usage
   - Replace with verifySessionToken(request)

### Files to Verify (Review Only)
1. **`src/app/admin/benefits/page.tsx`** - Verify endpoint path is correct
2. **`src/features/admin/validation/schemas.ts`** - Verify schemas exist
3. **`src/features/admin/middleware/auth.ts`** - Reference for patterns
4. **`src/middleware.ts`** - Verify auth context setup

---

## Success Criteria for Each Bug

### Bug #1: Admin Benefits Page 404
**✓ Fixed When**:
- [ ] GET /api/admin/benefits returns 200 with paginated list
- [ ] Admin dashboard benefits page loads without errors
- [ ] Pagination works correctly
- [ ] Filtering and search work
- [ ] Non-admin users get 403 Forbidden

### Bug #2: Back Button Navigation
**✓ Fixed When**:
- [ ] Back button on /admin/cards/123 goes to /admin/cards (not /dashboard)
- [ ] Back button on /admin/benefits/456 goes to /admin/benefits
- [ ] Back button hidden on /admin main page
- [ ] All admin sub-pages have back buttons

### Bug #3: Add Card 401 Error
**✓ Fixed When**:
- [ ] POST /api/cards/add returns 201 for authenticated users
- [ ] POST /api/cards/add returns 401 for unauthenticated requests
- [ ] Users can add cards to their dashboard
- [ ] No regression in other user API endpoints

---

## References & Related Documentation

- **Recent Commits**: efbede3, 94f19b4, 859c3da
- **Admin Auth Module**: `src/features/admin/middleware/auth.ts`
- **Admin Card Endpoint**: `src/app/api/admin/cards/route.ts` (reference implementation)
- **Auth Context**: `src/features/auth/context/auth-context.ts`
- **Validation Schemas**: `src/features/admin/validation/schemas.ts`
- **Audit Logging**: `src/features/admin/lib/audit.ts`

---

## Appendix: Code Examples

### Example 1: Verify Session Token Implementation
```typescript
// src/features/auth/utils/verify-session.ts
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/shared/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

export async function verifySessionToken(request: NextRequest): Promise<string> {
  try {
    // Get JWT from cookies (try both common names)
    const token = request.cookies.get('sessionToken')?.value 
      || request.cookies.get('jwt')?.value;
    
    if (!token) {
      throw new Error('No session token found in cookies');
    }

    // Verify JWT signature and payload
    const verified = await jwtVerify(token, JWT_SECRET);
    const userId = verified.payload.userId as string;

    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid token: missing or invalid userId');
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.status === 'INACTIVE' || user.status === 'DELETED') {
      throw new Error('User account is inactive');
    }

    return userId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Authentication failed: ${message}`);
  }
}
```

### Example 2: Updated API Route Using verifySessionToken
```typescript
// src/app/api/cards/add/route.ts - UPDATED
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken } from '@/features/auth/utils/verify-session';
import { prisma } from '@/shared/lib/prisma';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication and get userId
    let userId: string;
    try {
      userId = await verifySessionToken(request);
    } catch (authError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
          details: authError instanceof Error ? authError.message : undefined
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({})) as AddCardRequest;

    // Validate input
    const validation = validateAddCardRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          fieldErrors: validation.errors,
        } as ErrorResponse,
        { status: 400 }
      );
    }

    // ... rest of handler logic using userId ...
    
    const userCard = await prisma.userCard.create({
      data: {
        userId,  // ✓ Guaranteed to be valid
        masterCardId: body.masterCardId,
        customName: body.customName,
        actualAnnualFee: body.actualAnnualFee,
        renewalDate: body.renewalDate ? new Date(body.renewalDate) : getDefaultRenewalDate(),
        status: 'ACTIVE',
      },
      include: { benefits: true }
    });

    return NextResponse.json(
      {
        success: true,
        userCard: formatCardForResponse(userCard),
        benefitsCreated: userCard.benefits.length,
        message: 'Card added to your collection'
      } as AddCardResponse,
      { status: 201 }
    );
  } catch (error) {
    // Handle unexpected errors
    console.error('[AddCard] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add card',
        code: 'SERVER_ERROR',
      } as ErrorResponse,
      { status: 500 }
    );
  }
}
```

### Example 3: Context-Aware Navigation
```typescript
// src/app/admin/layout.tsx - UPDATED
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine back button destination based on current path
  const getBackUrl = (): string | null => {
    // Don't show back button on main admin page
    if (pathname === '/admin') return null;
    
    // Detail pages go back to parent list
    if (pathname.startsWith('/admin/cards/')) return '/admin/cards';
    if (pathname.startsWith('/admin/benefits/')) return '/admin/benefits';
    if (pathname.startsWith('/admin/users/')) return '/admin/users';
    if (pathname.startsWith('/admin/audit-logs/')) return '/admin/audit-logs';
    
    // Single page sections go back to admin home
    if (pathname === '/admin/cards') return '/admin';
    if (pathname === '/admin/benefits') return '/admin';
    if (pathname === '/admin/users') return '/admin';
    if (pathname === '/admin/audit-logs') return '/admin';
    
    // Default fallback
    return '/admin';
  };

  const backUrl = getBackUrl();

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 p-4">
          {/* ... nav items ... */}
        </nav>

        {/* Back Button - Only show if not on main admin page */}
        {backUrl && (
          <Link
            href={backUrl}
            className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
          >
            <span>←</span>
            <span>Back</span>
          </Link>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
```

---

**Document Status**: Complete and Ready for Development  
**Next Steps**: Assign tasks to development team, begin Phase 1 implementation

