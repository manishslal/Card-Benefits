# Wave 1 Quick Reference - 5 Critical Fixes at a Glance

**Estimated implementation time:** 2-3 hours  
**No migrations. No database changes. Fully backward compatible.**

---

## The 5 Tasks (Copy-Paste Ready)

### Task 1A: Middleware Route Classification
**File:** `src/middleware.ts`

```typescript
// ADD after line 64 (after PUBLIC_API_ROUTES):
const PROTECTED_API_PREFIXES = [
  '/api/benefits',
  '/api/cards',
  '/api/user',
];

// REPLACE lines 82-95 (isProtectedRoute function):
function isProtectedRoute(pathname: string): boolean {
  if (PROTECTED_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/api/protected/')) return true;
  for (const route of PROTECTED_ROUTES) {
    if (pathname.startsWith(route + '/')) return true;
  }
  // NEW:
  for (const prefix of PROTECTED_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}
```

**Why:** `/api/benefits/*`, `/api/cards/*` routes currently return 401 because they're not classified as protected.

---

### Task 1B: /api/auth/user → /api/user/profile
**Option A (Recommended):** Move file
```bash
mv src/app/api/auth/user/route.ts src/app/api/user/profile/route.ts
```

**Why:** `/api/auth` = public paths (login/signup). `/api/user` = protected paths. Clean separation.

---

### Task 1C: Add credentials: 'include' to Fetch Calls
**Files to update (4 components):**

In each file, change all authenticated fetch calls from:
```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({...}),
});
```

To:
```typescript
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ← ADD THIS LINE
  body: JSON.stringify({...}),
});
```

**Files:**
- [ ] `src/components/AddBenefitModal.tsx` (line ~123)
- [ ] `src/components/EditBenefitModal.tsx` (line ~155)
- [ ] `src/components/AddCardModal.tsx` (line ~260)
- [ ] `src/components/EditCardModal.tsx` (line ~118)

**Why:** Without this, browser doesn't send session cookie. Middleware can't extract JWT.

---

### Task 1D: Add GET /api/cards/[id]
**File:** `src/app/api/cards/[id]/route.ts`

**Add this handler before PATCH:**

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

    const cardId = request.nextUrl.pathname.split('/')[3];

    if (!cardId) {
      return NextResponse.json(
        { success: false, error: 'Card ID required' } as GetCardErrorResponse,
        { status: 400 }
      );
    }

    const card = await prisma.userCard.findUnique({
      where: { id: cardId },
      include: {
        player: {
          select: { userId: true },
        },
        userBenefits: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            name: true,
            type: true,
            stickerValue: true,
            userDeclaredValue: true,
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

    if (card.player.userId !== userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view this card' } as GetCardErrorResponse,
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        card: {
          id: card.id,
          masterCardId: card.masterCardId,
          customName: card.customName,
          actualAnnualFee: card.actualAnnualFee,
          renewalDate: card.renewalDate.toISOString(),
          status: card.status,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
          benefits: card.userBenefits.map((benefit) => ({
            id: benefit.id,
            name: benefit.name,
            type: benefit.type,
            stickerValue: benefit.stickerValue,
            userDeclaredValue: benefit.userDeclaredValue,
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

**Why:** Card detail page currently uses stale mock data (wrong units). This adds the real endpoint.

---

### Task 1E: Fix DELETE HTTP 204 Protocol Violation
**Files:**
- `src/app/api/cards/[id]/route.ts` (DELETE handler)
- `src/app/api/benefits/[id]/route.ts` (DELETE handler)

**Change:**
```typescript
// BEFORE (WRONG):
return NextResponse.json({ success: true }, { status: 204 });

// AFTER (CORRECT):
return new NextResponse(null, { status: 204 });
```

**Why:** HTTP 204 (No Content) must NOT include a response body. Violates RFC 7231.

---

## Testing Checklist

### Task 1A - Route Classification
- [ ] POST `/api/benefits/add` → 200 (not 401)
- [ ] PATCH `/api/cards/[id]` → 200 (not 401)
- [ ] DELETE `/api/cards/[id]` → 204 (not 401)
- [ ] GET `/api/cards/my-cards` → 200 (not 401)

### Task 1B - Protected Route
- [ ] GET `/api/user/profile` with token → 200
- [ ] GET `/api/user/profile` without token → 401

### Task 1C - Fetch Credentials
- [ ] Modal fetch calls include `credentials: 'include'`
- [ ] Add Benefit modal creates benefit (not 401)
- [ ] Edit Card modal updates card (not 401)

### Task 1D - GET Card Details
- [ ] GET `/api/cards/{id}` returns card + benefits
- [ ] Response includes values in cents (not dollars)
- [ ] Card detail page shows real data (not mock)

### Task 1E - DELETE HTTP Compliance
- [ ] DELETE `/api/cards/{id}` returns 204 with NO body
- [ ] DELETE `/api/benefits/{id}` returns 204 with NO body
- [ ] Card soft-deleted in DB (status = 'DELETED')
- [ ] Benefits archived in DB (status = 'ARCHIVED')

---

## Deployment Checklist

**Pre-deployment:**
- [ ] All code changes committed
- [ ] All tests passing locally
- [ ] Code review approved
- [ ] No database migrations needed
- [ ] Backward compatibility verified

**Deployment:**
- [ ] Deploy middleware.ts changes
- [ ] Deploy route handler changes
- [ ] Deploy modal fetch changes
- [ ] Verify in staging
- [ ] Deploy to production

**Post-deployment:**
- [ ] Monitor error logs (should see 0 auth errors)
- [ ] Test end-to-end flows (login → add card → add benefit)
- [ ] Verify no 401 errors on protected routes

---

## Rollback Plan

**If critical issue discovered:**

```bash
# Identify the commits:
git log --oneline | head -5

# Revert the Wave 1 commits (in reverse order):
git revert <hash-1>
git revert <hash-2>
git revert <hash-3>

# Force deploy
npm run build && npm run deploy
```

**Rollback time:** ~2 minutes

---

## Key Metrics

| Metric | Before | After |
|--------|--------|-------|
| POST /api/benefits/add | ❌ 401 | ✅ 200 |
| PATCH /api/cards/[id] | ❌ 401 | ✅ 200 |
| DELETE /api/cards/[id] | ❌ 401 + HTTP violation | ✅ 204 clean |
| GET /api/cards/[id] | ❌ 404 (missing) | ✅ 200 with data |
| Card detail page | ❌ Stale mock data | ✅ Real live data |

---

## FAQ

**Q: Do I need to run migrations?**  
A: No. No database changes.

**Q: Will this break existing clients?**  
A: No. Backward compatible. Old clients without `credentials: 'include'` will fail on protected routes (they already do), but this makes it explicit and required.

**Q: Can I deploy these changes separately?**  
A: Yes. Deploy in order: Task 1A → Task 1B → Task 1C → Task 1D → Task 1E. Each is independent after previous is deployed.

**Q: What if DELETE still returns a body by mistake?**  
A: Test in browser DevTools. Response tab should show (empty) or (no body) text. Headers should have `content-length: 0`.

**Q: How do I test locally?**  
A: Run `npm run dev`, login, try add/edit/delete in modals. Should work without 401 errors.

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**For detailed documentation:** See WAVE1-AUTH-API-SPEC.md
