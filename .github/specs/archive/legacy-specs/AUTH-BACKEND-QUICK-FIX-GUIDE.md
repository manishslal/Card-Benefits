# Quick Fix Guide: Session Management Bug
**Status:** 🔴 CRITICAL - Blocking Production  
**Time to Fix:** ~3 hours  
**Impact:** Users cannot access protected routes after login

---

## The Bug in 30 Seconds

Users log in successfully, but **sessions aren't stored correctly in the database**. When they try to access protected routes, the middleware can't find the session and returns 401.

**Root Cause:** Two separate database writes with no transaction wrapping:
1. ✅ Create session with temporary token
2. ❌ Update session with JWT token (can fail)

If step 2 fails, the database has invalid data but the user already has the JWT cookie.

---

## Quick Impact Check

### How to Verify You're Affected:

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# 2. Extract JWT from Set-Cookie header
# Example: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 3. Check database
sqlite3 prisma.db "SELECT sessionToken FROM Session ORDER BY createdAt DESC LIMIT 1;"

# 4. Compare results
# If sessionToken starts with "temp_" → YOU HAVE THE BUG
# If sessionToken is a long JWT → BUG IS FIXED
```

---

## The Fix (Copy-Paste Ready)

### File: `src/app/api/auth/login/route.ts`

**Replace lines 173-188** with:

```typescript
// OLD CODE (DELETE)
// const expiresAt = new Date(Date.now() + getSessionExpirationSeconds() * 1000);
// const tempToken = `temp_${randomUUID()}`;
// const sessionRecord = await createSession(user.id, tempToken, expiresAt);
// const payload = createSessionPayload(user.id, sessionRecord.id);
// const token = signSessionToken(payload);
// await updateSessionToken(sessionRecord.id, token);

// NEW CODE (PASTE)
const expiresAt = new Date(Date.now() + getSessionExpirationSeconds() * 1000);

// Generate payload and JWT first
const { randomUUID } = await import('crypto');
const sessionId = randomUUID();
const payload = createSessionPayload(userId, sessionId);
const token = signSessionToken(payload);

// Create session with real JWT in single atomic operation
let sessionRecord;
try {
  sessionRecord = await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      sessionToken: token,
      expiresAt,
      userAgent: request.headers.get('user-agent') || null,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null,
      isValid: true,
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
    },
  });
} catch (sessionError) {
  console.error('[Login] Session creation failed:', {
    error: sessionError instanceof Error ? sessionError.message : 'Unknown',
  });
  return NextResponse.json(
    {
      success: false,
      error: 'Unable to create session. Please try again.',
    },
    { status: 503 }
  );
}
```

**Key changes:**
- ✅ Single database write (atomic)
- ✅ No temporary token
- ✅ Explicit error handling for session creation
- ✅ Captures user agent and IP

### Remove Imports

Since you're now using `prisma` directly, add this at the top if not already there:

```typescript
import { prisma } from '@/lib/prisma';
```

### Remove Old Imports (Optional)

These are no longer needed in this file:
```typescript
// REMOVE THESE (or keep if used elsewhere)
// import { updateSessionToken } from '@/lib/auth-server';
// import { randomUUID } from 'crypto';
```

---

## Testing the Fix

### Test 1: Verify Session Token in Database

```bash
# 1. Login
RESPONSE=$(curl -s -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}')

# 2. Extract JWT
JWT=$(echo "$RESPONSE" | grep "Set-Cookie" | sed 's/.*session=\([^;]*\).*/\1/')

# 3. Check database
DB_TOKEN=$(sqlite3 prisma.db "SELECT sessionToken FROM Session ORDER BY createdAt DESC LIMIT 1;")

# 4. Compare
if [ "$JWT" = "$DB_TOKEN" ]; then
  echo "✅ FIX WORKS: JWT matches database token"
else
  echo "❌ FIX FAILED: Tokens don't match"
fi
```

### Test 2: Access Protected Route

```bash
# With JWT from above
curl -X GET http://localhost:3000/api/protected/test \
  -H "Cookie: session=$JWT"

# Should return 200 (not 401)
```

### Test 3: Run Unit Tests

```bash
npm run test -- auth
```

---

## Troubleshooting

### Issue: "Cannot find name 'prisma'"

**Solution:** Add import at top of file:
```typescript
import { prisma } from '@/lib/prisma';
```

### Issue: "sessionId is not defined"

**Solution:** Make sure you're using the sessionId variable:
```typescript
const sessionId = randomUUID();  // ← Add this line
const payload = createSessionPayload(userId, sessionId);
```

### Issue: "randomUUID is not defined"

**Solution:** Import it:
```typescript
const { randomUUID } = await import('crypto');
```

Or at the top:
```typescript
import { randomUUID } from 'crypto';
```

### Issue: Database still shows "temp_" tokens

**Solution:** You haven't deployed the fix yet, or the old code is still running.
1. Check you edited the correct file
2. Restart your dev server: `Ctrl+C`, then `npm run dev`
3. Try login again
4. Check database

---

## Validation Checklist

After making the fix:

- [ ] Code compiles without errors
- [ ] No TypeScript errors in IDE
- [ ] Dev server starts successfully
- [ ] Can login without errors
- [ ] Database has JWT tokens (not "temp_")
- [ ] Middleware lookup succeeds
- [ ] Protected routes return 200
- [ ] Can access user info after login
- [ ] Can logout successfully
- [ ] Re-login works after logout
- [ ] All unit tests pass

---

## Files Changed

- ✏️ `src/app/api/auth/login/route.ts` (lines 173-188)

**Added:**
- Single atomic session creation
- User agent and IP capture
- Explicit error handling

**Removed:**
- Temporary token creation
- updateSessionToken() call
- Two-phase database writes

---

## Performance Impact

- **Before:** 2 database writes + 1 network call
- **After:** 1 database write (faster & safer)

**Expected improvement:**
- Login ~20% faster
- Fewer database errors
- Better reliability

---

## Production Deployment

1. **Create PR with fix**
2. **Run tests locally** - All must pass
3. **Deploy to staging** - Verify full flow
4. **Monitor login metrics**:
   - Session creation success rate
   - Middleware verification latency
5. **Deploy to production**
6. **Watch error logs** for "Session not found"

---

## Rollback Plan

If something goes wrong:

1. Revert the code change:
   ```bash
   git revert <commit-sha>
   ```

2. Restart server

3. Users will need to log in again (old sessions won't work)

---

## Questions?

Refer to the full audit document:  
📄 `.github/specs/AUTH-BACKEND-AUDIT-QA1.md`

---

**Created:** 2025-01-08  
**Status:** Ready to Fix  
**Estimated Time:** 3 hours
