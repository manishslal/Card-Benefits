# Production Bugs Fix - Quick Reference
## For Fast Implementation and Testing

---

## One-Page Summary

**3 Critical Bugs to Fix (In Order)**:

| Priority | Bug | Root Cause | Fix Location | Estimated Time |
|----------|-----|-----------|--------------|-----------------|
| **1** | Add Card Returns 401 | `getAuthContext()` doesn't work in API routes | `src/app/api/cards/add/route.ts` | 2-3h |
| **2** | Benefits Page 404 | Missing GET/POST endpoint | Create `src/app/api/admin/benefits/route.ts` | 3-4h |
| **3** | Back Button Wrong | Hard-coded `/dashboard` href | `src/app/admin/layout.tsx` line 95 | 1-2h |

---

## Fix #1: Add Card 401 - Implementation Path

### Create this file:
📄 `src/features/auth/utils/verify-session.ts` (NEW)

```typescript
import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/shared/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '');

export async function verifySessionToken(request: NextRequest): Promise<string> {
  const token = request.cookies.get('sessionToken')?.value 
    || request.cookies.get('jwt')?.value;
  
  if (!token) throw new Error('No session token found');

  const verified = await jwtVerify(token, JWT_SECRET);
  const userId = verified.payload.userId as string;
  
  if (!userId) throw new Error('Invalid token payload');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'INACTIVE') throw new Error('User not found or inactive');

  return userId;
}
```

### Update this file:
📄 `src/app/api/cards/add/route.ts` (Lines 97-112)

**Before**:
```typescript
const authContext = getAuthContext();
const userId = authContext?.userId;
if (!userId) {
  return NextResponse.json(...401);
}
```

**After**:
```typescript
let userId: string;
try {
  userId = await verifySessionToken(request);
} catch (authError) {
  return NextResponse.json(
    { success: false, error: 'Authentication required', code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}
```

### Find & Fix Others:
```bash
grep -r "getAuthContext\|getAuthUserId" src/app/api --include="*.ts" | grep -v admin | grep -v auth
# Apply same pattern to any user API routes found
```

---

## Fix #2: Benefits List 404 - Implementation Path

### Create this file:
📄 `src/app/api/admin/benefits/route.ts` (NEW - Copy pattern from cards endpoint)

**Reference**: `src/app/api/admin/cards/route.ts` lines 1-200

**Minimum Implementation**:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/shared/lib';
import { verifyAdminRole } from '@/features/admin/middleware/auth';

// GET Handler
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await verifyAdminRole(request);
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    
    const benefits = await prisma.masterBenefit.findMany({
      take: limit,
      skip: (page - 1) * limit,
      orderBy: { name: 'asc' }
    });

    const total = await prisma.masterBenefit.count();

    return NextResponse.json({
      success: true,
      data: benefits,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    });
  } catch (error) {
    // ... error handling
  }
}

// POST Handler
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await verifyAdminRole(request);
    
    const body = await request.json();
    
    const benefit = await prisma.masterBenefit.create({
      data: {
        masterCardId: body.masterCardId,
        name: body.name,
        type: body.type,
        stickerValue: body.stickerValue,
        resetCadence: body.resetCadence
      }
    });

    return NextResponse.json({ success: true, data: benefit }, { status: 201 });
  } catch (error) {
    // ... error handling
  }
}
```

---

## Fix #3: Back Button Navigation - Implementation Path

### Update this file:
📄 `src/app/admin/layout.tsx` (Lines 94-100)

**Before**:
```typescript
<Link
  href="/dashboard"  // ❌ ALWAYS goes to user dashboard
  className="..."
>
```

**After**:
```typescript
'use client';

import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  const getBackUrl = (): string | null => {
    if (pathname === '/admin') return null;
    if (pathname.startsWith('/admin/cards/')) return '/admin/cards';
    if (pathname.startsWith('/admin/benefits/')) return '/admin/benefits';
    return '/admin';
  };

  const backUrl = getBackUrl();

  return (
    <div className="flex h-screen">
      <aside className="...">
        {backUrl && (
          <Link href={backUrl} className="...">
            <span>←</span>
            <span>Back</span>
          </Link>
        )}
      </aside>
      {children}
    </div>
  );
}
```

---

## Quick Testing Checklist

### Test Fix #1 (Add Card):
- [ ] Log in as user
- [ ] Click "Add New Card"
- [ ] Select card, click "Add Card"
- [ ] ✓ POST /api/cards/add returns 201, card added
- [ ] ✓ Card appears in dashboard
- [ ] ✓ Unauthenticated request returns 401

### Test Fix #2 (Benefits List):
- [ ] Log in as admin
- [ ] Click "Manage Benefits"
- [ ] ✓ Benefits list loads (no 404 error)
- [ ] ✓ Pagination works (page=2, limit=10)
- [ ] ✓ Search/filter works
- [ ] ✓ Non-admin user gets 403 Forbidden

### Test Fix #3 (Navigation):
- [ ] Go to /admin/cards/123 (card detail)
- [ ] Click "← Back" button
- [ ] ✓ Goes to /admin/cards (not /dashboard)
- [ ] ✓ Back button hidden on /admin main page

---

## Command Reference

```bash
# Test all API routes
npm test src/app/api/cards/add/route.test.ts
npm test src/app/api/admin/benefits/route.test.ts

# Run full test suite
npm run test

# Build and check for errors
npm run build

# Type check
npm run type-check

# Lint changes
npm run lint

# Format code
npm run format

# Deploy
git add .
git commit -m "Fix: Production bugs #1, #2, #3"
git push origin main
```

---

## Common Mistakes to Avoid

❌ **Don't**:
- Use `getAuthContext()` in API routes
- Hard-code navigation URLs
- Forget to check cookie names (sessionToken vs jwt)
- Skip error handling for auth failures
- Forget to add pagination to list endpoints

✅ **Do**:
- Extract JWT from request directly in API routes
- Use usePathname() for context-aware navigation
- Test both authenticated and unauthenticated flows
- Reference existing endpoint patterns
- Test pagination edge cases (page=999, limit=0, etc.)

---

## Dependency Check

Before starting implementation, verify these exist:

```typescript
// Check: Jose library for JWT verification
import { jwtVerify } from 'jose';  ✓

// Check: Prisma client
import { prisma } from '@/shared/lib/prisma';  ✓

// Check: Admin auth utilities
import { verifyAdminRole } from '@/features/admin/middleware/auth';  ✓

// Check: Next.js components
import { usePathname } from 'next/navigation';  ✓
```

---

## File Change Summary

**Create (3 files)**:
- `src/app/api/admin/benefits/route.ts` (250+ lines)
- `src/features/auth/utils/verify-session.ts` (60 lines)
- `src/features/auth/utils/verify-session.test.ts` (80+ lines)

**Update (2 files)**:
- `src/app/api/cards/add/route.ts` (5-10 line change)
- `src/app/admin/layout.tsx` (20-30 line change)

**Search & Update**:
- Any other user API routes using `getAuthContext()`

---

## Success Metrics (After Deployment)

✓ **Production Monitoring**:
- Error rate on /api/cards/add: < 0.1%
- Error rate on /api/admin/benefits: < 0.1%
- 401/403 rate on user routes: < 1%
- Page load time unchanged
- No new support tickets

---

## Full Specification

For detailed requirements, schema definitions, and edge case handling:
📖 See: `.github/specs/production-bugs-fix-spec.md`

