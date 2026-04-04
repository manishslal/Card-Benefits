# Session Token Race Condition Fix - Technical Specification

**Severity:** CRITICAL 🔴  
**Status:** SPECIFICATION  
**Created:** 2024  
**Affected Components:** Authentication System (Login, Signup, Middleware)  
**Files to Modify:** 4 core files + 2 test files  

---

## Executive Summary & Goals

The authentication system has a **TOCTOU (Time-Of-Check-Time-Of-Use) race condition** where session tokens can mismatch between the client's cookie and the database record. This occurs during login/signup when a temporary token is created and later replaced with a JWT. If a client makes an authenticated request immediately after login, the middleware fails to find the session because the database update hasn't completed yet.

**Root Cause:**  
Session creation and JWT token update are two separate database operations. Between these operations, there's a window where a race condition can occur:
- Client receives JWT in cookie (from Step 4)
- Middleware tries to lookup session by JWT (Step 6)
- But database still has tempToken from Step 1! (Step 4 update hasn't completed yet)

### Primary Objectives

1. **Eliminate the race condition** by making session creation atomic with JWT assignment
2. **Prevent tempToken-JWT mismatch** in the database
3. **Ensure middleware never receives "session not found" errors** due to timing
4. **Add comprehensive logging** for production debugging
5. **Handle concurrent login scenarios** safely
6. **Support soft session revocation** without breaking authentication

### Success Criteria

- ✓ Login and signup complete atomically with JWT in database before response sent
- ✓ No "session token not found" errors in middleware (step 3 failures)
- ✓ All concurrent login scenarios tested and documented
- ✓ Database consistency guaranteed via Prisma transactions
- ✓ Detailed audit logging for all session operations
- ✓ Zero regression in existing authentication flows
- ✓ Session revocation (logout) still works correctly
- ✓ Performance impact minimal (sub-5ms per operation)

---

## Problem Statement & Root Cause Analysis

### The Race Condition: Timeline View

```
TIMELINE: Problematic Flow with Concurrent Requests

T0.0ms: Login Request arrives
  ├─ T0.1ms: Validate credentials ✓
  ├─ T0.2ms: CREATE session with tempToken="temp_abc123"
  │          Session in DB: { id: "sess_1", sessionToken: "temp_abc123" }
  │
  ├─ T0.3ms: Create JWT payload
  ├─ T0.4ms: Sign JWT token = "eyJhbGc.eyJ..."
  │
  ├─ T0.5ms: [RACE WINDOW OPENS]
  │          Response being built, but update not yet sent to DB
  │
  ├─ T0.6ms: UPDATE session: sessionToken="eyJhbGc.eyJ..."
  │          DB UPDATE QUERY SENT
  │
  ├─ T0.7ms: Set cookie in response with JWT
  ├─ T0.8ms: Send response to client
  │          Cookie: session=eyJhbGc.eyJ...
  │
  └─ T0.9ms: Client receives response

T1.0ms: [IMMEDIATELY] Browser makes authenticated request
  ├─ Request sent with Cookie: session=eyJhbGc.eyJ...
  │
  └─ T1.2ms: Middleware Step 3 tries to lookup:
             SELECT * FROM session WHERE sessionToken = "eyJhbGc.eyJ..."
             
             BUT IF DB UPDATE HASN'T COMMITTED YET (T0.6-T0.8 slow):
             Session still has sessionToken = "temp_abc123"
             LOOKUP RETURNS: NULL ❌
             
             Result: "[Auth] ✗ Step 3 failed: Session not found in database"
             Authentication FAILS even though user is logged in!
```

### Code References: Exact Locations of Race Condition

#### **Phase 1: Create with Temp Token** (`src/app/api/auth/login/route.ts:180-181`)
```typescript
const sessionRecord = await createSession(
  user.id,
  `temp_${randomUUID()}`, // ← TEMPORARY TOKEN HERE
  expiresAt
);
```

**File:** `src/app/api/auth/login/route.ts`  
**Lines:** 180-181  
**Issue:** Session created with non-JWT token; must be updated later

#### **Phase 2: Sign JWT** (`src/app/api/auth/login/route.ts:184-185`)
```typescript
const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload); // ← JWT CREATED IN MEMORY
```

**File:** `src/app/api/auth/login/route.ts`  
**Lines:** 184-185  
**Issue:** JWT exists only in memory; database still has tempToken

#### **Phase 3: Update DB with JWT** (`src/app/api/auth/login/route.ts:188`)
```typescript
await updateSessionToken(sessionRecord.id, token);
// ← DB WRITE HAPPENS HERE, ASYNC, NOT YET COMMITTED
```

**File:** `src/app/api/auth/login/route.ts`  
**Lines:** 188  
**Issue:** Async write; race condition window between JWT signature and DB commit

#### **Phase 4: Send Response (BEFORE UPDATE COMPLETES)** (`src/app/api/auth/login/route.ts:201`)
```typescript
response.cookies.set('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
});
return NextResponse.json({ success: true, userId: user.id });
```

**File:** `src/app/api/auth/login/route.ts`  
**Lines:** 201  
**Issue:** Cookie sent before DB write commits; client can use JWT before DB has it

#### **Middleware Lookup Fails** (`src/middleware.ts:176`)
```typescript
console.log('[Auth] Step 3: Looking up session in database...');
const dbSession = await getSessionByToken(token);
if (!dbSession) {
  console.error('[Auth] ✗ Step 3 failed: Session not found in database');
  // ← THIS ERROR OCCURS WHEN UPDATE HASN'T COMMITTED YET
  return { valid: false };
}
```

**File:** `src/middleware.ts`  
**Lines:** 176  
**Issue:** If tempToken-to-JWT update hasn't committed, lookup fails

### Why This Is Difficult to Debug

1. **Intermittent:** Only occurs when network latency or DB write times align badly
2. **Environment-dependent:** More likely in low-resource environments or under high load
3. **Concurrent:** Multiple simultaneous logins can trigger the race
4. **Silent failures:** User just sees "authentication failed" with no obvious cause

---

## Solution Architecture

### Solution Overview: Atomic Session Creation

We will use **Prisma transactions** to ensure that session creation and JWT assignment happen atomically—either both succeed together, or both fail together. There's no window where the database can be in an intermediate state.

### Option A: Transaction-Based (RECOMMENDED ⭐)

```
BEFORE (Vulnerable):
────────────────────
1. CREATE session with tempToken
2. Sign JWT
3. UPDATE session with JWT (RACE WINDOW HERE)
4. Send response


AFTER (Safe):
─────────────
1. Generate session ID separately
2. Sign JWT with that ID
3. Use $transaction to CREATE session WITH JWT atomically
4. Send response (guaranteed DB has JWT)
```

**Pseudocode:**
```typescript
// Generate all components first
const sessionId = cuid();
const expiresAt = calculateExpiration();
const payload = createSessionPayload(userId, sessionId);
const token = signSessionToken(payload);

// Execute atomically in transaction
const session = await prisma.$transaction(async (tx) => {
  return await tx.session.create({
    data: {
      id: sessionId,
      userId,
      sessionToken: token,  // ← JWT INSERTED DIRECTLY, NO UPDATE NEEDED
      expiresAt,
      userAgent: ua,
      ipAddress: ip,
    },
  });
});

// Safe to send response now—JWT guaranteed in DB
setSessionCookie(response, token);
return NextResponse.json({ success: true, userId });
```

**Advantages:**
- ✓ Single atomic operation (no race condition)
- ✓ No UPDATE needed (simpler and faster)
- ✓ Clear code intent
- ✓ Easier to test

**Implementation Pattern:**
```typescript
const session = await prisma.$transaction(async (tx) => {
  // Check for concurrent operations if needed
  const existingSession = await tx.session.findFirst({
    where: {
      userId: user.id,
      isValid: true,
      expiresAt: { gt: new Date() },
    },
  });
  
  if (existingSession) {
    // Optional: Invalidate previous session
    await tx.session.update({
      where: { id: existingSession.id },
      data: { isValid: false },
    });
  }

  // Create new session with JWT atomically
  return await tx.session.create({
    data: {
      id: sessionId,
      userId,
      sessionToken: token,
      expiresAt,
      userAgent,
      ipAddress,
    },
  });
});
```

### Option B: Pre-allocation with Immediate Create

An alternative if Option A needs refinement:

```typescript
// 1. Pre-allocate session ID
const sessionId = cuid();

// 2. Create JWT with that ID
const payload = createSessionPayload(userId, sessionId);
const token = signSessionToken(payload);

// 3. Create session WITH the JWT in one call
const session = await prisma.session.create({
  data: {
    id: sessionId,
    userId,
    sessionToken: token,
    expiresAt,
  },
});

// 4. Send response (JWT already in DB)
response.cookies.set('session', token);
```

**Why this works:**
- No UPDATE step
- Create is atomic
- Simple and foolproof

---

## Implementation Phases

### Phase 1: Refactor Session Creation Function (2-3 days)

**Objective:** Modify `createSession()` to accept pre-generated JWT  

**Key Deliverables:**
1. Update `src/lib/auth-server.ts:createSession()` signature
   - Change from: `createSession(userId: string, tempToken: string, expiresAt: Date)`
   - Change to: `createSession(userId: string, sessionToken: string, expiresAt: Date, metadata: {...})`
   - **Note:** `sessionToken` is now the REAL JWT, not a temp token

2. Update login/signup to pre-generate JWT before DB insert

**Acceptance Criteria:**
- ✓ createSession accepts real sessionToken parameter
- ✓ No tempToken logic in function
- ✓ Handles concurrent previous-session invalidation
- ✓ Detailed logging of session creation

---

### Phase 2: Refactor Login Route (1-2 days)

**Objective:** Implement atomic session creation with JWT  

**Key Deliverables:**
1. Modify `src/app/api/auth/login/route.ts`
   - Generate sessionId BEFORE DB operations
   - Sign JWT with that sessionId
   - Pass JWT to createSession (no UPDATE)
   - Add transaction error handling

2. Update error handling for transaction failures
3. Add comprehensive logging

**Acceptance Criteria:**
- ✓ No tempToken created in login flow
- ✓ JWT assigned atomically with session creation
- ✓ Response sent only after transaction succeeds
- ✓ Detailed logs of each step

---

### Phase 3: Refactor Signup Route (1-2 days)

**Objective:** Apply same pattern to signup  

**Key Deliverables:**
1. Modify `src/app/api/auth/signup/route.ts`
   - Match login pattern exactly
   - Generate sessionId first
   - Sign JWT
   - Create session atomically

**Acceptance Criteria:**
- ✓ Signup uses identical session creation pattern
- ✓ No race condition window
- ✓ Proper error handling

---

### Phase 4: Enhanced Middleware Logging (1 day)

**Objective:** Add diagnostics to catch any remaining timing issues  

**Key Deliverables:**
1. Add detailed timing metrics to middleware
2. Log session state at each step
3. Add correlation IDs for tracing

**Acceptance Criteria:**
- ✓ Can trace complete auth flow in logs
- ✓ Timing information available for analysis
- ✓ No performance degradation

---

### Phase 5: Comprehensive Testing (2-3 days)

**Objective:** Test all edge cases and concurrent scenarios  

**Key Deliverables:**
1. Unit tests for createSession (new signature)
2. Integration tests for login flow
3. Race condition tests (concurrent logins)
4. Session invalidation tests
5. Database failure scenario tests

**Acceptance Criteria:**
- ✓ All tests pass
- ✓ Race condition cannot be reproduced
- ✓ Concurrent scenarios handled safely

---

### Phase 6: Deployment & Monitoring (1 day)

**Objective:** Deploy safely with monitoring  

**Key Deliverables:**
1. Staging deployment validation
2. Production rollout plan
3. Monitoring setup for auth errors

**Acceptance Criteria:**
- ✓ Zero increase in auth errors post-deploy
- ✓ Monitoring shows session creation timing

---

## Data Schema / Session Model

### Current Schema (Unchanged)

```prisma
model Session {
  id                String   @id @default(cuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // CRITICAL FIELD: Must contain valid JWT, never tempToken
  sessionToken      String   @unique  // UNIQUE constraint—enforces 1:1 with JWT

  // Metadata
  expiresAt         DateTime
  isValid           Boolean  @default(true)
  userAgent         String?
  ipAddress         String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([expiresAt])
}
```

### Key Schema Properties

| Field | Type | Constraint | Purpose |
|-------|------|-----------|---------|
| `id` | String (CUID) | Primary Key | Unique session identifier |
| `userId` | String | Foreign Key | Links to User |
| `sessionToken` | String | **@unique** | JWT token (searchable, unique) |
| `expiresAt` | DateTime | Indexed | Session lifetime |
| `isValid` | Boolean | Default: true | Soft revocation flag |
| `userAgent` | String (opt) | None | Device fingerprinting |
| `ipAddress` | String (opt) | None | Location tracking |

### Index Strategy

```prisma
// Current indexes (KEEP THESE)
@@index([userId])          // Fast: Find user's sessions
@@index([expiresAt])       // Fast: Find expired sessions for cleanup

// Additional index (CONSIDER)
@@index([isValid, expiresAt])  // Fast: Find valid active sessions
```

### No Schema Changes Needed

The current schema is correct for the fix. We're not changing the schema—we're changing **how we populate it** (JWT goes in on CREATE, not on UPDATE).

---

## User Flows & Workflows

### Flow 1: Normal Login (Happy Path) with Race Condition Fix

```
User Interaction: Click "Login" button
──────────────────────────────────────

Step 1: Frontend Form Submission
   ├─ Validate form locally (email, password)
   ├─ POST /api/auth/login
   └─ { email: "user@example.com", password: "secret123" }

Step 2: Backend Validation
   ├─ Validate request body format ✓
   ├─ Validate email format ✓
   ├─ Check rate limit (not locked out) ✓
   └─ Status: Ready to authenticate

Step 3: Credential Verification
   ├─ Lookup user by email
   ├─ Verify password (Argon2id timing-safe comparison)
   ├─ Password matches ✓
   └─ Status: User authenticated

Step 4: Session Creation [ATOMIC - NEW APPROACH]
   ├─ Generate sessionId = cuid()
   ├─ Calculate expiresAt = now + 30 days
   ├─ Create payload = { userId, sessionId, expiresAt, issuedAt, version }
   ├─ Sign JWT = jwt.sign(payload, secret, { algorithm: 'HS256' })
   │  JWT result: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ..."
   │
   └─ TRANSACTION START: Create session atomically
      ├─ Check for existing valid session (optional: invalidate old)
      ├─ CREATE session record {
      │    id: sessionId,
      │    userId: user.id,
      │    sessionToken: JWT, ← REAL JWT GOES HERE, NO UPDATE
      │    expiresAt: expiresAt,
      │    userAgent: request.headers['user-agent'],
      │    ipAddress: getClientIP(request),
      │    isValid: true,
      │    createdAt: now,
      │  }
      ├─ TRANSACTION COMMIT ✓
      └─ Status: Session in database with JWT

Step 5: Response to Client
   ├─ Set HTTP-only secure cookie
   │  response.cookies.set('session', JWT, {
   │    httpOnly: true,    // ← Prevent XSS access
   │    secure: true,      // ← HTTPS only
   │    sameSite: 'strict', // ← CSRF protection
   │    maxAge: 2592000,   // ← 30 days
   │  })
   ├─ Return JSON response
   │  { success: true, userId: "user_123" }
   └─ Status: Response sent to client

Step 6: Client Receives Response
   ├─ Cookie stored in browser (secure, httpOnly)
   ├─ Redirect to dashboard
   └─ Status: User ready to make authenticated requests

Step 7: First Authenticated Request (NOW SAFE!)
   ├─ Browser makes request with cookie
   │  GET /dashboard
   │  Cookie: session=eyJhbGciOiJIUzI1...
   │
   └─ Middleware verifies (see Flow 2)

Status: ✓ RACE CONDITION ELIMINATED
────────────────────────────────────
Reason: JWT inserted in database BEFORE response sent. No update step.
        Middleware will always find the session.
```

### Flow 2: Middleware Verification (Safe) 

```
Middleware: Protected Route Request
──────────────────────────────────

Step 1: Extract Token from Cookie
   ├─ Check for 'session' cookie in request
   ├─ Token found: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   └─ Token preview logged: "eyJhbGciOiJIUzI1NiIsInR..." (first 30 chars)

Step 2: Verify JWT Signature
   ├─ Decode JWT: jwt.verify(token, secret, { algorithms: ['HS256'] })
   ├─ Signature valid? YES ✓
   ├─ Extract payload: { userId, sessionId, issuedAt, expiresAt, version }
   └─ Status: JWT authentic

Step 3: Check Token Expiration (JWT-level)
   ├─ payload.expiresAt < now? NO ✓
   ├─ Token is NOT expired
   └─ Status: Token still valid

Step 4: Lookup Session in Database [NOW GUARANTEED TO FIND IT!]
   ├─ Query: SELECT * FROM Session
   │          WHERE sessionToken = token (uses @unique index)
   ├─ Result: Session { id, userId, expiresAt, isValid: true, ... } ✓
   │  (FOUND IT! No race condition!)
   └─ Status: Session located in database

Step 5: Verify Session Validity
   ├─ session.expiresAt < now? NO ✓
   ├─ session.isValid == true? YES ✓
   ├─ session.userId == payload.userId? YES ✓ (sanity check)
   └─ Status: Session is valid and active

Step 6: Verify User Exists
   ├─ Query: SELECT id FROM User WHERE id = session.userId
   ├─ Result: User { id, email, ... } ✓
   └─ Status: User account is active

Step 7: Authentication Success
   ├─ Store auth context: { userId, sessionId, user }
   ├─ Add to request locals for route handler
   └─ Continue to route handler

Status: ✓ AUTHENTICATION SUCCESSFUL
────────────────────────────────────
Logs show: ✓ All 6 verification steps passed, authentication successful
```

### Flow 3: Logout (Session Revocation)

```
User Interaction: Click "Logout" button
───────────────────────────────────────

Step 1: POST /api/auth/logout
   ├─ Middleware extracts token
   ├─ Verifies JWT (steps 2-3 of Flow 2)
   └─ Proceeds to route handler

Step 2: Soft Revocation (IMMEDIATE)
   ├─ UPDATE session SET isValid = false WHERE id = session.id
   ├─ Transaction commits
   └─ Effect: Immediate (next request fails at Step 5 of Flow 2)

Step 3: Clear Cookie (Client-side cleanup)
   ├─ response.cookies.delete('session')
   └─ Effect: Browser removes cookie

Step 4: Return Success Response
   └─ { success: true, message: "Logged out" }

Status: ✓ SESSION REVOKED
────────────────────────────────────
Notes: 
  - Soft revocation via isValid flag (reversible if needed)
  - Cookie cleared for complete removal
  - Next request with old token will fail at isValid check
  - Optional: Also delete session record (hard delete) if needed
```

### Flow 4: Concurrent Login Scenario (HANDLED SAFELY)

```
Scenario: User attempts login twice rapidly
─────────────────────────────────────────────

Request A: Login #1                  Request B: Login #2
─────────────────────────────────────────────────────

Generate sessionId_A
Sign JWT_A

                                    Generate sessionId_B
                                    Sign JWT_B

Transaction A: Create session_A ─────┐
with JWT_A                           ├─ ✓ Succeed in any order
                                    │
Transaction B: Create session_B ─────┤
with JWT_B                          └─

Both sessions in DB (same userId):
├─ Session A { id: sessionId_A, userId, sessionToken: JWT_A }
└─ Session B { id: sessionId_B, userId, sessionToken: JWT_B }

Client receives both cookies:
├─ Cookie from Request A: session=JWT_A (may be overwritten)
└─ Cookie from Request B: session=JWT_B (final value)

Result:
├─ JWT_B will authenticate successfully (most recent)
├─ JWT_A also valid (not revoked) — can still use old session
└─ Both valid until expiration

OPTIONAL IMPROVEMENT:
If we want only one active session per user:
└─ In Transaction B, before creating new session:
   └─ UPDATE session SET isValid = false 
      WHERE userId = user.id AND id != sessionId_B
```

### Edge Case Flows

#### Edge Case 1: Database Transaction Fails

```
SCENARIO: Transaction fails (DB error, connection lost)
─────────────────────────────────────────────────────

Flow:
├─ Generate sessionId
├─ Sign JWT
├─ BEGIN TRANSACTION
├─ CREATE session record
├─ ❌ COMMIT fails (e.g., constraint violation, network error)
└─ Transaction ROLLBACK

Response to Client:
├─ No cookie set (transaction failed)
├─ Return HTTP 500
│  { success: false, error: "Session creation failed" }
└─ No partial session in DB

Client Behavior:
├─ Not authenticated (no cookie)
├─ Can retry login immediately
└─ No orphaned sessions

Logging:
├─ [Auth] Transaction failed: <error detail>
├─ [Auth] Session rollback completed
└─ Alert: Monitor for transaction failures
```

#### Edge Case 2: Token Already in Use (Concurrency)

```
SCENARIO: Same JWT signed twice (impossible normally, but paranoid-check)
─────────────────────────────────────────────────────────────────────

Why impossible:
└─ Each JWT has unique { sessionId, issuedAt } in payload
└─ sessionId is cuid() — unique
└─ Different sessionIds → Different JWTs

Safeguard in Transaction:
├─ sessionToken has @unique constraint
├─ If somehow same JWT tried to create twice:
│  ├─ First transaction: ✓ succeeds
│  └─ Second transaction: ❌ fails (unique constraint)
│     └─ Rolls back, no duplicate

Result: Safe by design ✓
```

#### Edge Case 3: Clock Skew (Expiration Mismatches)

```
SCENARIO: Server clocks out of sync between session creation and verification
─────────────────────────────────────────────────────────────────────────────

Setup:
├─ Login server: 2024-01-15 10:00:00 UTC (create session)
├─ Auth server: 2024-01-15 09:55:00 UTC (verify after 5 sec clock skew)
└─ JWT claims: expiresAt = "2024-02-14 10:00:00 UTC"

Token Verification Flow:
├─ Step 2: Verify JWT signature ✓ (no time dependency)
├─ Step 3: Check JWT.expiresAt < now?
│         "2024-02-14 10:00:00" < "2024-01-15 09:55:00"? NO
│         ✓ Token still valid (30 days in future)
├─ Step 4: Lookup in database ✓
├─ Step 5: Check session.expiresAt < now?
│         Same comparison, ✓ still valid
└─ Result: ✓ Authentication succeeds despite clock skew

Mitigation:
├─ Use NTP to keep clocks synchronized
├─ Run time checks on server startup
├─ Add acceptable skew tolerance if needed (e.g., ±5 minutes)
└─ Monitor for clock mismatches in logs
```

---

## API Routes & Contracts

### Route 1: POST /api/auth/login

#### Request

```
POST /api/auth/login HTTP/1.1
Content-Type: application/json
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)

{
  "email": "user@example.com",
  "password": "MySecurePassword123!"
}
```

#### Request Schema Validation

```typescript
interface LoginRequest {
  email: string;      // Required, valid email format, max 255 chars
  password: string;   // Required, min 8 chars, max 128 chars
}

Validation Rules:
├─ email: Must match /^[^\s@]+@[^\s@]+\.[^\s@]+$/
├─ password: Must be non-empty, at least 8 characters
├─ Both fields required (no null/undefined)
└─ Request body max size: 1KB
```

#### Response: Success (200 OK)

```json
{
  "success": true,
  "userId": "user_550e8400e29b41d4a716446655440000",
  "message": "Authentication successful"
}
```

**Headers:**
```
Set-Cookie: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; 
            HttpOnly; 
            Secure; 
            SameSite=Strict; 
            Max-Age=2592000; 
            Path=/
```

#### Response: Client Validation Error (400 Bad Request)

```json
{
  "success": false,
  "error": "Validation failed",
  "fieldErrors": {
    "email": ["Invalid email format"],
    "password": ["Password must be at least 8 characters"]
  }
}
```

#### Response: Invalid Credentials (401 Unauthorized)

```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

**Note:** Generic message to prevent user enumeration attacks

#### Response: Rate Limited (429 Too Many Requests)

```json
{
  "success": false,
  "error": "Too many login attempts. Account locked.",
  "lockedUntil": "2024-01-15T10:15:00Z"
}
```

#### Response: Server Error (500 Internal Server Error)

```json
{
  "success": false,
  "error": "An unexpected error occurred during authentication"
}
```

**Logging (Server):**
```
[Login Error] Unexpected exception: {
  "message": "Connection refused",
  "stack": "...",
  "type": "DatabaseError"
}
```

---

### Route 2: POST /api/auth/signup

#### Request

```
POST /api/auth/signup HTTP/1.1
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Request Schema

```typescript
interface SignupRequest {
  email: string;           // Required, valid email
  password: string;        // Required, must pass strength validation
  firstName?: string;      // Optional, max 100 chars
  lastName?: string;       // Optional, max 100 chars
}

Validation Rules:
├─ email: Valid format, not already registered
├─ password: Min 8 chars, max 128 chars, complexity requirements
│   ├─ At least one uppercase letter
│   ├─ At least one lowercase letter
│   ├─ At least one number
│   └─ At least one special character (!@#$%^&*)
├─ firstName: Optional, max 100 chars
└─ lastName: Optional, max 100 chars
```

#### Response: Success (201 Created)

```json
{
  "success": true,
  "userId": "user_550e8400e29b41d4a716446655440000",
  "message": "Account created and authenticated"
}
```

**Headers:**
```
Set-Cookie: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...; 
            HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/
```

#### Response: Validation Error (400 Bad Request)

```json
{
  "success": false,
  "error": "Validation failed",
  "fieldErrors": {
    "password": ["Password must contain at least one special character"]
  }
}
```

#### Response: Email Already Registered (409 Conflict)

```json
{
  "success": false,
  "error": "Email already registered",
  "fieldErrors": {
    "email": ["An account with this email already exists"]
  }
}
```

#### Response: Server Error (500 Internal Server Error)

```json
{
  "success": false,
  "error": "An unexpected error occurred during account creation"
}
```

---

### Route 3: POST /api/auth/logout

#### Request

```
POST /api/auth/logout HTTP/1.1
Cookie: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response: Success (200 OK)

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Headers:**
```
Set-Cookie: session=; 
            HttpOnly; 
            Secure; 
            SameSite=Strict; 
            Max-Age=0; 
            Path=/
```

#### Response: Not Authenticated (401 Unauthorized)

```json
{
  "success": false,
  "error": "Not authenticated"
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: Race Condition - Concurrent Session Creation

**Description:** User logs in twice simultaneously from different clients (or network duplicate)

```
Scenario:
  T0.0: Request A sends login
  T0.1: Request B sends login (same user, same credentials)
  T0.2: Both pass authentication
  T0.3: Both begin transaction for session creation

Expected Behavior (SAFE):
  ├─ Both transactions execute
  ├─ Session A created with JWT_A: { id: "sess_1", JWT_A }
  ├─ Session B created with JWT_B: { id: "sess_2", JWT_B }
  ├─ Both sessions in database (same userId, different sessionIds)
  ├─ Client receives both cookies
  ├─ Final cookie value: whichever response arrived last
  └─ Both sessions valid until expiration

Handling:
  ├─ ✓ No database constraint violations
  ├─ ✓ No race condition (each session atomic)
  └─ Optional: Invalidate previous session (implement if desired)

Testing:
  └─ Run 10 concurrent login requests for same user
      └─ Verify all 10 sessions created successfully
      └─ Verify all 10 JWTs are valid
      └─ Verify latest cookie works in middleware
```

---

### Edge Case 2: Database Constraint Violation During Transaction

**Description:** Session token already exists (should be impossible, but paranoia)

```
Scenario:
  └─ sessionToken has @unique constraint
  └─ Two transactions try to insert same JWT (impossible in practice)

Expected Behavior:
  ├─ Transaction 1: ✓ succeeds
  ├─ Transaction 2: ❌ fails with unique constraint error
  │  └─ ROLLBACK executed automatically
  │  └─ No partial session created
  ├─ Return HTTP 500 to client
  └─ No authentication

Handling:
  ├─ Catch Prisma error code P2002 (unique constraint)
  ├─ Log detailed error with context
  ├─ Return generic "session creation failed" message
  └─ Alert: This should never happen (investigate if it does)

Testing:
  └─ Mock database to throw unique constraint error
      └─ Verify transaction rolls back
      └─ Verify 500 response sent
      └─ Verify error logged
```

---

### Edge Case 3: JWT Signature Verification Fails at Middleware

**Description:** Corrupted token received by middleware

```
Scenario:
  ├─ Browser cookie modified or corrupted
  ├─ Transmission altered (unlikely with HTTPS)
  ├─ Token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.CORRUPTED..."

Expected Behavior (SAFE):
  ├─ Step 2: jwt.verify() throws error
  ├─ Error caught: "JWT signature is invalid"
  ├─ Authentication fails
  └─ Return unauthenticated response

Handling:
  ├─ Do not lookup database (JWT invalid, pointless)
  ├─ Log error: token preview (first 30 chars)
  ├─ Return 401 Unauthorized
  └─ Suggest re-login

Testing:
  ├─ Create valid JWT, modify signature
  ├─ Create valid JWT, delete payload
  ├─ Create valid JWT, flip one bit
  └─ Verify all three fail at Step 2 (JWT verification)
```

---

### Edge Case 4: Session Expired (Token Valid, Session Old)

**Description:** JWT not expired but session record is old

```
Scenario:
  ├─ JWT created: 2024-01-01 (expiresAt: 2024-02-01)
  ├─ Now: 2024-01-31 (29 days later, JWT still valid)
  ├─ Admin hard-deleted session record (emergency revocation)
  ├─ Middleware lookup: Session NOT FOUND in database

Expected Behavior (SAFE):
  ├─ Step 1-3: ✓ Pass (JWT is valid)
  ├─ Step 4: Database lookup returns NULL
  ├─ Authentication FAILS (session removed)
  └─ Return 401 Unauthorized

Handling:
  ├─ Log: Session not found (could be hard-deleted)
  ├─ This is a valid security scenario (admin revocation)
  └─ User must re-login

Note: Soft revocation preferred (set isValid=false) for auditability
  └─ Allows checking "when was this session revoked?"

Testing:
  ├─ Create valid session
  ├─ Delete session record from database
  ├─ Try to authenticate with JWT
  ├─ Verify Step 4 fails with "session not found"
  └─ Verify 401 response
```

---

### Edge Case 5: User Account Deleted While Session Active

**Description:** Session exists, but user record deleted

```
Scenario:
  ├─ User logged in (valid session)
  ├─ Admin deletes user account
  ├─ User makes authenticated request

Expected Behavior (SAFE):
  ├─ Steps 1-5: ✓ Pass (JWT valid, session valid)
  ├─ Step 6: User lookup fails (user.id not found)
  ├─ Authentication FAILS
  └─ Return 401 Unauthorized

Handling:
  ├─ Session.user relation will be NULL (cascading delete handled by Prisma)
  ├─ Middleware catches: User not found
  ├─ Log: User account deleted during active session
  └─ Return 401

Testing:
  ├─ Create user + session
  ├─ Delete user (cascade deletes session)
  ├─ Verify session gone
  └─ Try to authenticate
      └─ Verify Step 4 fails (session not found)
```

---

### Edge Case 6: Clock Skew - Token Expires Unexpectedly

**Description:** Server clocks not synchronized

```
Scenario:
  ├─ Login server: 2024-01-15 10:00:00 UTC
  ├─ Auth server: 2024-01-15 09:55:00 UTC (5 min behind)
  ├─ JWT expiresAt: 2024-02-14 10:00:00 UTC (30 days from login)
  ├─ Auth server checks: 2024-02-14 10:00:00 < 2024-01-15 09:55:00?
  │  └─ FALSE (still 30 days valid, clock skew doesn't matter)

Expected Behavior:
  └─ ✓ Token authenticates successfully despite clock skew

Handling:
  ├─ NTP synchronization on all servers (critical)
  ├─ Monitor clock skew in logs
  ├─ Alert if skew > 5 minutes
  └─ Acceptable tolerance: ±1 minute (industry standard)

Testing:
  ├─ Mock system time on auth server
  ├─ Set to 5 minutes BEFORE login server
  ├─ Try to authenticate fresh token
  ├─ Verify ✓ succeeds (token still valid)
  ├─ Set to 31 days AFTER token creation
  ├─ Try to authenticate old token
  └─ Verify ✗ fails (token expired)
```

---

### Edge Case 7: Middleware Called Without Cookie

**Description:** Request to protected route without session cookie

```
Scenario:
  ├─ GET /api/protected
  ├─ No Cookie header
  ├─ OR Cookie header exists but no 'session' entry

Expected Behavior (SAFE):
  ├─ Step 1: Token extraction returns null/undefined
  ├─ Log: "Cookie not found"
  ├─ Authentication FAILS
  └─ Return 401 Unauthorized

Handling:
  ├─ Check for null token before processing
  ├─ Return early: 401 Unauthorized
  ├─ No database queries if no token
  └─ Log: No cookie provided

Testing:
  ├─ Request protected route with no cookies
  ├─ Request protected route with unrelated cookie
  ├─ Request protected route with empty session cookie
  └─ Verify all return 401
```

---

### Edge Case 8: Multiple Concurrent Requests from Same User

**Description:** User makes 3 authenticated requests simultaneously

```
Scenario:
  ├─ GET /dashboard (fetch data)
  ├─ POST /api/benefits (submit form)
  ├─ GET /api/user/profile (fetch profile)
  └─ All sent with same session cookie, within 10ms

Expected Behavior (SAFE):
  ├─ Request 1: Middleware validates (queries DB)
  ├─ Request 2: Middleware validates (queries DB)
  ├─ Request 3: Middleware validates (queries DB)
  ├─ All queries use @index([userId]) for fast lookup
  ├─ All queries return same session
  ├─ All requests proceed ✓
  └─ No race conditions

Handling:
  ├─ Database indexes support concurrent reads (normal behavior)
  ├─ No write conflicts (middleware doesn't modify session)
  ├─ Middleware is read-only, safe to parallelize
  └─ No additional error handling needed

Testing:
  ├─ Simulate 10 concurrent requests to protected routes
  ├─ Use same session cookie
  ├─ Verify all succeed
  ├─ Monitor database query count (should be 10 queries)
  └─ Verify timing shows parallel execution
```

---

### Edge Case 9: Logout During Active Requests

**Description:** User logs out while another request is in-flight

```
Scenario:
  ├─ User clicks logout button
  ├─ POST /api/auth/logout (in progress)
  ├─ Meanwhile, GET /api/user/profile (in progress with same session)

Timing:
  ├─ T0.0: /logout request starts
  ├─ T0.1: /profile request starts (same session cookie)
  ├─ T0.2: /logout sets isValid = false, sends response
  ├─ T0.3: /profile middleware checks session
  │  └─ Session.isValid = false (just updated)
  │  └─ Authentication fails
  └─ T0.4: /profile returns 401

Expected Behavior (SAFE):
  ├─ /logout: ✓ completes, session revoked
  ├─ /profile: ✗ fails with 401 (sees revoked session)
  └─ This is correct behavior (revocation is immediate)

Alternative Scenario (Later requests):
  ├─ T0.0: /logout completes, isValid = false
  ├─ T0.5: /profile starts (uses same old cookie)
  ├─ Middleware checks: isValid = false ✗
  ├─ Authentication fails
  └─ User redirected to login ✓

Handling:
  ├─ Soft revocation via isValid flag is immediate
  ├─ Middleware checks isValid on every request
  ├─ No caching of session validity
  └─ Revocation is prompt (next request fails)

Testing:
  ├─ Create session + login
  ├─ Call logout (set isValid = false)
  ├─ Immediately try to authenticate with same token
  ├─ Verify Step 5 fails (isValid check)
  ├─ Verify 401 response
  └─ Verify old token cannot be re-used
```

---

### Edge Case 10: Database Connection Pool Exhausted

**Description:** Too many concurrent requests, connection pool empty

```
Scenario:
  ├─ App receives sudden traffic spike
  ├─ 1000 concurrent requests arrive
  ├─ Database connection pool: max 20 connections
  ├─ Login request #50 waits for available connection

Expected Behavior:
  ├─ Request 1-20: Process immediately
  ├─ Request 21-1000: Queue for available connection
  ├─ After ~500ms: Some connections released, queue drains
  ├─ If wait exceeds timeout (~5000ms): Connection error

Handling:
  ├─ Prisma manages queue automatically
  ├─ Timeout error → HTTP 500 response
  ├─ Logging: "Database connection timeout"
  ├─ Client-side: Retry with exponential backoff
  └─ Infrastructure: Monitor pool usage, increase if needed

Testing:
  ├─ Load test: 500 concurrent login requests
  ├─ Monitor database connection usage
  ├─ Verify requests eventually succeed (queue drains)
  ├─ Verify timeout errors logged
  └─ Verify no session data corruption
```

---

### Edge Case 11: Malicious JWT Token Injection

**Description:** Attacker sends crafted JWT in cookie

```
Scenario:
  ├─ Attacker crafts JWT with different userId
  ├─ Sets userId = "admin_id" in payload
  ├─ Signature signed with attacker's secret (different from server)
  ├─ Sends as cookie to protected route

Expected Behavior (SAFE):
  ├─ Step 2: JWT signature verification fails
  │  └─ Signature computed with attacker's secret ≠ server's secret
  ├─ Error: "JWT signature is invalid"
  ├─ Authentication fails (never reaches Step 4)
  └─ Return 401 Unauthorized

Handling:
  ├─ Server uses secret from getSessionSecret() (environment variable)
  ├─ No way for attacker to compute valid signature without secret
  ├─ JWT algorithm: HS256 (symmetric)
  │  └─ Requires shared secret (only server has it)
  ├─ Cannot forge JWT without the secret
  └─ Log: Signature verification failure (possible attack attempt)

Testing:
  ├─ Create valid JWT (with server secret)
  ├─ Manually modify userId in payload
  ├─ Re-encode (JWT Base64), but original signature invalid
  ├─ Send to protected route
  ├─ Verify Step 2 fails (signature mismatch)
  ├─ Verify 401 response
  └─ Verify no database lookup attempted
```

---

### Edge Case 12: Session Token Format Validation

**Description:** Corrupted or invalid token format

```
Scenario 1: Completely invalid string
  ├─ Cookie value: "this-is-not-a-jwt"
  ├─ Middleware Step 2: jwt.verify() → error
  ├─ Error: "malformed JWT" or "invalid token format"
  ├─ Result: ✓ Caught at Step 2, 401 response

Scenario 2: Truncated JWT
  ├─ Cookie value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ"
  ├─ Middleware Step 2: jwt.verify() → error
  ├─ Error: "invalid token format"
  ├─ Result: ✓ Caught at Step 2, 401 response

Scenario 3: Empty or null token
  ├─ Cookie value: "" or null
  ├─ Middleware Step 1: token == null
  ├─ Check: if (!token) return { valid: false }
  ├─ Result: ✓ Caught at Step 1, 401 response

Handling:
  ├─ jwt.verify() validates format automatically
  ├─ Error handling catches format errors
  └─ Safe by design (no exceptions escape)

Testing:
  ├─ Test with invalid token strings (10+ variations)
  ├─ Test with truncated JWTs
  ├─ Test with empty/null tokens
  ├─ Verify all fail gracefully
  └─ Verify no exception leaks
```

---

## Component Architecture

### System Components Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (BROWSER)                         │
├─────────────────────────────────────────────────────────────┤
│  ├─ Login Form Component                                    │
│  ├─ Protected Route Guards                                  │
│  └─ Cookie Storage (httpOnly, Secure)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ POST /api/auth/login
                       │ GET /api/protected
                       │ (with Cookie header)
                       ↓
┌─────────────────────────────────────────────────────────────┐
│                 NEXT.JS API ROUTES (Edge)                   │
├─────────────────────────────────────────────────────────────┤
│  ├─ POST /api/auth/login  (Entry Point)                    │
│  ├─ POST /api/auth/signup                                  │
│  └─ POST /api/auth/logout                                  │
└──────────┬──────────────────────┬──────────────────────────┘
           │                      │
           ↓                      ↓
┌──────────────────────┐ ┌───────────────────┐
│  MIDDLEWARE          │ │  ROUTE HANDLER    │
│  (Verification)      │ │  (Business Logic) │
├──────────────────────┤ ├───────────────────┤
│ ✓ Extract JWT from   │ │ ✓ Validate input  │
│   cookie             │ │ ✓ Query user DB   │
│ ✓ Verify signature   │ │ ✓ Hash password   │
│ ✓ Check expiration   │ │ ✓ Create session  │
│ ✓ Lookup in DB       │ │   (Transaction)   │
│ ✓ Validate session   │ │ ✓ Sign JWT        │
│ ✓ Check user exists  │ │ ✓ Set cookie      │
└──────────────────────┘ │ ✓ Log events      │
                         └───────┬───────────┘
                                 │
                    ┌────────────┴────────────┐
                    ↓                         ↓
           ┌─────────────────┐      ┌──────────────────┐
           │  AUTH UTILITIES │      │  DATABASE (PRISMA)
           ├─────────────────┤      ├──────────────────┤
           │ ✓ JWT Sign      │      │ ✓ User Model     │
           │ ✓ JWT Verify    │      │ ✓ Session Model  │
           │ ✓ Hash Password │      │ ✓ Transaction    │
           │ ✓ Create Payload│      │ ✓ Queries/Updates│
           │ ✓ Validate      │      │ ✓ Relationships  │
           └─────────────────┘      └──────────────────┘
```

### Component Responsibilities

#### 1. **Login/Signup Route Handler**
- **File:** `src/app/api/auth/login/route.ts` and `signup/route.ts`
- **Responsibility:**
  - Receive and validate request
  - Verify user credentials
  - Generate session ID and JWT
  - Call createSession (atomic transaction)
  - Set secure cookie
  - Return response
- **Dependencies:** auth-utils, auth-server, prisma
- **Error Handling:** Validation, rate limiting, database errors

#### 2. **Middleware (Authentication Verifier)**
- **File:** `src/middleware.ts`
- **Responsibility:**
  - Extract JWT from cookie on protected routes
  - Verify JWT signature
  - Check expiration
  - Lookup session in database
  - Validate session state
  - Set auth context for route handler
- **Dependencies:** auth-utils, auth-server, AsyncLocalStorage
- **Error Handling:** 4-step verification with detailed logging

#### 3. **Auth Utilities Library**
- **File:** `src/lib/auth-utils.ts`
- **Responsibility:**
  - JWT signing/verification
  - Password hashing (Argon2id)
  - Payload creation
  - Email validation
  - Password strength validation
- **Dependencies:** `jsonwebtoken`, `argon2`, custom validators
- **Error Handling:** Cryptographic errors, validation errors

#### 4. **Auth Server Functions**
- **File:** `src/lib/auth-server.ts`
- **Responsibility:**
  - `createSession()` - Create session with JWT (NEW ATOMIC VERSION)
  - `updateSessionToken()` - Update session token (REMOVED after fix)
  - `getSessionByToken()` - Lookup session by JWT
  - `invalidateSession()` - Soft revocation
  - `getSessionByUserId()` - Find user's sessions
  - `cleanupExpiredSessions()` - Cron job
- **Dependencies:** Prisma client
- **Error Handling:** Database errors, not found scenarios

#### 5. **Database (Prisma)**
- **File:** `prisma/schema.prisma`
- **Models:**
  - `User` - Account data
  - `Session` - Session records with JWT
  - `Player` - Player profile (created on signup)
- **Constraints:**
  - Session.sessionToken @unique
  - Session.userId Foreign Key with Cascade Delete
- **Indexes:** userId, expiresAt, (isValid, expiresAt)

### Component Integration Points

```
LOGIN FLOW:
───────────
Request → Route Handler
         ├─ Validate input (Route)
         ├─ Query user (Prisma)
         ├─ Verify password (Auth Utils)
         ├─ Generate JWT (Auth Utils)
         ├─ Create session atomically (Auth Server)
         │  └─ Transaction includes Prisma
         ├─ Set cookie (Route)
         └─ Response (Route)

VERIFICATION FLOW:
──────────────────
Request → Middleware
         ├─ Extract token (Middleware)
         ├─ Verify JWT (Auth Utils)
         ├─ Lookup session (Auth Server via Prisma)
         ├─ Validate session (Middleware)
         ├─ Set auth context (Middleware)
         └─ Route handler (now authenticated)

LOGOUT FLOW:
────────────
Request → Route Handler (with auth)
         ├─ Invalidate session (Auth Server)
         │  └─ SET isValid = false (Prisma)
         ├─ Clear cookie (Route)
         └─ Response (Route)
```

### Component Dependencies Graph

```
Route Handlers (login, signup, logout)
  ├─ depends on → Auth Utils (validation, hashing, JWT)
  ├─ depends on → Auth Server (session operations)
  └─ depends on → Prisma Client (database)

Middleware
  ├─ depends on → Auth Utils (JWT verification)
  ├─ depends on → Auth Server (session lookup)
  └─ depends on → Prisma Client (database)

Auth Server
  ├─ depends on → Prisma Client (database operations)
  └─ depends on → Auth Utils (for logging context)

Auth Utils
  ├─ depends on → jsonwebtoken library
  ├─ depends on → argon2 library
  └─ NO external dependencies (standalone)

Database (Prisma)
  ├─ depends on → Database connection
  └─ NO code dependencies

No circular dependencies ✓
```

### Parallelization Strategy

The following can be developed in parallel after Phase 1:

1. **Phase 2 (Login Route)** - Independent, only needs Phase 1 complete
2. **Phase 3 (Signup Route)** - Independent from Phase 2, only needs Phase 1
3. **Phase 4 (Middleware Logging)** - Independent, only needs Phases 2-3 for testing
4. **Phase 5 (Tests)** - Can start once Phase 3 complete

**NOT parallel:**
- Cannot start Phase 2 until Phase 1 complete (signature dependency)

---

## Implementation Tasks

### Phase 1: Refactor Session Creation Function

#### Task 1.1: Update createSession() Function Signature
- **File:** `src/lib/auth-server.ts`
- **Complexity:** Small
- **Estimated Time:** 2-4 hours
- **Description:** Modify `createSession()` to accept real sessionToken (JWT) instead of tempToken
- **Acceptance Criteria:**
  - ✓ Function signature accepts `sessionToken` parameter
  - ✓ sessionToken is stored directly without UPDATE step
  - ✓ Function handles concurrent session validation (optional: invalidate old sessions)
  - ✓ Comprehensive logging added
  - ✓ TypeScript types correct
  - ✓ No breaking changes to error handling
- **Implementation Notes:**
  ```typescript
  // OLD SIGNATURE (to remove)
  export async function createSession(
    userId: string,
    tempToken: string,
    expiresAt: Date
  ): Promise<Session>

  // NEW SIGNATURE (implement)
  export async function createSession(
    userId: string,
    sessionToken: string,  // ← Real JWT now
    expiresAt: Date,
    metadata: {
      userAgent?: string;
      ipAddress?: string;
      invalidatePrevious?: boolean;  // ← Optional: revoke old sessions
    } = {}
  ): Promise<Session>
  ```
- **Dependencies:** None
- **Testing:** Unit test in tests/lib/auth-server.test.ts
- **Blockers:** None

---

#### Task 1.2: Update Session Creation Logic in Function Body
- **File:** `src/lib/auth-server.ts` (createSession function)
- **Complexity:** Small
- **Estimated Time:** 2-3 hours
- **Description:** Rewrite createSession to use transaction pattern
- **Acceptance Criteria:**
  - ✓ Uses Prisma.$transaction for atomicity
  - ✓ Optional: Invalidates previous sessions (if flag set)
  - ✓ Includes proper error handling
  - ✓ Logs transaction begin/commit/rollback
  - ✓ Returns created session object
  - ✓ Handles race condition safely
- **Implementation Pattern:**
  ```typescript
  const session = await prisma.$transaction(async (tx) => {
    // Optional: Invalidate old sessions
    if (metadata.invalidatePrevious) {
      await tx.session.updateMany({
        where: { userId, isValid: true },
        data: { isValid: false },
      });
    }

    // Create new session with JWT atomically
    return await tx.session.create({
      data: {
        id: sessionId,
        userId,
        sessionToken,  // ← Real JWT, no update needed
        expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        isValid: true,
      },
    });
  });
  ```
- **Dependencies:** Task 1.1 complete
- **Testing:** Unit test
- **Blockers:** None

---

#### Task 1.3: Remove updateSessionToken() Function
- **File:** `src/lib/auth-server.ts`
- **Complexity:** Trivial
- **Estimated Time:** 30 minutes
- **Description:** Delete `updateSessionToken()` function (no longer needed after atomic creation)
- **Acceptance Criteria:**
  - ✓ Function removed
  - ✓ All calls to updateSessionToken removed (will be done in Phases 2-3)
  - ✓ No other code references it
- **Dependencies:** Phases 2-3 must be complete first (need to update all callers)
- **Testing:** Search for remaining references
- **Blockers:** Must wait for Phases 2-3

---

#### Task 1.4: Update Auth Server Exports and Documentation
- **File:** `src/lib/auth-server.ts`
- **Complexity:** Trivial
- **Estimated Time:** 1 hour
- **Description:** Update JSDoc comments, exports, and types
- **Acceptance Criteria:**
  - ✓ createSession() fully documented with new signature
  - ✓ Comments explain atomic transaction behavior
  - ✓ Example usage documented
  - ✓ TypeScript types exported if needed
- **Dependencies:** Tasks 1.1, 1.2 complete
- **Testing:** TypeScript compilation only
- **Blockers:** None

---

### Phase 2: Refactor Login Route

#### Task 2.1: Refactor Login Route for Atomic Session Creation
- **File:** `src/app/api/auth/login/route.ts`
- **Complexity:** Medium
- **Estimated Time:** 4-6 hours
- **Description:** Rewrite login flow to generate sessionId and JWT before calling createSession
- **Acceptance Criteria:**
  - ✓ Generate sessionId (CUID) before DB operations
  - ✓ Create JWT with that sessionId
  - ✓ Call createSession with real JWT (not tempToken)
  - ✓ Remove separate updateSessionToken() call
  - ✓ Error handling: only send cookie if createSession succeeds
  - ✓ Detailed logging of each step
  - ✓ TypeScript compiles with no errors
  - ✓ All tests pass
- **Implementation Pattern:**
  ```typescript
  // Step 1: Validate credentials (existing)
  const user = await validateCredentials(email, password);

  // Step 2: NEW - Generate session ID before JWT
  const sessionId = cuid();
  const expiresAt = calculateSessionExpiration();

  // Step 3: NEW - Create JWT with that sessionId
  const payload = createSessionPayload(user.id, sessionId);
  const token = signSessionToken(payload);

  // Step 4: NEW - Create session atomically with JWT
  const session = await createSession(user.id, token, expiresAt, {
    userAgent: request.headers.get('user-agent') || undefined,
    ipAddress: getClientIP(request),
  });

  // Step 5: Set cookie (only if session created successfully)
  response.cookies.set('session', token, {...});
  return NextResponse.json({ success: true, userId: user.id });
  ```
- **Remove:** The following lines (old pattern)
  ```typescript
  // OLD: Create with tempToken, then update
  const sessionRecord = await createSession(
    user.id,
    `temp_${randomUUID()}`,  // ← REMOVE
    expiresAt
  );
  const payload = createSessionPayload(user.id, sessionRecord.id);
  const token = signSessionToken(payload);
  await updateSessionToken(sessionRecord.id, token);  // ← REMOVE
  ```
- **Dependencies:** Phase 1 complete
- **Testing:** Integration test login flow
- **Blockers:** None

---

#### Task 2.2: Add Error Handling for Transaction Failures
- **File:** `src/app/api/auth/login/route.ts`
- **Complexity:** Small
- **Estimated Time:** 2-3 hours
- **Description:** Handle failures in createSession transaction
- **Acceptance Criteria:**
  - ✓ Catches Prisma transaction errors
  - ✓ Catches P2002 (unique constraint) with context
  - ✓ Catches connection errors with retry guidance
  - ✓ Returns appropriate HTTP status (500)
  - ✓ Logs error with full context
  - ✓ No partial session created (transaction rollback)
  - ✓ Detailed error logging for debugging
- **Implementation Pattern:**
  ```typescript
  try {
    const session = await createSession(...)
    // ... set cookie, return success
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        console.error('[Auth] Unique constraint violation:', error.meta);
      }
    }
    console.error('[Login] Session creation failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({
      success: false,
      error: 'Session creation failed',
    }, { status: 500 });
  }
  ```
- **Dependencies:** Task 2.1 complete
- **Testing:** Unit test with mocked Prisma errors
- **Blockers:** None

---

#### Task 2.3: Add Comprehensive Logging to Login Flow
- **File:** `src/app/api/auth/login/route.ts`
- **Complexity:** Small
- **Estimated Time:** 2-3 hours
- **Description:** Log each step for debugging and audit trail
- **Acceptance Criteria:**
  - ✓ Log start of login flow
  - ✓ Log successful credential verification
  - ✓ Log session ID generation
  - ✓ Log JWT signing
  - ✓ Log session creation (before + after)
  - ✓ Log cookie setting
  - ✓ Log successful completion
  - ✓ Error logging at each failure point
  - ✓ No sensitive data in logs (password, token contents)
  - ✓ Structured logging with context
- **Dependencies:** Task 2.1 complete
- **Testing:** Verify logs appear in console/system
- **Blockers:** None

---

### Phase 3: Refactor Signup Route

#### Task 3.1: Update Signup Route to Match Login Pattern
- **File:** `src/app/api/auth/signup/route.ts`
- **Complexity:** Medium
- **Estimated Time:** 4-6 hours
- **Description:** Apply same atomic session creation pattern as login
- **Acceptance Criteria:**
  - ✓ Uses identical session creation pattern to login
  - ✓ Generate sessionId before JWT
  - ✓ Sign JWT with that sessionId
  - ✓ Call createSession with real JWT
  - ✓ No tempToken logic
  - ✓ Error handling for transaction failures
  - ✓ Comprehensive logging
  - ✓ TypeScript compiles with no errors
  - ✓ All tests pass
- **Implementation:** Same pattern as Task 2.1, applied to signup
- **Dependencies:** Phase 1 complete, Task 2.1 complete (for reference)
- **Testing:** Integration test signup flow
- **Blockers:** None

---

#### Task 3.2: Test Signup and Login Consistency
- **File:** Integration tests
- **Complexity:** Small
- **Estimated Time:** 2-3 hours
- **Description:** Verify signup and login use identical session patterns
- **Acceptance Criteria:**
  - ✓ Signup session creation matches login
  - ✓ Same JWT structure
  - ✓ Same expiration handling
  - ✓ Same error scenarios
  - ✓ Cross-test: Can login after signup, use same patterns
- **Dependencies:** Tasks 3.1 complete
- **Testing:** Integration test comparing flows
- **Blockers:** None

---

### Phase 4: Enhanced Middleware Logging

#### Task 4.1: Add Timing Metrics to Middleware
- **File:** `src/middleware.ts`
- **Complexity:** Small
- **Estimated Time:** 2-3 hours
- **Description:** Add performance timing and detailed state logging
- **Acceptance Criteria:**
  - ✓ Log timestamp at each step
  - ✓ Record execution time for each verification step
  - ✓ Log session state at Step 4 (what was found in DB)
  - ✓ Add correlation ID for request tracing
  - ✓ Log database query metrics if available
  - ✓ No performance regression (< 5ms overhead)
- **Implementation Pattern:**
  ```typescript
  const startTime = performance.now();
  console.log(`[Auth] Starting verification (correlationId: ${correlationId})`);

  // Step 1: Extract
  const step1Start = performance.now();
  // ... extract token
  console.log(`[Auth] Step 1 completed in ${performance.now() - step1Start}ms`);

  // Step 4: Lookup
  const step4Start = performance.now();
  const dbSession = await getSessionByToken(token);
  console.log(`[Auth] Step 4 DB lookup: ${performance.now() - step4Start}ms`, {
    found: !!dbSession,
    sessionState: dbSession ? { 
      id: dbSession.id, 
      isValid: dbSession.isValid, 
      expiresAt: dbSession.expiresAt 
    } : null,
  });
  ```
- **Dependencies:** None
- **Testing:** Manual verification of logs
- **Blockers:** None

---

#### Task 4.2: Add Correlation IDs for Request Tracing
- **File:** `src/middleware.ts`
- **Complexity:** Small
- **Estimated Time:** 1-2 hours
- **Description:** Add correlation ID to trace requests through logs
- **Acceptance Criteria:**
  - ✓ Generate unique correlation ID per request
  - ✓ Pass correlation ID through all log statements
  - ✓ Can trace complete flow by correlation ID
  - ✓ Useful for debugging production issues
- **Implementation:** Attach to request context
- **Dependencies:** Task 4.1 complete
- **Testing:** Manual log analysis
- **Blockers:** None

---

### Phase 5: Comprehensive Testing

#### Task 5.1: Unit Test createSession Function
- **File:** `tests/lib/auth-server.test.ts`
- **Complexity:** Small
- **Estimated Time:** 3-4 hours
- **Description:** Test new createSession signature and transaction behavior
- **Acceptance Criteria:**
  - ✓ Test successful session creation with JWT
  - ✓ Test unique constraint error handling
  - ✓ Test invalid input validation
  - ✓ Test with and without metadata
  - ✓ Test optional: previous session invalidation
  - ✓ 90%+ code coverage
  - ✓ All tests pass
- **Test Cases:**
  - Normal creation with valid JWT
  - Creation with metadata (userAgent, ipAddress)
  - Previous session invalidation
  - Unique constraint violation (mocked)
  - Database connection error
  - Invalid sessionId format
  - Invalid expiresAt time
- **Dependencies:** Phase 1 complete
- **Testing:** Run with `npm run test`
- **Blockers:** None

---

#### Task 5.2: Integration Test Login Flow
- **File:** `tests/integration/login.test.ts`
- **Complexity:** Medium
- **Estimated Time:** 4-5 hours
- **Description:** Test complete login flow with JWT and session creation
- **Acceptance Criteria:**
  - ✓ Valid credentials → ✓ authenticated
  - ✓ Invalid password → ✗ 401 response
  - ✓ User not found → ✗ 401 response (generic)
  - ✓ Cookie set correctly (httpOnly, Secure, SameSite)
  - ✓ JWT valid and verifiable
  - ✓ Session created in database
  - ✓ Session token matches cookie value
  - ✓ Subsequent request with cookie → ✓ authenticated
  - ✓ All tests pass
- **Test Cases:**
  - Successful login
  - Invalid credentials
  - User not found
  - Rate limiting (already exists, verify still works)
  - Concurrent logins (race condition test)
  - Cookie expiration
  - Multiple login attempts
  - Session state in database
- **Dependencies:** Phases 2 complete
- **Testing:** Run with `npm run test`
- **Blockers:** None

---

#### Task 5.3: Race Condition Testing
- **File:** `tests/concurrent/race-condition.test.ts`
- **Complexity:** Medium
- **Estimated Time:** 4-5 hours
- **Description:** Test concurrent login scenarios to ensure no race conditions
- **Acceptance Criteria:**
  - ✓ 10 concurrent logins (same user) → all succeed
  - ✓ 10 concurrent logins (different users) → all succeed
  - ✓ Each session has unique sessionId and JWT
  - ✓ All sessions findable in database
  - ✓ No session token collisions
  - ✓ No race condition errors
  - ✓ All database transactions committed
- **Test Scenarios:**
  - Concurrent logins from same user (sequential verification)
  - Concurrent logins from different users
  - Login + logout race (logout during login)
  - Login + immediate authenticated request
  - 50 concurrent requests (stress test)
- **Dependencies:** Phases 2-3 complete
- **Testing:** Run with `npm run test`
- **Blockers:** None

---

#### Task 5.4: Middleware Verification Tests
- **File:** `tests/middleware/auth.test.ts`
- **Complexity:** Medium
- **Estimated Time:** 3-4 hours
- **Description:** Test middleware verification logic with new session structure
- **Acceptance Criteria:**
  - ✓ Valid JWT + session → ✓ authenticated
  - ✓ Invalid JWT signature → ✗ 401
  - ✓ Expired JWT → ✗ 401
  - ✓ Session not found (deleted) → ✗ 401
  - ✓ Session.isValid = false → ✗ 401
  - ✓ User deleted → ✗ 401
  - ✓ No cookie → ✗ 401
  - ✓ 4-step verification logged correctly
  - ✓ All tests pass
- **Test Cases:**
  - Valid token + valid session
  - Corrupted token
  - Truncated token
  - Expired token
  - Revoked session (isValid=false)
  - Missing session in DB
  - Missing user account
  - Empty cookie
  - Clock skew scenarios
  - Concurrent requests with same token
- **Dependencies:** Phases 2-4 complete
- **Testing:** Run with `npm run test`
- **Blockers:** None

---

#### Task 5.5: End-to-End Test Complete Auth Flow
- **File:** `tests/e2e/auth-flow.test.ts`
- **Complexity:** Medium
- **Estimated Time:** 3-4 hours
- **Description:** Test complete user journey: signup → login → authenticated request → logout
- **Acceptance Criteria:**
  - ✓ Signup: create account, session, receive JWT
  - ✓ Can immediately authenticate with JWT after signup
  - ✓ Login: authenticate, receive JWT
  - ✓ Can immediately authenticate with JWT after login
  - ✓ Middleware: verify JWT on protected route
  - ✓ Logout: revoke session, clear cookie
  - ✓ Cannot authenticate after logout
  - ✓ Session state consistent throughout
  - ✓ No race conditions observed
- **Test Scenarios:**
  - Signup → immediate protected request
  - Login → immediate protected request
  - Multiple protected requests concurrently
  - Logout during active requests
  - Re-login after logout
- **Dependencies:** Phases 2-4 complete
- **Testing:** Run with `npm run test` (or Playwright for true E2E)
- **Blockers:** None

---

### Phase 6: Deployment & Monitoring

#### Task 6.1: Staging Validation
- **File:** deployment docs
- **Complexity:** Small
- **Estimated Time:** 2-3 hours
- **Description:** Test changes in staging environment before production
- **Acceptance Criteria:**
  - ✓ Deploy to staging
  - ✓ Run full test suite
  - ✓ Manual testing: signup, login, logout, protected routes
  - ✓ Database migrations applied
  - ✓ No errors in logs
  - ✓ Performance metrics acceptable
  - ✓ Monitoring alerts functioning
- **Testing:** Manual + automated in staging
- **Blockers:** Phase 5 complete

---

#### Task 6.2: Production Deployment Plan
- **File:** `.github/specs/AUTH-RACE-CONDITION-DEPLOYMENT.md`
- **Complexity:** Small
- **Estimated Time:** 2-3 hours
- **Description:** Document safe deployment strategy
- **Acceptance Criteria:**
  - ✓ Deployment steps documented
  - ✓ Rollback procedure defined
  - ✓ Monitoring checks defined
  - ✓ Success metrics clear
  - ✓ Communication plan for users
- **Sections:**
  - Pre-deployment checklist
  - Deployment steps (canary → full)
  - Monitoring metrics to watch
  - Rollback procedure
  - Post-deployment validation
- **Dependencies:** Task 6.1 complete
- **Blockers:** None

---

#### Task 6.3: Monitoring Setup
- **File:** `src/lib/monitoring.ts` (or existing monitoring)
- **Complexity:** Medium
- **Estimated Time:** 3-4 hours
- **Description:** Add monitoring and alerting for auth errors
- **Acceptance Criteria:**
  - ✓ Track auth success/failure rates
  - ✓ Alert on increased Step 3 failures (session not found)
  - ✓ Track session creation timing
  - ✓ Monitor JWT verification failures
  - ✓ Dashboard shows auth health metrics
  - ✓ Alerts configured in monitoring system
- **Metrics to Track:**
  - Login success rate (%)
  - Signup success rate (%)
  - Middleware verification success rate (%)
  - Session creation timing (ms)
  - Step 3 failures (should be ~0 after fix)
  - JWT verification failures
  - Transaction rollback count
- **Dependencies:** Phase 2-4 complete
- **Blockers:** None

---

## Security & Compliance Considerations

### 1. Authentication & Authorization Strategy

#### JWT Security
- **Algorithm:** HS256 (symmetric, server-side secret only)
- **Secret Management:** `getSessionSecret()` reads from environment variable
  - ✓ Secret never logged or exposed
  - ✓ Secret rotatable (change ENV, old tokens fail gracefully)
  - ✓ Different secrets per environment (dev, staging, prod)
- **Signature Verification:** On every request in middleware
  - ✓ Detects token tampering
  - ✓ Fails fast (Step 2)
- **Expiration:**
  - ✓ JWT has expiresAt claim
  - ✓ Session has expiresAt field
  - ✓ Both checked independently (defense in depth)

#### Session Management
- **Session Storage:** Database only (never client-side)
- **Session Token:** JWT token stored in database for cross-verification
  - ✓ Can revoke sessions immediately (soft delete)
  - ✓ Can audit session history
  - ✓ Can detect concurrent sessions
- **Soft Revocation:** `isValid` flag for immediate revocation
  - ✓ Checked on every request
  - ✓ No cache delay
  - ✓ Reversible if needed

#### Cookie Security
- **HttpOnly:** ✓ Cannot be accessed by JavaScript (XSS protection)
- **Secure:** ✓ HTTPS only (man-in-the-middle protection)
- **SameSite=Strict:** ✓ CSRF protection (no cross-site cookie submission)
- **Max-Age:** 30 days (balances security and usability)
- **Path:** `/` (entire application)

### 2. Data Protection & Privacy

#### Sensitive Data Handling
- **Passwords:**
  - ✓ Hashed with Argon2id (industry standard)
  - ✓ Never logged
  - ✓ Never transmitted in logs
  - ✓ Comparison is timing-safe (prevents timing attacks)
- **JWTs:**
  - ✓ Not logged in full form (only preview)
  - ✓ Stored as Base64 (opaque to database)
  - ✓ Signed (cannot be tampered)
- **Session Tokens:**
  - ✓ Stored in database with @unique constraint
  - ✓ Never duplicated
  - ✓ Never exposed to client other than in cookie
- **User IPs & User Agents:**
  - ✓ Stored in Session for device fingerprinting
  - ✓ Used for suspicious activity detection (optional feature)
  - ✓ Subject to privacy policy

#### User Enumeration Prevention
- **Login Errors:** Generic message "Invalid email or password"
  - ✓ Cannot determine if email exists
  - ✓ Consistent response time (doesn't leak via timing)
- **Rate Limiting:** Applied to email address (blocks after 5 failed attempts)
  - ✓ Prevents brute force
  - ✓ Generic "account locked" message

### 3. Audit & Logging

#### Audit Trail
- **What to Log:**
  - ✓ Login attempts (success/failure)
  - ✓ Signup (success/failure)
  - ✓ Logout (success)
  - ✓ Session creation (transaction begin/commit)
  - ✓ Session revocation (soft delete)
  - ✓ Failed verification steps (with correlation ID)
- **What NOT to Log:**
  - ✗ Passwords (never, even hashed)
  - ✗ Full JWT tokens (only preview)
  - ✗ User secrets
- **Log Format:**
  - ✓ Structured (JSON-like with fields)
  - ✓ Timestamped
  - ✓ Correlation ID for request tracing
  - ✓ Severity level (error, warn, info)

#### Compliance Requirements
- **GDPR (if applicable):**
  - ✓ User can request data deletion
  - ✓ Sessions deleted on user delete (cascade)
  - ✓ Audit logs retained per retention policy
- **PCI-DSS (if handling payments):**
  - ✓ Passwords hashed (not stored plaintext)
  - ✓ Sessions isolated per user
  - ✓ HTTPS enforced (Secure cookie flag)
- **SOC2 (if applicable):**
  - ✓ Audit logging implemented
  - ✓ Access controls enforced
  - ✓ Monitoring and alerting configured

---

## Performance & Scalability Considerations

### 1. Expected Load & Growth

#### Current System
- **Estimated Users:** 1,000 - 10,000 concurrent
- **Login/Logout Rate:** 100-200 requests per minute (peak)
- **Session Lookup Rate:** 500-1,000 requests per second (middleware)
- **Database:** Prisma + PostgreSQL (assumed)

#### Growth Trajectory
- **Year 1:** 10x user growth expected
- **Session Scaling:** Linear with user count
- **Session Lookup:** Critical (happens on every request)

### 2. Caching Strategies

#### Session Cache (Optional)
- **Current:** No cache (direct database lookup every time)
- **Recommendation:** Add Redis cache for session lookup
  ```typescript
  // Pseudocode
  const getSessionByToken = async (token: string) => {
    // Try cache first
    const cached = await redis.get(`session:${token}`);
    if (cached) return JSON.parse(cached);

    // Cache miss → query database
    const session = await prisma.session.findUnique({
      where: { sessionToken: token }
    });

    // Cache for 5 minutes (short TTL for session changes)
    if (session) {
      await redis.setex(`session:${token}`, 300, JSON.stringify(session));
    }

    return session;
  };
  ```
- **TTL:** 5 minutes (balance freshness with performance)
- **Benefits:**
  - ✓ Reduces database load by 50-80%
  - ✓ Faster verification (Redis ~1ms vs DB ~10-50ms)
  - ✓ Handles traffic spikes better
- **Cost:** Redis infrastructure

#### JWT Cache Consideration
- **Current:** No caching needed (JWT signature is fast, ~1ms)
- **Recommendation:** Not needed (JWT verification is memory-only)

### 3. Database Optimization

#### Indexes (Current Schema)
```prisma
@@index([userId])          // Find user's sessions (O(log n))
@@index([expiresAt])       // Find expired sessions for cleanup (O(log n))
```

#### Recommended Indexes for Scaling
```prisma
// Add this index for Session.isValid + expiration queries
@@index([isValid, expiresAt])  // Find active sessions efficiently

