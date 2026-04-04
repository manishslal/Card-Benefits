# Wave 1 Implementation Checklist

**Project:** Card Benefits Tracker MVP Remediation  
**Phase:** Wave 1 - Critical Auth/API Fixes  
**Status:** Ready for Development  
**Estimated Duration:** 2-3 hours

---

## Overview

This checklist guides engineers through implementing all 5 critical fixes. Each task is self-contained but should be deployed together.

**Critical Path:**
1. ✅ Task 1A (1 file, 10 min)
2. ✅ Task 1B (1 file move, 5 min)
3. ✅ Task 1C (4 files, 15 min)
4. ✅ Task 1D (1 file, 20 min)
5. ✅ Task 1E (2 files, 10 min)

**Total:** ~60 minutes implementation + testing

---

## Task 1A: Middleware Route Classification Fix

### Overview
Add `PROTECTED_API_PREFIXES` array and update `isProtectedRoute()` in middleware.

### Pre-Implementation
- [ ] Read WAVE1-AUTH-API-SPEC.md section "Task 1A"
- [ ] Review current `src/middleware.ts` (lines 54-95)
- [ ] Understand route classification logic

### Implementation Steps

**Step 1: Add constant after PUBLIC_API_ROUTES**
- [ ] Open `src/middleware.ts`
- [ ] Locate line 64: `const PUBLIC_API_ROUTES = ['/api/auth'];`
- [ ] Add after line 64:
  ```typescript
  
  /** API route prefixes that REQUIRE authentication */
  const PROTECTED_API_PREFIXES = [
    '/api/benefits',
    '/api/cards',
    '/api/user',
  ];
  ```
- [ ] File formatted correctly (no syntax errors)

**Step 2: Update isProtectedRoute() function**
- [ ] Locate `function isProtectedRoute()` at line 82
- [ ] Replace entire function (lines 82-95) with:
  ```typescript
  function isProtectedRoute(pathname: string): boolean {
    if (PROTECTED_ROUTES.has(pathname)) return true;
    if (pathname.startsWith('/api/protected/')) return true;
    for (const route of PROTECTED_ROUTES) {
      if (pathname.startsWith(route + '/')) return true;
    }
    for (const prefix of PROTECTED_API_PREFIXES) {
      if (pathname.startsWith(prefix)) return true;
    }
    return false;
  }
  ```
- [ ] Indentation matches rest of file
- [ ] No duplicate code
- [ ] Function remains single responsibility

### Testing

- [ ] Run `npm run build` — no TypeScript errors
- [ ] Run `npm run dev` — middleware loads without errors
- [ ] Test cases from spec:
  - [ ] 1A.1: POST /api/benefits/add with token → 200
  - [ ] 1A.2: PATCH /api/cards/[id] with token → 200
  - [ ] 1A.3: DELETE /api/benefits/[id] with token → 204
  - [ ] 1A.4: GET /api/cards/my-cards with token → 200
  - [ ] 1A.5: POST /api/user/profile without token → 401
  - [ ] 1A.6: Route classification edge cases pass

### Verification
- [ ] Commit message: "feat: add PROTECTED_API_PREFIXES to middleware route classification"
- [ ] No debug logs left in code
- [ ] No console statements added
- [ ] Code review comments resolved

---

## Task 1B: Fix /api/auth/user Route Classification

### Overview
Move `/api/auth/user` endpoint to `/api/user/profile` to fix public/protected classification conflict.

### Pre-Implementation
- [ ] Read WAVE1-AUTH-API-SPEC.md section "Task 1B"
- [ ] Verify current location: `src/app/api/auth/user/route.ts` exists
- [ ] Check if `src/app/api/user/` directory exists
- [ ] Search codebase for any calls to `/api/auth/user`

### Implementation Steps

**Step 1: Create directory if needed**
- [ ] Check if `src/app/api/user/` directory exists
  - [ ] If not: `mkdir -p src/app/api/user/profile`
  - [ ] If yes: `mkdir -p src/app/api/user/profile` (creates profile subdir)

**Step 2: Move file**
- [ ] Run: `mv src/app/api/auth/user/route.ts src/app/api/user/profile/route.ts`
- [ ] Verify new file exists: `ls -la src/app/api/user/profile/route.ts`
- [ ] Verify old file gone: `ls src/app/api/auth/user/` should error

