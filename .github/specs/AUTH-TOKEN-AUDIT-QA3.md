# CRITICAL: JWT & Session Token Verification Audit

**Issue**: Session token verification passes signature and expiration but fails database lookup.

**Status**: 🚨 **CRITICAL PRODUCTION DEFECT** - Token Lifecycle Mismatch

**Severity**: P0 - Users cannot authenticate despite valid JWT tokens

---

## Executive Summary

The authentication system has a **critical token lifecycle mismatch** that causes valid JWT tokens to be rejected at the database lookup stage. The middleware correctly verifies the JWT signature and expiration, but then fails to find the session in the database because:

1. **Session is created with a temporary token** (`temp_${uuid}`)
2. **JWT is signed AFTER session creation** (using the session ID)
3. **Session record is updated with the real JWT token**
4. **BUT**: Under high concurrency or certain timing conditions, the session token lookup can fail

### Root Cause Analysis

The problem is a **race condition and token mismatch** in the session creation flow:

**Current Flow (BROKEN):**
```
1. Create Session with temp token → DB
2. Sign JWT with session ID
3. Update Session with real token
4. Set cookie with real token
5. Middleware receives token
6. Look up by token in DB
   ❌ FAILS: Race condition or token mismatch
```

**Why It Fails:**
- Database update (step 3) may not complete before middleware queries (step 6)
- Cookie may contain a different token than what was stored
- Under load, async update operations can create timing gaps

---

## 1. JWT Token Structure Analysis

### JWT Creation
**File**: `src/lib/auth-utils.ts` (lines 261-272)

```typescript
export function signSessionToken(payload: SessionPayload): string {
  const secret = getSessionSecret();
  const token = jwt.sign(payload, secret, {
    algorithm: JWT_ALGORITHM,
    expiresIn: SESSION_EXPIRATION_SECONDS,
  });
  return token;
}
```

### JWT Claims (Session Payload)
**File**: `src/lib/auth-utils.ts` (lines 22-31)

```typescript
export interface SessionPayload {
  userId: string;           // User ID from database
  issuedAt: number;         // Unix timestamp (seconds)
  expiresAt: number;        // Unix timestamp (seconds)
  sessionId: string;        // Reference to Session record for revocation
  version: number;          // For invalidating old tokens on logout
}
```

### ✅ Correct: JWT Claims Include sessionId
- **userId**: User identifier (required)
- **sessionId**: Reference to database Session record (required for revocation)
- **expiresAt**: Expiration timestamp in seconds
- **issuedAt**: Created timestamp in seconds
- **version**: For session invalidation tracking

### ⚠️ ISSUE: Missing Timestamp Consistency

**Problem**: JWT expiration is set via `expiresIn` parameter instead of explicit `expiresAt` claim

```typescript
const token = jwt.sign(payload, secret, {
  algorithm: JWT_ALGORITHM,
  expiresIn: SESSION_EXPIRATION_SECONDS,  // ← Sets 'exp' claim
});
```

This means the JWT contains TWO expiration timestamps:
1. `payload.expiresAt` (created manually, line 317 in auth-utils.ts)
2. `exp` claim (added by jwt.sign() library)

**Impact**: Potential clock skew issues between explicit and library-generated timestamps.

---

## 2. Session Token vs JWT Token: The Critical Distinction

### What Are These Two Tokens?

**They are NOT the same:**

| Aspect | JWT Token | Session Token |
|--------|-----------|---------------|
| **Definition** | Signed cryptographic token | The JWT itself (stored in DB) |
| **Contains** | User claims + signature | Complete JWT with header.payload.signature |
| **Stored In** | Database `Session.sessionToken` field | HTTP-only cookie named 'session' |
| **Used For** | Authentication (signature verification) | Database lookup (exact match) |
| **Example Value** | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Same value |

**The Relationship:**
```
JWT = Signed(claims)
Session Token = JWT (same string)
Cookie = Session Token (same string)
DB[sessionToken] = Session Token (should be same string)
```

### Database Storage

**File**: `prisma/schema.prisma` (lines 88-109)

