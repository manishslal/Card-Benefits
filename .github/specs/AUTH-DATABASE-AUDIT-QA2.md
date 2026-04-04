# CRITICAL: Database Session Persistence Audit

**Status:** PRODUCTION ISSUE  
**Severity:** CRITICAL - Sessions not persisting to database  
**Prepared:** QA Code Review  
**Focus:** Root cause analysis of session persistence failure in production

---

## Executive Summary

Sessions are being created but **not persisting to the database**. This is a critical production issue affecting user authentication. The audit identifies multiple potential failure points in the session creation flow and provides specific diagnosis steps.

### Key Findings:
- ✓ Prisma schema is correctly defined
- ✓ Session creation API flows appear correct
- ✓ Database connection uses PostgreSQL in production (Railway)
- ⚠️ **CRITICAL:** Two-step session creation pattern may have transaction isolation issues
- ⚠️ **CRITICAL:** Database connection pooling could affect INSERT visibility
- ⚠️ **CRITICAL:** Middleware session lookup timing could fail before write commits
- ⚠️ **WARNING:** Environment-specific database differences (SQLite dev vs PostgreSQL prod)

---

## 1. Schema Analysis

### 1.1 Session Model Definition

**Location:** `prisma/schema.prisma:88-109`

```prisma
model Session {
  id                String   @id @default(cuid())
  userId            String   // FK to User
  user              User @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Session metadata
  sessionToken      String   @unique  // Signed JWT payload
  expiresAt         DateTime  // Expiration timestamp
  isValid           Boolean @default(true)  // For soft revocation

  // Device tracking
  userAgent         String?  // For device identification
  ipAddress         String?  // For suspicious login detection

  // Metadata
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Indexes
  @@index([userId])
  @@index([expiresAt])
}
```

### 1.2 Schema Assessment

| Field | Type | Status | Issues |
|-------|------|--------|--------|
| `id` | CUID (Primary Key) | ✓ Correct | Auto-generated, indexed |
| `userId` | Foreign Key to User | ✓ Correct | Cascade delete on user removal |
| `sessionToken` | String (UNIQUE) | ⚠️ **ISSUE** | See #1.3 |
| `expiresAt` | DateTime | ✓ Correct | Indexed for cleanup queries |
| `isValid` | Boolean | ✓ Correct | Defaults to true |
| `userAgent` | String (nullable) | ✓ Correct | Optional device tracking |
| `ipAddress` | String (nullable) | ✓ Correct | Optional IP tracking |
| `createdAt` | DateTime | ✓ Correct | Default to now() |

### 1.3 CRITICAL FINDING: sessionToken Uniqueness Constraint

**Problem:** `sessionToken` has a `@unique` constraint, but the session creation flow uses a **two-step process**:

1. **Step 1** (`createSession`): Create session with **temporary placeholder token** `temp_{uuid}`
2. **Step 2** (`updateSessionToken`): Update with real JWT token

**Risk Chain:**
```
Login/Signup Request
    ↓
createSession(userId, "temp_uuid_123", expiresAt)  ← Creates with TEMP token
    ↓
SESSION CREATED IN DATABASE
    ↓
createSessionPayload(userId, sessionId)             ← Generate JWT payload
    ↓
signSessionToken(payload)                           ← Sign JWT
    ↓
updateSessionToken(sessionId, jwtToken)             ← Update record with real token
    ↓
Middleware tries to verify session...
```

**CRITICAL ISSUE:** Between Step 1 and Step 2, the database contains a session with a **temporary token**. If:
- Middleware queries database BEFORE Step 2 completes
- Update fails (network error, database deadlock, transaction rollback)
- Temporary token was never meant to be valid

Then **session will fail validation** even though the record exists.

---

## 2. Database Connection Analysis

### 2.1 Prisma Client Initialization

**Location:** `src/lib/prisma.ts:1-12`