// For reporting: sessions created today
@@index([createdAt])  // Analytics queries

// For device tracking: find sessions by IP
@@index([ipAddress])  // Suspicious login detection
```

#### Query Optimization
- **Session Lookup:** Uses `@unique` constraint on sessionToken
  - ✓ Index scan (single row lookup) instead of full table scan
  - ✓ O(1) time complexity (hash index)
  - ✓ Already optimal

#### Sharding Consideration (Future)
- **If:** Millions of sessions across multiple databases
- **Strategy:** Shard by userId hash
  - Each user's sessions go to same shard
  - Eliminates cross-shard queries
  - Scales horizontally

### 4. Rate Limiting & Throttling

#### Current Strategy (Exists)
- **Login Rate Limit:** 5 failed attempts → lock for 15 minutes
- **Mechanism:** In-memory counter per email (or Redis)

#### Recommendation: Keep Current
- ✓ Adequate for typical load
- ✓ Prevents brute force attacks
- ✓ Can be adjusted if abuse occurs

#### Rate Limiting at Middleware (Optional)
```typescript
// Limit middleware requests (prevent hammering protected routes)
const rateLimiter = new RateLimiter({
  maxRequests: 100,  // per user
  windowMs: 60 * 1000,  // per minute
});

if (rateLimiter.isLimited(userId)) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  );
}
```

### 5. Performance Metrics & Benchmarks

#### Target Metrics
- **Session Creation:** < 50ms (transaction overhead)
  - Breakdown: JWT signing (~5ms), DB write (~40ms), commit (~5ms)
- **Session Lookup:** < 5ms (with Redis) or < 50ms (DB only)
- **JWT Verification:** < 1ms (in-memory, CPU-only)
- **Middleware Total:** < 10ms (combined)

#### Measurement & Monitoring
- **Profile:** Timing for each operation added in Phase 4
- **Monitor:** Correlate response times with load (logs)
- **Alert:** If median > 20ms or p99 > 100ms, investigate

#### Load Testing
```bash
# Test with ab (Apache Bench)
ab -n 10000 -c 100 https://app.example.com/api/protected

