# JWT Token Verification Failure - Quick Fix Guide

**Problem**: Middleware passes JWT signature verification but fails database lookup.

**Root Cause**: Race condition between session token update and client requests.

**Impact**: Users cannot authenticate despite valid tokens.

---

## The Core Issue (Visualized)

### What's Happening Now (BROKEN):

```
┌─────────────────────────────────────────────────────────────┐
│ LOGIN ENDPOINT (src/app/api/auth/login/route.ts)            │
├─────────────────────────────────────────────────────────────┤

TIME  OPERATION                     DATABASE STATE
──────────────────────────────────────────────────────────────
T=0   Create Session               Session.sessionToken = "temp_xyz"
      with temp token              ✅ Created

T=1   Sign JWT                     (No DB change)
      "eyJhbGc..."                 ✅ JWT created

T=2   Update Session with          Session.sessionToken = "eyJhbGc..."
      real JWT                     ⏳ UPDATE in progress...

T=3   Send cookie to client        (Client receives response)
      with real JWT                ✅ Response sent
      
T=3.5 ⚠️ UPDATE COMPLETES          Session.sessionToken = "eyJhbGc..."
                                   ✅ UPDATE committed
                                   
T=4   CLIENT'S FIRST REQUEST       
      /dashboard                   
      Cookie: "eyJhbGc..."         
                                   
T=5   MIDDLEWARE QUERIES DB        SELECT * FROM Session 
                                   WHERE sessionToken = "eyJhbGc..."
                                   
      Result: ❓ FOUND or FAILED?
      
      - If T=3 < T=5: ✅ FOUND
      - If T=3 > T=5: ❌ NOT FOUND (race condition!)
```

### The Problem Window:

```
RACE CONDITION WINDOW
═════════════════════════════════════════════════════════════

Server sends response:      Client makes request:
T=3.0ms                     T=3.1ms
(before update completes)   (before DB update completes)

       ┌──────────────────┐
       │ UPDATE in Flight │
       │ (50-200ms over   │
       │  Railway)        │
       └──────────────────┘
       ↓
 Query happens here
 Database doesn't have token yet!
 Result: 401 Unauthorized
```

---

## The Fix (Step-by-Step)

### Fix #1: Atomic Transaction (5-10 minutes)

**File**: `src/app/api/auth/login/route.ts`

**Before** (BROKEN):
```typescript
// Step 1: Create with temp token
const tempToken = `temp_${randomUUID()}`;
const sessionRecord = await createSession(user.id, tempToken, expiresAt);

// Step 2: Sign JWT
const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload);

// Step 3: Update with real token
await updateSessionToken(sessionRecord.id, token);

// Step 4: Send response (race condition!)
setSessionCookie(response, token, getSessionExpirationSeconds());
return response;
```

**After** (FIXED):
```typescript
// Single atomic operation
const expiresAt = new Date(Date.now() + getSessionExpirationSeconds() * 1000);

// Create payload first
const payload = createSessionPayload(user.id, crypto.randomUUID());
const token = signSessionToken(payload);

// Single transaction: create session with real token
const sessionRecord = await prisma.$transaction(async (tx) => {
  return await tx.session.create({
    data: {
      userId: user.id,
      sessionToken: token,  // ← Real JWT, not temp
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      isValid: true,
    },
    select: { id: true, userId: true },
  });
});

// Now we can safely send response - token is guaranteed in DB
setSessionCookie(response, token, getSessionExpirationSeconds());
return response;
```

**Key Changes**:
1. ❌ Remove `temp_${uuid}` step
2. ✅ Sign JWT BEFORE creating session
3. ✅ Create session with real JWT in one transaction
4. ✅ Response only sent AFTER transaction commits

---

### Fix #2: Update Signup Route (5-10 minutes)

**File**: `src/app/api/auth/signup/route.ts`

**Before** (BROKEN):
```typescript
const tempToken = `temp_${randomUUID()}`;
const sessionRecord = await createSession(user.id, tempToken, expiresAt);

const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload);

await updateSessionToken(sessionRecord.id, token);
setSessionCookie(response, token, getSessionExpirationSeconds());
return response;
```

**After** (FIXED):
```typescript
// Create payload first
const payload = createSessionPayload(user.id, crypto.randomUUID());
const token = signSessionToken(payload);

// Single transaction: create session with real token
const sessionRecord = await prisma.$transaction(async (tx) => {
  return await tx.session.create({
    data: {
      userId: user.id,
      sessionToken: token,  // ← Real JWT
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      isValid: true,
    },
    select: { id: true, userId: true },
  });
});

setSessionCookie(response, token, getSessionExpirationSeconds());
return response;
```

---

### Fix #3: Update Prisma Schema (Optional but Recommended)

**File**: `prisma/schema.prisma`