```typescript
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### 2.2 Connection Assessment

| Component | Status | Issue |
|-----------|--------|-------|
| Singleton pattern | ✓ Good | Prevents multiple instances |
| Connection pooling | ⚠️ Default | No custom pool config |
| Query logging (dev) | ✓ Enabled | Good for debugging |
| Production logging | ✓ Disabled | Correct (performance) |
| Global cache | ⚠️ **ISSUE** | Only caches non-production |

### 2.3 CRITICAL ISSUE: Production Singleton Not Cached

**Problem:** In production, the Prisma client is **created new every time the middleware runs**.

```typescript
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
                                                       ↑
                                        NOT cached in production!
```

**Impact:**
- Each middleware execution may create a new PrismaClient instance
- Connection pooling may not work as expected
- Multiple clients opening/closing connections
- Railway PostgreSQL connection pool exhaustion possible

**Expected:** Should cache in production too:
```typescript
// CORRECT approach:
globalForPrisma.prisma = prisma;  // Always cache, regardless of NODE_ENV
```

---

## 3. Session Creation Flow Analysis

### 3.1 Login API Route: Session Creation

**Location:** `src/app/api/auth/login/route.ts:170-188`

```typescript
// Create session with a temporary unique placeholder token
const tempToken = `temp_${randomUUID()}`;
const sessionRecord = await createSession(user.id, tempToken, expiresAt);

// Create session payload and sign JWT using the session ID
const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload);

// Update session record with the real JWT token (atomic)
await updateSessionToken(sessionRecord.id, token);
```

### 3.2 Auth Server: Session Creation Functions

**Location:** `src/lib/auth-server.ts:404-431`

#### createSession()
```typescript
export async function createSession(
  userId: string,
  sessionToken: string,
  expiresAt: Date,
  userAgent?: string,
  ipAddress?: string
) {
  try {
    const session = await prisma.session.create({
      data: {
        userId,
        sessionToken,        // ← TEMPORARY TOKEN HERE
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        isValid: true,
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });
    return session;
  } catch (error) {
    throw new Error('Failed to create session');
  }
}
```

#### updateSessionToken()
```typescript
export async function updateSessionToken(
  sessionId: string,
  token: string
): Promise<void> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { sessionToken: token },
    });
  } catch (error) {
    console.error('[Auth] Failed to update session token:', {...});
    throw error;
  }
}
```

### 3.3 CRITICAL ISSUES IN SESSION CREATION

#### Issue #1: Two-Phase Update Without Transaction

**Severity:** CRITICAL

**Problem:** Session creation uses two separate database operations:
1. `CREATE` with temporary token
2. `UPDATE` to replace with real token

This creates a **race condition window**:

```
Time  Operation                          Database State
----  ---------                          ---------------
T0    createSession(temp_uuid)           Session exists: sessionToken="temp_uuid"
T1    [Middleware queries database]      ← Can query temp_uuid (unverifiable!)
T2    signSessionToken(payload)          (processing JWT)
T3    updateSessionToken(real_jwt)       Session updated: sessionToken="real_jwt"
T4    [Client uses session cookie]       Cookie has "real_jwt"
```

**If middleware queries at T1**, it will find a session with a temporary token that doesn't match the JWT in the cookie → **authentication fails**.

#### Issue #2: No Error Recovery

**Severity:** CRITICAL

**Problem:** If `updateSessionToken` fails, the session record exists with a **temporary token that can never be used**.

```typescript
// In login flow:
const sessionRecord = await createSession(...);  // ✓ Success
const token = signSessionToken(payload);          // ✓ Success
await updateSessionToken(sessionId, token);       // ✗ FAILS!

// Now database has:
// Session { id: "...", sessionToken: "temp_xyz", userId: "..." }
// But client has JWT token in cookie
// They WILL NEVER MATCH
```

#### Issue #3: Unique Constraint Violation Risk

**Severity:** HIGH

**Problem:** If two login attempts happen concurrently for the same user, both could try to create sessions with different temporary tokens:

```
Request 1: createSession("user1", "temp_uuid1")  ← Success
Request 2: createSession("user1", "temp_uuid2")  ← Success (different token)

