# QA CODE REVIEW: Authentication System Implementation

**Review Date:** April 1, 2026
**Reviewer:** QA Automation Engineer
**Tasks Reviewed:** 1.1-1.10 (PHASE 1: Core Authentication System)
**Scope:** Full-stack authentication with session management, rate limiting, and ownership verification

---

## EXECUTIVE SUMMARY

**Overall Assessment:** APPROVED WITH CRITICAL FIXES REQUIRED

The authentication system implementation is **architecturally sound** with excellent design patterns for security (Argon2id, timing-safe comparison, JWT, AsyncLocalStorage). However, **two critical issues** prevent production readiness:

1. **CRITICAL: AsyncLocalStorage context not properly scoped to request lifecycle** - The middleware function cannot wrap the actual request handler, causing `getAuthUserId()` to return undefined in server actions.
2. **CRITICAL: Rate limiting not implemented for signup endpoint** - Specification requires 3 requests/hour, but no rate limiter is instantiated or checked in signup route.

**Issue Severity Summary:**
- **CRITICAL:** 2 issues (must fix before Task #3 authorization work)
- **HIGH:** 4 issues (should fix before production)
- **MEDIUM:** 5 issues (can fix in next iteration)
- **LOW:** 3 issues (polish/documentation)

**Recommendation:** **BLOCKED** - Cannot proceed to Task #3 (Authorization) until critical AsyncLocalStorage issue is resolved. The auth foundation is unstable; adding authorization on top will fail.

---

## CRITICAL ISSUES (MUST FIX)

### Issue #C1: AsyncLocalStorage Context Lost Between Middleware and Server Actions

**Severity:** CRITICAL
**Files:** `/src/middleware.ts` (lines 120-124), `/src/lib/auth-context.ts`
**Impact:** Server actions cannot access userId via `getAuthUserId()`. Authentication context will always be undefined in protected server actions, breaking all authorization checks.

**Problem Description:**

The middleware function correctly extracts and validates the session, but it does NOT wrap the actual request handler with `runWithAuthContext()`. This means the AsyncLocalStorage context is never established for the request:

```typescript
// middleware.ts, lines 119-124
// Store userId in AsyncLocalStorage for server actions/components
// This runs synchronously before returning response
// Note: Due to Next.js architecture, we cannot fully wrap the handler,
// so this is informational. For server actions, we'll use a wrapper.

return response;
```

**Why This Is Broken:**

Next.js middleware runs in a separate execution context from route handlers and server actions. The `runWithAuthContext()` call in middleware is never executed - it's only documented as a comment. When a server action calls `getAuthUserId()`, the AsyncLocalStorage store is empty because the action ran outside the context established by `runWithAuthContext()`.

**Specific Evidence:**

1. Middleware returns response WITHOUT calling `runWithAuthContext()` (line 124)
2. The `withAuth()` wrapper function exists but is NEVER USED anywhere in the codebase
3. Any server action calling `getAuthUserId()` will receive `undefined`
4. Authorization checks in Task #3 will all fail with "Not authenticated"

**How to Fix:**

The `withAuth()` wrapper from middleware.ts must be used in EVERY server action that requires authentication:

```typescript
// CORRECT approach:
'use server';

export async function getPlayerCards(playerId: string) {
  return withAuth(async () => {
    const userId = getAuthUserId(); // Now returns actual userId
    if (!userId) throw new Error('Not authenticated');
    // ... rest of logic
  });
}

// CURRENT approach (BROKEN):
'use server';

export async function getPlayerCards(playerId: string) {
  const userId = getAuthUserId(); // Returns undefined - context not set
  if (!userId) throw new Error('Not authenticated'); // Always throws
  // ... rest of logic never reaches
}
```

**Additional Notes:**

- The comment on lines 121-122 acknowledges the problem ("we cannot fully wrap the handler")
- This is a **fundamental architectural issue** with how Next.js separates middleware from handlers
- The solution is documented correctly in `middleware.ts` comments (lines 153-170) but not implemented anywhere
- This must be fixed before implementing Task #3 authorization

---

### Issue #C2: Signup Rate Limiting Not Implemented

**Severity:** CRITICAL
**Files:** `/src/app/api/auth/signup/route.ts`
**Impact:** No protection against brute-force signup attacks. Attackers can spam account creation, filling database and causing denial-of-service.

**Problem Description:**

Specification Section 7 (API Routes) states:

> **Route 1: POST /api/auth/signup**
> **Rate Limit:** 3 requests per hour per IP

The signup route contains NO rate limiting logic. The login route correctly implements rate limiting (5 attempts in 15 min), but signup is unprotected.

**Current Code:**

```typescript
// /src/app/api/auth/signup/route.ts
// NO rate limiter instantiated
// NO rate limit check in POST handler
// NO call to loginRateLimiter.check() or similar

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({})) as SignupRequest;
    const validation = validateSignupRequest(body);
    if (!validation.valid) {
      return NextResponse.json(...);
    }
    // ... proceeds directly to account creation with no rate limit
```

**Why This Matters:**

- Attackers can create unlimited accounts with automated scripts
- Each account creation writes to database (User + Session + Player records)
- Resource exhaustion: unlimited accounts fills database
- Creates chaos in data analysis (millions of test accounts)
- No rate limit on IP address as specified

**How to Fix:**

```typescript
// At top of signup route
const signupRateLimiter = new RateLimiter({
  maxAttempts: 3,           // 3 signup attempts
  windowMs: 60 * 60 * 1000, // Per hour
  lockoutMs: 60 * 60 * 1000, // Lock for 1 hour
});

// In POST handler, after parsing body:
const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
const rateLimitCheck = signupRateLimiter.check(clientIp);

if (!rateLimitCheck.isAllowed) {
  return NextResponse.json(
    {
      success: false,
      error: 'Too many signup attempts. Please try again later.',
      retryAfter: Math.ceil(rateLimitCheck.attemptsRemaining / 1000),
    },
    { status: 429 }
  );
}

// ... if signup fails:
signupRateLimiter.recordFailure(clientIp);

// ... if signup succeeds:
signupRateLimiter.recordSuccess(clientIp);
```

---

## HIGH PRIORITY ISSUES (SHOULD FIX)

### Issue #H1: Middleware Cannot Properly Wrap Async Context for Route Handlers

**Severity:** HIGH
**Files:** `/src/middleware.ts` (lines 64-125)
**Impact:** While server actions can use `withAuth()` wrapper, route handlers (API endpoints) have no mechanism to access userId from AsyncLocalStorage.

**Problem Description:**

The middleware validates the session and computes `userId`, but has no way to pass it to route handlers or server actions that don't explicitly call `withAuth()`. Next.js middleware cannot modify the async context of subsequent handlers.

**Current Limitation:**

```typescript
// middleware.ts doesn't provide context to handlers
export async function middleware(request: NextRequest) {
  // ... compute userId ...

  // Cannot do this:
  // await runWithAuthContext({ userId }, () => NextResponse.next());
  // Because we must return NextResponse, not Promise<NextResponse>

  return response; // userId information is lost
}
```

**Why This Matters:**

- API routes in `/api/protected/*` cannot easily access userId
- Each API route must either duplicate authentication logic or call `getAuthUserId()` (which won't work)
- Inconsistent authentication patterns across different route types

**Workaround:**

For API routes, attach userId to request object:

```typescript
// Better pattern (not implemented):
const response = NextResponse.next();
response.headers.set('x-user-id', userId || '');
return response;

// In API route:
const userId = request.headers.get('x-user-id');
```

Or require all protected API routes to re-verify session:

```typescript
// In API route:
export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');
  const payload = verifySessionToken(sessionCookie.value);
  const userId = payload.userId;
  // ...
}
```

**Recommendation:** Document this pattern clearly in each API route, or create an API route utility function to centralize the verification logic.

---

### Issue #H2: Race Condition in Session Creation (Session Token Null Before Update)

**Severity:** HIGH
**Files:** `/src/app/api/auth/signup/route.ts` (lines 120-127), `/src/app/api/auth/login/route.ts` (lines 150-157)
**Impact:** Brief window where session token is empty string; if database query happens between create and update, session appears invalid.

**Problem Description:**

Both signup and login routes use a two-step session creation process:

```typescript
// Step 1: Create session with empty token
const sessionRecord = await createSession(user.id, '', expiresAt);

// Step 2: Sign JWT token
const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload);

// Step 3: Update session record with token
await updateSessionToken(sessionRecord.id, token);
```

The schema defines `sessionToken` as `@unique`, so two concurrent requests could attempt to create sessions with empty strings, violating the unique constraint.

**Scenario:**

1. User 1 hits signup endpoint
2. `createSession()` creates record with `sessionToken = ''`
3. User 2 hits signup endpoint
4. `createSession()` tries to create another record with `sessionToken = ''`
5. **P2002 unique constraint violation** on second request

**Current Code (Problematic):**

```typescript
// signup/route.ts, lines 120-127
const sessionRecord = await createSession(user.id, '', expiresAt);
// ...
const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload);
await updateSessionToken(sessionRecord.id, token);
```

**How to Fix:**

Generate token BEFORE creating session record:

```typescript
// Step 1: Create payload and sign token first
const sessionId = crypto.randomUUID(); // Or generate any unique ID
const payload = createSessionPayload(user.id, sessionId);
const token = signSessionToken(payload);

// Step 2: Create session with token already filled
const expiresAt = new Date(Date.now() + getSessionExpirationSeconds() * 1000);
const sessionRecord = await createSession(user.id, token, expiresAt);

// No Step 3 needed - token is already set
```

Or use Prisma transaction:

```typescript
const expiresAt = new Date(Date.now() + getSessionExpirationSeconds() * 1000);
const sessionRecord = await prisma.$transaction(async (tx) => {
  const session = await tx.session.create({
    data: {
      userId: user.id,
      expiresAt,
      sessionToken: '', // temp
    },
  });

  const payload = createSessionPayload(user.id, session.id);
  const token = signSessionToken(payload);

  return tx.session.update({
    where: { id: session.id },
    data: { sessionToken: token },
  });
});
```

---

### Issue #H3: Session Cookie Not Set Properly in Signup Route

**Severity:** HIGH
**Files:** `/src/app/api/auth/signup/route.ts` (line 258)
**Impact:** Cookie Set-Cookie header uses semicolon separation, but missing space before "Secure" flag in production, creating malformed Set-Cookie header.

**Problem Description:**

The `setSessionCookie()` function joins cookie options with `'; '` (semicolon-space):

```typescript
// signup/route.ts, lines 236-259
function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
): void {
  const cookieName = 'session';
  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = [
    `${cookieName}=${token}`,
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];

  if (isProduction) {
    cookieOptions.push('Secure');
  }

  response.headers.set('Set-Cookie', cookieOptions.join('; '));
}
```

Output in production:
```
Set-Cookie: session=<token>; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict; Secure
```

**Appears correct!** Actually, wait... let me re-read the code. It looks correct. Let me verify by checking if there are any actual issues...

Actually, on careful reading, the cookie formatting appears correct. The options are joined with `'; '` which produces proper RFC 6265 cookie format. This is **NOT an issue** - I was mistaken. Let me remove this from final review.

---

### Issue #H3: Middleware Cookie Clearing Uses Inconsistent Header Approach (Revised)

**Severity:** HIGH
**Files:** `/src/middleware.ts` (lines 94-101)
**Impact:** Middleware clears invalid session cookies, but the `setSessionCookie()` function in auth routes is not used, creating inconsistency.

**Problem Description:**

Middleware manually sets the Set-Cookie header:

```typescript
// middleware.ts, lines 96-100
if (!userId && sessionCookie?.value) {
  response.headers.set(
    'Set-Cookie',
    'session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict'
  );
}
```

But doesn't include `Secure` flag even in production. The logout route also sets cookies differently than signup/login routes.

**Why This Matters:**

- Inconsistent security configuration across different parts of code
- In production, middleware clears cookies without Secure flag, potentially allowing HTTP interception during the clear operation

**How to Fix:**

Create a shared utility function:

```typescript
// lib/auth-utils.ts
export function setCookie(
  response: NextResponse,
  name: string,
  value: string,
  maxAgeSeconds?: number
): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const options = [
    `${name}=${value}`,
    maxAgeSeconds !== undefined ? `Max-Age=${maxAgeSeconds}` : undefined,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ]
    .filter(Boolean)
    .join('; ');

  if (isProduction) {
    // Add Secure flag
    const cookieWithSecure = options + '; Secure';
    response.headers.set('Set-Cookie', cookieWithSecure);
  } else {
    response.headers.set('Set-Cookie', options);
  }
}
```

Use consistently:

```typescript
// middleware.ts
setCookie(response, 'session', '', 0); // Clear cookie

// signup/login routes
setCookie(response, 'session', token, getSessionExpirationSeconds());
```

---

### Issue #H4: Missing Database Index on Session.sessionToken (Performance)

**Severity:** HIGH
**Files:** `/prisma/schema.prisma` (lines 86-107)
**Impact:** Session lookups by token (`getSessionByToken`) do table scans; causes N+1 query pattern and slow session validation on every request.

**Problem Description:**

The Session model has:

```prisma
model Session {
  sessionToken      String   @unique  // Has @unique, but no explicit index
  expiresAt         DateTime
  isValid           Boolean @default(true)

  @@index([userId])     // Index on userId
  @@index([expiresAt])  // Index on expiration
  // Missing: @@index([sessionToken])
}
```

While `@unique` implies an index in most databases, it's better to explicitly declare it for clarity and to ensure compound indexes work properly.

**Current Lookups:**

```typescript
// auth-server.ts, line 426
export async function getSessionByToken(sessionToken: string) {
  const session = await prisma.session.findUnique({
    where: { sessionToken },  // Uses unique constraint, but not optimized
    select: { ... },
  });
}
```

**Why This Matters:**

- Session validation happens on EVERY middleware execution
- Current implementation uses unique constraint (which works), but less explicit
- If you ever need compound indexes (e.g., `sessionToken + isValid`), you need explicit index

**How to Fix:**

```prisma
model Session {
  id                String   @id @default(cuid())
  userId            String
  user              User @relation(fields: [userId], references: [id], onDelete: Cascade)

  sessionToken      String   @unique
  expiresAt         DateTime
  isValid           Boolean @default(true)

  userAgent         String?
  ipAddress         String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([userId])
  @@index([expiresAt])
  @@index([sessionToken])  // Add explicit index
  @@index([isValid])       // Also add index for isValid checks
}
```

---

### Issue #H5: Logout Endpoint Returns 401 When Not Authenticated (Wrong Error Code)

**Severity:** HIGH
**Files:** `/src/app/api/auth/logout/route.ts` (lines 56-62)
**Impact:** API returns 401 for logout attempt with no session, but 401 means "provide credentials"; 204 No Content or 200 OK is more appropriate.

**Problem Description:**

```typescript
// logout/route.ts, lines 55-62
if (!sessionCookie?.value) {
  return NextResponse.json(
    {
      success: false,
      error: 'Not authenticated',
    } as LogoutError,
    { status: 401 }  // WRONG
  );
}
```

**Why 401 is Wrong:**

- **401 Unauthorized:** Means "you provided invalid credentials; provide valid ones and retry"
- **204 No Content:** Standard response when logout succeeds or already logged out
- **200 OK:** Also acceptable with success message

Logout is idempotent - if you're already logged out, the logout succeeded (state is correct).

**How to Fix:**

```typescript
if (!sessionCookie?.value) {
  return NextResponse.json(
    {
      success: true,
      message: 'Already logged out',
    },
    { status: 200 }  // Already logged out = successful state
  );
}
```

Or more idiomatically:

```typescript
// Return 204 No Content (logout succeeded, no body)
if (!sessionCookie?.value) {
  const response = NextResponse.json({}, { status: 204 });
  return response;
}
```

---

## MEDIUM PRIORITY ISSUES (CAN FIX)

### Issue #M1: Console.log Statements in Production Code

**Severity:** MEDIUM
**Files:**
- `/src/app/api/auth/signup/route.ts` (line 158)
- `/src/app/api/auth/login/route.ts` (line 176)
- `/src/app/api/auth/logout/route.ts` (line 94)
- `/src/app/api/auth/session/route.ts` (line 143)

**Impact:** Console logs leak error details in production logs; should use structured logging.

**Evidence:**

```typescript
// signup/route.ts, line 158
console.error('[Signup Error]', error.message);

// login/route.ts, line 176
console.error('[Login Error]', error.message);

// logout/route.ts, line 94
console.error('[Logout Error]', error.message);
```

**How to Fix:**

Replace with structured logging:

```typescript
// Use a logger like pino, winston, or built-in next logging
import { logger } from '@/lib/logger';

logger.error('Signup error', {
  error: error instanceof Error ? error.message : 'Unknown',
  context: 'auth/signup',
});
```

Or remove logs for security-sensitive operations (auth errors may contain sensitive info).

---

### Issue #M2: Password Hash Length Validation Not Strict Enough

**Severity:** MEDIUM
**Files:** `/src/lib/auth-utils.ts` (lines 106-121)
**Impact:** SESSION_SECRET validation uses string length as proxy for entropy; 32 bytes of "aaaaaaa...aa" is weak despite passing length check.

**Problem Description:**

```typescript
// auth-utils.ts, lines 106-121
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is not set. ' +
      'Generate a 256-bit random key and set it in .env.local'
    );
  }
  if (secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be at least 256 bits (32 bytes). ' +
      'Current length: ' + secret.length + ' bytes'
    );
  }
  return secret;
}
```

This assumes 1 character = 1 byte. But if SECRET_KEY is base64-encoded, it could be longer. If hex-encoded, assumptions are different.

**Better Approach:**

- Document expected encoding format
- Decode and validate actual entropy
- Or increase minimum length to account for encoding overhead

```typescript
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      'SESSION_SECRET environment variable is not set. ' +
      'Generate using: openssl rand -hex 32'
    );
  }

  // If hex-encoded, raw secret is half the string length
  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error(
      'SESSION_SECRET must be 64 hex characters (256 bits). ' +
      'Generate using: openssl rand -hex 32'
    );
  }

  return secret;
}
```

---

### Issue #M3: Rate Limiter Memory Can Grow Unbounded (Potential Memory Leak)

**Severity:** MEDIUM
**Files:** `/src/lib/rate-limiter.ts` (lines 201-218)
**Impact:** If attacker uses many different IPs/emails, rate limiter map grows without bound, causing memory exhaustion.

**Problem Description:**

```typescript
// rate-limiter.ts, lines 201-218
private cleanup(): void {
  const now = Date.now();
  const toDelete: string[] = [];

  for (const [identifier, record] of this.attempts.entries()) {
    // Delete if window has expired and not locked
    if (
      now - record.firstFailureTime > this.config.windowMs &&
      (!record.lockedUntil || now > record.lockedUntil)
    ) {
      toDelete.push(identifier);
    }
  }

  for (const identifier of toDelete) {
    this.attempts.delete(identifier);
  }
}
```

**Issue:** Cleanup only runs every 1 hour (line 73: `setInterval(() => this.cleanup(), 60 * 60 * 1000)`). Between cleanups, lockout records can accumulate:

- Attacker tries login from 1000 different IPs
- Each IP creates an `AttemptRecord` with `lockedUntil` timestamp
- Records stay in memory for at least 1 hour, even if not accessed
- With many attackers, map can grow to millions of entries

**Scenario:**

- Attacker hits login endpoint from IPs 192.168.1.1 through 192.168.255.255
- Creates ~65k entries in rate limiter
- Each entry is ~50 bytes
- = ~3.25 MB per attack wave
- Multiple waves = memory leak

**How to Fix:**

```typescript
private cleanup(): void {
  const now = Date.now();
  const toDelete: string[] = [];
  const MAX_RECORDS = 10000; // Prevent unbounded growth

  for (const [identifier, record] of this.attempts.entries()) {
    const isExpired =
      now - record.firstFailureTime > this.config.windowMs &&
      (!record.lockedUntil || now > record.lockedUntil);

    const isOldLocked =
      record.lockedUntil && now - record.lockedUntil > this.config.lockoutMs * 2;

    if (isExpired || isOldLocked) {
      toDelete.push(identifier);
    }
  }

  // Force cleanup if too many records
  if (this.attempts.size > MAX_RECORDS) {
    const sortedByTime = Array.from(this.attempts.entries())
      .sort((a, b) => a[1].firstFailureTime - b[1].firstFailureTime);

    const toRemove = sortedByTime
      .slice(0, sortedByTime.length - MAX_RECORDS)
      .map(([id]) => id);

    toRemove.forEach(id => this.attempts.delete(id));
  }

  for (const identifier of toDelete) {
    this.attempts.delete(identifier);
  }
}
```

Or reduce cleanup interval:

```typescript
// Instead of every hour, cleanup every minute
this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
```

---

### Issue #M4: No Validation That User Still Exists After Session Creation

**Severity:** MEDIUM
**Files:** `/src/app/api/auth/signup/route.ts`, `/src/app/api/auth/login/route.ts`
**Impact:** If user is deleted between session creation and response, user receives valid session for non-existent account.

**Problem Description:**

Signup and login routes create session but don't verify user still exists:

```typescript
// signup/route.ts, lines 116-127
const user = await createUser(email, passwordHash, firstName, lastName);

const expiresAt = new Date(Date.now() + getSessionExpirationSeconds() * 1000);
const sessionRecord = await createSession(user.id, '', expiresAt);
// ... if user was deleted here, we still create valid session!

const payload = createSessionPayload(user.id, sessionRecord.id);
const token = signSessionToken(payload);
```

**Why It Matters:**

- User.onDelete: Cascade means all sessions are deleted too
- But concurrent delete + session creation is possible
- Session endpoint already checks this (line 115-124), so it's inconsistent

**How to Fix:**

Add verification step:

```typescript
const user = await createUser(email, passwordHash, firstName, lastName);

// Verify user still exists
const userExists = await prisma.user.findUnique({
  where: { id: user.id },
  select: { id: true },
});

if (!userExists) {
  throw new Error('User creation failed');
}

// Then create session
const expiresAt = new Date(Date.now() + getSessionExpirationSeconds() * 1000);
const sessionRecord = await createSession(user.id, '', expiresAt);
```

Or use transaction:

```typescript
const { user, session } = await prisma.$transaction(async (tx) => {
  const user = await tx.user.create({ data: {...} });
  const session = await tx.session.create({
    data: { userId: user.id, ... }
  });
  return { user, session };
});
```

---

### Issue #M5: Session Creation Uses Empty String, Not Null, for Initial Token

**Severity:** MEDIUM
**Files:** `/src/app/api/auth/signup/route.ts` (line 120), `/src/app/api/auth/login/route.ts` (line 150)
**Impact:** Sessions with empty token appear valid to database queries; confusing and error-prone.

**Problem Description:**

```typescript
// signup/route.ts, line 120
const sessionRecord = await createSession(user.id, '', expiresAt);
```

An empty string is falsy in JavaScript but truthy in TypeScript. Better to use:

```typescript
const sessionRecord = await createSession(user.id, null, expiresAt);
```

Then update schema:

```prisma
sessionToken      String?   @unique  // Optional until JWT is signed
```

And check for null:

```typescript
if (!session?.sessionToken) {
  return null; // Session not yet finalized
}
```

---

## LOW PRIORITY ISSUES (POLISH)

### Issue #L1: Missing JSDoc on Public Auth Functions

**Severity:** LOW
**Files:** `/src/hooks/useAuth.ts` - hook implementations documented, but API endpoints lack detailed JSDoc

**Impact:** Developers using auth API have less clarity on behavior

**Details:**
- `/src/app/api/auth/signup/route.ts` has block comment but no JSDoc for response types
- `/src/app/api/auth/login/route.ts` lacks JSDoc
- `/src/app/api/auth/logout/route.ts` lacks JSDoc
- `/src/app/api/auth/session/route.ts` lacks JSDoc

**Recommendation:** Add JSDoc comments documenting response types and error scenarios:

```typescript
/**
 * POST /api/auth/signup - Create new user account
 *
 * @param request - NextRequest with email and password in body
 * @returns {SignupResponse} 201 Created with userId
 * @returns {SignupError} 400/409/500 on error
 * @throws Will never throw; errors returned as response
 */
export async function POST(request: NextRequest): Promise<NextResponse> { ... }
```

---

### Issue #L2: No TypeScript `as const` on Error Messages

**Severity:** LOW
**Files:** `/src/lib/rate-limiter.ts`, auth routes
**Impact:** Type inference is loose; error messages aren't narrowed as literal types

**Example:**

```typescript
// Could be:
return {
  isAllowed: true,
  isLocked: false,
  attemptsRemaining: this.config.maxAttempts,
} as const;  // Add 'as const' for literal type inference
```

---

### Issue #L3: Missing Environment Variable Documentation

**Severity:** LOW
**Files:** Codebase doesn't document required `.env` variables

**Needed:**

```
# .env.local (create if missing)
SESSION_SECRET=<256-bit random key, hex-encoded>
DATABASE_URL=file:./dev.db
NODE_ENV=development
```

**Recommendation:** Create `.env.example` documenting all required variables:

```env
# Session & Authentication
SESSION_SECRET=<run: openssl rand -hex 32>

# Database
DATABASE_URL=file:./dev.db

# Environment
NODE_ENV=development
```

---

## SPECIFICATION ALIGNMENT ANALYSIS

### Verified Compliance (Correct)

| Section | Requirement | Status |
|---------|-------------|--------|
| 3.1 | Email validation (RFC 5322) | ✓ Implemented in `validateEmail()` |
| 3.1 | Password strength (12+ chars, complexity) | ✓ Implemented in `validatePasswordStrength()` |
| 3.1 | Argon2id with 64MB, 2 iterations | ✓ Correct config in `ARGON2_CONFIG` |
| 3.2 | Timing-safe password comparison | ✓ Using `argon2.verify()` internally |
| 3.2 | HS256 JWT signing | ✓ Implemented with `jsonwebtoken` |
| 3.3 | 30-day session expiration | ✓ `SESSION_EXPIRATION_SECONDS = 2,592,000` |
| 3.3 | HTTP-only, Secure, SameSite=Strict | ✓ Set in cookie configuration |
| 3.4 | Session soft revocation with isValid | ✓ Implemented in Session model |
| 5.1 | Signup creates User + default Player | ✓ Implemented in `createUser()` |
| 5.2 | Login with rate limiting (5/15min) | ✓ Implemented with `RateLimiter` |
| 5.2 | Generic error message | ✓ "Invalid email or password" |
| 5.3 | Session validation on every request | ✓ Middleware validates |
| 5.3 | JWT signature verification | ✓ `verifySessionToken()` checks |
| 5.4 | Ownership verification | ✓ Implemented in `auth-server.ts` |
| 7.1 | Signup response structure | ✓ Matches spec |
| 7.2 | Login response structure | ✓ Matches spec |
| 7.3 | Logout clears cookie | ✓ Sets Max-Age=0 |
| 7.4 | Session endpoint checks isValid | ✓ Checks database flag |
| 8 | All edge cases handled | ✓ Mostly complete |

### Specification Deviations

| Section | Requirement | Status | Note |
|---------|-------------|--------|------|
| 3.1 | Signup rate limit (3/hour) | ✗ NOT IMPLEMENTED | Critical issue #C2 |
| 5.2 | Cron timing-safe comparison | ✗ NOT IMPLEMENTED | Task #4 scope |
| 5.4 | Server actions use withAuth | ✗ NOT INTEGRATED | Critical issue #C1 |

---

## TEST COVERAGE RECOMMENDATIONS

### Priority 1: Critical Path Testing (Must Have)

**TC-1.1: Signup Flow**
```
Given: Valid email and strong password
When: POST /api/auth/signup
Then: 201 Created, userId returned, session cookie set
```

**TC-1.2: Login Flow**
```
Given: Correct email and password
When: POST /api/auth/login
Then: 200 OK, userId returned, session cookie set
```

**TC-1.3: Session Validation**
```
Given: Valid session cookie
When: GET /api/auth/session
Then: 200 OK, user info returned
```

**TC-1.4: Logout Flow**
```
Given: Valid session cookie
When: POST /api/auth/logout
Then: 200 OK, cookie cleared (Max-Age=0)
```

**TC-1.5: Expired Session Rejection**
```
Given: Expired session token
When: Request protected endpoint
Then: 401 Unauthorized, redirect to /login
```

**TC-1.6: Invalid Token Rejection**
```
Given: Tampered/invalid JWT token
When: Request protected endpoint
Then: 401 Unauthorized
```

### Priority 2: Security Testing (High Priority)

**TC-2.1: Rate Limiting - Login**
```
Given: Email with failed login attempts
When: 5 failed attempts in 15 minutes
Then: 423 Locked, cannot login until timeout expires
```

**TC-2.2: Rate Limiting - Signup**
```
Given: Same IP/email
When: 4 signup attempts in 1 hour
Then: All succeed (3 limit not enforced - BUG)
```

**TC-2.3: Password Hashing**
```
Given: Password "MyPassword123!"
When: Hashed with Argon2id
Then: Hash format is $argon2id$v=19$m=65536,t=2,p=1$...
```

**TC-2.4: Timing Attack Prevention**
```
Given: Wrong password
When: verifyPassword() is called
Then: Takes same time as correct password (no early exit)
```

**TC-2.5: User Enumeration Prevention**
```
Given: Non-existent email
When: POST /api/auth/login
Then: Returns "Invalid email or password" (same as wrong password)
```

**TC-2.6: Session Revocation**
```
Given: Valid session token
When: User logs out and hits protected endpoint
Then: 401 Unauthorized (session.isValid = false checked)
```

### Priority 3: Edge Case Testing (Medium Priority)

**TC-3.1: Concurrent Login**
```
Given: User logs in from two tabs
When: Both requests hit login endpoint
Then: Both create valid sessions (multiple sessions supported)
```

**TC-3.2: Duplicate Email Signup**
```
Given: Email already registered
When: Second signup attempt with same email
Then: 409 Conflict, "Email already registered"
```

**TC-3.3: Weak Password Rejection**
```
Given: Password "Weak1!"
When: POST /api/auth/signup
Then: 400 Bad Request with specific requirements
```

**TC-3.4: Invalid Email Format**
```
Given: Email "invalid-email"
When: POST /api/auth/signup
Then: 400 Bad Request with "Invalid email format"
```

**TC-3.5: User Deleted After Session Creation**
```
Given: User account deleted
When: Using session token from deleted user
Then: 401 Unauthorized (user not found in database)
```

**TC-3.6: Database Connection Failure**
```
Given: Database unavailable
When: POST /api/auth/login
Then: 500 Internal Server Error with generic message
```

### Test Files to Create

1. **`__tests__/lib/auth-utils.test.ts`** - Unit tests for password hashing, JWT operations
2. **`__tests__/lib/rate-limiter.test.ts`** - Rate limiter edge cases, memory cleanup
3. **`__tests__/api/auth.integration.test.ts`** - Full signup/login/logout flows
4. **`__tests__/security/auth-security.test.ts`** - Timing attacks, user enumeration
5. **`__tests__/e2e/auth.e2e.test.ts`** - End-to-end browser tests

---

## SUMMARY OF REQUIRED FIXES

### Before Task #3 Can Proceed

**CRITICAL (Blocking):**
1. Fix AsyncLocalStorage context scoping - every server action must use `withAuth()` wrapper
2. Implement signup rate limiting (3/hour/IP)

**HIGH (Should fix):**
3. Implement proper session token generation (no empty string race condition)
4. Add explicit Session.sessionToken index
5. Fix logout endpoint error code (401 → 200)
6. Create shared cookie setter utility

**MEDIUM (Next iteration):**
7. Remove console.log statements
8. Improve SESSION_SECRET validation
9. Add rate limiter memory cleanup
10. Add user existence check after creation

---

## FINAL VERDICT

**Status: BLOCKED - NEEDS CRITICAL FIXES**

**Current Score: 6/10**

**Strengths:**
- Excellent password hashing implementation (Argon2id)
- Proper JWT signing and verification
- Good error handling and generic messages
- Correct session cookie flags (HttpOnly, SameSite, Secure)
- Comprehensive specification documentation

**Critical Blockers:**
- AsyncLocalStorage context not properly scoped to requests
- No signup rate limiting
- Cannot test Task #3 authorization until context issue fixed

**Recommendation:**
1. Fix issues #C1 and #C2 first (2-3 hours)
2. Fix issues #H1-H5 before production release (3-4 hours)
3. Implement test suite (4-6 hours)
4. Then proceed to Task #3 authorization implementation

**Estimated Effort:** 2-3 days to reach production-ready state

---

## SIGN-OFF

**QA Reviewer:** Claude Haiku 4.5
**Review Date:** April 1, 2026
**Verdict:** **CONDITIONAL APPROVAL - Needs critical fixes before proceeding**

The authentication system is architecturally sound but has implementation issues that prevent it from functioning in a production environment. The AsyncLocalStorage context must be properly scoped to the request lifecycle, and signup rate limiting must be implemented to match the specification.

Once these critical issues are resolved, the authentication system will provide a solid foundation for Task #3 (authorization and ownership verification).