# Expected results:
# - 0% failed (no race conditions)
# - Median response time: 5-10ms
# - p99 response time: 20-50ms
```

---

## Testing Strategy

### Unit Tests

**Files to Test:**
- `src/lib/auth-server.ts` - createSession function
- `src/lib/auth-utils.ts` - JWT functions

**Coverage Target:** 90%+

**Key Test Cases:**
- ✓ createSession with valid JWT
- ✓ createSession with metadata (userAgent, ipAddress)
- ✓ createSession transaction rollback on error
- ✓ getSessionByToken with valid token
- ✓ getSessionByToken with invalid token
- ✓ JWT signing and verification round-trip
- ✓ Password hashing and verification

### Integration Tests

**Files to Test:**
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/logout/route.ts`

**Coverage Target:** 85%+

**Key Test Cases:**
- ✓ Login with valid credentials
- ✓ Login with invalid password
- ✓ Login with non-existent email
- ✓ Signup with valid data
- ✓ Signup with duplicate email
- ✓ Signup with weak password
- ✓ Logout with valid session
- ✓ Can authenticate immediately after login
- ✓ Can authenticate immediately after signup

### Race Condition Tests

**Purpose:** Ensure atomic session creation prevents race condition

**Test Scenarios:**
1. **Concurrent Logins (Same User)**
   - 10 login requests for same email/password
   - Expected: All succeed, each with unique session
   - Verify: No duplicate sessionIds, all JWTs valid