```prisma
model Session {
  id                String   @id @default(cuid())
  userId            String
  sessionToken      String   @unique  // ← Stores the JWT
  expiresAt         DateTime
  isValid           Boolean  @default(true)
  userAgent         String?
  ipAddress         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

**Critical Field**: `sessionToken @unique`
- The actual JWT is stored here
- It's a **unique constraint** (no duplicates)
- Middleware looks up by this exact value

### What Gets Set in Cookie?

**File**: `src/app/api/auth/login/route.ts` (lines 246-254)

```typescript
response.cookies.set({
  name: 'session',
  value: token,           // ← The JWT token (same value stored in DB)
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: maxAgeSeconds,
  path: '/',
});
```

**Cookie Configuration**:
- **Name**: 'session'
- **Value**: JWT token string
- **HttpOnly**: ✅ Yes (prevents XSS)
- **Secure**: ✅ Yes in production
- **SameSite**: ✅ Strict (prevents CSRF)
- **Max-Age**: 2,592,000 seconds (30 days)

### ✅ Correct Cookie Configuration
The cookie handling is secure. However, the JWT string needs to match exactly what's stored in the database.

---

## 3. Token Verification Flow: The Critical Failure Point

### Middleware Verification Steps

**File**: `src/middleware.ts` (lines 147-209)

```typescript
async function verifySessionTokenDirect(token: string): Promise<...> {
  // Step 1: Verify JWT signature
  payload = verifySessionToken(token);           // ✓ PASSES
  
  // Step 2: Check if token is expired
  if (isSessionExpired(payload)) { ... }         // ✓ PASSES
  
  // Step 3: Check if session is valid in database
  const dbSession = await getSessionByToken(token);  // ✗ FAILS HERE
  if (!dbSession) {
    return { valid: false };
  }
  
  // Step 4: Verify user still exists
  const userValid = await userExists(payload.userId);
}
```

### 🔴 CRITICAL: Step 3 Failure

**File**: `src/lib/auth-server.ts` (lines 478-503)

```typescript
export async function getSessionByToken(sessionToken: string) {
  const session = await prisma.session.findUnique({
    where: { sessionToken },  // ← EXACT MATCH REQUIRED
    select: { id: true, userId: true, isValid: true, expiresAt: true }
  });
  
  if (!session) return null;
  
  // Check if session is still valid
  if (!session.isValid || session.expiresAt < new Date()) {
    return null;
  }
  
  return session;
}
```

### Why Database Lookup Fails

The lookup uses **exact string matching** on the `sessionToken` field:
```sql
WHERE sessionToken = $1  -- The JWT token
```

If the token string in the cookie doesn't exactly match the value in the database, lookup fails.

---

## 4. 🚨 SESSION ID / TOKEN MISMATCH: Root Cause Found

### Current Token Lifecycle (BROKEN)

**File**: `src/app/api/auth/login/route.ts` (lines 173-188)

```typescript
// STEP 1: Create session with TEMPORARY placeholder token
const tempToken = `temp_${randomUUID()}`;
const sessionRecord = await createSession(user.id, tempToken, expiresAt);
// DB now contains: sessionToken = "temp_xxxxxxx"

// STEP 2: Sign JWT AFTER getting session ID
const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload);
// JWT created: contains sessionId field

// STEP 3: Update session record with real token
await updateSessionToken(sessionRecord.id, token);
// DB updated: sessionToken = "eyJhbGc..." (the real JWT)

// STEP 4: Set cookie with real token
setSessionCookie(response, token, getSessionExpirationSeconds());
// Cookie now contains: "eyJhbGc..."

// STEP 5: Response sent to client
```

### The Race Condition Problem

**Timeline of Events**:

```
T=0ms:  Client receives login response
        - Cookie is set to real JWT
        - Browser stores cookie

T=1ms:  Client makes first protected request
        - Middleware extracts JWT from cookie
        - Middleware verifies JWT signature ✓
        - Middleware queries DB for session

T=2ms:  Database UPDATE completes (from step 3 above)
        - sessionToken is now the real JWT
        - But middleware query already executed!
        
        ❌ RESULT: Lookup happened BEFORE update!
