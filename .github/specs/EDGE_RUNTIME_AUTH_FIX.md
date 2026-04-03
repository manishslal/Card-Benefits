# Edge Runtime Authentication Fix - Technical Specification

## Executive Summary & Goals

**Problem:** The authentication middleware fails in production (Edge Runtime) because it attempts to use Node.js `crypto` module through the `jsonwebtoken` library. Vercel Edge Runtime and similar serverless edge environments only support Web APIs, not Node.js modules.

**Solution:** Implement a two-tier authentication architecture that separates JWT verification (which requires `crypto`) from the middleware layer. The middleware will perform a simple cookie check and delegate token verification to a Node.js API endpoint.

**Primary Objectives:**
1. Remove all cryptographic operations from the middleware (Edge Runtime)
2. Move JWT verification to `/api/auth/verify` (Node.js Runtime)
3. Maintain full session revocation capability (via database checks)
4. Preserve all existing security controls and audit requirements
5. Deploy without database schema changes or environment variable changes

**Success Criteria:**
- ✅ Middleware executes successfully in Edge Runtime (no `crypto` errors)
- ✅ Login flow completes without 401 errors
- ✅ Protected routes load after successful authentication
- ✅ Logout revokes sessions immediately
- ✅ Concurrent requests are handled correctly
- ✅ All existing tests pass
- ✅ Railway deployment succeeds

---

## Functional Requirements

### Core Features

**1. Session Cookie Extraction (Edge Runtime - Middleware)**
- Extract `session` cookie from incoming request
- Handle malformed cookies gracefully (no crashes)
- Return `null` if cookie is missing
- No cryptographic validation at this layer

**2. Internal Token Verification (Node.js Runtime - API)**
- Accept POST request with JSON body `{ token: string }`
- Verify JWT signature using `jsonwebtoken` library (requires `crypto`)
- Check JWT expiration timestamp
- Validate session exists in database and is not revoked
- Verify user account still exists
- Return `{ valid: true, userId: string }` or `{ valid: false }`

**3. Route Protection (Edge Runtime - Middleware)**
- Classify routes as PUBLIC or PROTECTED
- Public routes: Allow without authentication
- Protected routes: Require valid session token
- Call `/api/auth/verify` for protected routes
- Deny access (401) if verification fails
- Set auth context for downstream handlers

**4. Session Management**
- Create session records in database after login
- Store JWT token in `sessionToken` field
- Track `isValid` flag for revocation
- Track `expiresAt` timestamp for expiration
- Invalidate sessions on logout
- Verify user still exists (account not deleted)

### User Roles & Permissions

This spec focuses on authentication (is the user who they claim to be). Authorization (what they can do) is handled separately by `verifyPlayerOwnership`, `verifyCardOwnership`, and `verifyBenefitOwnership` in `auth-server.ts`.

- **Unauthenticated Users:** Can access public routes only (login, signup, homepage)
- **Authenticated Users:** Can access protected routes (/dashboard, /cards, /benefits, /settings)
- **Session-Revoked Users:** Cannot access protected routes (treated as unauthenticated)

### System Constraints & Limits

| Constraint | Value | Reason |
|-----------|-------|--------|
| Session Duration | 30 days | Defined in `SESSION_EXPIRATION_SECONDS` |
| JWT Algorithm | HS256 | HMAC-SHA256 (symmetric key) |
| Session Secret Min Length | 32 bytes (256 bits) | NIST recommendation for HMAC-SHA256 |
| Cookie Max-Age | 2,592,000 seconds (30 days) | Must match JWT `expiresAt` |
| Cookie Attributes | HttpOnly, Secure, SameSite=Strict | Prevents XSS, CSRF, and cross-site theft |
| Network Timeout (internal API call) | 5 seconds (recommended) | Fail closed if verify endpoint unresponsive |
| Error Messages | Generic (no token details) | Prevent information leaks to attackers |

---

## Implementation Phases

### Phase 1: Architectural Planning & Testing (1 day)
**Objectives:**
- Map current request flow through middleware
- Document all crypto operations that need relocation
- Write tests for new `/api/auth/verify` endpoint
- Design error handling strategy

**Key Deliverables:**
- Current flow diagram (middleware → verifyToken → crypto)
- Target flow diagram (middleware → /api/auth/verify → crypto)
- Unit test suite for `/api/auth/verify`
- Integration test suite for middleware + API flow

**Phase Dependencies:** None (can start immediately)

### Phase 2: Implement `/api/auth/verify` Endpoint (1 day)
**Objectives:**
- Create new Node.js API route at `/api/auth/verify`
- Implement token verification logic (can use `crypto` here)
- Add database session validation
- Add user existence check
- Implement error handling (network, database, invalid token)

**Key Deliverables:**
- `/api/auth/verify` POST endpoint with full spec
- Request validation middleware
- Response schemas (success and error cases)
- Unit tests for endpoint

**Phase Dependencies:** Phase 1 (tests)

### Phase 3: Refactor Middleware (1 day)
**Objectives:**
- Remove `verifyToken()` function from middleware
- Remove `import { verifySessionToken }`
- Add internal fetch call to `/api/auth/verify`
- Update protected route handling
- Maintain auth context setting

**Key Deliverables:**
- Updated `middleware.ts` without crypto operations
- Correct error handling for network failures
- Integration tests (middleware → API → database)
- Backward compatibility check

**Phase Dependencies:** Phase 2 (API exists)

### Phase 4: Testing & Validation (1 day)
**Objectives:**
- Run full test suite (unit + integration)
- Test edge cases (network failures, concurrent requests, etc.)
- Validate session revocation works
- Verify Railway deployment
- Performance testing (latency of internal API call)

**Key Deliverables:**
- All tests passing
- Edge case test coverage report
- Performance baseline (latency metrics)
- Deployment readiness checklist

**Phase Dependencies:** Phase 3 (middleware refactored)

### Phase 5: Deployment & Monitoring (0.5 day)
**Objectives:**
- Deploy to Railway
- Monitor for errors in production
- Verify login flow works end-to-end
- Monitor Edge Runtime logs
- Set up alerts for crypto errors

**Key Deliverables:**
- Deployment completed
- Production monitoring active
- Zero crypto errors in logs
- Rollback plan (if needed)

**Phase Dependencies:** Phase 4 (testing complete)

---

## Data Schema / State Management

### Session Entity (Existing - No Changes)

**Database Table:** `Session` (Prisma model)

```
Session {
  id: String @id @default(cuid())
  userId: String @db.String
  user: User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  sessionToken: String @unique        // JWT token string (exact match lookup)
  isValid: Boolean @default(true)     // Revocation flag (set false on logout)
  expiresAt: DateTime                 // Expiration timestamp (checked on every request)
  
  userAgent: String?                  // Device info (optional, for multi-device support)
  ipAddress: String?                  // IP address (optional, for security logs)
  
  createdAt: DateTime @default(now())
  updatedAt: DateTime @updatedAt
  
  @@unique([userId, sessionToken])    // One session token per user (prevent duplicates)
  @@index([userId])                   // Fast lookup by user
  @@index([expiresAt])                // Fast cleanup of expired sessions
}
```