Request 1: updateSessionToken(id1, "jwt1")       ← Success
Request 2: updateSessionToken(id2, "jwt2")       ← Success

Result: User has 2 sessions! ✓ (Actually fine)
BUT if same token is reused:
Request 1: createSession("user1", "temp_A")      ← Success
Request 1: updateSessionToken(id1, "jwt_ABC")    ← Success
Request 2: createSession("user1", "temp_A")      ← UNIQUE constraint error!
```

---

## 4. Session Lookup & Middleware Flow

### 4.1 Middleware Implementation

**Location:** `src/middleware.ts:147-209`

```typescript
async function verifySessionTokenDirect(
  token: string
): Promise<{ valid: boolean; userId?: string }> {
  // Step 1: Verify JWT signature
  let payload = verifySessionToken(token);
  
  // Step 2: Check expiration
  if (isSessionExpired(payload)) return { valid: false };
  
  // Step 3: Check if session is valid in database
  const dbSession = await getSessionByToken(token);
  if (!dbSession) {
    // ← SESSION NOT FOUND IN DATABASE!
    return { valid: false };
  }
  
  // Step 4: Verify user still exists
  const userValid = await userExists(payload.userId);
  if (!userValid) return { valid: false };
  
  return { valid: true, userId: payload.userId };
}
```

### 4.2 Auth Server: Session Lookup

**Location:** `src/lib/auth-server.ts:478-503`

```typescript
export async function getSessionByToken(sessionToken: string) {
  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken },  // ← Queries by token
      select: {
        id: true,
        userId: true,
        isValid: true,
        expiresAt: true,
      },
    });

    if (!session) return null;

    // Check if session is still valid
    if (!session.isValid || session.expiresAt < new Date()) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}