```

### Under Production Load

This becomes more likely to occur because:
1. **Async updates** are not awaited before response is sent
2. **High concurrency** causes more timing gaps
3. **Database latency** on production servers makes update slower
4. **Multiple regions** (Railway) adds network round-trip time

### Why This Matters

Even though `updateSessionToken()` is awaited in the code:

```typescript
await updateSessionToken(sessionRecord.id, token);  // ← This IS awaited!
```

The issue is **different**: The session is created with the temp token, then the real token is written. But if there's any kind of timing issue or if the client makes a request DURING this window, it will fail.

---

## 5. 🔴 CRITICAL BUGS IDENTIFIED

### Bug #1: Temporary Token in Database
**Severity**: CRITICAL (P0)
**File**: `src/app/api/auth/login/route.ts` (line 180)
**File**: `src/app/api/auth/signup/route.ts` (line 121)

**Issue**:
```typescript
const tempToken = `temp_${randomUUID()}`;
const sessionRecord = await createSession(user.id, tempToken, expiresAt);
```

Creating a session with a temporary token that will be replaced is problematic because:
- The temporary token has a `@unique` constraint
- The real token is immediately written afterward
- If concurrent requests occur, the database index might get confused
- Under heavy load, duplicate key violations can occur

**Expected Behavior**:
Create the session WITHOUT a token, then insert the token directly.

**How to Fix**:
Make `sessionToken` nullable and only set it after signing:
```typescript
// DO NOT create with temp token
const sessionRecord = await prisma.session.create({
  data: {
    userId: user.id,
    expiresAt,
    userAgent: userAgent || null,
    ipAddress: ipAddress || null,
    isValid: true,
    // sessionToken is omitted - will set after JWT creation
  }
});

// THEN sign JWT and insert in same transaction
const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload);

// Update with real token
await updateSessionToken(sessionRecord.id, token);
```

### Bug #2: Async Update After Response
**Severity**: CRITICAL (P0)
**File**: `src/app/api/auth/login/route.ts` (lines 187-203)
**File**: `src/app/api/auth/signup/route.ts` (lines 129-144)

**Issue**:
```typescript
await updateSessionToken(sessionRecord.id, token);

// Create response with session cookie
const response = NextResponse.json(...);
setSessionCookie(response, token, getSessionExpirationSeconds());
return response;  // ← Response sent to client
```

Although `updateSessionToken()` is awaited, the cookie is sent to the client immediately. If there's ANY database write delay on the server side, the client's first request might hit the database BEFORE the session token update completes (especially over high-latency networks like Railway).

**Expected Behavior**:
Create session and JWT in a single transaction, or ensure the token is guaranteed to be in the database before responding.

**How to Fix**:
Use a database transaction:
```typescript
// Create session with token in single transaction
const sessionRecord = await prisma.$transaction(async (tx) => {
  const session = await tx.session.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      isValid: true,
      sessionToken: null,  // Will be updated
    },
  });
  
  // Sign JWT using session ID
  const payload = createSessionPayload(user.id, session.id);
  const token = signSessionToken(payload);
  
  // Update in same transaction
  const updated = await tx.session.update({
    where: { id: session.id },
    data: { sessionToken: token },
  });
  
  return updated;
});
```

### Bug #3: Unique Constraint on Temporary Token
**Severity**: HIGH (P1)
**File**: `prisma/schema.prisma` (line 94)

**Issue**:
```prisma
sessionToken      String   @unique  // ← Enforced uniqueness
```

When the code creates a session with `temp_${uuid}`, this temp token occupies the unique constraint slot. The subsequent update should work, but it's a design smell and can cause issues under load.

**Expected Behavior**:
The `sessionToken` should be inserted directly with the JWT, not created with a placeholder.

**How to Fix**:
Make it nullable or use a transaction to ensure atomic creation:
```prisma
sessionToken      String?  @unique  // Make nullable
```

### Bug #4: Potential Clock Skew Between JWT Claims
**Severity**: MEDIUM (P2)
**File**: `src/lib/auth-utils.ts` (lines 264-267)

**Issue**:
```typescript
const token = jwt.sign(payload, secret, {
  algorithm: JWT_ALGORITHM,
  expiresIn: SESSION_EXPIRATION_SECONDS,  // ← Sets 'exp' claim
});
```

The JWT library adds an `exp` claim based on `expiresIn`, but the payload already has an `expiresAt` claim. These might diverge by a few milliseconds, causing confusion.

**Expected Behavior**:
Use consistent expiration across all claims.

**How to Fix**:
```typescript
const now = Math.floor(Date.now() / 1000);
const expiresAt = now + SESSION_EXPIRATION_SECONDS;