### JWT Token Payload (Existing - No Changes)

**Structure:** HS256 (HMAC-SHA256) signed JSON

```typescript
interface SessionPayload {
  userId: string;           // User ID from database
  issuedAt: number;         // Unix timestamp (seconds)
  expiresAt: number;        // Unix timestamp (seconds)
  sessionId: string;        // Reference to Session.id for revocation
  version: number;          // For invalidating old tokens on logout
}
```

**Example (decoded):**
```json
{
  "userId": "user_abc123",
  "issuedAt": 1700000000,
  "expiresAt": 1702592000,
  "sessionId": "session_def456",
  "version": 1,
  "iat": 1700000000,
  "exp": 1702592000
}
```

### Request/Response Structures for `/api/auth/verify`

**Request Body:**
```typescript
interface VerifyTokenRequest {
  token: string;  // JWT token from cookie
}
```

**Success Response (200 OK):**
```typescript
interface VerifyTokenSuccess {
  valid: true;
  userId: string;  // User ID from token payload
}
```

**Failure Response (200 OK):**
```typescript
interface VerifyTokenFailure {
  valid: false;
}
```

**Note:** All responses return 200 OK. The `valid` field determines success/failure.

### State Management in Middleware

**Auth Context (AsyncLocalStorage):**
```typescript
interface AuthContext {
  userId: string | undefined;  // Set if authenticated, undefined if not
}
```

**Set on public routes:** `{ userId: undefined }`
**Set on protected routes (after verification):** `{ userId: "user_abc123" }`
**Set on failed auth:** Return 401 (never set context)

---

## User Flows & Workflows

