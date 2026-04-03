# Edge Runtime Authentication - Quick Reference for Developers

## The Problem in 30 Seconds

```
Middleware (Edge Runtime) cannot use Node.js crypto modules.
jsonwebtoken needs crypto module.
Result: Middleware crashes on Railway.

FIX: Move JWT verification from middleware to route handlers.
```

---

## The Fix in 30 Seconds

```typescript
// MIDDLEWARE (Edge Runtime) - SIMPLE
// ✓ Extract cookie
// ✓ Check if exists
// ✓ Set context
// ✗ Do NOT verify JWT here

// PROTECTED ROUTE (Node.js Runtime) - VERIFICATION
// ✓ Use @withAuth() wrapper
// ✓ Verify JWT signature
// ✓ Check database session
// ✓ Return 401 on failure
```

---

## Checklist for Phase 1: Middleware Changes

### 1. Open `src/middleware.ts`

### 2. Find and REMOVE these lines:
```typescript
import {
  verifySessionToken,  // ← REMOVE THIS IMPORT
  type SessionPayload,
} from '@/lib/auth-utils';

function verifyToken(token: string): SessionPayload | null {
  try {
    return verifySessionToken(token);  // ← REMOVE THIS FUNCTION
  } catch (error) {
    console.error('[Auth Middleware] Token verification failed:', { ... });
    return null;
  }
}

// In the protected route handler:
const payload = verifyToken(sessionToken);  // ← REMOVE THIS CALL
if (!payload) {
  return createUnauthorizedResponse('Invalid or expired session');  // ← REMOVE THIS BLOCK
}

const { valid, userId } = await validateSessionInDatabase(  // ← REMOVE THIS CALL
  sessionToken,
  payload.userId
);
```

### 3. KEEP these lines (but MODIFY):
```typescript
// KEEP: Route classification
const isPublic = PUBLIC_ROUTES.has(pathname) || isPublicApiRoute(pathname);
const isProtected = isProtectedRoute(pathname);

// KEEP: Extract cookie
const sessionToken = extractSessionToken(request);

// KEEP: Check if cookie exists
if (!sessionToken) {
  return createUnauthorizedResponse('Authentication required');
}

// KEEP: Set context (but store token too)
return await runWithAuthContext(
  { userId: undefined, sessionToken },  // ← STORE TOKEN HERE
  async () => NextResponse.next()
);
```

### 4. Update `auth-context.ts`:
```typescript
// OLD
interface AuthContext {
  userId: string | undefined;
}

// NEW
interface AuthContext {
  userId: string | undefined;
  sessionToken: string | undefined;  // ← ADD THIS
}
```

### 5. Create `src/lib/with-auth.ts`:
```typescript
import { getAuthSessionToken, getAuthUserId } from '@/lib/auth-context';
import { verifySessionToken } from '@/lib/auth-utils';
import { getSessionByToken, userExists } from '@/lib/auth-server';
import { NextRequest, NextResponse } from 'next/server';

export async function withAuth<T extends Record<string, any>>(
  handler: (userId: string) => Promise<NextResponse<T>>
): (req: NextRequest) => Promise<NextResponse<T>> {
  return async (req: NextRequest) => {
    try {
      // Get token from context (set by middleware)
      const token = getAuthSessionToken();
      if (!token) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Verify JWT signature (this is OK in Node.js runtime)
      let payload;
      try {
        payload = verifySessionToken(token);
      } catch (error) {
        console.error('[withAuth] JWT verification failed');
        return NextResponse.json(
          { error: 'Invalid or expired session' },
          { status: 401 }
        );
      }

      // Validate session in database
      const session = await getSessionByToken(token);
      if (!session) {
        return NextResponse.json(
          { error: 'Session invalid or revoked' },
          { status: 401 }
        );
      }

      // Verify userId matches
      if (session.userId !== payload.userId) {
        return NextResponse.json(
          { error: 'Session mismatch' },
          { status: 401 }
        );
      }

      // Verify user still exists
      const userValid = await userExists(payload.userId);
      if (!userValid) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        );
      }

      // Call handler with verified userId
      return await handler(payload.userId);
    } catch (error) {
      console.error('[withAuth] Unexpected error:', error);
      return NextResponse.json(
        { error: 'Authentication check failed' },
        { status: 500 }
      );
    }
  };
}
```

---

## Checklist for Phase 3: Wrap Protected Routes

### Find a protected route file like `src/app/api/protected/user/route.ts`

### BEFORE:
```typescript
import { getAuthUserId } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  const userId = getAuthUserId();
  
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getUserById(userId);
  return NextResponse.json(user);
}
```

### AFTER:
```typescript
import { withAuth } from '@/lib/with-auth';  // ← ADD IMPORT

export async function GET(request: NextRequest) {
  return await withAuth(async (userId) => {  // ← WRAP HANDLER
    const user = await getUserById(userId);
    return NextResponse.json(user);
  })(request);  // ← CALL WITH REQUEST
}
```

### Pattern:
```typescript
export async function POST(request: NextRequest) {
  return await withAuth(async (userId) => {
    // Business logic here
    // userId is verified and guaranteed non-null
    return NextResponse.json({ success: true });
  })(request);
}
```

---

## Checklist for Phase 4: Testing

### Test 1: Middleware doesn't import crypto
```bash
grep -r "jsonwebtoken" src/middleware.ts  # Should return nothing
grep -r "crypto" src/middleware.ts        # Should return nothing
```