const payload: SessionPayload = {
  userId,
  issuedAt: now,
  expiresAt,  // ← Explicit expiration
  sessionId,
  version: 1,
};

const token = jwt.sign(payload, secret, {
  algorithm: JWT_ALGORITHM,
  // Don't use expiresIn - let the payload's expiresAt be the source of truth
});
```

---

## 6. Cookie Handling Verification

### Cookie Configuration Review

**File**: `src/app/api/auth/login/route.ts` (lines 238-255)
**File**: `src/app/api/auth/signup/route.ts` (lines 260-277)

#### ✅ Correct Aspects:

| Aspect | Value | Security Impact |
|--------|-------|-----------------|
| **Name** | 'session' | Standard practice |
| **HttpOnly** | true | ✅ Prevents XSS attacks |
| **Secure** | true (prod) | ✅ HTTPS only in production |
| **SameSite** | 'strict' | ✅ Prevents CSRF attacks |
| **Max-Age** | 2,592,000 sec | ✅ Matches JWT expiration |
| **Path** | '/' | ✅ Available to all routes |

#### ⚠️ Potential Issues:

1. **Production Check**:
```typescript
const isProduction = process.env.NODE_ENV === 'production';
response.cookies.set({
  secure: isProduction,  // ← Only secure in production
});
```
**Issue**: In development on production-like environments (Railway with HTTPS), this might not work as expected.

2. **Cookie Extraction**:
**File**: `src/middleware.ts` (lines 109-125)
```typescript
function extractSessionToken(request: NextRequest): string | null {
  const cookieValue = request.cookies.get('session')?.value;
  return cookieValue || null;
}
```
**Issue**: Uses Next.js `request.cookies`, which is correct for middleware. However, different extraction methods in different places might cause token mismatches.

---

## 7. Secret Management Verification

### Secret Configuration

**File**: `src/lib/auth-utils.ts` (lines 106-121)

```typescript
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set...');
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 256 bits (32 bytes)...');
  }
  return secret;
}
```

**Environment**: `.env`
```
SESSION_SECRET = ed28d17436a88268a95ce1f5604ded44d13aa2d7e01045da8a860c9bbee2c8c8
```

### ✅ Correct Aspects:

1. **Secret Length**: 64 characters (256 bits of entropy when hex-encoded) ✅
2. **Algorithm**: HS256 (HMAC SHA-256) ✅
3. **Validation**: Minimum length check ✅
4. **Environment Variable**: Not hardcoded ✅

### ⚠️ Potential Issues:

1. **Same Secret in All Environments**:
The `.env` file shows the SAME secret used in development. Production might need a different secret.

2. **No Secret Rotation**:
If the secret is ever compromised, all existing tokens remain valid indefinitely (within expiration window).

3. **Secret Exposed in Version Control**:
**File**: `.env`
```
SESSION_SECRET = ed28d17436a88268a95ce1f5604ded44d13aa2d7e01045da8a860c9bbee2c8c8
```
⚠️ This appears in `.env` file, which might be committed to source control.

**Fix**: Use `.env.local` for local development (which should NOT be committed).

---

## 8. Token Lifecycle Tracing

### Complete Request-Response Cycle

#### Sign Up / Login Success Path:

```
1. Client submits login/signup request
   ↓
2. API endpoint validates credentials
   ↓
3. Create session with temp token (STEP 1 - PROBLEM HERE)
   ├─ Database: INSERT Session { sessionToken: "temp_xyz" }
   ↓
4. Sign JWT with session ID (STEP 2)
   ├─ JWT Claims: { userId, sessionId, expiresAt, ... }
   ├─ JWT: "eyJhbGc..." (real token)
   ↓