### Primary Flow: Login → Access Protected Route → Logout

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: LOGIN (POST /api/auth/login)                               │
├─────────────────────────────────────────────────────────────────────┤
│ User submits email + password                                       │
│ → Verify password against hash (server action, Node.js runtime)     │
│ → Create Session record in database                                 │
│ → Sign JWT token (HS256)                                            │
│ → Set session cookie (HttpOnly, Secure, SameSite=Strict)            │
│ → Redirect to /dashboard                                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: ACCESS DASHBOARD (GET /dashboard)                           │
├─────────────────────────────────────────────────────────────────────┤
│ Browser sends cookie with request                                   │
│                                                                      │
│ [MIDDLEWARE - Edge Runtime]                                        │
│ 1. Extract 'session' cookie                                        │
│    ✓ Cookie exists → Continue                                      │
│    ✗ No cookie → Return 401                                        │
│                                                                      │
│ 2. Route is protected → Call /api/auth/verify                      │
│    POST body: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }   │
│                                                                      │
│ [API ENDPOINT - Node.js Runtime]                                   │
│ 3. Verify JWT signature (needs crypto module)                      │
│    ✓ Signature valid → Continue                                    │
│    ✗ Invalid/expired → Return { valid: false }                    │
│                                                                      │
│ 4. Query Session table                                             │
│    ✓ Session found, isValid=true, expiresAt > now → Continue      │
│    ✗ Session not found or revoked → Return { valid: false }       │
│                                                                      │
│ 5. Verify User still exists                                        │
│    ✓ User found → Return { valid: true, userId }                  │
│    ✗ User not found → Return { valid: false }                     │
│                                                                      │
│ [MIDDLEWARE - Edge Runtime]                                        │
│ 6. Check response from /api/auth/verify                            │
│    ✓ { valid: true } → Set auth context, proceed                  │
│    ✗ { valid: false } → Return 401                                │
│    ✗ Network error → Return 401 (fail closed)                     │
│                                                                      │
│ 7. Route handler executes with auth context set                    │
│    → Render /dashboard (authenticated)                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: LOGOUT (POST /api/auth/logout)                             │
├─────────────────────────────────────────────────────────────────────┤
│ 1. Mark session as invalid in database                             │
│    → Session.isValid = false                                       │
│    → Session.updatedAt = now()                                     │
│                                                                      │
│ 2. Clear session cookie from response                              │
│    → Set-Cookie: session=; Max-Age=0                               │
│                                                                      │
│ 3. Redirect to /login                                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: NEXT REQUEST TO /DASHBOARD (after logout)                  │
├─────────────────────────────────────────────────────────────────────┤
│ [MIDDLEWARE - Edge Runtime]                                        │
│ 1. Extract 'session' cookie                                        │
│    ✓ Cookie still exists (client hasn't cleared) → Continue        │
│                                                                      │
│ 2. Route is protected → Call /api/auth/verify                      │
│                                                                      │
│ [API ENDPOINT - Node.js Runtime]                                   │
│ 3. Verify JWT signature                                            │
│    ✓ Signature still valid → Continue                              │
│                                                                      │
│ 4. Query Session table                                             │
│    ✗ Session.isValid = false → Return { valid: false }             │
│       (Or session not found due to delete)                         │
│                                                                      │
│ [MIDDLEWARE - Edge Runtime]                                        │
│ 5. Check response from /api/auth/verify                            │
│    ✗ { valid: false } → Return 401                                │
│    → Clear session cookie in response                              │
│                                                                      │
│ 6. Redirect to /login (or show 401)                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Alternative Flow: Session Revocation (Multi-Session Logout)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ADMIN: Revoke all sessions for a user                              │
├─────────────────────────────────────────────────────────────────────┤
│ Call invalidateUserSessions(userId)                                │
│ → UPDATE Session SET isValid = false WHERE userId = ?              │
│                                                                      │
│ All existing tokens become invalid immediately                      │
│ Next request with any token:                                       │
│ 1. JWT signature still valid (cryptographic check passes)          │
│ 2. But Session.isValid = false (database check fails)              │
│ 3. Return 401 (token is revoked)                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Alternative Flow: Expired Token

```
┌─────────────────────────────────────────────────────────────────────┐
│ After 30 days, token expires                                       │
├─────────────────────────────────────────────────────────────────────┤
│ Next request:                                                       │
│                                                                      │
│ [API ENDPOINT - Node.js Runtime]                                   │
│ 1. Verify JWT signature                                            │
│    ✗ Token expired (exp < now) → Return error                      │
│                                                                      │
│ OR                                                                  │
│                                                                      │
│ 2. Query Session table                                             │
│    ✗ Session.expiresAt < now → Return { valid: false }            │
│       (Session.isValid may be true, but expiration takes priority) │
│                                                                      │
│ [MIDDLEWARE - Edge Runtime]                                        │
│ Return 401 → Redirect to /login                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Edge Case: User Deleted Account

```
┌─────────────────────────────────────────────────────────────────────┐
│ User logs in → JWT and Session created                             │
│ → User deletes account (User record deleted from DB)               │
├─────────────────────────────────────────────────────────────────────┤
│ Next request:                                                       │
│                                                                      │
│ [API ENDPOINT - Node.js Runtime]                                   │
│ 1. Verify JWT signature → Valid                                    │
│ 2. Query Session → Found and valid                                 │
│ 3. Query User (SELECT id FROM User WHERE id = ?) → NOT FOUND       │
│    → User deleted, return { valid: false }                         │
│                                                                      │
│ [MIDDLEWARE - Edge Runtime]                                        │
│ Return 401 → Redirect to /login                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Edge Case: Concurrent Requests

```
┌─────────────────────────────────────────────────────────────────────┐
│ Two requests arrive simultaneously for same user                    │
├─────────────────────────────────────────────────────────────────────┤
│ Request 1: GET /cards         Request 2: POST /logout              │
│                                                                      │
│ Middleware (both):                                                  │
│ • Extract cookie → Same token in both                              │
│ • Call /api/auth/verify (may or may not be concurrent)            │
│                                                                      │
│ Possible Scenarios:                                                │
│                                                                      │
│ 1. Both /api/auth/verify calls happen before logout               │
│    → Both return { valid: true }                                   │
│    → GET /cards succeeds                                           │
│    → POST /logout sets isValid=false                               │
│    → CORRECT: Request came before logout took effect               │
│                                                                      │
│ 2. Logout happens between requests                                 │
│    → Request 1 /api/auth/verify returns { valid: true }            │
│    → logout sets isValid=false                                     │
│    → Request 2 /api/auth/verify returns { valid: false }           │
│    → CORRECT: Each request checked at different times              │
│                                                                      │
│ 3. Both happen simultaneously                                      │
│    → Database handles atomically (transaction)                     │
│    → Both /api/auth/verify calls may return { valid: true }        │
│       (if both check before update)                                │
│    → OR one returns { valid: false } (if checks after update)      │
│    → ACCEPTABLE: At least one succeeds, both are correct behavior  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## API Routes & Contracts

### 1. POST `/api/auth/verify` (NEW)

**Purpose:** Verify JWT token validity. Internal API endpoint (called by middleware only).

**HTTP Method:** POST

**Request Headers:**
```
Content-Type: application/json
X-Internal-Call: true  (OPTIONAL: for tracking internal vs external calls)
```

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1c2VyX2FiYzEyMyIsImlzc3VlZEF0IjoxNzAwMDAwMDAwLCJleHBpcmVzQXQiOjE3MDI1OTIwMDAsInNlc3Npb25JZCI6InNlc3Npb25fZGVmNDU2IiwidmVyc2lvbiI6MSwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDI1OTIwMDB9.signature..."
}
```

**Response - Success (200 OK):**
```json
{
  "valid": true,
  "userId": "user_abc123"
}
```

**Response - Failure (200 OK):**
```json
{
  "valid": false
}
```

**Response - Server Error (500):**
```json
{
  "valid": false,
  "error": "Internal server error"
}
```

**Status Codes:**
- `200 OK` - Always return this, check `valid` field in body
- `400 Bad Request` - Missing or malformed `token` field
- `500 Internal Server Error` - Database or cryptographic error

**Error Scenarios & Handling:**

| Scenario | JWT Valid? | Session Found? | User Exists? | Response |
|----------|-----------|----------------|------------|----------|
| Valid token, valid session, user exists | ✓ | ✓ | ✓ | `{ valid: true, userId }` |
| Token expired | ✗ | ✓ | ✓ | `{ valid: false }` |
| Session revoked (isValid=false) | ✓ | ✓ | ✓ | `{ valid: false }` |
| Session expires (expiresAt < now) | ✓ | ✓ | ✓ | `{ valid: false }` |
| Session not found in DB | ✓ | ✗ | ✓ | `{ valid: false }` |
| User deleted (not in User table) | ✓ | ✓ | ✗ | `{ valid: false }` |
| Malformed JWT | ✗ | - | - | `{ valid: false }` |
| Database error | - | - | - | `{ valid: false }` (fail closed) |
| Network timeout | - | - | - | Timeout error |

**Implementation Pseudocode:**
```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Parse and validate request
    const { token } = await request.json();
    if (!token || typeof token !== 'string') {
      return NextResponse.json({ valid: false }, { status: 400 });
    }

    // 2. Verify JWT signature (requires crypto module - OK here in Node.js)
    let payload;
    try {
      payload = verifySessionToken(token);  // Uses jsonwebtoken internally
    } catch (error) {
      // Token is invalid, expired, or malformed
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    // 3. Query Session table
    const session = await getSessionByToken(token);
    if (!session) {
      // Session not found, revoked, or expired
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    // 4. Verify user still exists
    const userExists = await userExists(session.userId);
    if (!userExists) {
      // User account was deleted
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    // 5. All checks passed
    return NextResponse.json(
      { valid: true, userId: session.userId },
      { status: 200 }
    );
  } catch (error) {
    // Unexpected error - fail closed
    console.error('[/api/auth/verify] Error:', error);
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}
```

---

### 2. Updated Middleware Behavior (middleware.ts)

**Current Broken Code:**
```typescript
// BROKEN: This calls verifyToken() which uses jsonwebtoken (requires crypto)
const payload = verifyToken(sessionToken);  // ✗ Crashes in Edge Runtime
```

**New Code:**
```typescript
// FIXED: Call /api/auth/verify endpoint instead
const verifyResponse = await fetch('http://localhost:3000/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: sessionToken }),
});
const { valid, userId } = await verifyResponse.json();
```

**Complete Protected Route Flow:**
```typescript
if (isProtected) {
  const sessionToken = extractSessionToken(request);

  if (!sessionToken) {
    return createUnauthorizedResponse('Authentication required');
  }

  // Call /api/auth/verify instead of verifyToken()
  let verifyResponse;
  try {
    verifyResponse = await fetch('http://localhost:3000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken }),
      // Add timeout to fail quickly if API is slow
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    // Network error or timeout - deny access (fail closed)
    console.error('[Auth Middleware] Token verification request failed:', error);
    return createUnauthorizedResponse('Authentication service unavailable');
  }

  if (!verifyResponse.ok) {
    return createUnauthorizedResponse('Invalid session');
  }

  const { valid, userId } = await verifyResponse.json();

  if (!valid) {
    return createUnauthorizedResponse('Session invalid or revoked');
  }

  // Auth successful
  return await runWithAuthContext(
    { userId },
    async () => NextResponse.next()
  );
}
```

---

### 3. Existing Auth Endpoints (No Changes)

These endpoints already exist and do not need modification:

- **POST `/api/auth/login`** - Verifies password, creates session, sets cookie
- **POST `/api/auth/logout`** - Revokes session, clears cookie
- **POST `/api/auth/signup`** - Creates user, creates initial session

These continue to work as before (they're in Node.js runtime anyway).

---

## Edge Cases & Error Handling

### Edge Case 1: Network Failure Calling /api/auth/verify

**Scenario:** Internal fetch to `/api/auth/verify` times out or connection refused

**How to Handle:**
- Set timeout to 5 seconds using `AbortSignal.timeout(5000)`
- Catch network errors: `fetch()` rejects promise on network error
- Log error (for debugging production issues)
- Return 401 (fail closed - never grant access on unknown errors)

**Code:**
```typescript
try {
  const verifyResponse = await fetch('http://localhost:3000/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: sessionToken }),
    signal: AbortSignal.timeout(5000),
  });
  // Handle response...
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('[Middleware] Token verification timeout');
  } else {
    console.error('[Middleware] Token verification failed:', error.message);
  }
  return createUnauthorizedResponse('Authentication service unavailable');
}
```

**Expected Outcome:** User sees 401 error, tries login again

---

### Edge Case 2: Malformed JWT Token

**Scenario:** Cookie contains invalid/corrupted JWT (e.g., truncated, wrong encoding)

**How to Handle:**
- `verifySessionToken()` throws `JsonWebTokenError` on invalid token
- Catch error in `/api/auth/verify` endpoint
- Return `{ valid: false }` (not an error response)
- Middleware returns 401

**Code (in /api/auth/verify):**
```typescript
let payload;
try {
  payload = verifySessionToken(token);
} catch (error: any) {
  // Common errors:
  // - JsonWebTokenError: "invalid token" (format, signature, etc.)
  // - TokenExpiredError: "jwt expired"
  if (error.name === 'TokenExpiredError') {
    console.warn('[/api/auth/verify] Token expired:', error.expiredAt);
  } else if (error.name === 'JsonWebTokenError') {
    console.warn('[/api/auth/verify] Invalid token:', error.message);
  }
  return NextResponse.json({ valid: false }, { status: 200 });
}
```

**Expected Outcome:** User sees 401 error, must log in again

---

### Edge Case 3: Session Revoked Between Requests

**Scenario:** User logs out. Token is still valid (cryptographically) but session is revoked.

**How to Handle:**
- Check `session.isValid` flag in `/api/auth/verify`
- Return `{ valid: false }` if `isValid === false`
- Middleware returns 401
- User redirected to login

**Code (in /api/auth/verify):**
```typescript
const session = await getSessionByToken(token);

if (!session || !session.isValid) {
  return NextResponse.json({ valid: false }, { status: 200 });
}
```

**Expected Outcome:** User must log in again. Session revocation is immediate.

---

### Edge Case 4: User Deleted Account

**Scenario:** User logs in. Session created. User deletes account. Token is still valid but user no longer exists.

**How to Handle:**
- Check `userExists(userId)` in `/api/auth/verify`
- Return `{ valid: false }` if user not found
- Middleware returns 401
- User redirected to login

**Code (in /api/auth/verify):**
```typescript
const userExists = await userExists(session.userId);
if (!userExists) {
  return NextResponse.json({ valid: false }, { status: 200 });
}
```

**Expected Outcome:** User account cannot be used. Must create new account.

---

### Edge Case 5: Token Expiration

**Scenario:** Token is > 30 days old. JWT expiration is reached.

**How to Handle:**
- `verifySessionToken()` throws `TokenExpiredError` (or similar)
- Catch error in `/api/auth/verify`
- Return `{ valid: false }`
- Middleware returns 401, user must log in again

**Alternative Check:** Even if JWT signature is valid, also check `session.expiresAt`

**Code (in /api/auth/verify):**
```typescript
// First check: JWT expiration (catches expired tokens)
let payload;
try {
  payload = verifySessionToken(token);  // Throws if exp < now
} catch (error: any) {
  if (error.name === 'TokenExpiredError') {
    console.info('[/api/auth/verify] Token expired');
  }
  return NextResponse.json({ valid: false }, { status: 200 });
}

// Second check: Database expiration (additional safety)
const session = await getSessionByToken(token);
if (session && session.expiresAt < new Date()) {
  return NextResponse.json({ valid: false }, { status: 200 });
}
```

**Expected Outcome:** User must log in to get a fresh token.

---

### Edge Case 6: Concurrent Logout + Request

**Scenario:** User makes two simultaneous requests: one to /logout, one to /dashboard.

**How to Handle:**
- Logout updates `Session.isValid = false`
- Both concurrent `/api/auth/verify` calls may see different states
- One may return `true`, one may return `false`
- This is acceptable - they happened at different logical times
- Database ensures atomicity (ACID guarantees)

**Code (in /api/auth/verify):**
```typescript
// This is a point-in-time check
// If another request updates isValid while we're checking, that's OK
const session = await getSessionByToken(token);

// Check exact state at this moment
if (!session?.isValid) {
  return NextResponse.json({ valid: false }, { status: 200 });
}
```

**Expected Outcome:** At least one request succeeds, one fails. No data corruption.

---

### Edge Case 7: Database Error During Verification

**Scenario:** Prisma fails to query Session table (network, timeout, corrupted data, etc.)

**How to Handle:**
- Try/catch around database operations
- Log error (for debugging)
- Return `{ valid: false }` (fail closed)
- Never grant access when verification fails

**Code (in /api/auth/verify):**
```typescript
try {
  const session = await getSessionByToken(token);
  const userValid = await userExists(session.userId);
  // ...
} catch (error: any) {
  console.error('[/api/auth/verify] Database error:', {
    code: error.code,
    message: error.message,
  });
  return NextResponse.json({ valid: false }, { status: 200 });
}
```

**Expected Outcome:** User sees 401. Database error is logged. No security breach.

---

### Edge Case 8: Cookie Parsing Error

**Scenario:** Cookie is malformed and causes parsing to fail in middleware.

**How to Handle:**
- Try/catch around `request.cookies.get()`
- Log error
- Return `null` (treat as missing cookie)
- Return 401

**Code (in middleware.ts):**
```typescript
function extractSessionToken(request: NextRequest): string | null {
  try {
    const token = request.cookies.get('session')?.value;
    return token || null;
  } catch (error) {
    console.error('[Auth Middleware] Error parsing cookies:', error);
    return null;  // Treat malformed cookie as missing
  }
}
```

**Expected Outcome:** User must log in again. Bad cookies don't crash middleware.

---

### Edge Case 9: Signature Verification with Wrong Secret

**Scenario:** (Should not happen in production) Session secret changed but token still uses old secret.

**How to Handle:**
- `verifySessionToken()` throws `JsonWebTokenError` on signature mismatch
- Catch and return `{ valid: false }`
- Middleware returns 401
- User must log in again

**Code (handles automatically):**
```typescript
try {
  payload = verifySessionToken(token);  // Uses SESSION_SECRET from env
  // Throws if signature doesn't match
} catch (error) {
  // Including signature mismatch errors
  return NextResponse.json({ valid: false }, { status: 200 });
}
```

**Expected Outcome:** All users must re-login if secret changes. Prevents token reuse.

---

### Edge Case 10: Large Concurrent Load

**Scenario:** Many users request `/dashboard` simultaneously. Thousands of calls to `/api/auth/verify` at once.

**How to Handle:**
- `/api/auth/verify` is stateless (no shared mutable state)
- Each call is independent
- Prisma connection pool handles multiple queries
- No race conditions (ACID guarantees)

**Optimization Recommendations:**
- Add connection pooling in Prisma (already done)
- Consider caching in Redis (future optimization, not required now)
- Monitor database query latency
- Set timeout in middleware (5 seconds) to fail fast

**Expected Outcome:** All requests are handled correctly. No deadlocks or data corruption.

---

### Edge Case 11: Invalid Request Body to /api/auth/verify

**Scenario:** Middleware (or attacker) sends malformed JSON to `/api/auth/verify`

**How to Handle:**
- Try/catch around `request.json()`
- Validate `token` field exists and is a string
- Return 400 Bad Request if validation fails

**Code (in /api/auth/verify):**
```typescript
let token;
try {
  const body = await request.json();
  token = body?.token;
} catch (error) {
  return NextResponse.json({ valid: false }, { status: 400 });
}

if (!token || typeof token !== 'string') {
  return NextResponse.json({ valid: false }, { status: 400 });
}
```

**Expected Outcome:** Invalid requests are rejected. Service is resilient.

---

### Edge Case 12: Missing SESSION_SECRET Environment Variable

**Scenario:** Deployment issue: `SESSION_SECRET` env var not set.

**How to Handle:**
- `getSessionSecret()` checks and throws
- Catch at startup (during verification)
- Fail loudly in logs
- Return 500 error on requests

**Code (in /api/auth/verify):**
```typescript
try {
  payload = verifySessionToken(token);  // Calls getSessionSecret() internally
} catch (error) {
  if (error.message.includes('SESSION_SECRET')) {
    console.error('[CRITICAL] SESSION_SECRET not configured', error);
    // Return 500 so monitoring alerts trigger
    return NextResponse.json(
      { valid: false, error: 'Server configuration error' },
      { status: 500 }
    );
  }
  return NextResponse.json({ valid: false }, { status: 200 });
}
```

**Expected Outcome:** Deployment fails with clear error. Prevents silent failures.

---

## Component Architecture

### System Components

```
┌────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                            │
│                                                                    │
│  1. Sends HTTP request with 'session' cookie (HttpOnly)            │
└────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│              EDGE RUNTIME (Vercel/Railway)                         │
│              ┌─────────────────────────────────────┐              │
│              │  middleware.ts                      │              │
│              │                                     │              │
│              │  1. extractSessionToken()           │              │
│              │     - Read cookie (NO crypto)       │              │
│              │                                     │              │
│              │  2. Check route classification      │              │
│              │     - PUBLIC vs PROTECTED           │              │
│              │                                     │              │
│              │  3. For protected routes:           │              │
│              │     - Call /api/auth/verify (HTTP)  │              │
│              │     - Wait for response             │              │
│              │     - Check { valid, userId }       │              │
│              │                                     │              │
│              │  4. Set auth context                │              │
│              │     - runWithAuthContext()          │              │
│              │                                     │              │
│              │  5. Pass to route handler           │              │
│              └─────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│              NODE.JS RUNTIME (Railway)                             │
│              ┌─────────────────────────────────────┐              │
│              │  /api/auth/verify (NEW)             │              │
│              │                                     │              │
│              │  1. Parse request body              │              │
│              │     - Extract token                 │              │
│              │                                     │              │
│              │  2. verifySessionToken()            │              │
│              │     - Uses jsonwebtoken library     │              │
│              │     - Uses crypto module ✓ OK HERE  │              │
│              │     - Validates signature           │              │
│              │     - Checks expiration             │              │
│              │                                     │              │
│              │  3. getSessionByToken()             │              │
│              │     - Query Session table           │              │
│              │     - Check isValid flag            │              │
│              │     - Check expiresAt timestamp     │              │
│              │                                     │              │
│              │  4. userExists()                    │              │
│              │     - Query User table              │              │
│              │     - Verify account still exists   │              │
│              │                                     │              │
│              │  5. Return response                 │              │
│              │     - { valid: true, userId }       │              │
│              │     - { valid: false }              │              │
│              └─────────────────────────────────────┘              │
│                                                                    │
│              ┌─────────────────────────────────────┐              │
│              │  Other Auth Routes (existing)       │              │
│              │                                     │              │
│              │  - POST /api/auth/login             │              │
│              │  - POST /api/auth/logout            │              │
│              │  - POST /api/auth/signup            │              │
│              │  - POST /api/auth/session           │              │
│              └─────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────────────┐
│              DATABASE (PostgreSQL on Railway)                      │
│                                                                    │
│  Tables:                                                           │
│  - User (lookup user by ID)                                       │
│  - Session (lookup token, check isValid, check expiresAt)         │
│                                                                    │
│  Indexes for performance:                                         │
│  - Session.sessionToken (unique, for lookups)                     │
│  - Session.userId (for lookups, cleanup)                          │
│  - Session.expiresAt (for cleanup of old sessions)                │
└────────────────────────────────────────────────────────────────────┘
```

### Component Interactions

| Component | Component | Interaction | Direction |
|-----------|-----------|-------------|-----------|
| Middleware | Client | HTTP Request/Response | ← → |
| Middleware | /api/auth/verify | Internal fetch (HTTP) | → ← |
| /api/auth/verify | Database | Prisma queries | → ← |
| Auth utilities | Database | Prisma queries | → ← |
| Client | Auth utilities | Server actions | → ← |

### Dependency Graph

```
Client Request
  ↓
middleware.ts
  ├─ extractSessionToken (simple string extraction)
  ├─ isProtectedRoute (set classification)
  └─ fetch /api/auth/verify (internal HTTP call)
       ↓
       /api/auth/verify endpoint
         ├─ request.json() (parse request)
         ├─ verifySessionToken() [from auth-utils.ts]
         │   └─ Uses jsonwebtoken (requires crypto)
         ├─ getSessionByToken() [from auth-server.ts]
         │   └─ Prisma query
         ├─ userExists() [from auth-server.ts]
         │   └─ Prisma query
         └─ response.json() (build response)
```

### Key Separation of Concerns

| Component | Responsibility | Runtime | Can Use Crypto? |
|-----------|-----------------|---------|-----------------|
| middleware.ts | Route classification, cookie extraction, auth context | Edge | ✗ No |
| /api/auth/verify | Token verification, session validation | Node.js | ✓ Yes |
| auth-utils.ts | JWT signing/verification, password hashing | Node.js | ✓ Yes |
| auth-server.ts | Database queries, user/session management | Node.js | ✓ Yes |
| auth-context.ts | AsyncLocalStorage for auth context | Both | ✓ Yes (primitives only) |

---

## Implementation Tasks

### Phase 1: Planning & Testing

**Task 1.1: Document Current Flow**
- **Complexity:** Small
- **Depends on:** None
- **Deliverables:**
  1. Diagram: Current request flow (middleware → verifyToken → crypto ✗)
  2. List of all functions that need relocation
  3. Error cases in current implementation
- **Acceptance Criteria:**
  - [ ] Diagram shows exact point where crypto fails
  - [ ] All 5+ functions calling crypto are identified
  - [ ] Current error messages documented

**Task 1.2: Design New Architecture**
- **Complexity:** Small
- **Depends on:** Task 1.1
- **Deliverables:**
  1. Diagram: New two-tier architecture (middleware → /api/auth/verify → crypto)
  2. Internal API contract specification
  3. Network failure handling strategy
- **Acceptance Criteria:**
  - [ ] Diagram shows middleware in Edge Runtime, /api/auth/verify in Node.js
  - [ ] All status codes and response formats defined
  - [ ] Timeout strategy documented (5 seconds recommended)

**Task 1.3: Write Unit Tests for /api/auth/verify**
- **Complexity:** Medium
- **Depends on:** Task 1.2
- **Deliverables:**
  1. Test suite with 12+ test cases
  2. Coverage for all success/failure scenarios
  3. Mock database for tests
- **Acceptance Criteria:**
  - [ ] Tests for valid token → { valid: true }
  - [ ] Tests for invalid token → { valid: false }
  - [ ] Tests for revoked session → { valid: false }
  - [ ] Tests for expired token → { valid: false }
  - [ ] Tests for missing user → { valid: false }
  - [ ] Tests for database error → { valid: false }
  - [ ] All tests pass before Phase 2
  - [ ] Code coverage > 90%

**Task 1.4: Write Integration Tests (Middleware + API)**
- **Complexity:** Medium
- **Depends on:** Task 1.3
- **Deliverables:**
  1. Integration test suite
  2. Mock HTTP server for middleware tests
  3. Test cases for network failures
- **Acceptance Criteria:**
  - [ ] Test full flow: middleware → /api/auth/verify → response
  - [ ] Test network timeout (> 5s) → 401
  - [ ] Test network error → 401
  - [ ] Test concurrent requests (no race conditions)
  - [ ] All tests pass

---

### Phase 2: Implement /api/auth/verify Endpoint

**Task 2.1: Create New Route File**
- **Complexity:** Small
- **Depends on:** Phase 1 (tests written)
- **Deliverables:**
  1. `/src/app/api/auth/verify/route.ts`
  2. Request validation
  3. Response builders
- **Acceptance Criteria:**
  - [ ] File created at correct path
  - [ ] Exports `POST` function
  - [ ] Request body validated
  - [ ] Response schemas match spec

**Task 2.2: Implement Token Verification Logic**
- **Complexity:** Medium
- **Depends on:** Task 2.1
- **Deliverables:**
  1. Call `verifySessionToken()` from auth-utils.ts
  2. Error handling for invalid/expired tokens
  3. Return `{ valid: false }` on any crypto error
- **Acceptance Criteria:**
  - [ ] Valid token returns payload
  - [ ] Expired token caught and handled
  - [ ] Malformed token caught and handled
  - [ ] No unhandled exceptions
  - [ ] Unit tests pass

**Task 2.3: Implement Database Validation**
- **Complexity:** Medium
- **Depends on:** Task 2.2
- **Deliverables:**
  1. Call `getSessionByToken()` from auth-server.ts
  2. Check `isValid` flag
  3. Check `expiresAt` timestamp
  4. Call `userExists()` to verify user still exists
- **Acceptance Criteria:**
  - [ ] Session found → continue
  - [ ] Session not found → return { valid: false }
  - [ ] isValid=false → return { valid: false }
  - [ ] expiresAt < now → return { valid: false }
  - [ ] User not found → return { valid: false }
  - [ ] Unit tests pass

**Task 2.4: Implement Error Handling**
- **Complexity:** Medium
- **Depends on:** Task 2.3
- **Deliverables:**
  1. Try/catch around all operations
  2. Logging for each error type
  3. Fail-closed responses (never grant access on error)
- **Acceptance Criteria:**
  - [ ] Database errors logged and handled
  - [ ] Crypto errors logged and handled
  - [ ] Network errors logged and handled
  - [ ] All errors return 200 OK with { valid: false }
  - [ ] No unhandled exceptions
  - [ ] Integration tests pass

**Task 2.5: Test Complete /api/auth/verify**
- **Complexity:** Small
- **Depends on:** Task 2.4
- **Deliverables:**
  1. Run unit test suite
  2. Verify all 12+ test cases pass
  3. Check code coverage
- **Acceptance Criteria:**
  - [ ] All unit tests pass
  - [ ] Code coverage > 90%
  - [ ] No console errors or warnings
  - [ ] Endpoint responds in < 100ms for success cases

---

### Phase 3: Refactor Middleware

**Task 3.1: Remove Broken Token Verification**
- **Complexity:** Small
- **Depends on:** Phase 2 (API exists and tested)
- **Deliverables:**
  1. Remove `import { verifySessionToken }`
  2. Remove `verifyToken()` function
  3. Remove `validateSessionInDatabase()` function
- **Acceptance Criteria:**
  - [ ] `verifySessionToken` import removed
  - [ ] `verifyToken()` function deleted
  - [ ] `validateSessionInDatabase()` function deleted
  - [ ] No references to these functions remain
  - [ ] File still compiles (tests will fail, that's expected)

**Task 3.2: Add Internal /api/auth/verify Call**
- **Complexity:** Medium
- **Depends on:** Task 3.1
- **Deliverables:**
  1. For protected routes: fetch `/api/auth/verify`
  2. Send token in POST body (not URL)
  3. Set 5-second timeout
  4. Parse response
- **Acceptance Criteria:**
  - [ ] Fetch call uses POST method
  - [ ] Token sent in body (not query param)
  - [ ] Content-Type header set correctly
  - [ ] Timeout configured (5 seconds)
  - [ ] Response parsed correctly

**Task 3.3: Update Protected Route Handler**
- **Complexity:** Medium
- **Depends on:** Task 3.2
- **Deliverables:**
  1. Check `valid` field from response
  2. Extract `userId` from response
  3. Set auth context on success
  4. Return 401 on failure
- **Acceptance Criteria:**
  - [ ] Valid response → set auth context with userId
  - [ ] Invalid response → return 401
  - [ ] Network error → return 401
  - [ ] Integration tests pass

**Task 3.4: Add Error Handling**
- **Complexity:** Medium
- **Depends on:** Task 3.3
- **Deliverables:**
  1. Try/catch around fetch
  2. Handle timeout errors
  3. Handle network errors
  4. Handle JSON parse errors
- **Acceptance Criteria:**
  - [ ] Timeout errors caught and handled
  - [ ] Network errors caught and handled
  - [ ] JSON parse errors caught and handled
  - [ ] All errors result in 401 (fail closed)
  - [ ] Error messages logged but not exposed to client

**Task 3.5: Test Refactored Middleware**
- **Complexity:** Medium
- **Depends on:** Task 3.4
- **Deliverables:**
  1. Run middleware unit tests
  2. Run middleware integration tests
  3. Verify no Edge Runtime crypto errors
- **Acceptance Criteria:**
  - [ ] All middleware tests pass
  - [ ] No errors in Edge Runtime logs
  - [ ] No `crypto` module errors
  - [ ] Protected routes require auth
  - [ ] Public routes allow no auth
  - [ ] Concurrent requests handled correctly

---

### Phase 4: Testing & Validation

**Task 4.1: Run Full Test Suite**
- **Complexity:** Small
- **Depends on:** Phase 3 (middleware refactored)
- **Deliverables:**
  1. Run `npm run test` (all tests)
  2. Fix any failing tests
  3. Generate coverage report
- **Acceptance Criteria:**
  - [ ] All tests pass
  - [ ] Code coverage > 90%
  - [ ] No console errors or warnings
  - [ ] Test execution time < 60 seconds

**Task 4.2: Edge Case Testing**
- **Complexity:** Medium
- **Depends on:** Task 4.1
- **Deliverables:**
  1. Test all 12 edge cases documented in spec
  2. Add test cases for any edge cases found
  3. Document test results
- **Acceptance Criteria:**
  - [ ] Test expired token → 401
  - [ ] Test revoked session → 401
  - [ ] Test deleted user → 401
  - [ ] Test malformed token → 401
  - [ ] Test network timeout → 401
  - [ ] Test database error → 401
  - [ ] Test concurrent logout+request → both handled correctly
  - [ ] Test cookie parsing error → no crash
  - [ ] All edge case tests pass

**Task 4.3: Performance Testing**
- **Complexity:** Medium
- **Depends on:** Task 4.2
- **Deliverables:**
  1. Measure middleware latency
  2. Measure `/api/auth/verify` latency
  3. Test with realistic load (100+ concurrent requests)
  4. Document performance baseline
- **Acceptance Criteria:**
  - [ ] Middleware latency < 50ms (with cached responses)
  - [ ] /api/auth/verify latency < 100ms (with database queries)
  - [ ] No timeouts under 100 concurrent requests
  - [ ] No memory leaks during load test
  - [ ] Performance report documented

**Task 4.4: Session Revocation Testing**
- **Complexity:** Medium
- **Depends on:** Task 4.3
- **Deliverables:**
  1. Test logout revokes session immediately
  2. Test next request is denied after logout
  3. Test concurrent requests during logout
  4. Test session list is updated
- **Acceptance Criteria:**
  - [ ] Logout sets isValid=false
  - [ ] Next request to protected route → 401
  - [ ] Concurrent requests during logout handled correctly
  - [ ] Session list shows correct revocation

**Task 4.5: Railway Deployment Dry Run**
- **Complexity:** Medium
- **Depends on:** Task 4.4
- **Deliverables:**
  1. Deploy to Railway staging environment
  2. Run smoke tests
  3. Check logs for errors
  4. Verify no crypto errors
- **Acceptance Criteria:**
  - [ ] Deployment succeeds
  - [ ] Application starts without errors
  - [ ] Login flow works
  - [ ] Dashboard loads after login
  - [ ] No crypto errors in logs
  - [ ] No Edge Runtime errors in logs

---

### Phase 5: Deployment & Monitoring

**Task 5.1: Production Deployment**
- **Complexity:** Small
- **Depends on:** Phase 4 (dry run succeeded)
- **Deliverables:**
  1. Deploy to Railway production
  2. Monitor first hour of traffic
  3. Check logs for errors
- **Acceptance Criteria:**
  - [ ] Deployment to production succeeds
  - [ ] Application starts
  - [ ] Login works
  - [ ] No crypto errors in logs
  - [ ] Error rate < 0.1% in first hour

**Task 5.2: Smoke Testing**
- **Complexity:** Small
- **Depends on:** Task 5.1
- **Deliverables:**
  1. Test login flow
  2. Test protected route access
  3. Test logout
  4. Test session revocation
- **Acceptance Criteria:**
  - [ ] Login succeeds (email + password)
  - [ ] Dashboard loads after login
  - [ ] Logout clears session
  - [ ] Next request after logout → 401
  - [ ] Concurrent requests work

**Task 5.3: Set Up Monitoring & Alerts**
- **Complexity:** Small
- **Depends on:** Task 5.2
- **Deliverables:**
  1. Monitor for crypto errors (should be zero)
  2. Monitor Edge Runtime errors
  3. Monitor /api/auth/verify latency
  4. Alert on error spikes
- **Acceptance Criteria:**
  - [ ] Alerts configured
  - [ ] Dashboard shows crypto error count (should be 0)
  - [ ] Alerts trigger on errors > 1% of traffic
  - [ ] Logs are searchable

**Task 5.4: Documentation**
- **Complexity:** Small
- **Depends on:** Task 5.3
- **Deliverables:**
  1. Document the fix in README
  2. Add section explaining two-tier architecture
  3. Add troubleshooting guide
- **Acceptance Criteria:**
  - [ ] README updated with two-tier architecture explanation
  - [ ] Environment variable requirements documented
  - [ ] Troubleshooting section added
  - [ ] Links to this spec included

---

## Security & Compliance Considerations

### Authentication & Authorization Strategy

**1. Session-Based Authentication (Not Stateless)**
- Tokens are stored in database (`Session.sessionToken`)
- Allows immediate revocation (logout, forced logout, account deletion)
- Stateless JWT-only would allow using token after logout (security risk)

**2. JWT Verification** (Not Relying Solely on Signature)
- Signature verified (prevents tampering)
- BUT ALSO checked in database (prevents revoked token reuse)
- This dual-check is the key security feature

**3. Cookie Storage**
- Session token stored in **HttpOnly** cookie (JavaScript cannot access)
- Prevents XSS attacks (if JS code is compromised, token is still safe)
- **Secure** flag: Only sent over HTTPS (prevents man-in-the-middle)
- **SameSite=Strict**: Prevents CSRF attacks (cookie not sent to third-party sites)

**4. Password Hashing**
- Argon2id algorithm (memory-hard, resistant to GPU/ASIC attacks)
- Parameters: 64MB memory, 2 iterations
- Timing-safe verification prevents timing attacks

**5. Environment Variables**
- `SESSION_SECRET`: 256-bit key, stored securely (not in code)
- `DATABASE_URL`: Never logged or exposed
- All secrets validated at startup

### Data Protection & Privacy

**1. Minimal Token Payload**
- Only `userId`, `issuedAt`, `expiresAt`, `sessionId`, `version`
- No sensitive data in JWT (could be decoded by anyone)
- Signature prevents tampering, not reading

**2. Error Messages** (Generic, No Information Leaks)
- `"Invalid or expired session"` (not "token expired" or "session revoked")
- `"Authentication required"` (not "no cookie found")
- Prevents attackers from learning system details

**3. Database Sessions**
- Store in database for revocation and audit
- Can be used to show user "active sessions"
- Can be used for forced logout (admin feature)

**4. User Agent & IP Tracking** (Optional)
- `Session.userAgent`: Device info (for multi-device support)
- `Session.ipAddress`: IP address (for security monitoring)
- Used for "confirm new device" flows (future feature)
- Not used for authentication (can be spoofed)

### Audit & Logging

**1. Auth Events to Log**
- Login (success/failure, email, timestamp)
- Logout (user, timestamp)
- Session revocation (reason, admin user if forced)
- Failed token verification (no token details, just count)
- Unusual activity (failed attempts spike, deleted users, etc.)

**2. What NOT to Log**
- Tokens (even partial, hashes are OK)
- Passwords (even hashes, use separate audit log)
- Full JWT payload (log just the claims, not the value)
- Sensitive user data (emails in production logs are risky)

**3. Log Retention**
- Keep auth logs for 90 days minimum
- Longer retention for compliance (industry depends)
- Log storage should be separate from application logs

### Security Checklist

- ✅ Tokens stored in HttpOnly cookies (XSS-safe)
- ✅ Cookies marked Secure (HTTPS-only)
- ✅ Cookies marked SameSite=Strict (CSRF-safe)
- ✅ Passwords hashed with Argon2id (GPU-resistant)
- ✅ Session tokens stored in database (revocation works)
- ✅ JWT verified in Node.js runtime (safe)
- ✅ Middleware doesn't handle crypto (Edge Runtime safe)
- ✅ Error messages are generic (no information leaks)
- ✅ Environment variables validated at startup
- ✅ Session revocation happens immediately (logout works)
- ✅ User deletion is handled (account removal works)
- ✅ Concurrent requests are handled correctly (no race conditions)

---

## Performance & Scalability Considerations

### Expected Load & Growth

**Baseline Assumptions:**
- 100-500 concurrent users per day
- 1-2 requests per user per minute (on average)
- Peak: 10x concurrent during business hours
- Growth: 2x year-over-year for first 2 years

**Scaling Checkpoints:**
- 1,000 concurrent users: Current architecture OK
- 5,000 concurrent users: Add Redis caching
- 10,000+ concurrent users: Consider session microservice

### Caching Strategies

**Current (No Cache):**
- Every protected route request → `/api/auth/verify` call
- Every verify call → Database query
- Acceptable for 1,000 concurrent users

**Future Optimization (Redis):**
- Cache session validity in Redis (5-minute TTL)
- Check Redis first in `/api/auth/verify`
- If miss: Query database and update Redis
- If session revoked: Invalidate Redis cache immediately
- Reduces database load by ~80%

**Caching Trade-off:**
- Pro: Reduced database load, faster responses
- Con: Revocation takes up to 5 minutes (instead of immediate)
- Mitigate: For critical logout, clear Redis immediately

### Database Optimization

**Indexes (Already Recommended in Schema):**

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| Session | `(sessionToken)` | Unique | Fast token lookup |
| Session | `(userId)` | Index | Fast user lookups |
| Session | `(expiresAt)` | Index | Fast cleanup queries |
| Session | `(userId, sessionToken)` | Unique Composite | Prevent duplicates |

**Query Patterns:**
```sql
-- Lookup by token (most frequent)
SELECT * FROM Session WHERE sessionToken = ?;
-- ✅ Uses index on sessionToken (unique)

-- Cleanup expired sessions
DELETE FROM Session WHERE expiresAt < NOW();
-- ✅ Uses index on expiresAt for fast scans

-- Get user sessions
SELECT * FROM Session WHERE userId = ? AND isValid = true;
-- ✅ Uses index on userId
```

**Vacuum & Maintenance:**
- PostgreSQL auto-vacuum enabled (default)
- Manually cleanup expired sessions: Monthly cron job
- Monitor index bloat: Quarterly analysis
- Monitor query performance: APM tool (New Relic, DataDog)

### Rate Limiting & Throttling

**Current (No Rate Limit):**
- Acceptable for trusted internal API call only
- `/api/auth/verify` is called only by middleware

**If Made Public (Do NOT recommend):**
- Limit: 100 requests/sec per IP
- Limit: 1000 requests/sec globally
- Implement in middleware or CDN (Cloudflare)

### Latency Targets

| Operation | Target | Current Est. | Acceptable? |
|-----------|--------|--------------|------------|
| Token extraction | < 1ms | 0.1ms | ✅ Yes |
| Route classification | < 1ms | 0.2ms | ✅ Yes |
| Fetch /api/auth/verify | < 100ms | 50-80ms | ✅ Yes |
| JWT verification | < 10ms | 5-8ms | ✅ Yes |
| Database query | < 50ms | 20-30ms | ✅ Yes |
| Total middleware + API | < 150ms | 80-120ms | ✅ Yes |

**Latency Testing:**
- Measure P50, P95, P99 latencies
- Monitor for sudden increases (indicates issues)
- Alert if P99 > 500ms (something is slow)

### Concurrent Request Handling

**Database Connections:**
- Prisma default pool: 10 connections
- Acceptable for 1,000 concurrent users
- Scale to 50 connections for 10,000+ users

**Connection Pool Configuration:**
```typescript
// In .env.local
DATABASE_URL="postgresql://...?pool_size=10"
```

**Load Testing Script:**
```bash
# Install: npm install -D k6
# Run: k6 run load-test.js

import http from 'k6/http';

export default function() {
  const res = http.post('http://localhost:3000/api/auth/verify', {
    token: '...'
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'valid true or false': (r) => {
      const body = JSON.parse(r.body);
      return 'valid' in body;
    }
  });
}

export const options = {
  vus: 100,  // 100 concurrent users
  duration: '30s',
};
```

---

## Quality Control Checklist

Before marking this specification complete, verify:

- ✅ **Requirements**: All user requirements are addressed
  - Two-tier architecture (Edge + Node.js)
  - No crypto in Edge Runtime
  - Session revocation still works
  - Concurrent requests handled
  
- ✅ **Data Schema**: Supports all functional requirements
  - Session table stores token and isValid flag
  - User table exists and is queried
  - Indexes defined for performance
  - No schema changes needed
  
- ✅ **API Design**: RESTful and intuitive
  - POST /api/auth/verify clear contract
  - Request/response schemas fully specified
  - Error cases documented
  - Status codes defined
  
- ✅ **User Flows**: Complete with error paths
  - Login → Protected route → Logout flow mapped
  - Session revocation flow documented
  - Expired token handling shown
  - Deleted user handling shown
  
- ✅ **Edge Cases**: Realistic and comprehensively handled
  - 12 edge cases documented
  - Each case has handling strategy
  - No unhandled scenarios
  
- ✅ **Components**: Truly modular and parallel-developable
  - Middleware and API are independent (after API exists)
  - Phase 1 (tests) can start immediately
  - Phases can be done in parallel if needed
  - Clear interfaces between components
  
- ✅ **Implementation Tasks**: Specific and measurable
  - 20 tasks defined across 5 phases
  - Each task has acceptance criteria
  - Dependencies mapped
  - Complexity estimated
  
- ✅ **Security**: Addressed comprehensively
  - HttpOnly, Secure, SameSite cookies documented
  - Password hashing strategy explained
  - Error handling prevents info leaks
  - Revocation is immediate
  
- ✅ **Performance**: Scalability considered
  - Current load can be handled
  - Future optimization path (Redis) outlined
  - Database indexes recommended
  - Latency targets defined
  
- ✅ **Clarity**: Engineers can code from this spec
  - No ambiguous requirements
  - Code examples provided
  - Error handling is explicit
  - All scenarios documented

---

## Appendix: Related Documentation

- Current middleware implementation: `src/middleware.ts`
- Authentication utilities: `src/lib/auth-utils.ts`
- Server utilities: `src/lib/auth-server.ts`
- Auth context: `src/lib/auth-context.ts`
- Prisma schema: `prisma/schema.prisma`
- Environment variables: `.env.example`

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2024-04-03 | System | Initial specification for Edge Runtime auth fix |