2. **Concurrent Logins (Different Users)**
   - 10 login requests for different users
   - Expected: All succeed independently
   - Verify: No session cross-contamination

3. **Concurrent Login + Authenticated Request**
   - Login request + immediately GET /api/protected
   - Expected: GET succeeds (even if login response delayed)
   - Verify: No "session not found" errors

4. **Concurrent Logout + Request**
   - Logout + GET /api/protected (within 100ms)
   - Expected: GET may succeed or fail (depends on timing)
   - Verify: No partial/corrupted session state

### Middleware Tests

**Files to Test:**
- `src/middleware.ts`

**Coverage Target:** 90%+

**Key Test Cases:**
- ✓ Valid JWT + valid session → authenticated
- ✓ Invalid JWT signature → rejected
- ✓ Expired JWT → rejected
- ✓ Session not found → rejected
- ✓ Session.isValid = false → rejected
- ✓ User deleted → rejected
- ✓ No cookie → rejected
- ✓ Logs all 4 verification steps

### End-to-End Tests

**Test Flow:**
1. Signup → receive JWT
2. GET /dashboard → authenticated ✓
3. POST /benefits → receive response ✓
4. Logout → session revoked
5. GET /dashboard → 401 ✗

**Tools:** Playwright or similar browser automation

---

## Rollback Procedure