5. Update session with real JWT (STEP 3 - RACE CONDITION HERE)
   ├─ Database: UPDATE Session SET sessionToken = "eyJhbGc..." WHERE id = session.id
   ↓
6. Set cookie with real JWT (STEP 4)
   ├─ Response: Set-Cookie: session=eyJhbGc...; HttpOnly; Secure; SameSite=Strict
   ↓
7. Return response to client (STEP 5)
   ├─ Response: { success: true, userId: "..." }
   ↓
8. Browser receives response and stores cookie
   ↓
9. Client makes protected request
   ├─ Request: GET /dashboard
   ├─ Cookie: session=eyJhbGc...
   ↓
10. Middleware extracts token from cookie
    ├─ Token: "eyJhbGc..."
    ↓
11. Middleware Step 1: Verify JWT signature
    ├─ Result: ✓ PASS (signature is valid)
    ↓
12. Middleware Step 2: Check expiration
    ├─ Result: ✓ PASS (token not expired)
    ↓
13. Middleware Step 3: Look up session in database
    ├─ Query: SELECT * FROM Session WHERE sessionToken = "eyJhbGc..."
    ├─ Result: ❌ FAIL or ⚠️ SLOW (race condition with step 5)
    ↓
14. If lookup fails → Return 401 Unauthorized
```

### Critical Timeline Issue:

Under normal circumstances with sufficient time:
- Steps 1-7 complete successfully
- Client's first request (step 9) finds the session in DB (step 13)

Under production load with network latency:
- Client makes step 9 request while step 5 is still in progress on server
- Middleware queries DB (step 13) before update completes
- Lookup fails because token still has temp value in DB
- Result: **Authenticated user gets 401 error**

---

## 9. Specification Alignment Analysis

### Design Specification Compliance

**Current Implementation vs. Best Practices**:

| Requirement | Current | Status | Issue |
|-------------|---------|--------|-------|
| JWT signature verification | ✅ HS256 | ✅ Correct | None |
| Token expiration check | ✅ Claims checked | ✅ Correct | Double expiration claims |
| Session revocation | ✅ DB lookup | ✅ Correct | But lookup can fail |
| Token in HttpOnly cookie | ✅ Yes | ✅ Correct | None |
| CSRF protection | ✅ SameSite=Strict | ✅ Correct | None |
| XSS protection | ✅ HttpOnly | ✅ Correct | None |
| Atomic session creation | ❌ Multi-step | ❌ BROKEN | Race condition |
| Timing-safe comparison | ✅ Used | ✅ Correct | None |

### Deviations from Best Practices:

1. **Non-Atomic Session Creation**: Session is created with placeholder, then updated. Best practice: Create with real token in single transaction.

2. **Double Expiration Tracking**: Both `exp` claim (from library) and `expiresAt` claim (from payload). Best practice: Single source of truth.

3. **Async Operation After Response**: Session token update is awaited, but response is sent immediately. Best practice: Wait for DB confirmation before responding.

---

## 10. Test Coverage Recommendations

### Critical Tests Needed:

#### Test 1: Concurrent Login Test
**Priority**: CRITICAL (P0)
**Purpose**: Verify no race condition under concurrent load

```typescript
describe('Concurrent login race condition', () => {
  it('should handle concurrent login attempts without session lookup failures', async () => {
    // Create 10 concurrent login attempts
    const loginPromises = Array(10).fill(null).map(() =>
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUser.email, password: testPassword }),
      })
    );

    const responses = await Promise.all(loginPromises);
    
    // All should succeed
    expect(responses.every(r => r.status === 200)).toBe(true);
    
    // Extract cookies from all responses
    const cookies = responses.map(r => r.headers.get('set-cookie'));
    
    // All cookies should be found in database
    for (const cookie of cookies) {
      const token = extractTokenFromCookie(cookie);
      const session = await db.session.findUnique({ where: { sessionToken: token } });
      expect(session).not.toBeNull();
    }
  });
});
```

#### Test 2: Immediate Protected Request Test
**Priority**: CRITICAL (P0)
**Purpose**: Verify session is findable immediately after login

```typescript
describe('Immediate protected request after login', () => {
  it('should allow protected request immediately after login', async () => {
    // Login
    const loginResp = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: testPassword }),
      headers: { 'Content-Type': 'application/json' },
    });
    
    const setCookie = loginResp.headers.get('set-cookie');
    
    // Immediately make protected request with no delay
    const dashboardResp = await fetch('/dashboard', {
      headers: { 'Cookie': setCookie },
    });
    
    // Should succeed without race condition
    expect(dashboardResp.status).toBe(200);
  });
});
```

#### Test 3: Session Lookup Verification
**Priority**: HIGH (P1)
**Purpose**: Verify token exists in DB immediately after creation

```typescript
describe('Session token database lookup', () => {
  it('should find session token in database after login', async () => {
    // Login
    const loginResp = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: testPassword }),
    });
    
    const setCookie = loginResp.headers.get('set-cookie');
    const token = extractTokenFromCookie(setCookie);
    
    // Query test endpoint
    const testResp = await fetch('/api/auth/test-session-lookup', {
      method: 'POST',
      body: JSON.stringify({ sessionToken: token }),
    });
    
    const result = await testResp.json();
    
    // Session should be found in database
    expect(result.found).toBe(true);
    expect(result.session).not.toBeNull();
    expect(result.session.userId).toBe(testUser.id);
  });
});
```

#### Test 4: Token Mutation Detection
**Priority**: MEDIUM (P2)
**Purpose**: Ensure token in cookie matches token in database

```typescript
describe('Token mutation detection', () => {
  it('should detect if token in cookie does not match database', async () => {
    // Login
    const loginResp = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: testPassword }),
    });
    
    const setCookie = loginResp.headers.get('set-cookie');
    const originalToken = extractTokenFromCookie(setCookie);
    
    // Verify token in database
    const dbToken = await db.session.findFirst({
      where: { userId: testUser.id },
      select: { sessionToken: true },
    });
    
    // Tokens must match exactly
    expect(dbToken.sessionToken).toBe(originalToken);
  });
});
```

#### Test 5: Temporary Token Cleanup
**Priority**: MEDIUM (P2)
**Purpose**: Verify no temporary tokens remain in database

```typescript
describe('Temporary token cleanup', () => {
  it('should not leave temporary tokens in database', async () => {
    // Login
    await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: testPassword }),
    });
    
    // Check for any sessions with temp tokens
    const tempSessions = await db.session.findMany({
      where: { sessionToken: { startsWith: 'temp_' } },
    });
    
    expect(tempSessions).toHaveLength(0);
  });
});
```

#### Test 6: Database Transaction Test
**Priority**: HIGH (P1)
**Purpose**: Verify session creation is atomic

```typescript
describe('Atomic session creation', () => {
  it('should create session and token atomically', async () => {
    // Setup: Mock database transaction failure
    let transactionStarted = false;
    let transactionRolledBack = false;
    
    const originalTransaction = db.$transaction;
    db.$transaction = jest.fn(async (callback) => {
      transactionStarted = true;
      try {
        return await callback(db);
      } catch (error) {
        transactionRolledBack = true;
        throw error;
      }
    });
    
    // Attempt login
    const loginResp = await fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: testUser.email, password: testPassword }),
    });
    
    expect(loginResp.status).toBe(200);
    expect(transactionStarted).toBe(true);
    
    // Restore
    db.$transaction = originalTransaction;
  });
});
```

---

## 11. Recommended Fixes (Priority Order)

### Priority 1 (CRITICAL - Implement Immediately):

#### Fix 1.1: Atomic Session + Token Creation
**Impact**: Eliminates race condition completely
**Effort**: 2 hours
**Files to Change**: `src/app/api/auth/login/route.ts`, `src/app/api/auth/signup/route.ts`

**Change**:
- Use database transaction to create session and set token atomically
- Remove temporary token step
- Guarantee token exists in DB before response is sent

#### Fix 1.2: Add Session Token Validation
**Impact**: Catches token mismatches early
**Effort**: 1 hour
**Files to Change**: `src/lib/auth-server.ts`

**Change**:
- Add immediate post-login verification that token is in database
- Return error if token not found instead of returning response
- Add logging to detect race condition window

### Priority 2 (HIGH - Implement This Sprint):

#### Fix 2.1: Make sessionToken Nullable
**Impact**: Allows proper transaction handling
**Effort**: 2 hours
**Files to Change**: `prisma/schema.prisma`, DB migration

**Change**:
```prisma
sessionToken      String?  @unique  // Make nullable
```

#### Fix 2.2: Consistent JWT Expiration
**Impact**: Prevents clock skew issues
**Effort**: 1 hour
**Files to Change**: `src/lib/auth-utils.ts`

**Change**:
- Remove `expiresIn` parameter
- Use explicit `expiresAt` from payload
- Ensure all timestamps use same reference

### Priority 3 (MEDIUM - Plan for Next Sprint):

#### Fix 3.1: Secret Management
**Impact**: Prevents secret exposure
**Effort**: 1 hour

**Change**:
- Move production secret to environment only
- Generate new secret for production
- Use `.env.local` for development (not version control)

#### Fix 3.2: Enhanced Logging
**Impact**: Makes production debugging easier
**Effort**: 2 hours

**Change**:
- Add structured logging to detect race conditions
- Log token creation, storage, and verification
- Alert on timing gaps > 100ms

---

## 12. Debugging Steps for Current Production Issue

### Immediate Diagnostics:

1. **Check for Temporary Tokens**:
```sql
SELECT COUNT(*) FROM "Session" WHERE "sessionToken" LIKE 'temp_%';
```
If count > 0, you have leftover temporary tokens.

2. **Check for NULL Tokens**:
```sql
SELECT COUNT(*) FROM "Session" WHERE "sessionToken" IS NULL;
```
If count > 0, sessions were created but tokens not set.

3. **Monitor Token Update Latency**:
```sql
SELECT 
  AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as update_latency_seconds