**Step 3: Update route documentation**
- [ ] Open moved file: `src/app/api/user/profile/route.ts`
- [ ] Update JSDoc comment at top:
  ```typescript
  /**
   * GET /api/user/profile
   * 
   * Fetches the current authenticated user's profile information.
   */
  ```
- [ ] Save file

**Step 4: Search and update references**
- [ ] Search codebase: `grep -r "/api/auth/user" src/`
- [ ] For each reference found:
  - [ ] Update path from `/api/auth/user` to `/api/user/profile`
  - [ ] Verify in component files
  - [ ] Test files (if any)

### Testing

- [ ] Run `npm run build` — no errors
- [ ] Run `npm run dev` — server starts
- [ ] Test cases from spec:
  - [ ] 1B.1: GET /api/user/profile with token → 200 with user data
  - [ ] 1B.2: GET /api/user/profile without token → 401
  - [ ] 1B.3: GET /api/user/profile with expired token → 401
  - [ ] 1B.4: GET /api/user/profile after user deletion → 401

### Verification
- [ ] Old path `src/app/api/auth/user/` directory deleted or empty
- [ ] New path `src/app/api/user/profile/route.ts` exists
- [ ] No remaining references to `/api/auth/user` in codebase
- [ ] Commit message: "refactor: move /api/auth/user to /api/user/profile for consistent route protection"
- [ ] Code review approved

---

## Task 1C: Add credentials: 'include' to Fetch Calls

### Overview
Add `credentials: 'include'` to all authenticated fetch calls in 4 modal components.

### Pre-Implementation
- [ ] Read WAVE1-AUTH-API-SPEC.md section "Task 1C"
- [ ] Understand why: browser doesn't send cookies without explicit opt-in

### Implementation Steps

**File 1: AddBenefitModal.tsx**
- [ ] Open `src/components/AddBenefitModal.tsx`
- [ ] Search for: `fetch('/api/benefits/add'`
- [ ] In that fetch call, add `credentials: 'include',` after `headers` line
  ```typescript
  const response = await fetch('/api/benefits/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // ← ADD THIS
    body: JSON.stringify({...}),
  });
  ```
- [ ] Save file

**File 2: EditBenefitModal.tsx**
- [ ] Open `src/components/EditBenefitModal.tsx`
- [ ] Search for: `fetch(\`/api/benefits/${benefit.id}\``
- [ ] Add `credentials: 'include',` after `headers` line
- [ ] Save file

**File 3: AddCardModal.tsx**
- [ ] Open `src/components/AddCardModal.tsx`
- [ ] Search for: `fetch('/api/cards/add'`
- [ ] NOTE: `fetch('/api/cards/available'` may already have `credentials: 'include'` ✓
- [ ] In the `/api/cards/add` fetch call, add `credentials: 'include',`
- [ ] Save file

**File 4: EditCardModal.tsx**
- [ ] Open `src/components/EditCardModal.tsx`
- [ ] Search for: `fetch(\`/api/cards/${card.id}\``
- [ ] Add `credentials: 'include',` after `headers` line
- [ ] Save file

### Testing

- [ ] Run `npm run build` — no errors
- [ ] Run `npm run dev` — modals load without errors
- [ ] Test cases from spec:
  - [ ] 1C.1: AddBenefitModal submit → 200 (not 401)
  - [ ] 1C.2: EditCardModal submit → 200 (not 401)
  - [ ] 1C.3: Verify fetch includes credentials in DevTools Network tab
  - [ ] 1C.4: DELETE actions work (204 responses)

### Verification
- [ ] All 4 files updated
- [ ] No syntax errors
- [ ] Formatting consistent (matches existing code style)
- [ ] Commit message: "fix: add credentials to fetch calls in authenticated modals"
- [ ] Code review approved

---

## Task 1D: Add GET /api/cards/[id] Endpoint

### Overview
Add GET handler to card detail endpoint. Currently missing, causing mock data fallback.

### Pre-Implementation
- [ ] Read WAVE1-AUTH-API-SPEC.md section "Task 1D"
- [ ] Review existing `src/app/api/cards/[id]/route.ts`
- [ ] Understand Prisma queries and response format

### Implementation Steps

**Step 1: Open file**
- [ ] Open `src/app/api/cards/[id]/route.ts`
- [ ] File currently has PATCH and DELETE handlers
- [ ] Will add GET handler before PATCH