### Scenario: Critical Issue Discovered Post-Deployment

#### Immediate Actions (First Hour)
1. **Monitor Alerts:** Check auth error rates
   - If Step 3 failures > 5%, declare incident
2. **Isolate Issue:** Reproduce in staging
   - Deploy to staging, attempt to replicate
3. **Assess Impact:** Calculate affected users
   - Query: SELECT COUNT(*) FROM session WHERE createdAt > rollback_time
4. **Notify:** Alert on-call engineers + management
   - "Auth system experiencing increased errors, investigating..."

#### Rollback Steps

**Option 1: Code Rollback (Preferred)**
1. Revert commit: `git revert <commit-hash>`
2. Deploy previous version: `npm run deploy:prod`
3. Verify: Test login/signup in production
4. Monitor: Confirm error rates return to baseline

**Option 2: Feature Flag Disable**
1. Add feature flag to createSession:
   ```typescript
   if (!ENV.ATOMIC_SESSION_ENABLED) {
     // Fall back to old pattern (create + update)
     const sessionRecord = await createSession(userId, tempToken, expiresAt);
     const token = signSessionToken(createSessionPayload(...));
     await updateSessionToken(sessionRecord.id, token);
   }
   ```
2. Disable flag in production: `ATOMIC_SESSION_ENABLED=false`
3. Monitor: Confirm rates normalize