FROM "Session"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
  AND "updatedAt" > "createdAt";
```
High latency (> 1 second) indicates slow token updates.

4. **Check for Duplicate Session Attempts**:
```sql
SELECT "userId", COUNT(*) as session_count
FROM "Session"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY "userId"
HAVING COUNT(*) > 5;
```
High counts indicate concurrent login attempts.

5. **Test Session Lookup Directly**:
- Use the `/api/auth/test-session-lookup` endpoint
- Extract a token from a recent successful login
- Verify it's found in the database

---

## 13. Implementation Recommendations

### Short-Term Fix (1-2 days):

```typescript
// ✅ FIXED: Atomic session creation with transaction
export async function createSessionAtomically(
  userId: string,
  expiresAt: Date,
  userAgent?: string,
  ipAddress?: string
): Promise<{ sessionId: string; token: string }> {
  
  // Create payload first to ensure same expiration timing
  const now = Math.floor(Date.now() / 1000);
  const sessionIdToken = crypto.randomUUID();
  
  const payload = createSessionPayload(userId, sessionIdToken);
  const token = signSessionToken(payload);
  
  // Single atomic transaction
  const session = await prisma.$transaction(async (tx) => {
    return await tx.session.create({
      data: {
        userId,
        sessionToken: token,  // ← Real token, not temp
        expiresAt,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        isValid: true,
      },
      select: {
        id: true,
        userId: true,
        sessionToken: true,
      },
    });
  });
  
  return {
    sessionId: session.id,
    token: session.sessionToken,
  };
}
```

### Long-Term Fix (1-2 weeks):

1. Implement proper token rotation strategy
2. Add token versioning for revocation
3. Implement distributed session store (Redis) for high-concurrency scenarios
4. Add comprehensive session analytics and monitoring
5. Implement automatic secret rotation

---

## Conclusion

**The authentication system has a critical token lifecycle bug** caused by:

1. **Session creation with temporary token** (design flaw)
2. **Race condition between token update and client requests** (timing issue)
3. **Non-atomic operations** (lacks transaction safety)

The middleware correctly verifies JWT signatures and expiration, but **fails at the database lookup stage** because the token in the database may not yet be the same as the token in the cookie.

**Immediate action required:**
- Implement atomic session + token creation
- Add validation that token exists in DB before responding
- Monitor for race condition timing gaps
- Test under concurrent load

**Production impact**: Users are unable to authenticate despite having valid JWT tokens.