**Step 2: Add interface definitions (at top of file, after imports)**
- [ ] Add after existing interfaces (after `PatchCardRequest`, `PatchCardResponse`, etc.):
  ```typescript
  interface GetCardResponse {
    success: true;
    card: {
      id: string;
      masterCardId: string;
      customName: string | null;
      actualAnnualFee: number | null;
      renewalDate: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      benefits: {
        id: string;
        name: string;
        type: string;
        stickerValue: number;
        userDeclaredValue: number | null;
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
  ```

**Step 3: Add GET handler (before PATCH function)**
- [ ] Copy GET handler from spec (Task 1D Implementation section)
- [ ] Paste before `export async function PATCH`
- [ ] Verify indentation (2-space or match file style)
- [ ] Save file

**Step 4: Verify logic**
- [ ] Handler extracts card ID from URL ✓
- [ ] Checks authentication ✓
- [ ] Includes benefits with `where: { status: 'ACTIVE' }` ✓
- [ ] Verifies user ownership ✓
- [ ] Returns values in cents (not dollars) ✓
- [ ] Maps DateTime to ISO string ✓

### Testing

- [ ] Run `npm run build` — no errors
- [ ] Run `npm run dev` — server loads
- [ ] Test cases from spec:
  - [ ] 1D.1: GET /api/cards/{id} returns card + benefits (200)
  - [ ] 1D.2: GET /api/cards/nonexistent → 404
  - [ ] 1D.3: GET /api/cards/{user-b-card} as user A → 403
  - [ ] 1D.4: Response actualAnnualFee in cents (55000 not 550) ✓
  - [ ] 1D.5: Only ACTIVE benefits returned
  - [ ] 1D.6: Without auth → 401

### Verification
- [ ] File has no duplicate code
- [ ] No TypeScript errors in build
- [ ] Prisma query correct (no missing fields)
- [ ] Response format matches interface
- [ ] Card detail page navigation works and loads real data
- [ ] Commit message: "feat: add GET /api/cards/[id] endpoint for card detail page"
- [ ] Code review approved

---

## Task 1E: Fix DELETE HTTP 204 Protocol Violation

### Overview
Fix both DELETE handlers to return 204 with NO body (not 204 with JSON body).

### Pre-Implementation
- [ ] Read WAVE1-AUTH-API-SPEC.md section "Task 1E"
- [ ] Understand HTTP spec: 204 = No Content

### Implementation Steps

**File 1: DELETE in /api/cards/[id]/route.ts**
- [ ] Open `src/app/api/cards/[id]/route.ts`
- [ ] Find `export async function DELETE` (around line 168)
- [ ] Scroll to end of function
- [ ] Find: `return NextResponse.json({ success: true }, { status: 204 });`
- [ ] Replace with:
  ```typescript
  return new NextResponse(null, { status: 204 });
  ```
- [ ] Save file

**File 2: DELETE in /api/benefits/[id]/route.ts**
- [ ] Open `src/app/api/benefits/[id]/route.ts`
- [ ] Find `export async function DELETE` (around line 158)
- [ ] Scroll to end of function
- [ ] Find: `return NextResponse.json({ success: true }, { status: 204 });`
- [ ] Replace with:
  ```typescript
  return new NextResponse(null, { status: 204 });
  ```
- [ ] Save file

### Testing

- [ ] Run `npm run build` — no errors
- [ ] Run `npm run dev` — modals load
- [ ] Test cases from spec:
  - [ ] 1E.1: DELETE /api/cards/{id} returns 204 with no body
  - [ ] 1E.2: DELETE /api/benefits/{id} returns 204 with no body
  - [ ] 1E.3: DELETE card marks status='DELETED' in DB
  - [ ] 1E.4: DELETE card archives all benefits (status='ARCHIVED')
  - [ ] 1E.5: DELETE benefit marks status='ARCHIVED' in DB
  - [ ] 1E.6: DELETE nonexistent → 404 with error body

### Verification
- [ ] Both files updated
- [ ] No `{ success: true }` returned with 204
- [ ] Build succeeds
- [ ] Manual test: Check Network tab in DevTools, DELETE response should show (empty body)
- [ ] Commit message: "fix: return 204 with empty body for DELETE endpoints (HTTP spec compliance)"
- [ ] Code review approved

---

## Integration Testing

After all 5 tasks complete, run end-to-end flow tests:

### Full Flow Test 1: Add Card and Benefit
- [ ] Login to app
- [ ] Navigate to dashboard
- [ ] Click "Add Card" → AddCardModal opens
- [ ] Fill form, submit
  - [ ] Modal shows success message (not 401)
  - [ ] Card appears in list