**Option 3: Database Rollback**
1. Create session records with correct JWT from failed attempts
2. Requires: Detailed logging of session creation failures
3. Complex, manual process

#### Post-Rollback Analysis
1. **Root Cause Analysis:** Why did tests miss the issue?
2. **Revised Testing:** Add more edge cases or stress tests
3. **Deployment Strategy:** Smaller canary, phased rollout
4. **Re-deploy:** Fix issue, pass additional testing, re-deploy

---

## Monitoring & Observability

### Key Metrics to Track

#### Success/Failure Rates
```
Auth Success Rate (%) = Successful logins / Total login attempts
Goal: > 99.9%
Current (with race condition): ~98%

Step 3 Failures (Session Not Found)
Goal: < 0.1% after fix
Current (with race condition): 1-2% under load
```

#### Timing Metrics
```
Session Creation Time (ms)
Goal: < 50ms
Includes: JWT signing + DB transaction + commit

Middleware Verification Time (ms)
Goal: < 10ms (with Redis cache)
Goal: < 50ms (without cache)
```

#### Error Types
```
Login failures by step:
- Validation error (400): Expected
- Invalid credentials (401): Expected
- Rate limited (429): Expected if attack detected
- Session creation failed (500): BAD - indicates issue

Middleware failures by step:
- Step 1: No cookie: Expected (unauthenticated request)
- Step 2: JWT invalid: Low frequency (< 0.1%)
- Step 3: Session not found: CRITICAL (should be ~0%)
- Step 4: Session invalid: Low frequency
- Step 5: User not found: Low frequency
- Step 6: User error: Unexpected (rare)
```