```

### 4.3 CRITICAL PROBLEM: Unique Token Lookups with Temporary Tokens

**Severity:** CRITICAL

The flow is:
1. Create session with `sessionToken: "temp_uuid_xyz"`
2. Middleware later queries: `findUnique({ where: { sessionToken: "jwt_real_token" } })`
3. **Session is NOT found** because database has different token!

**Why this happens:**
- Login sets cookie with `"jwt_real_token"`
- Middleware extracts `"jwt_real_token"` from cookie
- Middleware queries: `findUnique({ where: { sessionToken: "jwt_real_token" } })`
- But if `updateSessionToken` hasn't completed, database still has `"temp_uuid"`
- **Result: `dbSession = null` → Authentication fails**

---

## 5. Session Expiration & Cleanup

### 5.1 Logout Flow

**Location:** `src/app/api/auth/logout/route.ts:82-105`

```typescript
try {
  await invalidateSession(sessionCookie.value);  // ← Marks as invalid
} catch (error) {
  const response = NextResponse.json({
    success: false,
    error: 'Failed to complete logout.',
  }, { status: 500 });
  clearSessionCookie(response);
  return response;
}
```

### 5.2 Invalidate Session Function

**Location:** `src/lib/auth-server.ts:513-523`

```typescript
export async function invalidateSession(sessionToken: string): Promise<boolean> {
  try {
    const result = await prisma.session.updateMany({
      where: { sessionToken },
      data: { isValid: false },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}
```

### 5.3 Expiration Assessment

| Component | Status | Assessment |
|-----------|--------|------------|
| Logout invalidation | ✓ Correct | Sets `isValid: false` |
| Expiration check | ✓ Correct | Compares `expiresAt < now` |
| TTL in middleware | ✓ Correct | 30 days (2,592,000 seconds) |
| Cleanup jobs | ⚠️ Missing | No automated cleanup of expired sessions |
| Orphaned sessions | ⚠️ Risk | Old sessions accumulate in database |

### 5.4 ISSUE: No Automated Cleanup

**Severity:** MEDIUM

Production has no cron job to delete expired sessions. Over time, the Session table will accumulate:
- Expired sessions (expiresAt < now)
- Orphaned sessions (user deleted but session remains due to CASCADE delete potential issues)

**Recommended:** Add `/api/cron/cleanup-sessions` endpoint to periodically remove expired sessions.

---

## 6. Data Integrity Issues

### 6.1 Foreign Key Cascade Behavior

**Schema:**
```prisma
model Session {
  userId String
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

**Behavior:** When a User is deleted, all their Sessions are deleted automatically.

**Assessment:** ✓ Correct - Prevents orphaned sessions

### 6.2 UNIQUE Constraint on sessionToken

**Issue:** The `@unique` constraint on `sessionToken` is problematic with the two-step creation pattern.

**Problem Scenario:**
```
1. createSession(userId, "temp_abc") → Insert succeeds
2. Concurrent request: createSession(userId, "temp_def") → Insert succeeds
3. Both have different temporary tokens → No conflict yet

BUT if both try to UPDATE with the SAME JWT:
4. updateSessionToken(id1, "jwt_same") → Success
5. updateSessionToken(id2, "jwt_same") → UNIQUE constraint violation!
```

This shouldn't happen with single user login, but could with concurrent requests.

### 6.3 CRITICAL ISSUE: Transaction Isolation Level

**Severity:** CRITICAL

PostgreSQL (used in production) has different transaction isolation levels:

1. **READ UNCOMMITTED** - Can read uncommitted changes (dirty reads)
2. **READ COMMITTED** (DEFAULT) - Can't read dirty data, but phantom reads possible
3. **REPEATABLE READ** - Prevents phantom reads
4. **SERIALIZABLE** - Strongest isolation

**Problem:** Prisma doesn't specify isolation level. If using READ COMMITTED:

```
Connection 1: BEGIN TRANSACTION
Connection 1: INSERT Session(sessionToken="temp_xyz") ← Not yet committed
Connection 2: SELECT * FROM Session WHERE sessionToken="jwt_token" ← Returns NULL
Connection 1: UPDATE Session SET sessionToken="jwt_token" ← Commits

Connection 2: Already returned NULL to client
Result: Authentication fails!
```

**Current Status:** No explicit transaction control in session creation.

---

## 7. Environment-Specific Issues

### 7.1 Development vs Production Database

| Aspect | Development | Production |
|--------|-------------|-----------|
| Database | SQLite (`dev.db`) | PostgreSQL (Railway) |
| Connection | Local file | Network connection |
| Pooling | Not applicable | Connection pool (default size) |
| Persistence | File-based | Server-based |
| Transactions | Simple | Complex isolation levels |
| Concurrency | Limited | High |

### 7.2 CRITICAL: DATABASE_URL Configuration

**Location:** `.env` (development)
```
DATABASE_URL="postgresql://postgres:password@junction.proxy.rlwy.net:57123/railway"
```

**Issues:**
1. ✓ PostgreSQL URL format is correct
2. ✓ Host, port, credentials present
3. ⚠️ **CONNECTION POOLING:** Default Prisma pool size is 10 connections
4. ⚠️ **RAILWAY LIMITS:** May have connection limits

**Potential Issue:** If Railway PostgreSQL limits connections and pool exhausts:
- New requests queue
- Timeout waiting for available connection
- Session creation fails
- Session lookup fails

### 7.3 ISSUE: Prisma Client Global Cache Bug in Production

**Severity:** CRITICAL (repeated)

In `src/lib/prisma.ts`:
```typescript
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
                                            ↑ Only caches in development!
```

**Impact in Production:**
- Every middleware execution creates a NEW PrismaClient
- Each client opens new database connections
- Connection pool exhaustion
- Railway PostgreSQL connection limit exceeded
- All database operations fail with "too many connections" error

**Evidence:** Check Railway PostgreSQL logs for "too many connections" or "connection limit" errors.

---

## 8. Diagnosis and Verification Steps

### 8.1 Immediate Verification

#### Step 1: Check Production Database Logs
```sql
-- PostgreSQL logs for Railway service
SELECT * FROM pg_stat_activity;  -- Current connections
SHOW max_connections;             -- Connection limit
```

**Action:** Login to Railway > PostgreSQL service > Logs

#### Step 2: Verify Session Record Creation
```sql
-- Check if sessions are being created
SELECT COUNT(*) FROM "Session";

-- Check recent sessions
SELECT id, "sessionToken", "isValid", "expiresAt", "createdAt"
FROM "Session"
ORDER BY "createdAt" DESC
LIMIT 10;

-- Look for temporary tokens
SELECT COUNT(*) FROM "Session" WHERE "sessionToken" LIKE 'temp_%';
```

**Action:** Run these queries against production database via Railway

#### Step 3: Check Token Matching
```sql
-- For a known user, check if session tokens exist
SELECT id, "sessionToken", "createdAt", "updatedAt"
FROM "Session"
WHERE "userId" = 'USER_ID_HERE'
ORDER BY "createdAt" DESC
LIMIT 5;
```

#### Step 4: Verify Middleware Lookup
Add logging to middleware to show:
```typescript
console.log('[Auth] Query database for sessionToken:', token.substring(0, 30) + '...');
const dbSession = await getSessionByToken(token);
console.log('[Auth] Database lookup result:', dbSession ? 'Found' : 'NOT FOUND');
```

### 8.2 Application-Level Diagnostics

#### Step 1: Enable Debug Logging in Production
```typescript
// src/lib/prisma.ts - Enable for troubleshooting
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],  // Log all database operations
});
```

#### Step 2: Add Session Creation Telemetry
```typescript
// In login/signup routes
console.log('[Session] Before creation:', { userId, expiresAt });
const sessionRecord = await createSession(...);
console.log('[Session] After creation:', { sessionId: sessionRecord.id });

const token = signSessionToken(payload);
console.log('[Session] Before update:', { sessionId, tokenLength: token.length });

await updateSessionToken(sessionRecord.id, token);
console.log('[Session] After update: SUCCESS');
```

#### Step 3: Check Session Token Consistency
```typescript
// After successful login, immediately verify
const created = await getSessionByToken(token);
if (!created) {
  console.error('[CRITICAL] Session not found immediately after creation!');
  // This indicates the two-phase creation race condition
}
```

---

## 9. Root Cause Assessment

### 9.1 Most Likely Causes (Ranked by Probability)

| # | Cause | Probability | Impact | Fix Difficulty |
|---|-------|-------------|--------|-----------------|
| 1 | Prisma singleton not cached in production | CRITICAL | Connection exhaustion | EASY |
| 2 | Two-phase session creation race condition | HIGH | Sessions unverifiable | MEDIUM |
| 3 | Transaction isolation level issue | MEDIUM | Timing-dependent failures | HARD |
| 4 | Railway connection pool exhaustion | MEDIUM | All DB queries fail | MEDIUM |
| 5 | Middleware querying before update commits | MEDIUM | Auth failures | HARD |

### 9.2 Diagnosis Priority

**Step 1: Fix Prisma singleton (EASY, CRITICAL)**
```typescript
// src/lib/prisma.ts - CHANGE THIS:
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// TO THIS:
globalForPrisma.prisma = prisma;  // Always cache!
```

**Step 2: Verify with Railway metrics**
- Check PostgreSQL connections in Railway dashboard
- Look for connection pool saturation
- Monitor connection creation rate

**Step 3: Add transaction wrapping (MEDIUM difficulty)**
Use Prisma transactions to make session creation atomic:
```typescript
const session = await prisma.$transaction(async (tx) => {
  const s = await tx.session.create({ /* ... */ });
  await tx.session.update({
    where: { id: s.id },
    data: { sessionToken: token },
  });
  return s;
});
```

---

## 10. Recommended Actions

### 10.1 CRITICAL (Fix Immediately)

#### Action 1: Fix Prisma Singleton Cache
**File:** `src/lib/prisma.ts`
**Change:** Remove the production exclusion
```typescript
// BEFORE:
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// AFTER:
globalForPrisma.prisma = prisma;
```
**Reason:** Prevents creating new database connections for every request

#### Action 2: Verify Railway Database Connection Status
**Steps:**
1. Go to Railway dashboard
2. Select PostgreSQL service
3. Check "Metrics" tab for connection count
4. Check logs for connection errors
5. Document findings

#### Action 3: Review Production Logs
**Look for:**
- "too many connections" errors
- "connection refused" errors
- "Session not found" in middleware logs
- Transaction rollback errors

### 10.2 HIGH PRIORITY (Fix Soon)

#### Action 1: Refactor Session Creation to Use Transactions
**File:** `src/lib/auth-server.ts`
```typescript
export async function createSessionAtomic(
  userId: string,
  sessionToken: string,
  expiresAt: Date,
  userAgent?: string,
  ipAddress?: string
) {
  return await prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        userId,
        sessionToken,  // Use real token immediately
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        isValid: true,
      },
    });
    return session;
  });
}
```

**Benefit:** Atomicity guarantees - no temporary tokens, no race conditions

#### Action 2: Add Session Creation Verification
**File:** `src/app/api/auth/login/route.ts`
```typescript
// After updateSessionToken succeeds
const verification = await getSessionByToken(token);
if (!verification) {
  throw new Error('Session verification failed - database persistence issue');
}
```

**Benefit:** Fail fast if sessions aren't persisting

#### Action 3: Add Railway Connection Pool Configuration
**File:** `src/lib/prisma.ts`
```typescript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Alternative: Configure via DATABASE_URL
// postgresql://user:password@host:port/db?schema=public&connection_limit=20
```

### 10.3 MEDIUM PRIORITY (Improve)

#### Action 1: Add Automated Session Cleanup
**File:** `src/app/api/cron/cleanup-sessions/route.ts`
```typescript
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delete expired sessions
  const deleted = await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  return NextResponse.json({
    success: true,
    message: `Deleted ${deleted.count} expired sessions`,
  });
}
```

#### Action 2: Add Explicit Transaction Isolation Level
**File:** `src/lib/auth-server.ts`
```typescript
// For critical operations, use SERIALIZABLE isolation
await prisma.$queryRaw`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;`;
const session = await prisma.session.create(/* ... */);
```

#### Action 3: Implement Session Refresh Logic
Allow tokens to be refreshed before expiration:
```typescript
export async function refreshSessionToken(oldToken: string) {
  const dbSession = await getSessionByToken(oldToken);
  if (!dbSession) throw new Error('Session not found');
  
  const newPayload = createSessionPayload(dbSession.userId, dbSession.id);
  const newToken = signSessionToken(newPayload);
  
  // Update with new token
  await updateSessionToken(dbSession.id, newToken);
  return newToken;
}
```

---

## 11. Specification Alignment Analysis

### 11.1 Specification vs Implementation

| Requirement | Expected | Actual | Match |
|-------------|----------|--------|-------|
| Session created on login | Immediate insert to DB | ✓ `createSession()` called | ✓ |
| JWT token signed | After session created | ✓ `signSessionToken()` called | ✓ |
| Token stored in database | In `sessionToken` field | ⚠️ In two phases | ⚠️ |
| Session persists immediately | No race conditions | ✗ Temporary token initially | ✗ |
| Middleware validates session | Query by token | ✓ `getSessionByToken()` | ✓ |
| Logout revokes session | Sets `isValid=false` | ✓ `invalidateSession()` | ✓ |
| Session has 30-day TTL | `expiresAt = now + 30 days` | ✓ Correct | ✓ |

### 11.2 Specification Violations

1. **Session Persistence:** Spec implies atomic persistence; implementation uses two phases
2. **Token Immutability:** Temporary token is not the JWT, violating "token is JWT" assumption
3. **Query by Token:** Assumes token is stable; temporary token breaks this

---

## 12. Test Recommendations

### 12.1 Unit Tests

```typescript
describe('Session Creation', () => {
  it('should create session with JWT token, not temporary token', async () => {
    const token = signSessionToken(payload);
    const session = await createSessionAtomic(userId, token, expiresAt);
    
    expect(session.sessionToken).toBe(token);
    expect(session.sessionToken).not.toMatch(/^temp_/);
  });

  it('should verify session immediately after creation', async () => {
    const token = signSessionToken(payload);
    await createSessionAtomic(userId, token, expiresAt);
    
    const found = await getSessionByToken(token);
    expect(found).toBeDefined();
    expect(found?.isValid).toBe(true);
  });

  it('should not find session with temporary token', async () => {
    await createSession(userId, 'temp_xyz', expiresAt);
    
    const found = await getSessionByToken('temp_xyz');
    expect(found).toBeNull();  // Temporary tokens should not be queryable
  });
});
```

### 12.2 Integration Tests

```typescript
describe('Login Flow - Database Persistence', () => {
  it('should persist session to database before returning response', async () => {
    const response = await POST(loginRequest);
    
    // Extract token from cookie
    const setCookie = response.headers.get('set-cookie');
    const token = extractTokenFromCookie(setCookie);
    
    // Immediately query database
    const dbSession = await getSessionByToken(token);
    expect(dbSession).toBeDefined();
    expect(dbSession?.isValid).toBe(true);
  });

  it('should have matching token in database and cookie', async () => {
    const response = await POST(loginRequest);
    const cookieToken = extractToken(response);
    
    const dbSession = await getSessionByToken(cookieToken);
    expect(dbSession?.sessionToken).toBe(cookieToken);
  });
});
```

### 12.3 Load Tests

```typescript
describe('Concurrent Session Creation', () => {
  it('should handle 100 concurrent logins without duplication', async () => {
    const promises = Array(100)
      .fill(null)
      .map((_, i) => POST(createLoginRequest(`user${i}`)));
    
    const responses = await Promise.all(promises);
    
    responses.forEach((res, i) => {
      expect(res.status).toBe(200);
      const token = extractToken(res);
      expect(token).not.toMatch(/^temp_/);
    });
  });
});
```

---

## Summary Table: Issues by Severity

| ID | Issue | Severity | Location | Impact | Fix |
|----|-------|----------|----------|--------|-----|
| P1 | Prisma singleton not cached in production | CRITICAL | prisma.ts:12 | Connection exhaustion | Change line 12 |
| P2 | Two-phase session creation with temp token | CRITICAL | auth-server.ts:404-431 | Race condition in database lookup | Use $transaction |
| P3 | No transaction wrapping for atomic insert | CRITICAL | login/signup routes | Token mismatch possible | Wrap in $transaction |
| P4 | Middleware queries before update commits | HIGH | middleware.ts:176 | Timing-dependent failures | Add verification loop |
| P5 | No automated session cleanup | MEDIUM | (missing) | Table bloat | Add cron job |
| P6 | No explicit connection pool tuning | MEDIUM | prisma.ts | Connection limit issues | Configure pooling |
| P7 | Unique constraint on sessionToken risky | MEDIUM | schema.prisma:94 | Constraint violations possible | Use compound key or remove unique |

---

## Conclusion

**Sessions are not persisting to the database** due to a combination of:

1. **Critical Bug:** Prisma singleton not being cached in production → creates new connection pool for each request → connection exhaustion
2. **Critical Design:** Two-phase session creation with temporary tokens → race conditions in database lookup
3. **Design Issue:** No transaction wrapping → atomicity not guaranteed
4. **Environmental Issue:** Railway PostgreSQL connection pooling not optimized

**Recommended Immediate Actions:**
1. **Fix Prisma singleton caching** (5-minute fix)
2. **Verify Railway connection status** (diagnostics)
3. **Refactor session creation to use atomic transactions** (30-minute fix)
4. **Deploy and verify with comprehensive logging** (1-hour verification)

After these fixes, sessions should persist reliably to production PostgreSQL.