- [ ] Click "Add Benefit" on card
- [ ] Fill form, submit
  - [ ] Modal shows success message (not 401)
  - [ ] Benefit appears in list

### Full Flow Test 2: Edit Operations
- [ ] Click "Edit" on a card
  - [ ] Modal opens with current data
  - [ ] Change name, submit
  - [ ] Modal shows success (not 401)
- [ ] Click "Edit" on a benefit
  - [ ] Modal opens with current data
  - [ ] Change value, submit
  - [ ] Modal shows success (not 401)

### Full Flow Test 3: Delete Operations
- [ ] Click delete on a benefit
  - [ ] Confirm dialog appears
  - [ ] Click confirm
  - [ ] Benefit removed from list (204 response)
- [ ] Click delete on a card
  - [ ] Confirm dialog appears
  - [ ] Click confirm
  - [ ] Card removed from list (204 response)

### Full Flow Test 4: Card Detail Page
- [ ] Add a card with multiple benefits (if not already)
- [ ] Click card to open detail page
  - [ ] Page loads without errors (GET /api/cards/{id} succeeds)
  - [ ] Shows card name, annual fee
  - [ ] Shows all active benefits
  - [ ] Values are in cents (not dollars)
  - [ ] No mock data fallback

### Full Flow Test 5: Mobile Responsiveness
- [ ] Open DevTools, set mobile viewport
- [ ] Open each modal (AddCard, EditCard, AddBenefit, EditBenefit)
  - [ ] Forms don't overflow screen
  - [ ] All fields visible and accessible
  - [ ] No horizontal scroll needed

### Regression Tests
- [ ] Logout works
- [ ] Login works (existing flow unchanged)
- [ ] Public pages still accessible (login, signup)
- [ ] Protected pages still require auth

---

## Pre-Deployment Checklist

### Code Review
- [ ] All 5 tasks completed
- [ ] All code reviewed and approved
- [ ] No merge conflicts
- [ ] Commit history clean and descriptive

### Testing
- [ ] All unit tests pass: `npm run test`
- [ ] TypeScript build succeeds: `npm run build`
- [ ] Dev server runs without errors: `npm run dev`
- [ ] All integration tests pass
- [ ] Manual end-to-end tests pass

### Code Quality
- [ ] No console.log or debug statements left
- [ ] No unused imports
- [ ] Consistent formatting (Prettier)
- [ ] No TypeScript warnings
- [ ] JSDoc/comments clear and accurate

### Documentation
- [ ] WAVE1-AUTH-API-SPEC.md complete
- [ ] WAVE1-QUICK-REFERENCE.md complete
- [ ] This checklist complete and signed off
- [ ] Any new files documented

---

## Deployment

### Pre-Deployment Steps
- [ ] Ensure main branch is stable
- [ ] Run final build on main: `npm run build`
- [ ] Test in staging environment first
- [ ] Get deployment approval

### Deployment Command
```bash
# Assuming Wave 1 changes are on a branch
git checkout main
git pull origin main
npm install  # If any deps changed
npm run build
npm run deploy  # Or your deployment command
```

### Post-Deployment Validation
- [ ] App loads in production
- [ ] No 500 errors in logs
- [ ] Auth flows work (login/logout)
- [ ] Add card/benefit works (no 401 errors)
- [ ] Edit operations work (no 401 errors)
- [ ] Delete operations work (204 responses)
- [ ] Card detail page shows real data

### Monitoring
- [ ] Monitor error logs for next 1 hour
- [ ] Check 401 error counts (should be 0 for authenticated routes)
- [ ] Monitor response times (should be unchanged)
- [ ] Check database query performance (should be unchanged)

---

## Rollback Plan

If critical issue found within 1 hour of deployment:

```bash
# Find commits
git log --oneline | head -10

# Revert all Wave 1 commits (in reverse order)
git revert <commit-1a>
git revert <commit-1b>
git revert <commit-1c>
git revert <commit-1d>
git revert <commit-1e>

# Force redeploy
npm run build
npm run deploy
```

**Expected rollback time:** 2-3 minutes

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | __________ | _____ | __________ |
| Code Reviewer | __________ | _____ | __________ |
| QA Lead | __________ | _____ | __________ |
| Engineering Manager | __________ | _____ | __________ |

---

## Notes & Issues

| Issue | Severity | Resolution | Status |
|-------|----------|-----------|--------|
| | | | |

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Owner:** Engineering Team  
**Next Review:** Post-deployment verification