### Alerting Rules

```
Rule: High Step 3 Failures
  Condition: (Step 3 failures / total auth requests) > 1%
  Duration: 5 minutes
  Action: Page on-call engineer
  Runbook: Check session creation logs, verify DB health

Rule: Session Creation Timeout
  Condition: (Creation time p99) > 1000ms
  Duration: 5 minutes
  Action: Alert on-call engineer
  Runbook: Check database performance, connection pool

Rule: Middleware Verification Slow
  Condition: (Verification time p99) > 500ms
  Duration: 5 minutes
  Action: Check cache health (Redis down?)
  Runbook: Restart Redis if needed, verify DB indexes
```

### Dashboard Panels

**Auth Health Dashboard:**
- Login success rate (%) [sparkline]
- Signup success rate (%) [sparkline]
- Session creation time (ms) [gauge]
- Middleware verification time (ms) [gauge]
- Current active sessions [counter]
- Sessions created (last 24h) [counter]
- Failed login attempts (last 1h) [counter]
- Rate limited accounts (current) [counter]

**Errors Breakdown:**
- Validation errors (400): %
- Invalid credentials (401): %
- Rate limit (429): %
- Server errors (500): %
- By error type (graph)

---

## Frequently Asked Questions

**Q: Why not use a temporary token at all?**  
A: The fix generates sessionId first, then JWT, so no temporary token is needed. Single atomic create.