**Before**:
```prisma
sessionToken      String   @unique  // Required, must be unique
```

**After** (More flexible):
```prisma
sessionToken      String?  @unique  // Now optional, but unique when set
```

This allows sessions to be created without a token if needed.

**Then run**:
```bash
npx prisma migrate dev --name make_session_token_nullable
```

---

## Verification Checklist

After applying fixes, verify:

- [ ] No `temp_` sessions in database
```sql
SELECT COUNT(*) FROM "Session" WHERE "sessionToken" LIKE 'temp_%';
-- Should return 0
```

- [ ] All sessions have valid JWT tokens
```sql
SELECT COUNT(*) FROM "Session" WHERE "sessionToken" IS NULL;
-- Should return 0
```

- [ ] Login immediately finds session in DB
```bash
curl -X POST http://localhost:3000/api/auth/test-session-lookup \
  -H "Content-Type: application/json" \
  -d '{"sessionToken": "<your-token-here>"}'
# Should return: { "found": true, "session": {...} }
```

- [ ] Protected routes work immediately after login
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"..."}' \
  | jq -r '.token')

# Immediately access protected route
curl -H "Cookie: session=$TOKEN" http://localhost:3000/dashboard
# Should return 200, not 401
```

---

## Testing Under Load

### Test 1: Concurrent Logins

```bash
#!/bin/bash
# test-concurrent-logins.sh

for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email":"user'$i'@example.com",
      "password":"TestPassword123!"
    }' \
    -w "\nStatus: %{http_code}\n" &
done

wait
echo "All concurrent logins completed"
```

### Test 2: Immediate Protected Request

```javascript
// test-immediate-request.js
const fetch = require('node-fetch');

async function testImmediateRequest() {
  // Login
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'TestPassword123!'
    })
  });
  
  const setCookie = loginRes.headers.get('set-cookie');
  console.log('Login response:', loginRes.status);
  
  // Immediately (no delay) access protected route
  const dashboardRes = await fetch('http://localhost:3000/dashboard', {
    headers: { 'Cookie': setCookie }
  });
  
  console.log('Dashboard response:', dashboardRes.status);
  
  if (dashboardRes.status === 200) {
    console.log('✅ PASS: Immediate request succeeded');
  } else {
    console.log('❌ FAIL: Immediate request failed');
  }
}

testImmediateRequest();
```

---

## Rollback Plan

If issues occur after deploying the fix:

1. **Revert the code**:
```bash
git revert <commit-hash>
git push
```

2. **Redeploy**:
```bash
npm run build
npm run deploy
```

3. **Check for orphaned sessions**:
```sql
-- Clean up any malformed sessions
DELETE FROM "Session" WHERE "sessionToken" LIKE 'temp_%';
```

---

## Monitoring & Alerts

Add these to your monitoring:

### 1. Temporary Token Detection

```sql
-- Alert if any temp tokens exist
SELECT COUNT(*) as orphaned_count 
FROM "Session" 
WHERE "sessionToken" LIKE 'temp_%' 
  AND "createdAt" > NOW() - INTERVAL '5 minutes';

-- If orphaned_count > 0: 🚨 ALERT
```

### 2. Token Update Latency

```sql
-- Monitor how long token updates take
SELECT 
  AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as avg_latency_ms,
  MAX(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as max_latency_ms,
  COUNT(*) as total_sessions
FROM "Session"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
  AND "updatedAt" > "createdAt" + INTERVAL '1 second';

-- If max_latency_ms > 1000: ⚠️ WARNING
```

### 3. Failed Session Lookups

```typescript
// In middleware.ts - add this monitoring
if (!dbSession) {
  console.error('[AUTH] Session lookup failed', {
    tokenPrefix: token.substring(0, 20),
    timestamp: new Date().toISOString(),
    severity: 'CRITICAL',
  });
  
  // Send alert to monitoring service
  await alertMonitoring({
    service: 'auth-middleware',
    event: 'session-lookup-failed',
    userId: payload.userId,  // From JWT
  });
}
```

---

## Summary

**Current Problem**: Race condition between token storage and verification

**Root Cause**: Multi-step session creation with temporary token

**The Fix**: Atomic transaction with real token

**Time to Implement**: 30 minutes

**Deployment Risk**: Low (no breaking changes, fixes existing bugs)

**Testing**: Verify with concurrent login tests and immediate protected requests

---

## Questions?

If middleware is still failing after these fixes:

1. Check database logs for slow queries
2. Monitor network latency to database
3. Add detailed logging to middleware (see monitoring section)
4. Check if `SESSION_SECRET` is set correctly
5. Verify token format is valid JWT (use jwt.io to decode)

**Emergency hotline**: If production is down, temporarily disable JWT verification and use session ID only (less secure but faster fix).