### Test 2: Protected routes reject unauthenticated
```bash
curl -X GET http://localhost:3000/api/protected/user  # Should get 401
```

### Test 3: Protected routes work when authenticated
```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "TestPass123!"}'

# 2. Get session cookie from response headers
# 3. Use cookie to access protected route
curl -X GET http://localhost:3000/api/protected/user \
  -H "Cookie: session=<token-from-login>"  # Should get 200
```

### Test 4: Logout revokes session
```bash
# 1. Login and get session cookie
# 2. Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: session=<token>"

# 3. Try to access protected route → Should get 401
curl -X GET http://localhost:3000/api/protected/user \
  -H "Cookie: session=<token>"
```

### Test 5: Run all tests
```bash
npm run test                    # Unit tests
npm run test:e2e              # E2E tests
npm run test:coverage         # Coverage report
```

---

## Common Issues & Solutions

### Issue 1: "cannot find module 'jsonwebtoken' from middleware"
**Cause:** Didn't remove the import from middleware
**Fix:** Remove `import { verifySessionToken } from '@/lib/auth-utils'` from middleware.ts

### Issue 2: "withAuth is not defined"
**Cause:** Forgot to create `with-auth.ts`
**Fix:** Create file and export the function

### Issue 3: Route returns "Authentication required" always
**Cause:** Middleware not setting sessionToken in context
**Fix:** Ensure `runWithAuthContext({ ..., sessionToken }, ...)`

### Issue 4: Route handler can't access session token
**Cause:** Auth context getter doesn't return sessionToken
**Fix:** Update `getAuthSessionToken()` function in auth-context.ts

### Issue 5: "crypto module not supported" error in production
**Cause:** Still trying to verify JWT in middleware
**Fix:** Verify middleware doesn't call verifySessionToken()

---

## File Modification Checklist

### MODIFY Files:
- [ ] `src/middleware.ts` - Remove verifyToken() call and imports
- [ ] `src/lib/auth-context.ts` - Add sessionToken to interface
- [ ] `src/app/api/protected/user/route.ts` - Add @withAuth wrapper
- [ ] `src/app/api/protected/cards/route.ts` - Add @withAuth wrapper
- [ ] All other protected route files

### CREATE Files:
- [ ] `src/lib/with-auth.ts` - New auth wrapper function
- [ ] `src/__tests__/with-auth.test.ts` - Unit tests
- [ ] `src/__tests__/auth-integration.test.ts` - Integration tests
- [ ] `tests/auth.e2e.spec.ts` - E2E tests

---

## Verification Steps

### Step 1: Check middleware doesn't use crypto
```bash
# Should output nothing (no imports of jsonwebtoken, crypto, etc)
grep -E "import.*jsonwebtoken|import.*crypto" src/middleware.ts
```

### Step 2: Check with-auth.ts exists
```bash
ls -la src/lib/with-auth.ts  # Should exist
```

### Step 3: Check all protected routes wrapped
```bash
# Should show routes using @withAuth
grep -r "withAuth" src/app/api/protected/
```

### Step 4: Run tests
```bash
npm run test                                    # Unit tests
npm run test:e2e -- tests/auth.e2e.spec.ts   # E2E tests
npm run test:coverage                         # Coverage
```

### Step 5: Build and deploy to staging
```bash
npm run build                    # Should succeed
# Deploy to Railway staging
# Verify no "crypto module" errors in logs
```

---

## Before You Deploy to Production

### Checklist:
- [ ] All tests passing (>85% coverage)
- [ ] No crypto imports in middleware.ts
- [ ] All protected routes wrapped with @withAuth()
- [ ] Code reviewed by peer
- [ ] Staging deployment successful
- [ ] Staging smoke tests passed
- [ ] Rollback plan prepared
- [ ] Team notified about changes

### Smoke Tests Before Production:
```
1. Can signup on staging? ✓
2. Can login on staging? ✓
3. Can access protected routes? ✓
4. Can logout? ✓
5. Logout prevents access? ✓
6. No errors in logs? ✓
```

---

## Quick Git Commands

```bash
# Create feature branch
git checkout -b feat/edge-runtime-auth

# Commit changes phase by phase
git add src/middleware.ts src/lib/auth-context.ts
git commit -m "Phase 1: Remove crypto from middleware"

git add src/lib/with-auth.ts
git commit -m "Phase 2: Add withAuth() route wrapper"

git add src/app/api/protected
git commit -m "Phase 3: Wrap protected routes with withAuth()"

git add src/__tests__
git commit -m "Phase 4: Add comprehensive tests"

# Push and create PR
git push origin feat/edge-runtime-auth
# Create Pull Request on GitHub
```

---

## Getting Help

1. **Read the full spec:** `EDGE_RUNTIME_AUTHENTICATION_SPEC.md`
2. **Check summary:** `EDGE_RUNTIME_CONSTRAINT_SUMMARY.md`
3. **Ask team:** [Slack / Discord / Team Channel]
4. **Reference code:** Look at existing route handlers for patterns

---

## Success Criteria

You're done when:
- ✓ All tests pass
- ✓ Code compiles without errors
- ✓ Middleware has no crypto imports
- ✓ All protected routes are wrapped with @withAuth()
- ✓ Production deployment succeeds
- ✓ No "crypto module not supported" errors in logs
- ✓ Users can login, logout, access protected routes

---

**GOOD LUCK! 🚀**

You've got this. Take it one phase at a time.