**Q: What if database is slow?**  
A: Transaction still completes atomically. Response waits for commit. Better than race condition.

**Q: Can we use Redis for sessions instead of database?**  
A: Possible, but risky (data loss on crash). Database + Redis cache is safer.

**Q: How do we handle user sessions across devices?**  
A: Each login creates new session. Multiple sessions per user allowed. User can have active sessions on phone + desktop.

**Q: What if user logs in, closes browser, then opens it again?**  
A: Cookie has Max-Age=30 days. Still valid unless deleted or user logs out.

**Q: How do we know if a JWT is valid without database lookup?**  
A: JWT signature proves it was created by server. But we still check database to see if session was revoked (isValid=false).

---

## Implementation Checklist

- [ ] Phase 1: Refactor createSession
  - [ ] Update function signature
  - [ ] Implement transaction pattern
  - [ ] Update documentation
  - [ ] Unit tests pass

- [ ] Phase 2: Refactor login route
  - [ ] Generate sessionId before JWT
  - [ ] Remove tempToken logic
  - [ ] Add error handling
  - [ ] Add logging
  - [ ] Integration tests pass

- [ ] Phase 3: Refactor signup route
  - [ ] Match login pattern
  - [ ] Remove tempToken logic
  - [ ] Add error handling
  - [ ] Add logging
  - [ ] Integration tests pass

- [ ] Phase 4: Middleware logging
  - [ ] Add timing metrics
  - [ ] Add correlation IDs
  - [ ] Verify performance impact minimal

- [ ] Phase 5: Testing
  - [ ] Unit tests: 90%+ coverage
  - [ ] Integration tests: 85%+ coverage
  - [ ] Race condition tests: pass
  - [ ] Middleware tests: pass
  - [ ] E2E tests: pass

- [ ] Phase 6: Deployment
  - [ ] Staging validation complete
  - [ ] Production deployment plan documented
  - [ ] Monitoring setup complete
  - [ ] Alerts configured
  - [ ] Rollback procedure documented
  - [ ] Team trained on changes

---

## Success Metrics (Post-Deployment)

✓ **Zero "Session not found" errors** in middleware (Step 3 failures)
✓ **99.9%+ login success rate**
✓ **99.9%+ signup success rate**
✓ **<50ms session creation time** (median)
✓ **<10ms middleware verification time** (with cache)
✓ **Zero race condition reproduction** under load testing
✓ **All automated tests pass** (unit + integration + E2E)
✓ **Negative: Zero reported auth issues** from users post-deploy

---

## Document History

| Date | Version | Author | Change |
|------|---------|--------|--------|
| 2024-01-15 | 1.0 | Tech Architect | Initial specification |

---

**Document Owner:** Senior Backend Engineer (Session/Auth System)  
**Review Required:** Security, DevOps, QA before implementation  
**Approval:** Engineering Lead
