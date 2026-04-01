# Credit Card Benefits Tracker - Authentication System Specification

**Document Version:** 1.0
**Last Updated:** April 1, 2026
**Status:** Ready for Implementation
**Author:** Lead Product Architect

---

## Executive Summary & Goals

The Card Benefits Tracker application currently has no authentication or authorization, exposing critical security vulnerabilities where any user can call server actions to access or modify other users' data. This specification defines a comprehensive, type-safe authentication and authorization system using industry-standard patterns (NextAuth.js with JWT sessions) integrated with the existing Prisma schema and Next.js 15 App Router architecture.

**Primary Objectives:**
- Implement secure email/password authentication with password hashing (Argon2)
- Establish persistent session management using signed HTTP-only cookies with JWT payloads
- Add authorization middleware and ownership verification to all data mutations
- Secure the existing cron endpoint against timing attacks and unauthorized access
- Prevent session hijacking, CSRF attacks, and data leakage across user boundaries
- Support multi-player household structure while enforcing strict ownership boundaries
- Create type-safe session utilities compatible with TypeScript and React 19

**Success Criteria:**
- All server actions require valid session with user ID verification before executing
- Users can only access/modify data owned by their account or their players
- Cron endpoint uses timing-safe secret comparison and validates Vercel signatures
- Session tokens are cryptographically signed, secure, and impossible to forge
- Type system prevents passing unsanitized user input directly to database queries
- No user can access another user's players, cards, or benefits
- All auth failures return appropriate HTTP status codes (401, 403) with clear error messages
- Passwords stored as salted hashes, never in plaintext

---

## Functional Requirements

### Core Features
1. **User Registration (Signup)**
   - Email validation (format, uniqueness, optional email confirmation flow)
   - Password strength requirements (minimum 12 characters, complexity rules)
   - Password hashing using Argon2 (memory-hard, timing-safe algorithm)
   - Create User record with empty Players list

2. **User Login**
   - Email + password authentication
   - Timing-safe password comparison to prevent timing attacks
   - Issue cryptographically signed session cookie on success
   - Return clear error messages for invalid credentials (without revealing which failed)

3. **Session Management**
   - Session token stored in HTTP-only, secure cookie (cannot be accessed by JavaScript)
   - Token contains signed claims: userId, issuedAt, expiresAt
   - Session verification on every protected request
   - Automatic session refresh for active users (optional, extend on each request)
   - Graceful handling of expired tokens (redirect to login)

4. **Logout**
   - Clear session cookie by setting max-age=0
   - Optional: Add token to blacklist/revocation list for immediate invalidation
   - Client-side redirect to login page

5. **Authorization & Ownership Verification**
   - All server actions require valid session
   - Middleware wrapper validates session before action execution
   - Ownership check: verify userId → Player → UserCard → UserBenefit ownership
   - Return 403 Forbidden if user attempts cross-boundary access
   - Multi-player household support: user owns ALL players in their household

6. **Cron Endpoint Security**
   - Fix timing attack vulnerability: use `crypto.timingSafeEqual()` for secret comparison
   - Validate Vercel Cron signature header (if available)
   - Rate limiting: track request counts to prevent abuse
   - Fallback to Bearer token if signature unavailable
   - Log all cron executions with timestamp and count

### User Roles & Permissions
- **User (Account Owner):** Full access to own account, all players, cards, benefits
- **System (Cron Job):** Read-only access to expired benefits, write-only to reset them
- **Anonymous (Unauthenticated):** Access to signup/login pages only; redirect on protected routes

### System Constraints & Limits
- **Session Duration:** 30 days (configurable via environment variable)
- **Password Reset Token Expiry:** 1 hour
- **Rate Limiting:** 5 failed login attempts in 15 minutes → lock account for 15 minutes
- **Cookie Secure Flag:** Always enabled in production; respect __Secure- prefix
- **SameSite Policy:** Strict (prevents cross-site request forgery)
- **Token Algorithm:** HS256 (HMAC SHA-256) with 256-bit secret key
- **Password Hashing:** Argon2id, minimum 2 iterations, 64MB memory cost
- **Database:** SQLite (dev) → PostgreSQL (production); schema designed for both

---

## Implementation Phases

### Phase 1: Core Authentication System (Weeks 1-2)
**Objective:** Establish foundational auth infrastructure with email/password signup, login, and session management.

**Key Deliverables:**
- Prisma schema additions (Session model, password reset tokens)
- Session creation/verification utilities
- Signup server action with password validation and hashing
- Login server action with timing-safe comparison
- Logout server action
- Session cookie middleware
- Type-safe session context and hooks
- Protected route middleware

**Estimated Scope:** Large (15-20 tasks)
**Dependencies:** None
**Go/No-Go Criteria:**
- Users can sign up with valid email and password
- Users can log in with correct credentials
- Session persists across page refreshes
- Invalid credentials reject login
- Logout clears session and redirects

---

### Phase 2: Authorization & Ownership Verification (Weeks 2-3)
**Objective:** Add authorization checks to all server actions and API routes, enforce ownership boundaries.

**Key Deliverables:**
- Authorization middleware wrapper for server actions
- Ownership verification utilities (userId → Player, Player → Card, etc.)
- Wrap existing server actions with authorization checks
- Add ownership verification to all data mutations
- Implement action types with authenticated user context
- Update all server actions to use authenticated context
- Test cross-boundary access rejection
- Comprehensive error responses (401, 403)

**Estimated Scope:** Large (12-15 tasks)
**Dependencies:** Phase 1 complete
**Go/No-Go Criteria:**
- Users cannot access other users' players
- Users cannot modify cards/benefits owned by other players
- Unauthorized requests return 403 Forbidden
- All server actions validate ownership before mutation
- Type system prevents unauthed action calls

---

### Phase 3: Cron Security & Testing (Weeks 3-4)
**Objective:** Fix cron timing attack vulnerability, add comprehensive security testing.

**Key Deliverables:**
- Timing-safe secret comparison using crypto.timingSafeEqual()
- Vercel Cron signature validation (if available)
- Rate limiting for cron endpoint (in-memory or Redis)
- Request logging with timestamps and reset counts
- Security testing suite (auth failure scenarios)
- Authorization testing (ownership boundary verification)
- Integration tests for cron endpoint
- Documentation of security threat model and mitigations

**Estimated Scope:** Medium (8-10 tasks)
**Dependencies:** Phase 1-2 complete
**Go/No-Go Criteria:**
- Timing attack impossible (fixed-time comparison)
- Cron endpoint rejects requests without valid secret
- Rate limiting prevents brute force attacks
- All security tests pass
- No data leakage across user boundaries

---

### Phase 4: Password Reset & Account Management (Week 4+)
**Objective:** Add self-service password reset and account recovery flows.

**Key Deliverables:**
- Password reset token model in Prisma
- Generate secure, time-limited reset tokens
- Email service integration (SendGrid, AWS SES, or similar)
- Password reset request form (public route)
- Password reset form with token validation
- Account deletion with cascading cleanup
- Optional: Two-factor authentication (TOTP)

**Estimated Scope:** Medium (10-12 tasks)
**Dependencies:** Phase 1 complete

---

## Data Schema / State Management

### Existing Models (No Changes Required)

**User**
```
id                String   @id @default(cuid())
email             String   @unique
passwordHash      String   // Will be populated during auth implementation
firstName         String?
lastName          String?
emailVerified     Boolean @default(false)  // For future email confirmation
createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt

// Relationships
players           Player[]
sessions          Session[]  // NEW: one-to-many

// Indexes
@@index([email])
```

**Player** (unchanged, but authorization depends on userId)
```
id                String   @id @default(cuid())
userId            String   // FK to User (ownership boundary)
playerName        String
isActive          Boolean @default(true)
user              User @relation(fields: [userId], references: [id], onDelete: Cascade)
userCards         UserCard[]
userBenefits      UserBenefit[]
createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt

@@index([userId])
@@unique([userId, playerName])
```

### New Models Required

**Session**
```
id                String   @id @default(cuid())
userId            String   // FK to User
user              User @relation(fields: [userId], references: [id], onDelete: Cascade)

// Session metadata
sessionToken      String   @unique  // Signed JWT payload (or random token for validation)
expiresAt         DateTime  // Expiration timestamp
isValid           Boolean @default(true)  // For soft revocation (optional)

// Metadata
createdAt         DateTime @default(now())
updatedAt         DateTime @updatedAt
userAgent         String?  // For device identification (optional)
ipAddress         String?  // For suspicious login detection (optional)

// Indexes
@@index([userId])
@@index([expiresAt])
@@unique([sessionToken])
```

**PasswordResetToken** (Phase 4, optional for now)
```
id                String   @id @default(cuid())
userId            String   // FK to User
user              User @relation(fields: [userId], references: [id], onDelete: Cascade)

token             String   @unique  // HMAC token, never stored in plaintext
tokenHash         String   @unique  // Hash of token for database lookup
expiresAt         DateTime  // 1-hour expiration
isUsed            Boolean @default(false)

createdAt         DateTime @default(now())

@@index([userId])
@@index([expiresAt])
@@unique([tokenHash])
```

### Session Token Payload Structure (JWT)

When using JWT-based sessions (recommended for stateless auth):

```typescript
interface SessionPayload {
  userId: string;           // User ID from database
  issuedAt: number;        // Unix timestamp when created
  expiresAt: number;       // Unix timestamp when expires
  sessionId: string;       // Reference to Session record for revocation
  version: number;         // For invalidating old tokens on logout
}
```

Signed with HS256 using `SESSION_SECRET` environment variable (minimum 256-bit entropy).

### Authorization Boundary Model

```
User (ownership root)
  ├─ Player (owned by User)
  │   ├─ UserCard (owned by Player)
  │   │   └─ UserBenefit (owned by Player via UserCard)
  │   └─ UserBenefit (owned by Player, denormalized)
  └─ Session (owned by User)

Authorization Rules:
- User can access User.id if session.userId === User.id
- User can access Player if session.userId === Player.userId
- User can access UserCard if session.userId === UserCard.player.userId
- User can access UserBenefit if session.userId === UserBenefit.player.userId
- System (cron) can read expired UserBenefit records, update only specific fields
```

### Sample Data Structures

```typescript
// Session stored in HTTP-only cookie
const sessionCookie = {
  name: 'session',
  value: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  // JWT token
  maxAge: 2592000,  // 30 days in seconds
  httpOnly: true,
  secure: true,  // Only in production
  sameSite: 'strict',
  path: '/',
};

// Session payload (inside JWT)
const sessionPayload = {
  userId: 'user_clx5qp9pr0000z4w0g5z5z5z5',
  issuedAt: 1712000000,
  expiresAt: 1714592000,
  sessionId: 'session_clx5qp9pr0000z4w0g5z5z5z6',
  version: 1,
};

// User record
const user = {
  id: 'user_clx5qp9pr0000z4w0g5z5z5z5',
  email: 'alice@example.com',
  passwordHash: '$argon2id$v=19$m=65536,t=2,p=1$...',
  firstName: 'Alice',
  lastName: 'Smith',
  emailVerified: false,
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
};

// Player record (Alice's primary player)
const player = {
  id: 'player_clx5qp9pr0000z4w0g5z5z5z7',
  userId: 'user_clx5qp9pr0000z4w0g5z5z5z5',
  playerName: 'Primary',
  isActive: true,
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
};
```

---

## User Flows & Workflows

### Flow 1: User Registration (Signup)

```
┌─────────────────────────────────────────────────────────────────┐
│ USER SIGNUP FLOW                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────┐
│ START   │
└────┬────┘
     │
     ├─ User visits /signup page
     │
     ├─ User enters email and password
     │
     ├─ Client validates: email format, password strength (local)
     │
     ├─ Client submits signupAction({email, password})
     │
     ├─ Server: Call signupAction()
     │         └─ Validate email format (RFC 5322)
     │         └─ Validate password strength (12+ chars, 1 uppercase, 1 number, 1 special)
     │         └─ Check email uniqueness (query User table)
     │         └─ If duplicate: return {success: false, error: 'Email already registered'}
     │         └─ Hash password with Argon2id (memory=65536, time=2)
     │         └─ Create User record with hashed password
     │         └─ Create default Player record (playerName='Primary')
     │         └─ Return {success: true, userId: '...'}
     │
     ├─ If error: Display error message on signup page
     │           └─ User can retry with different email/password
     │
     ├─ If success: Automatically log in user (create session)
     │             └─ Set session cookie
     │             └─ Redirect to /dashboard
     │
     └─ END (user authenticated)

EDGE CASES:
1. Email already registered (duplicate unique constraint)
   → Return friendly error: "An account with this email already exists"

2. Password too weak (< 12 chars, missing complexity)
   → Return error with specific requirement that failed

3. Database connection timeout
   → Return generic error: "Unable to create account. Please try again."

4. Concurrent signup with same email
   → Prisma unique constraint prevents race condition
   → Second request gets P2002 error, returns duplicate email error

5. User closes browser during signup
   → Orphaned User record may exist (acceptable, can be cleaned up later)
   → User can retry signup; duplicate check prevents double-creation
```

### Flow 2: User Login

```
┌─────────────────────────────────────────────────────────────────┐
│ USER LOGIN FLOW                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────┐
│ START   │
└────┬────┘
     │
     ├─ User visits /login page (or auth required page)
     │
     ├─ User enters email and password
     │
     ├─ Client submits loginAction({email, password})
     │
     ├─ Server: Call loginAction()
     │         └─ Normalize email (lowercase, trim)
     │         └─ Query User by email
     │         └─ If user not found: goto INVALID CREDENTIALS path
     │         └─ Use crypto.timingSafeEqual() to compare passwords
     │            (prevents timing attack that leaks user existence)
     │         └─ If passwords don't match: goto INVALID CREDENTIALS path
     │         └─ Create Session record with 30-day expiry
     │         └─ Sign Session with HS256 (JWT)
     │         └─ Set session cookie (httpOnly, secure, sameSite=strict)
     │         └─ Return {success: true}
     │
     ├─ INVALID CREDENTIALS path:
     │  └─ Increment loginAttempts counter for email
     │  └─ If attempts > 5 in 15 minutes: lock account temporarily
     │  └─ Return {success: false, error: 'Invalid email or password'}
     │     (same message for both cases, prevents user enumeration)
     │  └─ Display error without revealing which field failed
     │
     ├─ If error: Show retry message on login page
     │           └─ User can try again
     │           └─ After 5 failed attempts: show account locked message
     │
     ├─ If success: Redirect to /dashboard
     │
     └─ END (user authenticated)

EDGE CASES:
1. User not found (typo in email)
   → Same error as wrong password: "Invalid email or password"
   → No indication that email doesn't exist (prevents user enumeration)

2. Correct email, wrong password
   → Same error message as above
   → Increment failed attempt counter

3. Account locked (5+ failed attempts in 15 min)
   → Return error: "Too many login attempts. Please try again in 15 minutes."
   → Lock implemented via cache (in-memory or Redis)
   → Automatic unlock after 15 minutes

4. Database connection timeout
   → Return error: "Unable to log in. Please try again."

5. Session creation fails (DB error)
   → Rollback any partial state
   → Return: "Unable to log in. Please try again."

6. User account deleted between query and session creation
   → P2025 error on session creation
   → Return: "Unable to log in. Please try again."

7. Concurrent login requests from same user
   → Both create valid sessions (acceptable, old session invalid after logout)
   → Multiple sessions possible (user on multiple devices)
```

### Flow 3: Authenticated Request with Session Validation

```
┌─────────────────────────────────────────────────────────────────┐
│ SESSION VALIDATION ON PROTECTED REQUEST                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│ Client makes request │ (e.g., GET /api/players, or server action)
└──────────┬───────────┘
           │
           ├─ Browser automatically includes session cookie
           │
           ├─ Server: Middleware validates session
           │         └─ Extract session cookie from headers
           │         └─ If missing: goto NO SESSION path
           │         └─ Parse & verify JWT signature (HS256)
           │         └─ If invalid signature: goto INVALID SESSION path
           │         └─ Extract userId, expiresAt from payload
           │         └─ Check expiresAt > now(): goto EXPIRED path
           │         └─ Attach userId to request context
           │         └─ Continue to next handler
           │
           ├─ Handler/Server Action runs with context.userId set
           │  └─ Any database query includes WHERE userId = context.userId
           │  └─ Ownership verified before mutation
           │  └─ Return data filtered by userId
           │
           ├─ NO SESSION path:
           │  └─ Redirect to /login with returnUrl=original-path
           │
           ├─ INVALID SESSION path (tampering detected):
           │  └─ Clear session cookie (set maxAge=0)
           │  └─ Redirect to /login
           │  └─ Log security event: "Invalid session signature"
           │
           ├─ EXPIRED path:
           │  └─ Clear session cookie
           │  └─ Redirect to /login
           │  └─ Optionally show: "Your session has expired. Please log in again."
           │
           └─ END (success or redirect)

EDGE CASES:
1. Cookie malformed (not valid JWT)
   → JWT parse fails
   → Treat as INVALID SESSION

2. Session token in URL query string (never happens with httpOnly)
   → httpOnly flag prevents JavaScript access
   → Token only in secure cookie

3. User opened site in multiple tabs
   → Each tab gets same session cookie
   → All tabs logout when cookie expires

4. User clears cookies manually
   → Next request has no session cookie
   → Redirect to /login

5. Attacker tries to modify session cookie
   → Signature verification fails (HMAC verified)
   → Treated as INVALID SESSION
   → Cookie cleared, redirect to login

6. Token rotation (optional enhancement):
   → Each request optionally issues new token with updated expiresAt
   → Old token still valid until new one issued
   → Prevents token replay if old token captured
```

### Flow 4: Server Action with Authorization Check

```
┌─────────────────────────────────────────────────────────────────┐
│ SERVER ACTION WITH OWNERSHIP VERIFICATION                        │
│ Example: User adding card to their own wallet                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐
│ Client calls server action      │
│ addCardToWallet(playerId, ...)  │
└──────────┬──────────────────────┘
           │
           ├─ Middleware: Validate session, attach userId to context
           │
           ├─ Server: Call addCardToWallet()
           │         └─ Extract context.userId from request
           │         └─ If no userId: return 401 Unauthorized
           │         └─ Ownership check: Player.userId === context.userId?
           │         └─ Query Player by playerId
           │         └─ If Player not found: return 404 Not Found
           │         └─ If Player.userId !== context.userId:
           │            return 403 Forbidden (ownership boundary violation)
           │         └─ Proceed with addCardToWallet() logic
           │         └─ Create UserCard + UserBenefits in transaction
           │         └─ Return {success: true, userCard: {...}}
           │
           ├─ If 401: Redirect to /login
           │
           ├─ If 403: Return error to client
           │         └─ Log security event: "Unauthorized access attempt"
           │         └─ User sees: "You don't have permission to do this."
           │
           ├─ If 404: Return error to client
           │         └─ User sees: "Player not found."
           │
           ├─ If success: Return new card data to client
           │
           └─ END

OWNERSHIP VERIFICATION ALGORITHM:
1. Extract userId from session context
2. For each data mutation, verify ownership chain:

   addCardToWallet(playerId, masterCardId, renewalDate):
   - Player.userId === userId ✓
   - Proceed

   toggleBenefit(benefitId, isUsed):
   - Query UserBenefit by id
   - UserBenefit.playerId === userId ✓
   - Proceed

   addPlayer(userId, playerName):
   - Verify requesting session.userId === userId
   - Only users can add players to their own account

EDGE CASES:
1. Player deleted between form submission and action execution
   → Query returns null
   → Return 404 Not Found

2. User tries to access another user's playerId
   → Player.userId !== context.userId
   → Return 403 Forbidden
   → Log security event

3. Concurrent mutations on same player
   → Both requests pass ownership check
   → Both transactions execute (both see consistent state)
   → Both succeed (acceptable, user can add multiple cards)

4. Network timeout after ownership check but before DB mutation
   → Server commits the mutation
   → Client retries, receives 409 Conflict if duplicate constraint violated
   → Client should handle gracefully

5. Session expires between client form load and submission
   → Middleware detects expired token
   → Return 401 Unauthorized
   → Client redirects to /login
   → User loses form data (acceptable, can retry after login)
```

### Flow 5: User Logout

```
┌─────────────────────────────────────────────────────────────────┐
│ USER LOGOUT FLOW                                                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ User clicks  │ (logout button, or session expires)
│ logout       │
└──────┬───────┘
       │
       ├─ Client calls logoutAction()
       │
       ├─ Server: Call logoutAction()
       │         └─ Extract context.userId from session
       │         └─ Mark Session record as invalid (isValid = false)
       │         └─ Or: delete Session record from database
       │         └─ (Prevents token replay if token leaked)
       │         └─ Set session cookie maxAge=0 (delete)
       │         └─ Return {success: true}
       │
       ├─ Client: Redirect to /login
       │
       ├─ Logout button disabled for next 100ms (prevent double-click)
       │
       └─ END (user unauthenticated)

EDGE CASES:
1. User already logged out in another tab
   → Session already deleted/invalid
   → Second logout returns error (caught, suppressed)
   → Still clear cookie and redirect

2. Network error during logout
   → Server side processed logout (likely)
   → Client doesn't know, still has cookie
   → Next request receives 401 (token invalid)
   → Middleware clears cookie

3. User session expires naturally (no explicit logout)
   → Cookie still present but token expired
   → Next request receives 401 from middleware
   → Middleware clears cookie

4. User closes browser without logging out
   → Cookie remains in browser (but expires in 30 days)
   → If device compromised, token can be replayed
   → Mitigation: keep Session record with userId for revocation
   → Can implement "logout all devices" feature
```

### Flow 6: Cron Job - Reset Expired Benefits

```
┌─────────────────────────────────────────────────────────────────┐
│ CRON JOB: RESET EXPIRED BENEFITS                                 │
│ Triggered daily by Vercel Cron at specified time                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────┐
│ Vercel sends HTTPS request   │
│ GET /api/cron/reset-benefits │
│ Header: Authorization: ...   │
└──────────────┬───────────────┘
               │
               ├─ Server receives request
               │
               ├─ Validate authorization
               │  ├─ Extract Authorization header
               │  ├─ If missing: return 401 Unauthorized
               │  ├─ Use crypto.timingSafeEqual() to compare secrets
               │  │  (prevents timing attack that leaks secret length/prefix)
               │  ├─ If mismatch: return 401 Unauthorized
               │  └─ Proceed
               │
               ├─ Rate limit check
               │  ├─ Record request in in-memory cache with timestamp
               │  ├─ If > 10 requests in 1 minute: return 429 Too Many Requests
               │  └─ Proceed
               │
               ├─ Transaction: Find and reset expired benefits
               │  ├─ Capture current time (now = new Date())
               │  ├─ Query all UserBenefit where:
               │  │  └─ isUsed = true
               │  │  └─ expirationDate <= now
               │  │  └─ resetCadence != 'OneTime'
               │  ├─ For each benefit:
               │  │  ├─ Calculate next expiration date
               │  │  ├─ Update UserBenefit:
               │  │  │  └─ isUsed = false
               │  │  │  └─ claimedAt = null
               │  │  │  └─ timesUsed = 0
               │  │  │  └─ expirationDate = nextDate
               │  │  └─ Continue
               │  ├─ If any error: ROLLBACK all changes
               │  └─ Commit transaction
               │
               ├─ Log result
               │  └─ console.log(`Reset ${count} benefits`)
               │
               ├─ Return success response
               │  └─ {ok: true, resetCount: 47, processedAt: '2026-04-01T00:00:00Z'}
               │
               └─ END

SECURITY CONSIDERATIONS:
1. Timing attack prevention:
   - Use crypto.timingSafeEqual(header, secret)
   - Compares full length, not early exit on mismatch
   - Prevents attacker from guessing secret character-by-character

2. Rate limiting:
   - In-memory cache (or Redis for distributed systems)
   - 10 requests per minute limit
   - Clear old entries periodically

3. Request validation:
   - Only accept HTTPS (enforced by Next.js)
   - Validate Content-Type (should be empty/undefined for GET)
   - Log all unauthorized attempts

4. Data integrity:
   - Wrap entire operation in transaction
   - If any update fails, ROLLBACK all changes
   - Prevents partial resets

EDGE CASES:
1. No expired benefits found
   → Return {ok: true, resetCount: 0}
   → This is normal on quiet days

2. Database connection timeout during query
   → Return 500 Internal Server Error
   → Vercel will retry later

3. Concurrent cron jobs (unlikely but possible)
   → Both read same expired benefits
   → Both update them
   → Prisma handles concurrent updates gracefully
   → May update same benefit twice (idempotent)

4. UserCard.renewalDate is null (data integrity issue)
   → Skip benefit or use fallback date
   → Log warning

5. Benefit already reset in another request
   → Attempt to update non-existent record
   → Silently ignored (benefit not found in query)

6. Rate limit exceeded (> 10 req/min)
   → Return 429 Too Many Requests
   → Vercel waits before retrying
```

---

## API Routes & Contracts

### Route 1: POST /api/auth/signup

**Purpose:** Create new user account and issue session cookie.

**Method:** POST
**Authentication:** None (public route)
**Rate Limit:** 3 requests per hour per IP

**Request Body:**
```typescript
{
  email: string;           // Must be valid email format (RFC 5322)
  password: string;        // Must be 12+ chars, 1 uppercase, 1 number, 1 special char
  firstName?: string;      // Optional first name (1-50 characters)
  lastName?: string;       // Optional last name (1-50 characters)
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123!",
    "firstName": "Alice",
    "lastName": "Smith"
  }'
```

**Response 201 (Success):**
```typescript
{
  success: true;
  userId: string;         // User ID
  message: string;        // "Account created successfully"
}

// Header: Set-Cookie: session=<JWT>; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/
```

**Response 400 (Validation Error):**
```typescript
{
  success: false;
  error: string;          // "Email already registered" | "Password too weak" | etc.
  fieldErrors?: {
    email?: string[];
    password?: string[];
    firstName?: string[];
    lastName?: string[];
  };
}
```

**Response 409 (Conflict - Email exists):**
```typescript
{
  success: false;
  error: "Email already registered";
}
```

**Response 429 (Rate Limited):**
```typescript
{
  success: false;
  error: "Too many signup attempts. Please try again later.";
  retryAfter: number;     // Seconds to wait
}
```

**Response 500 (Server Error):**
```typescript
{
  success: false;
  error: "Unable to create account. Please try again.";
}
```

---

### Route 2: POST /api/auth/login

**Purpose:** Authenticate user and issue session cookie.

**Method:** POST
**Authentication:** None (public route)
**Rate Limit:** 5 failed attempts in 15 minutes → 15-minute lockout

**Request Body:**
```typescript
{
  email: string;          // User email
  password: string;       // User password
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123!"
  }'
```

**Response 200 (Success):**
```typescript
{
  success: true;
  userId: string;
  message: "Logged in successfully";
}

// Header: Set-Cookie: session=<JWT>; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/
```

**Response 401 (Unauthorized - Invalid credentials):**
```typescript
{
  success: false;
  error: "Invalid email or password";  // Same message for both failures (prevents user enumeration)
}
```

**Response 423 (Locked - Too many failed attempts):**
```typescript
{
  success: false;
  error: "Too many login attempts. Please try again in 15 minutes.";
  lockedUntil: string;    // ISO 8601 timestamp
}
```

**Response 429 (Rate Limited):**
```typescript
{
  success: false;
  error: "Too many requests. Please try again later.";
  retryAfter: number;
}
```

**Response 500 (Server Error):**
```typescript
{
  success: false;
  error: "Unable to log in. Please try again.";
}
```

---

### Route 3: POST /api/auth/logout

**Purpose:** Invalidate session and clear authentication cookie.

**Method:** POST
**Authentication:** Required (valid session cookie)

**Request Body:**
```typescript
{
  // Empty body, uses session from cookie
}
```

**Request Example:**
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Cookie: session=<JWT>"
```

**Response 200 (Success):**
```typescript
{
  success: true;
  message: "Logged out successfully";
}

// Header: Set-Cookie: session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/
```

**Response 401 (Unauthorized - No session):**
```typescript
{
  success: false;
  error: "Not authenticated";
}
```

**Response 500 (Server Error):**
```typescript
{
  success: false;
  error: "Unable to log out. Please try again.";
}
```

---

### Route 4: GET /api/auth/session

**Purpose:** Retrieve current session info (user ID, expiration).

**Method:** GET
**Authentication:** Required (valid session cookie)
**Caching:** No cache (always fresh)

**Request Example:**
```bash
curl http://localhost:3000/api/auth/session \
  -H "Cookie: session=<JWT>"
```

**Response 200 (Authenticated):**
```typescript
{
  authenticated: true;
  userId: string;
  email: string;          // User email
  expiresAt: string;      // ISO 8601 timestamp
  expiresInSeconds: number;  // Seconds until expiry
}
```

**Response 401 (Unauthorized - No session):**
```typescript
{
  authenticated: false;
  error: "Not authenticated";
}
```

**Response 401 (Expired session):**
```typescript
{
  authenticated: false;
  error: "Session expired";
}
```

---

### Route 5: GET /api/cron/reset-benefits

**Purpose:** Reset expired benefits (daily scheduled job).

**Method:** GET
**Authentication:** Bearer token in Authorization header (timing-safe comparison)
**Rate Limit:** 10 requests per minute
**Idempotent:** Yes (safe to retry)

**Request Headers:**
```
Authorization: Bearer <CRON_SECRET>
User-Agent: vercel-cron/1.0
```

**Request Example:**
```bash
curl -X GET http://localhost:3000/api/cron/reset-benefits \
  -H "Authorization: Bearer your-secret-token-here"
```

**Response 200 (Success):**
```typescript
{
  ok: true;
  resetCount: number;     // Number of benefits reset
  processedAt: string;    // ISO 8601 timestamp
}

// Example response body:
// {
//   "ok": true,
//   "resetCount": 47,
//   "processedAt": "2026-04-01T00:00:00.000Z"
// }
```

**Response 401 (Unauthorized - Invalid token):**
```typescript
{
  error: "Unauthorized";
  code: "INVALID_CRON_SECRET";
}
```

**Response 429 (Rate Limited - Too many requests):**
```typescript
{
  error: "Too many requests";
  retryAfter: number;  // Seconds to wait
}
```

**Response 500 (Server Error):**
```typescript
{
  error: "Internal Server Error";
  timestamp: string;   // ISO 8601
}
```

---

### Server Action: addCardToWallet (Updated with Authorization)

**Purpose:** Add a card to user's wallet (requires ownership of player).

**Signature:**
```typescript
async function addCardToWallet(
  playerId: string,
  masterCardId: string,
  renewalDate: Date
): Promise<AddCardResult>
```

**Authorization Requirement:**
- User must own the Player (Player.userId === currentUserId)

**Request Example:**
```typescript
// Client-side (React component)
const result = await addCardToWallet(playerId, masterCardId, new Date());

if (result.success) {
  console.log('Card added:', result.userCard);
} else {
  console.error('Error:', result.error);
}
```

**Response Success:**
```typescript
{
  success: true;
  userCard: {
    id: string;
    playerId: string;
    masterCardId: string;
    customName: string | null;
    actualAnnualFee: number | null;
    renewalDate: Date;
    isOpen: boolean;
    createdAt: Date;
    updatedAt: Date;
    userBenefits: UserBenefit[];
    masterCard: MasterCard;
  };
}
```

**Response Errors:**
```typescript
// Validation error
{
  success: false;
  error: "playerId and masterCardId are required.";
}

// User doesn't own player (403 Forbidden equivalent)
{
  success: false;
  error: "You don't have permission to modify this player.";
}

// Card already in wallet
{
  success: false;
  error: "This card is already in the player's wallet.";
}

// Master card not found
{
  success: false;
  error: "Card template not found.";
}

// Database error
{
  success: false;
  error: "An unexpected error occurred.";
}
```

---

## Edge Cases & Error Handling

### Category 1: Authentication Edge Cases

#### 1.1 Concurrent Login Attempts
**Scenario:** User logs in from two browsers simultaneously.
**Current Behavior:** Both receive valid session tokens; both create Session records.
**Desired Behavior:** All sessions valid, user on both devices authenticated.
**Handling:**
- Allow multiple concurrent sessions (multi-device support)
- Track Session.userAgent or Session.ipAddress for device identification
- Optional: Implement "logout all other devices" feature (updates all other sessions to isValid=false)

#### 1.2 Partial Signup (User Closes Browser)
**Scenario:** User submits signup form; database creates User record; browser crashes before redirect.
**Current Behavior:** User partially created, User record persists, session never created.
**Desired Behavior:** Next signup attempt fails (duplicate email), user retries with same email.
**Handling:**
- Email unique constraint prevents double-creation
- User sees "Email already registered" on retry
- User can log in with previously entered password
- Orphaned User records acceptable (can clean up later with background job)
- Alternative: Add account activation token, only mark account active after confirmation

#### 1.3 Password Contains Special Characters
**Scenario:** User password contains Unicode characters or double-quotes.
**Current Behavior:** Argon2 hashing handles all bytes; must validate JSON encoding.
**Desired Behavior:** Accept any printable character; safely hash and verify.
**Handling:**
- JSON encode/decode password string correctly (watch for escaped quotes)
- Argon2 library handles binary data safely
- No length restrictions beyond 12 minimum and 128 maximum (prevent DOS from extremely long passwords)
- Store hash as-is in database (encrypted at rest if using SQLite encryption)

#### 1.4 Email Address Case Sensitivity
**Scenario:** User signs up as "Alice@Example.com", logs in as "alice@example.com".
**Current Behavior:** Email normalization should treat them as same.
**Desired Behavior:** Case-insensitive email matching.
**Handling:**
- Normalize email on signup/login: lowercase + trim
- Unique constraint on lowercased email
- Query database using lowercased email
- Display original email to user in UI (preserve case for user identity)

#### 1.5 Expired Session Token Manipulation
**Scenario:** Attacker captures expired session cookie, modifies expiresAt in JWT.
**Current Behavior:** JWT signature becomes invalid; token rejected.
**Desired Behavior:** Any tampering detectable.
**Handling:**
- HS256 signature ensures expiresAt cannot be modified without invalidating token
- Modified expiresAt fails HMAC verification
- Treat invalid signature as security incident (clear cookie, redirect to login, log event)
- Cannot be mitigated further (cryptographically impossible to forge HMAC without secret)

---

### Category 2: Authorization & Ownership Edge Cases

#### 2.1 User Deleted Mid-Request
**Scenario:** User session valid; User record deleted in database before action executes.
**Current Behavior:** Action queries owned resources; finds nothing (empty result set).
**Desired Behavior:** Request completes gracefully with "not found" error.
**Handling:**
- Return 404 Not Found for missing resources
- User's next request sees expired/invalid session (Session record deleted via cascade)
- User redirected to login

#### 2.2 Player Transferred Between Users (Not Allowed)
**Scenario:** System constraint: Player.userId cannot change (only update allowed).
**Current Behavior:** Prisma schema enforces via ownership field; no transfer operation exists.
**Desired Behavior:** Each player permanently belongs to one user.
**Handling:**
- No update operation permits changing Player.userId
- If needed in future, implement "transfer player" as: create new Player in target user, copy all UserCards+UserBenefits, soft-delete old Player
- Ownership cannot change; only deletion + recreation

#### 2.3 Benefit Owned by Non-Existent Player
**Scenario:** Data integrity issue: UserBenefit.playerId references deleted Player.
**Current Behavior:** Foreign key cascade deletes UserBenefit.
**Desired Behavior:** Benefit automatically cleaned up.
**Handling:**
- Prisma schema: UserBenefit has `onDelete: Cascade` on Player FK
- When Player deleted, all UserBenefits automatically deleted
- Orphaned benefits cannot occur (constraints prevent it)

#### 2.4 User Tries to Claim Benefit from Another User's Card
**Scenario:** User has playerId; user calls toggleBenefit(benefitId) where benefit belongs to different player.
**Current Behavior:** No ownership check in current code (SECURITY BUG).
**Desired Behavior:** Return 403 Forbidden.
**Handling:**
- Add ownership check: query UserBenefit, verify benefitId.playerId === context.userId
- If mismatch, return 403 Forbidden
- Log security event: "Unauthorized benefit access attempt by user X"
- Do not reveal whether benefit exists (return generic "not found" if possible)

#### 2.5 Authorization Check Race Condition
**Scenario:** User owns player; during form submission, another user somehow gains ownership (impossible, but consider race).
**Current Behavior:** Ownership check passes at validation time; action modifies data.
**Desired Behavior:** Data integrity maintained even if hypothetical ownership change occurs.
**Handling:**
- Re-validate ownership in transaction before mutation (not just during validation)
- Use explicit SELECT FOR UPDATE if database supports it
- For SQLite: entire transaction serialized, no concurrent writes
- For PostgreSQL: use SELECT ... FOR UPDATE to lock row until transaction completes

#### 2.6 User Session Exists but User Record Deleted
**Scenario:** User logged in; User record deleted from database; user makes request.
**Current Behavior:** Session verification passes (checks expiresAt); ownership check fails (User not found).
**Desired Behavior:** Request rejected as 401.
**Handling:**
- Add query to verify User still exists: `SELECT id FROM User WHERE id = context.userId`
- If user not found, invalidate session and return 401
- Alternatively: trust that session.userId is valid (user can only delete own account via explicit action)
- Recommendation: Add verification step in session middleware

---

### Category 3: Cron Job Edge Cases

#### 3.1 Timing Attack on CRON_SECRET
**Scenario:** Attacker tries to guess CRON_SECRET by observing response times.
**Current Behavior:** String comparison might short-circuit on mismatch.
**Desired Behavior:** Constant-time comparison regardless of match position.
**Handling:**
- Use `crypto.timingSafeEqual()` (Node.js built-in)
- Compares full byte sequence, never short-circuits
- Time taken is constant regardless of where secret differs
- CRITICAL: Compare entire secret, not just first few characters

#### 3.2 Cron Runs Twice Simultaneously
**Scenario:** Vercel sends two cron requests for same scheduled time.
**Current Behavior:** Both queries fetch expired benefits; both update them.
**Desired Behavior:** Benefits reset exactly once (idempotent).
**Handling:**
- Query only finds benefits with isUsed=true, expirationDate <= now
- After first cron sets isUsed=false, second cron doesn't find it
- Idempotent: if benefit already reset, second update is no-op
- No data corruption possible

#### 3.3 Database Timeout During Cron
**Scenario:** Database slow/unavailable; query times out mid-transaction.
**Current Behavior:** Transaction rolled back; benefits not reset.
**Desired Behavior:** Vercel retries cron later.
**Handling:**
- Set query timeout (2-5 minutes)
- If timeout: catch error, log, return 500
- Vercel automatically retries failed crons (typically 3 times with exponential backoff)
- Benefits reset on retry

#### 3.4 UserCard.renewalDate is Null
**Scenario:** Data integrity issue: UserCard exists with null renewalDate.
**Current Behavior:** Calculation of next expiration date fails.
**Desired Behavior:** Benefit cannot be reset (no window boundary).
**Handling:**
- Skip benefit or log error: "Cannot reset benefit with null renewalDate"
- Do not update benefit (leave isUsed=true)
- Next cron job skips it again
- Admin must manually fix renewalDate
- Prevent this: make renewalDate non-nullable in schema

#### 3.5 Cron Misses Benefits Due to Clock Skew
**Scenario:** Server clock drifts; cron checks at wrong time.
**Current Behavior:** Benefits expire at different times on different servers.
**Desired Behavior:** Consistent expiration across all clocks.
**Handling:**
- Always use server time (Date.now() in handler)
- Benefits expire when expirationDate <= now (server time)
- Clock skew affects when cron runs (Vercel's issue, not ours)
- Vercel synchronizes cron timing to UTC; clock skew unlikely
- Acceptable: benefits might reset 1-2 hours late (clock skew window)

#### 3.6 Rate Limit Prevents Legitimate Cron
**Scenario:** Cron executes many times per minute (unlikely, but possible in test).
**Current Behavior:** Requests > 10 per minute get 429.
**Desired Behavior:** Legitimate cron (1 per day) never rate limited.
**Handling:**
- Rate limit: 10 requests per minute (very generous, 1 cron per day is fine)
- Whitelist Vercel IP addresses (optional, defense in depth)
- Alternatively: use request signature to bypass rate limit
- Monitor cron execution; alert if running more than expected

#### 3.7 Invalid Reset Cadence Value
**Scenario:** UserBenefit has resetCadence='Invalid' (data corruption).
**Current Behavior:** getNextExpirationDate() doesn't handle it.
**Desired Behavior:** Benefit handled gracefully.
**Handling:**
- getNextExpirationDate() should validate cadence
- If invalid: return error or default behavior
- Recommendation: use TypeScript enum to prevent invalid values at type level
- At runtime: log error, return null, skip benefit (leave as-is)

---

### Category 4: Session Management Edge Cases

#### 4.1 Multiple Session Cookies (Cookie Name Collision)
**Scenario:** Multiple session keys in cookie header.
**Current Behavior:** cookie.get('session') returns first match.
**Desired Behavior:** Exactly one session cookie honored.
**Handling:**
- Set cookie with explicit name='session'
- Browser replaces same-named cookie on new login
- Never multiple 'session' cookies in valid scenario
- If found: reject request (return 401)

#### 4.2 Session Cookie Larger Than 4KB
**Scenario:** JWT token extremely long (unlikely with HS256).
**Current Behavior:** Cookie rejected by browser (4KB limit).
**Desired Behavior:** Session token is compact.
**Handling:**
- HS256 JWT with minimal claims: ~200 bytes
- No large data in JWT payload
- If needed: store claims in Session table, use opaque token in cookie
- Current approach: JWT payload keeps cookie small

#### 4.3 User Logs Out on One Device, Logs In on Another
**Scenario:** User has session on device A; logs out on device B; tries to use device A.
**Current Behavior:** Device A session still valid (different session token).
**Desired Behavior:** Separate sessions, no interference.
**Handling:**
- Each device gets unique session token
- Logout on B doesn't affect A's token
- Optional: "logout all devices" sets version=2, old tokens treated as invalid
- Without that feature: users can have multiple concurrent sessions

#### 4.4 Session Cookie Sent Over HTTP
**Scenario:** HTTP request (not HTTPS) includes session cookie.
**Current Behavior:** Cookie has secure=true; browser may or may not send it over HTTP.
**Desired Behavior:** Cookie never sent over HTTP.
**Handling:**
- Set secure=true in cookie (required in production)
- Browser: only sends cookie over HTTPS
- Dev environment: disable secure flag (allow HTTP locally)
- Local dev: use localhost (browser allows set-cookie without secure on localhost)

#### 4.5 Session Token Leaked (Captured in Network Traffic)
**Scenario:** Attacker captures session cookie.
**Current Behavior:** Attacker can impersonate user if used immediately.
**Desired Behavior:** Mitigate impact.
**Handling:**
- httpOnly flag: JavaScript cannot access cookie (blocks XSS attacks)
- secure flag: cookie only sent over HTTPS (blocks eavesdropping)
- sameSite=strict: cookie only sent same-site (blocks CSRF)
- Short session duration: 30 days (token expires)
- Optional: IP pinning - reject session if IP changes
- Optional: Token rotation - issue new token per request

#### 4.6 Clock Skew on User Device
**Scenario:** User's computer clock is 1 hour behind server.
**Current Behavior:** Server issues JWT with expiresAt = server time + 30 days.
**Desired Behavior:** Session duration consistent.
**Handling:**
- Clock skew on user device doesn't affect JWT (JWT issued by server)
- If user device clock is wrong: may affect client-side countdown timer (cosmetic only)
- Recommendation: don't implement client-side expiration countdown
- User finds out at next request (server checks expiresAt)

---

### Category 5: Data Validation & Input Edge Cases

#### 5.1 Email Validation
**Scenario:** User enters non-RFC-5322 email (e.g., "user@local").
**Current Behavior:** Validation may reject or accept depending on implementation.
**Desired Behavior:** Accept common formats; reject obviously invalid.
**Handling:**
- Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (simple, permissive)
- Or: use email-validator library
- Send confirmation email to verify (Phase 4)
- For now: accept most formats, reject only obvious invalids
- Recommendation: don't be too strict (many valid emails fail overly strict regex)

#### 5.2 Password with SQL Injection Characters
**Scenario:** User password contains SQL: `'; DROP TABLE User; --`.
**Current Behavior:** Prisma parameterizes queries; no SQL injection.
**Desired Behavior:** Password safely hashed.
**Handling:**
- Prisma ORM prevents SQL injection (parameterized queries)
- Argon2 hashing treats password as binary data
- No special escaping needed
- Safe to pass password directly to Argon2

#### 5.3 Very Long Password (DOS)
**Scenario:** User enters 1MB password.
**Current Behavior:** Argon2 would process it (slow, high memory).
**Desired Behavior:** Reject extremely long passwords.
**Handling:**
- Add maximum length: 256 characters
- Reject passwords > 256 chars with validation error
- Prevents DOS via memory exhaustion in hashing
- Acceptable to users (256 char password is extremely long)

#### 5.4 Whitespace-Only Password
**Scenario:** User password is just spaces: `"          "`.
**Current Behavior:** Validation allows (no explicit check).
**Desired Behavior:** Reject as invalid.
**Handling:**
- Trim password before hashing
- After trim, check length: if < 12, reject
- User cannot have password of only spaces

#### 5.5 Null/Undefined Email
**Scenario:** Client bug sends null email.
**Current Behavior:** Prisma rejects (schema requires String).
**Desired Behavior:** Clear error message.
**Handling:**
- Input validation catches null/undefined before reaching Prisma
- Return 400 Bad Request: "Email is required"
- Client should validate before sending (but server validates too, defense in depth)

---

### Category 6: Concurrency & Race Conditions

#### 6.1 Two Concurrent Signup Requests with Same Email
**Scenario:** Two browsers simultaneously POST /api/auth/signup with same email.
**Current Behavior:** Prisma unique constraint on email; one succeeds, one gets P2002 error.
**Desired Behavior:** One account created, other request returns "already exists" error.
**Handling:**
- Database unique constraint catches race condition
- First request creates User (succeeds)
- Second request hits unique constraint (P2002 error)
- Return 409 Conflict or 400 Bad Request with "Email already registered"
- Prisma handles the race atomically (not a problem)

#### 6.2 Two Concurrent addCardToWallet Requests
**Scenario:** User submits form twice (double-click); both requests process.
**Current Behavior:** Both try to create UserCard; second hits unique constraint on (playerId, masterCardId).
**Desired Behavior:** First succeeds, second returns "already added" error.
**Handling:**
- Unique constraint: `@@unique([playerId, masterCardId])`
- First request creates UserCard (succeeds)
- Second request hits unique constraint (P2002 error)
- Return 409 Conflict: "This card is already in the player's wallet."
- Idempotent for user: both requests have same result (card in wallet)

#### 6.3 Two Concurrent toggleBenefit Requests
**Scenario:** User's benefit isUsed=false; two clicks on "claim" button (double-click).
**Current Behavior:** Both update benefit to isUsed=true.
**Desired Behavior:** Benefit marked used exactly once.
**Handling:**
- Current implementation: `isUsed = false ? {isUsed: true, ...} : {isUsed: false}`
- Race condition: both read isUsed=false, both set isUsed=true, timesUsed incremented twice
- Fix: use conditional update in database:
  ```prisma
  update({
    where: {id: benefitId, isUsed: false},  // Only update if still false
    data: {isUsed: true, claimedAt: now, timesUsed: {increment: 1}}
  })
  ```
- If benefit already marked used: update returns 0 affected rows, client retries
- Recommendation: disable button while request pending (client-side debounce)

#### 6.4 Session Invalidated During Long Request
**Scenario:** User makes request; session expires before response.
**Current Behavior:** Request already passed authorization; completes anyway.
**Desired Behavior:** Request fails with 401.
**Handling:**
- Middleware validates session at request start
- If session expires mid-request: no re-validation (acceptable for < 30 second requests)
- For very long requests: add mid-request session check (optional enhancement)
- Recommendation: keep requests short (< 10 seconds), let session middleware handle auth

---

### Category 7: Error Recovery & Retry Scenarios

#### 7.1 Database Connection Drops During Signup
**Scenario:** User submits signup; network to database lost mid-transaction.
**Current Behavior:** Prisma throws connection error; signup fails.
**Desired Behavior:** User retries signup.
**Handling:**
- Return 500 Internal Server Error
- User sees: "Unable to create account. Please try again."
- Next signup attempt: database reconnects, request succeeds
- Possible duplicate User record if first request partially completed
- Mitigation: email unique constraint prevents double-signup; user retries with same email

#### 7.2 Session Cookie Lost (Browser Cache Cleared)
**Scenario:** User clears browser cache; session cookie deleted.
**Current Behavior:** Next request has no session cookie.
**Desired Behavior:** User redirected to login.
**Handling:**
- Middleware detects missing cookie
- Return 401 Unauthorized (or 302 redirect to /login)
- User must log in again
- Acceptable: user expects to log in after clearing cache

#### 7.3 Network Timeout on Login
**Scenario:** User clicks login; network times out (slow connection, server slow).
**Current Behavior:** Browser times out; user sees loading spinner.
**Desired Behavior:** User can retry.
**Handling:**
- Client-side: set request timeout (5-10 seconds)
- If timeout: show error: "Login took too long. Please try again."
- User clicks "Try Again" button
- Recommendation: add loading indicator and "Cancel" button
- Session creation idempotent: if first request creates session but network fails, second request creates new session (both valid)

#### 7.4 Partial Write in Transaction
**Scenario:** Cron creates UserCard; UserBenefit creation fails mid-transaction.
**Current Behavior:** Entire transaction rolled back (atomic).
**Desired Behavior:** Neither succeeds (consistent state).
**Handling:**
- Prisma $transaction ensures atomicity
- If any step fails: entire transaction rolled back
- UserCard creation undone
- No partial state possible
- Return 500 error to cron; Vercel retries later

---

## Component Architecture

### System Components & Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION SYSTEM ARCHITECTURE                               │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: CLIENT (React Components)                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────┐     │
│  │ SignupPage Component        │  │ LoginPage Component             │     │
│  │ - Form validation (local)   │  │ - Form submission               │     │
│  │ - Password strength meter   │  │ - Error display                 │     │
│  │ - Calls signupAction()      │  │ - Calls loginAction()           │     │
│  └────────┬────────────────────┘  └──────────┬──────────────────────┘     │
│           │                                   │                           │
│           └───┬───────────────────────────────┘                           │
│               │                                                           │
│  ┌────────────▼────────────────────────────────────────────────────┐      │
│  │ useAuth() Hook (Context-based)                                 │      │
│  │ - Manages session state                                        │      │
│  │ - Provides userId, isAuthenticated, expiresAt                 │      │
│  │ - Handles logout                                              │      │
│  │ - Auto-refresh expired tokens (optional)                      │      │
│  └────────────────────────────────────────────────────────────────┘      │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐      │
│  │ Protected Routes (Layout/Pages)                               │      │
│  │ - Check useAuth().isAuthenticated                             │      │
│  │ - Redirect to /login if not authenticated                     │      │
│  │ - Display dashboard/content if authenticated                  │      │
│  └────────────────────────────────────────────────────────────────┘      │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: API ROUTES (Next.js Route Handlers)                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ POST /api/auth/signup                                        │           │
│  │ - Validates email, password                                  │           │
│  │ - Hashes password with Argon2                                │           │
│  │ - Creates User + default Player in transaction               │           │
│  │ - Creates Session record                                     │           │
│  │ - Issues session cookie                                      │           │
│  │ - Returns userId + redirect signal                           │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ POST /api/auth/login                                         │           │
│  │ - Normalizes email (lowercase, trim)                         │           │
│  │ - Queries User by email                                      │           │
│  │ - Timing-safe password comparison                            │           │
│  │ - Creates Session record                                     │           │
│  │ - Issues session cookie with HS256 JWT                       │           │
│  │ - Rate limiting (5 fails / 15 min)                           │           │
│  │ - Returns success + userId                                   │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ POST /api/auth/logout                                        │           │
│  │ - Validates session (from middleware)                        │           │
│  │ - Sets Session.isValid = false (or delete)                   │           │
│  │ - Clears session cookie (maxAge=0)                           │           │
│  │ - Returns success                                            │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ GET /api/auth/session                                        │           │
│  │ - Validates session (from middleware)                        │           │
│  │ - Returns userId, email, expiresAt                           │           │
│  │ - Client uses to populate useAuth() context                  │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ GET /api/cron/reset-benefits                                 │           │
│  │ - Validates CRON_SECRET (timing-safe comparison)             │           │
│  │ - Rate limiting (10 req/min)                                 │           │
│  │ - Finds expired UserBenefits                                 │           │
│  │ - Resets in atomic transaction                               │           │
│  │ - Returns resetCount + timestamp                             │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: MIDDLEWARE (Request Validation & Context Injection)                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ middleware.ts (Next.js Middleware)                           │           │
│  │ - Runs before all requests                                   │           │
│  │ - Extracts session cookie                                    │           │
│  │ - Verifies JWT signature                                     │           │
│  │ - Checks expiresAt > now()                                   │           │
│  │ - Attaches userId to request context                         │           │
│  │ - Redirects /dashboard → /login if not authenticated         │           │
│  │ - Allows /login, /signup without auth                        │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ withAuth() Wrapper (Server Actions)                          │           │
│  │ - Extracted from middleware context or cookies               │           │
│  │ - Validates session.userId not null                          │           │
│  │ - Attaches userId to action context                          │           │
│  │ - Throws 401 if not authenticated                            │           │
│  │ - Wraps existing server actions                              │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ withOwnershipCheck() Wrapper (Server Actions)                │           │
│  │ - Validates ownership before mutation                        │           │
│  │ - Queries resource ownership chain                           │           │
│  │ - Compares resource.userId === context.userId               │           │
│  │ - Returns 403 if mismatch                                    │           │
│  │ - Proceeds with mutation if owned                            │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 4: SERVER ACTIONS (Authenticated Business Logic)                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ addCardToWallet(playerId, masterCardId, renewalDate)        │           │
│  │ ✓ Wrapped with withAuth() → verifies session.userId         │           │
│  │ ✓ Wrapped with withOwnershipCheck() → verifies Player owner │           │
│  │ - Creates UserCard + UserBenefits                            │           │
│  │ - Returns card or error                                      │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ toggleBenefit(benefitId, isUsed)                             │           │
│  │ ✓ Wrapped with withAuth() → verifies session.userId         │           │
│  │ ✓ Wrapped with withOwnershipCheck() → verifies benefit owner│           │
│  │ - Updates UserBenefit.isUsed + metadata                      │           │
│  │ - Returns benefit or error                                   │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ updateUserDeclaredValue(benefitId, valueInCents)             │           │
│  │ ✓ Wrapped with withAuth() → verifies session.userId         │           │
│  │ ✓ Wrapped with withOwnershipCheck() → verifies benefit owner│           │
│  │ - Updates UserBenefit.userDeclaredValue                      │           │
│  │ - Returns benefit or error                                   │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  Future actions (Phase 2 implementation):                                    │
│  - addPlayer(playerName)                                                     │
│  - deletePlayer(playerId)                                                    │
│  - updateCard(cardId, customName, renewalDate)                              │
│  - deleteCard(cardId)                                                        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 5: UTILITIES & SERVICES (Pure Functions)                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ password.ts (Password Hashing & Verification)               │           │
│  │ - hashPassword(password) → Promise<string>                   │           │
│  │   - Use Argon2id (memory=65536, time=2)                     │           │
│  │   - Return base64-encoded hash                              │           │
│  │ - verifyPassword(password, hash) → Promise<boolean>         │           │
│  │   - Timing-safe comparison                                  │           │
│  │   - Return true/false                                       │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ session.ts (Session Management)                             │           │
│  │ - createSession(userId) → Promise<SessionPayload>           │           │
│  │   - Generate HS256 JWT                                      │           │
│  │   - Set expiresAt = now + 30 days                           │           │
│  │   - Return token string                                     │           │
│  │ - verifySession(token) → SessionPayload | null             │           │
│  │   - Decode & verify JWT signature                           │           │
│  │   - Check expiresAt > now()                                 │           │
│  │   - Return payload or null                                  │           │
│  │ - getCookieOptions() → CookieOptions                        │           │
│  │   - httpOnly, secure, sameSite, maxAge                      │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ auth-context.ts (Client-Side Context)                       │           │
│  │ - AuthProvider (React context)                              │           │
│  │ - useAuth() hook                                            │           │
│  │ - ProtectedRoute component                                  │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ ownership-check.ts (Authorization Utilities)                │           │
│  │ - verifyPlayerOwnership(userId, playerId) → boolean         │           │
│  │ - verifyCardOwnership(userId, cardId) → boolean             │           │
│  │ - verifyBenefitOwnership(userId, benefitId) → boolean       │           │
│  │ - getOwnershipChain(userId, resourceType) → resource[]      │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │ validation.ts (Input Validation)                            │           │
│  │ - validateEmail(email) → {valid: boolean, error?: string}   │           │
│  │ - validatePassword(password) → {valid: boolean, error?: ...}│           │
│  │ - validatePlayerId(id) → {valid: boolean}                   │           │
│  │ - validateMasterCardId(id) → {valid: boolean}               │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ LAYER 6: DATABASE (Prisma ORM)                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  User (new fields added)                                                    │
│  ├─ id (PK)                                                                  │
│  ├─ email (unique)                                                           │
│  ├─ passwordHash ← populated during auth                                    │
│  ├─ firstName, lastName                                                      │
│  └─ sessions: Session[] (new relationship)                                  │
│                                                                               │
│  Session (new model)                                                         │
│  ├─ id (PK)                                                                  │
│  ├─ userId (FK to User)                                                      │
│  ├─ sessionToken (unique, HS256 JWT)                                        │
│  ├─ expiresAt                                                                │
│  ├─ isValid (for soft revocation)                                           │
│  ├─ createdAt, updatedAt                                                     │
│  ├─ userAgent (optional, device ID)                                         │
│  └─ ipAddress (optional, geo-location)                                      │
│                                                                               │
│  Player (existing, no schema changes)                                        │
│  ├─ id, userId (FK), playerName, isActive                                   │
│  └─ Ownership boundary: userId identifies owner                             │
│                                                                               │
│  UserCard (existing, no schema changes)                                      │
│  ├─ id, playerId (FK), masterCardId (FK)                                     │
│  └─ Authorization: must own Player                                          │
│                                                                               │
│  UserBenefit (existing, no schema changes)                                   │
│  ├─ id, userCardId (FK), playerId (FK, denormalized)                        │
│  └─ Authorization: must own Player                                          │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Integration Points

**1. Client ↔ API Routes**
- Session cookie automatically sent by browser
- No manual authorization headers needed
- Middleware validates on server side

**2. API Routes ↔ Server Actions**
- Server actions wrapped with withAuth() + withOwnershipCheck()
- Context automatically populated from middleware
- Server actions cannot be called without valid session (enforced at platform level)

**3. Server Actions ↔ Database**
- All queries include WHERE userId = context.userId
- Ownership verified before mutations
- Transactions ensure atomicity

**4. Client ↔ useAuth() Context**
- Components import useAuth() hook
- Access isAuthenticated, userId, expiresAt
- useAuth() fetches from /api/auth/session on mount
- Automatically refreshes session on page load

### Component Dependencies

```
signupAction
  └─ hashPassword() [password.ts]
  └─ Prisma.user.create()
     └─ Prisma.player.create() (default Player)
  └─ createSession() [session.ts]
  └─ setCookie() [session.ts]

loginAction
  └─ Prisma.user.findUnique({email})
  └─ verifyPassword() [password.ts]
  └─ createSession() [session.ts]
  └─ setCookie() [session.ts]
  └─ rateLimiter [cache]

logoutAction
  └─ verifySession() [from middleware]
  └─ Prisma.session.update({isValid: false})
  └─ clearCookie()

addCardToWallet (wrapped in server action)
  └─ withAuth() middleware
  └─ withOwnershipCheck() middleware
  └─ verifyPlayerOwnership() [ownership-check.ts]
  └─ existing addCardToWallet() logic

Middleware (middleware.ts)
  └─ verifySession() [session.ts]
  └─ attachUserContext()

useAuth() hook
  └─ fetch /api/auth/session
  └─ React.createContext
  └─ React.useContext
```

---

## Implementation Tasks

### Phase 1: Core Authentication System

**Task 1.1: Update Prisma Schema**
- **Complexity:** Small
- **Estimated Time:** 30 minutes
- **Acceptance Criteria:**
  - Session model added with all fields (id, userId, sessionToken, expiresAt, isValid, userAgent, ipAddress, createdAt, updatedAt)
  - User.passwordHash populated (schema already has field, verify it's String)
  - User has relationship to Session (one-to-many)
  - Session.sessionToken has unique constraint
  - Session.userId has foreign key to User with onDelete: Cascade
  - Migration created and applied successfully
- **Files to Modify:**
  - `/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/prisma/schema.prisma`

**Task 1.2: Implement Password Hashing & Verification Utilities**
- **Complexity:** Small
- **Estimated Time:** 1 hour
- **Acceptance Criteria:**
  - New file: `/src/lib/auth/password.ts`
  - `hashPassword(password: string): Promise<string>` function
    - Uses Argon2id (via library like `argon2` or `libsodium.js`)
    - Memory cost: 65536 KB
    - Time cost: 2 iterations
    - Returns base64-encoded hash
  - `verifyPassword(password: string, hash: string): Promise<boolean>` function
    - Uses timing-safe comparison (crypto.timingSafeEqual or argon2 verify)
    - Prevents timing attacks
    - Returns true only if password matches hash
  - Comprehensive tests: valid password, wrong password, invalid hash, edge cases
  - No errors thrown (returns success/failure booleans)
- **Dependencies:**
  - npm install argon2 (or alternative)
- **Files to Create:**
  - `/src/lib/auth/password.ts`
  - `/src/lib/auth/password.test.ts`

**Task 1.3: Implement Session Management Utilities**
- **Complexity:** Small-Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - New file: `/src/lib/auth/session.ts`
  - `SESSION_SECRET` environment variable (256-bit, read from .env)
  - `createSession(userId: string): Promise<{token: string; payload: SessionPayload}>`
    - Generates HS256 JWT with claims: userId, issuedAt, expiresAt, sessionId, version
    - Expires in 30 days
    - Returns both token string and decoded payload
  - `verifySession(token: string): SessionPayload | null`
    - Decodes JWT from token string
    - Verifies HS256 signature
    - Checks expiresAt > Date.now()
    - Returns payload if valid, null if invalid or expired
  - `getCookieOptions(): CookieOptions`
    - Returns object with httpOnly, secure, sameSite, maxAge, path
    - Conditional secure flag (true in production, false in dev)
  - Tests: valid token, expired token, tampered token, missing signature, missing claims
- **Dependencies:**
  - npm install jsonwebtoken (or jose for modern JWT)
  - Ensure SESSION_SECRET is set in .env.local
- **Files to Create:**
  - `/src/lib/auth/session.ts`
  - `/src/lib/auth/session.test.ts`
  - Update `.env.example` with SESSION_SECRET placeholder

**Task 1.4: Implement Signup Server Action**
- **Complexity:** Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - New file: `/src/actions/auth.ts`
  - `signupAction(email: string, password: string, firstName?: string, lastName?: string): Promise<SignupResult>`
  - Input validation:
    - Email format validation (simple regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
    - Email uniqueness check (query Prisma)
    - Password strength validation (12+ chars, 1 uppercase, 1 number, 1 special char)
    - Names optional, if provided: max 50 chars each
  - On success:
    - Hash password with Argon2
    - Create User record with passwordHash, firstName, lastName
    - Create default Player record (playerName='Primary', isActive=true)
    - Create Session record
    - Issue session cookie
    - Return {success: true, userId: '...'}
  - On error:
    - Duplicate email: return {success: false, error: 'Email already registered'}
    - Invalid password: return detailed error about requirement failed
    - DB error: return {success: false, error: 'Unable to create account'}
  - Atomic transaction: User + Player + Session created together
  - No partial state left if any step fails
- **Files to Create:**
  - `/src/actions/auth.ts`
  - `/src/actions/auth.test.ts` (integration tests)

**Task 1.5: Implement Login Server Action**
- **Complexity:** Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - In file: `/src/actions/auth.ts`
  - `loginAction(email: string, password: string): Promise<LoginResult>`
  - Input validation:
    - Email format check (basic validation)
    - Password not empty
  - Execution:
    - Normalize email (lowercase, trim)
    - Query User by email
    - If not found: return {success: false, error: 'Invalid email or password'} (no user enumeration)
    - Verify password using verifyPassword() with timing-safe comparison
    - If mismatch: increment login attempts counter (cache-based)
    - If > 5 attempts in 15 minutes: return {success: false, error: 'Account locked...'}
    - If success:
      - Create Session record
      - Issue session cookie
      - Return {success: true, userId: '...'}
  - Rate limiting: in-memory Map with timestamp tracking
  - Tests: valid login, wrong password, non-existent user, locked account, multiple attempts
- **Files to Modify:**
  - `/src/actions/auth.ts`
  - `/src/actions/auth.test.ts`
- **Dependencies:**
  - Rate limiter: simple in-memory cache (expandable to Redis later)

**Task 1.6: Implement Logout Server Action**
- **Complexity:** Small
- **Estimated Time:** 45 minutes
- **Acceptance Criteria:**
  - In file: `/src/actions/auth.ts`
  - `logoutAction(): Promise<LogoutResult>`
  - Extract session from middleware context
  - If no session: return {success: false, error: 'Not authenticated'}
  - Otherwise:
    - Query Session record by sessionToken
    - Update Session.isValid = false (or delete record)
    - Clear session cookie (set maxAge=0)
    - Return {success: true}
  - Tests: valid logout, already logged out, concurrent logouts
- **Files to Modify:**
  - `/src/actions/auth.ts`
  - `/src/actions/auth.test.ts`

**Task 1.7: Implement GET /api/auth/session Route**
- **Complexity:** Small
- **Estimated Time:** 45 minutes
- **Acceptance Criteria:**
  - New file: `/src/app/api/auth/session/route.ts`
  - Middleware provides session verification
  - If authenticated:
    - Query User by userId
    - Return {authenticated: true, userId, email, expiresAt, expiresInSeconds}
  - If not authenticated:
    - Return {authenticated: false, error: 'Not authenticated'}
  - No database queries on unauthenticated requests
  - Tests: authenticated user, expired session, no session
- **Files to Create:**
  - `/src/app/api/auth/session/route.ts`
  - Tests in corresponding test file

**Task 1.8: Implement Next.js Middleware for Session Validation**
- **Complexity:** Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - New file: `/src/middleware.ts`
  - Runs on all requests
  - Extract session cookie from request
  - Call verifySession() to validate JWT
  - If valid:
    - Attach userId to request headers (x-user-id header or request.context)
    - Continue to next handler
  - If invalid or expired:
    - For protected routes (/dashboard, /api/protected): redirect to /login
    - For public routes (/login, /signup, /api/auth/*): allow
  - If no session:
    - For protected routes: redirect to /login
    - For public routes: continue
  - Edge case: verify Session.isValid flag in database (optional, for revocation)
  - Tests: valid session, expired session, tampered token, no session, protected vs public routes
- **Files to Create:**
  - `/src/middleware.ts`
  - `/src/middleware.test.ts`
- **Configuration:**
  - Update `next.config.js` if needed for middleware config
  - Update `.env` with middleware-required variables

**Task 1.9: Implement useAuth() React Hook & AuthContext**
- **Complexity:** Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - New file: `/src/lib/auth/auth-context.tsx`
  - `AuthContext` with type:
    ```typescript
    interface AuthContextType {
      userId: string | null;
      email: string | null;
      isAuthenticated: boolean;
      expiresAt: Date | null;
      loading: boolean;
      logout: () => Promise<void>;
      refresh: () => Promise<void>;
    }
    ```
  - `AuthProvider` component wraps app
    - On mount: fetch /api/auth/session
    - Populate context from response
    - Set loading=false when complete
  - `useAuth()` hook returns context
  - `ProtectedRoute` component (optional):
    - Check isAuthenticated
    - Redirect to /login if not
  - Optional: auto-refresh token before expiry (5 minutes before expiry, call /api/auth/session)
  - Tests: initial auth state, fetch session, logout function, useAuth hook
- **Files to Create:**
  - `/src/lib/auth/auth-context.tsx`
  - `/src/lib/auth/use-auth.ts` (custom hook, separate file)
  - Update `src/app/layout.tsx` to wrap with AuthProvider

**Task 1.10: Implement POST /api/auth/signup Route**
- **Complexity:** Small
- **Estimated Time:** 45 minutes
- **Acceptance Criteria:**
  - New file: `/src/app/api/auth/signup/route.ts`
  - Accepts POST with JSON body: {email, password, firstName?, lastName?}
  - Calls signupAction() (from server actions)
  - On success: return 201 Created with {success: true, userId, message}
    - Also set session cookie in response
  - On error: return 400/409 with {success: false, error, fieldErrors?}
  - Rate limiting: 3 signups per hour per IP address
  - Tests: valid signup, duplicate email, weak password, rate limit
- **Files to Create:**
  - `/src/app/api/auth/signup/route.ts`

**Task 1.11: Implement POST /api/auth/login Route**
- **Complexity:** Small
- **Estimated Time:** 45 minutes
- **Acceptance Criteria:**
  - New file: `/src/app/api/auth/login/route.ts`
  - Accepts POST with JSON body: {email, password}
  - Calls loginAction() (from server actions)
  - On success: return 200 with {success: true, userId, message}
    - Also set session cookie in response
  - On error:
    - Invalid credentials: return 401 with {success: false, error: 'Invalid email or password'}
    - Account locked: return 423 with {success: false, error: 'Too many login attempts...', lockedUntil}
  - Rate limiting: built into loginAction() (5 fails / 15 min)
  - Tests: valid login, wrong password, non-existent email, locked account
- **Files to Create:**
  - `/src/app/api/auth/login/route.ts`

**Task 1.12: Implement POST /api/auth/logout Route**
- **Complexity:** Small
- **Estimated Time:** 30 minutes
- **Acceptance Criteria:**
  - New file: `/src/app/api/auth/logout/route.ts`
  - Accepts POST with no body
  - Calls logoutAction() (from server actions)
  - On success: return 200 with {success: true, message}
    - Also clear session cookie (set maxAge=0)
  - On error: return 401 with {success: false, error}
  - Tests: valid logout, no session
- **Files to Create:**
  - `/src/app/api/auth/logout/route.ts`

**Task 1.13: Create Signup Form Component**
- **Complexity:** Small-Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - New file: `/src/app/(auth)/signup/page.tsx`
  - Form with fields: email, password, confirmPassword, firstName, lastName
  - Client-side validation (before submission):
    - Email format
    - Password strength meter (12+ chars, etc.)
    - confirmPassword matches password
  - On submit:
    - Call signupAction({email, password, firstName, lastName})
    - Show loading state
    - On success: redirect to /dashboard
    - On error: show error message with retry option
  - Password strength meter visual feedback (red → yellow → green)
  - Link to /login page
  - No password pre-filled
  - Accessibility: labels, ARIA attributes, keyboard navigation
- **Files to Create:**
  - `/src/app/(auth)/signup/page.tsx`
  - `/src/components/auth/SignupForm.tsx` (extracted component)

**Task 1.14: Create Login Form Component**
- **Complexity:** Small-Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - New file: `/src/app/(auth)/login/page.tsx`
  - Form with fields: email, password
  - Client-side validation (optional, basic checks)
  - On submit:
    - Call loginAction({email, password})
    - Show loading state
    - On success: redirect to /dashboard
    - On error:
      - "Invalid email or password": show generic error
      - "Account locked": show countdown timer (15 minutes)
  - Remember me checkbox (optional, Phase 2)
  - Link to /signup page
  - Forgot password link (Phase 4)
  - No password pre-filled
  - Accessibility: labels, ARIA attributes
- **Files to Create:**
  - `/src/app/(auth)/login/page.tsx`
  - `/src/components/auth/LoginForm.tsx` (extracted component)

**Task 1.15: Create Protected Dashboard Layout**
- **Complexity:** Small
- **Estimated Time:** 1 hour
- **Acceptance Criteria:**
  - New file: `/src/app/(dashboard)/layout.tsx`
  - Wraps all dashboard routes
  - On mount: useAuth() verifies authenticated
  - If not authenticated: redirect to /login
  - Shows loading state while checking auth
  - Displays logout button (calls useAuth().logout())
  - Shows user email in header
  - Tests: authenticated user sees dashboard, unauthenticated redirected
- **Files to Create:**
  - `/src/app/(dashboard)/layout.tsx`
  - Update `/src/app/layout.tsx` to include AuthProvider

### Phase 2: Authorization & Ownership Verification

**Task 2.1: Implement Ownership Check Utilities**
- **Complexity:** Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - New file: `/src/lib/auth/ownership-check.ts`
  - `verifyPlayerOwnership(userId: string, playerId: string): Promise<boolean>`
    - Query Player by id
    - Check Player.userId === userId
    - Return boolean
  - `verifyCardOwnership(userId: string, cardId: string): Promise<boolean>`
    - Query UserCard by id
    - Get Player via userCard.player
    - Check Player.userId === userId
    - Return boolean
  - `verifyBenefitOwnership(userId: string, benefitId: string): Promise<boolean>`
    - Query UserBenefit by id
    - Check UserBenefit.playerId === userId (using denormalized FK)
    - Return boolean
  - All queries optimized with indexes
  - Tests: owned resource, unowned resource, non-existent resource
- **Files to Create:**
  - `/src/lib/auth/ownership-check.ts`
  - `/src/lib/auth/ownership-check.test.ts`

**Task 2.2: Implement withAuth() Wrapper for Server Actions**
- **Complexity:** Small-Medium
- **Estimated Time:** 1 hour
- **Acceptance Criteria:**
  - New file: `/src/lib/auth/with-auth.ts`
  - Higher-order function wrapper:
    ```typescript
    function withAuth<T extends (...args: any[]) => Promise<any>>(
      action: T
    ): (...args: Parameters<T>) => ReturnType<T>
    ```
  - Extracts session from middleware context (via cookies)
  - Verifies session valid and not expired
  - Attaches userId to first parameter or creates context object
  - If no session: throws AuthError (401)
  - If invalid: throws AuthError (401)
  - If expired: throws AuthError (401)
  - Preserves original action's return type
  - Tests: valid session, no session, expired session
- **Files to Create:**
  - `/src/lib/auth/with-auth.ts`
  - `/src/lib/auth/with-auth.test.ts`

**Task 2.3: Implement withOwnershipCheck() Wrapper for Server Actions**
- **Complexity:** Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - New file: `/src/lib/auth/with-ownership-check.ts`
  - Higher-order wrapper that:
    - Takes userId from context (assumes withAuth already applied)
    - Takes resource type (player, card, benefit)
    - Takes resource id from first parameter
    - Calls appropriate ownership check function
    - If owned: proceeds with action
    - If not owned: throws OwnershipError (403)
    - If resource not found: throws NotFoundError (404)
  - Composable with withAuth():
    ```typescript
    withOwnershipCheck(
      withAuth(originalAction),
      'player'
    )
    ```
  - Tests: owned resource, unowned resource, non-existent resource, combined with withAuth
- **Files to Create:**
  - `/src/lib/auth/with-ownership-check.ts`
  - `/src/lib/auth/with-ownership-check.test.ts`

**Task 2.4: Update addCardToWallet Server Action with Authorization**
- **Complexity:** Small
- **Estimated Time:** 45 minutes
- **Acceptance Criteria:**
  - Modify `/src/actions/wallet.ts`
  - Wrap existing addCardToWallet() with:
    1. withAuth() → verifies session.userId exists
    2. withOwnershipCheck() → verifies ownership of playerId
  - Function signature unchanged: (playerId, masterCardId, renewalDate)
  - On 403 Forbidden: return {success: false, error: 'You don't have permission...'}
  - On 404 Not Found: return {success: false, error: 'Player not found'}
  - Original logic unchanged
  - Tests: valid owner adds card, non-owner rejected, player not found
- **Files to Modify:**
  - `/src/actions/wallet.ts`

**Task 2.5: Update toggleBenefit Server Action with Authorization**
- **Complexity:** Small
- **Estimated Time:** 45 minutes
- **Acceptance Criteria:**
  - Modify `/src/actions/benefits.ts`
  - Wrap existing toggleBenefit() with:
    1. withAuth() → verifies session.userId exists
    2. withOwnershipCheck() → verifies ownership of benefitId
  - Function signature unchanged: (benefitId, currentIsUsed)
  - On 403 Forbidden: return {success: false, error: '...'}
  - On 404 Not Found: return {success: false, error: 'Benefit not found'}
  - Tests: valid owner toggles, non-owner rejected
- **Files to Modify:**
  - `/src/actions/benefits.ts`

**Task 2.6: Update updateUserDeclaredValue Server Action with Authorization**
- **Complexity:** Small
- **Estimated Time:** 45 minutes
- **Acceptance Criteria:**
  - Modify `/src/actions/benefits.ts`
  - Wrap existing updateUserDeclaredValue() with auth wrappers
  - Function signature unchanged: (benefitId, valueInCents)
  - On 403/404: return error
  - Tests: valid owner updates, non-owner rejected
- **Files to Modify:**
  - `/src/actions/benefits.ts`

**Task 2.7: Write Authorization Integration Tests**
- **Complexity:** Medium
- **Estimated Time:** 2 hours
- **Acceptance Criteria:**
  - Test file: `/src/__tests__/auth-integration.test.ts`
  - Test scenarios:
    - User can add card to own player
    - User cannot add card to other user's player
    - User can toggle own benefit
    - User cannot toggle other user's benefit
    - Non-authenticated requests rejected
    - Expired session rejected
    - Tampered session rejected
  - Test both success and failure paths
  - Use in-memory database or test fixtures
- **Files to Create:**
  - `/src/__tests__/auth-integration.test.ts`

### Phase 3: Cron Security & Testing

**Task 3.1: Fix Cron Timing Attack Vulnerability**
- **Complexity:** Small
- **Estimated Time:** 30 minutes
- **Acceptance Criteria:**
  - Modify `/src/app/api/cron/reset-benefits/route.ts`
  - Replace string comparison with `crypto.timingSafeEqual()`
  - Current (vulnerable):
    ```typescript
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    ```
  - Fixed (constant-time):
    ```typescript
    import { timingSafeEqual } from 'crypto';
    const expectedHeader = `Bearer ${process.env.CRON_SECRET}`;
    const isValid = timingSafeEqual(
      Buffer.from(authHeader || ''),
      Buffer.from(expectedHeader)
    );
    if (!isValid) {
    ```
  - Tests: valid secret accepted, invalid secret rejected, timing-safe verified
- **Files to Modify:**
  - `/src/app/api/cron/reset-benefits/route.ts`

**Task 3.2: Implement Rate Limiting for Cron Endpoint**
- **Complexity:** Small-Medium
- **Estimated Time:** 1 hour
- **Acceptance Criteria:**
  - Add in-memory rate limiter
  - Limit: 10 requests per 60 seconds (generous for 1 request per day)
  - Tracking: timestamp-based entries, auto-cleanup old entries
  - Response on rate limit: 429 Too Many Requests with retryAfter header
  - Tests: requests within limit accepted, exceeding limit rejected, old entries cleaned
  - Optional: Redis rate limiter for distributed deployments
- **Files to Modify:**
  - `/src/app/api/cron/reset-benefits/route.ts`
  - Optional: create `/src/lib/rate-limiter.ts`

**Task 3.3: Add Request Logging to Cron Endpoint**
- **Complexity:** Small
- **Estimated Time:** 30 minutes
- **Acceptance Criteria:**
  - Log all requests (authorized or not)
  - Include: timestamp, auth result (success/failure), reset count, errors
  - Use structured logging (JSON format for production parsing)
  - Example: `{timestamp: '2026-04-01T00:00:00Z', auth: 'success', resetCount: 47}`
  - Errors logged with details (but no sensitive data)
- **Files to Modify:**
  - `/src/app/api/cron/reset-benefits/route.ts`

**Task 3.4: Write Cron Endpoint Security Tests**
- **Complexity:** Medium
- **Estimated Time:** 1.5 hours
- **Acceptance Criteria:**
  - Test file: `/src/__tests__/cron-security.test.ts`
  - Test scenarios:
    - Valid CRON_SECRET accepted
    - Invalid CRON_SECRET rejected (401)
    - Missing Authorization header rejected (401)
    - Timing attack timing-safe (requests with valid/invalid secrets take ~same time)
    - Rate limit exceeded (429)
    - Benefits reset correctly
    - Concurrent cron requests handled
    - Database errors handled gracefully
  - Tests: timing-safe via measuring response times (not deterministic but indicative)
- **Files to Create:**
  - `/src/__tests__/cron-security.test.ts`

**Task 3.5: Write Comprehensive Authentication Tests**
- **Complexity:** Large
- **Estimated Time:** 3 hours
- **Acceptance Criteria:**
  - Test file: `/src/__tests__/auth-comprehensive.test.ts`
  - Signup flow tests:
    - Valid signup succeeds
    - Duplicate email rejected
    - Weak password rejected
    - Session created and cookie issued
  - Login flow tests:
    - Valid credentials succeed
    - Wrong password rejected
    - Non-existent email rejected (same error as wrong password)
    - Failed attempts tracked
    - Account locked after 5 failed attempts
    - Account unlocks after 15 minutes
  - Session tests:
    - Valid session verified
    - Expired session rejected
    - Tampered token rejected
    - Session in middleware accessible
  - Authorization tests:
    - Authenticated user can access protected routes
    - Unauthenticated user redirected
    - User cannot access other user's data
  - Tests cover happy paths and error scenarios
- **Files to Create:**
  - `/src/__tests__/auth-comprehensive.test.ts`

---

## Security & Compliance Considerations

### Authentication Strategy

**Email/Password Authentication (MVP)**
- No third-party auth providers yet (Phase 4+)
- Password hashing: Argon2id (memory-hard, timing-safe)
- Unique email constraint (prevents duplicates)
- Password strength requirements (12+ chars, complexity)
- No password hints or recovery (Phase 4: email recovery)

**Session Management**
- JWT tokens with HS256 signature
- Cryptographic signing prevents tampering
- HTTP-only cookies prevent JavaScript access (XSS protection)
- Secure flag prevents transmission over HTTP (HTTPS only in production)
- SameSite=Strict prevents CSRF
- Short session duration (30 days, configurable)
- Optional revocation via Session.isValid flag

### Authorization Strategy

**Ownership-Based Access Control (OAC)**
- User → Player → Card → Benefit ownership chain
- All mutations verify ownership before execution
- Denormalized playerId in UserBenefit for efficient queries
- No cross-user data access possible (schema enforces)
- Middleware validates session before reaching handlers

**Roles & Permissions**
- User (Account Owner): full access to own data
- System (Cron): read-only access to expired benefits, update specific fields
- Anonymous: public routes only

### Data Protection & Privacy

**Password Security**
- Never log passwords (not even in debug)
- Never email passwords (reset tokens only)
- Hash stored, not plaintext
- Argon2id: memory-hard (resistant to GPU attacks), timing-safe (prevents side-channel timing attacks)

**Session Tokens**
- Signed JWT (cannot forge without SECRET)
- Stored in HTTP-only cookie (cannot steal via JavaScript)
- Transmitted only over HTTPS (production)
- Short-lived (30 days)
- Optional: rotation (issue new token per request)

**Audit & Logging**
- Log all auth events: signup, login, logout, failed logins, account lockouts
- Log all authorization failures: 403 Forbidden attempts, ownership violations
- Do not log passwords, session tokens, or personal data
- Structured logging (JSON) for easy parsing
- Retention: 30 days (configurable)

### Threat Analysis & Mitigations

| Threat | Mitigation |
|--------|-----------|
| **Brute Force Password Attack** | Rate limiting (5 fails / 15 min), account lockout, Argon2 slow hashing |
| **Credential Stuffing** | Rate limiting, account lockout, optional: email confirmation |
| **Timing Attack on Password Comparison** | crypto.timingSafeEqual() (constant-time comparison) |
| **Session Hijacking (Cookie Theft)** | HTTP-only flag (prevents JS access), Secure flag (HTTPS only), SameSite=Strict (prevents CSRF), short TTL |
| **CSRF Attack** | SameSite=Strict cookie flag (prevents same-site attacks), CSRF token optional |
| **SQL Injection** | Prisma ORM (parameterized queries), no manual SQL |
| **XSS (Cross-Site Scripting)** | HTTP-only cookies (session not accessible via JS), input validation, output encoding |
| **Timing Attack on Cron Secret** | crypto.timingSafeEqual() for cron auth |
| **Cross-User Data Access** | Ownership verification, middleware session validation |
| **Data Exfiltration** | HTTPS enforced (production), passwords not logged, audit logs with retention |
| **Token Replay (Captured Token)** | Expiration (30 days), optional: token rotation, optional: IP pinning |
| **Weak Password** | Strength requirements (12+ chars, complexity), client-side meter |
| **Session Fixation** | New session created on login, old sessions independent |

---

## Performance & Scalability Considerations

### Expected Load & Growth

**MVP Phase**
- Estimated users: 100-1,000
- Concurrent users: 1-10
- Server actions per day: 10,000-100,000
- Peak requests per second: 5-10

**Phase 2-3**
- Estimated users: 10,000-100,000
- Concurrent users: 100-1,000
- Server actions per day: 100,000-1,000,000
- Peak requests per second: 50-200

### Optimization Strategies

**Database Indexing**
- `Session.userId` indexed (frequent queries)
- `Session.expiresAt` indexed (cleanup queries)
- `User.email` indexed (login lookups)
- `Player.userId` indexed (ownership checks)
- `UserBenefit.playerId` indexed (benefit queries)

**Caching Strategies**
- Session cache: optional in-memory cache to avoid DB queries (10 minutes TTL)
- Rate limiter: in-memory cache (15-minute window)
- Cleanup: periodic background job to delete expired sessions (optional, Phase 2+)

**Query Optimization**
- Ownership checks: single query per action (not N+1)
- Join Player when checking UserCard ownership (include: {player: true})
- Use denormalized playerId in UserBenefit (avoids join)

**Scalability Roadmap**
- **SQLite → PostgreSQL:** Better for concurrent writes, support for read replicas
- **In-Memory Cache → Redis:** Distributed session cache for multi-server deployment
- **Rate Limiter → Redis:** Distributed rate limiting across servers
- **Cron Job → Message Queue:** Use Vercel Queue or dedicated job service for scale

### Monitoring & Observability

**Key Metrics to Track**
- Login success rate (target: >95%)
- Failed login attempts per minute (alert if >10)
- Session creation rate (users per minute)
- Cron execution time (target: <5 seconds)
- Database query latency (target: <100ms p95)
- Authorization denial rate (should be low, <1%)

**Logging & Alerting**
- Alert on repeated failed login attempts from same IP (potential attack)
- Alert on unusual logout rate (potential session hijacking)
- Alert on authorization failures exceeding threshold (potential attack)
- Monitor cron success rate (target: 100%, alert on any failure)

---

## Implementation Tasks Summary

### Total Estimated Effort
- **Phase 1 (Core Auth):** 15 tasks, ~18-20 hours
- **Phase 2 (Authorization):** 7 tasks, ~8-10 hours
- **Phase 3 (Cron Security):** 5 tasks, ~7-8 hours
- **Total MVP:** ~33-40 hours of development

### Critical Path
1. Schema + Password utilities (Task 1.1-1.2)
2. Session utilities (Task 1.3)
3. Login/Signup actions (Tasks 1.4-1.5)
4. Middleware (Task 1.8)
5. Wrap server actions with auth (Task 2.2-2.6)
6. Fix cron vulnerability (Task 3.1)
7. UI Components & Pages (Tasks 1.13-1.15)

### Go/No-Go Checkpoints

**Checkpoint 1: Core Session Management (End of Task 1.8)**
- Session can be created, verified, and invalidated
- Middleware works for protected routes
- JWT signature verified
- Proceed to Checkpoint 2

**Checkpoint 2: Signup & Login Functional (End of Task 1.15)**
- Users can sign up
- Users can log in
- Dashboard accessible only when authenticated
- Logout works
- Proceed to Checkpoint 3

**Checkpoint 3: Authorization Enforcement (End of Task 2.7)**
- All server actions require auth
- Ownership boundary enforced
- Cross-user access prevented
- Proceed to Checkpoint 4

**Checkpoint 4: Cron Security (End of Task 3.3)**
- Timing attack fixed
- Rate limiting working
- All security tests passing
- Ready for production

---

## Testing Strategy

### Unit Tests
- **Password hashing:** valid, invalid, edge cases
- **Session creation/verification:** valid, expired, tampered
- **Ownership checks:** owned, not owned, missing
- **Input validation:** valid, invalid, edge cases
- **Coverage target:** >80% of auth module

### Integration Tests
- **Full auth flow:** signup → login → dashboard access → logout
- **Error paths:** duplicate email, wrong password, locked account
- **Authorization:** user can access own data, cannot access other's data
- **Cron:** valid secret accepted, invalid rejected, benefits reset

### E2E Tests (Phase 2+)
- **Browser-based tests:** Playwright
- **Flow tests:** signup form → confirmation → login → dashboard
- **Authorization tests:** login as user1, try to access user2's data
- **Cron job:** verify benefits reset daily

### Security Tests
- **Timing attack:** measure response times (constant)
- **Session tampering:** modify token, verify rejection
- **Rate limiting:** exceed limits, verify 429 response
- **CSRF:** cross-site request, verify rejected (SameSite)

### Performance Tests
- **Login response time:** target <500ms
- **Session verification:** target <50ms
- **Authorization check:** target <100ms
- **Cron execution:** target <5 seconds for 1000 benefits

---

## Rollback Plan

If critical issues discovered in production:

### Option 1: Disable Authentication Temporarily
- Comment out middleware session verification
- Revert to unauthenticated server actions
- **Data Integrity:** Users might access other users' data (controlled rollback)
- **Timeline:** 5-10 minutes
- **Communication:** Notify users of security investigation

### Option 2: Revert to Previous Commit
- Git revert to last working commit
- **Data Integrity:** New sessions lost, existing sessions still valid in database
- **Timeline:** 2-5 minutes
- **Communication:** Users must log in again

### Option 3: Emergency Migration
- Keep auth database, but whitelist specific users
- Disable signups temporarily
- Redirect non-whitelisted users to "maintenance" page
- **Timeline:** 10-15 minutes
- **Communication:** Service disruption notice

### Data Recovery
- **Sessions:** Session table can be truncated (users log in again)
- **Users:** Protect User table (never delete in rollback)
- **Passwords:** Already hashed, no recovery needed
- **Audit logs:** Retain for post-incident review

---

## Acceptance Criteria (Measurable & Testable)

### Authentication System
- [ ] Users can sign up with email and password
- [ ] Signup validates email uniqueness and password strength
- [ ] Passwords stored as salted Argon2 hashes (verify via `npm test`)
- [ ] Users can log in with correct credentials
- [ ] Login rejects wrong password without revealing user existence
- [ ] Session created after successful login
- [ ] Session persists across page refreshes
- [ ] Session cookie is HTTP-only and Secure
- [ ] Session cookie has SameSite=Strict
- [ ] Session expires after 30 days
- [ ] Expired session redirects to login
- [ ] Tampered session token rejected
- [ ] Users can logout
- [ ] Logout clears session cookie

### Authorization System
- [ ] All server actions require valid session
- [ ] Unauthenticated requests return 401
- [ ] Users cannot access other users' players
- [ ] Users cannot add cards to other users' players
- [ ] Users cannot toggle other users' benefits
- [ ] Ownership verification happens before mutation
- [ ] Cross-user access returns 403 Forbidden
- [ ] All authorization tests passing (100% coverage of ownership checks)

### Cron Security
- [ ] CRON_SECRET comparison is timing-safe (crypto.timingSafeEqual)
- [ ] Invalid cron secret rejected with 401
- [ ] Rate limiting prevents > 10 requests per minute
- [ ] Exceeding rate limit returns 429
- [ ] Benefits reset correctly daily
- [ ] Cron execution logged with count and timestamp
- [ ] All cron security tests passing

### Types & Type Safety
- [ ] Session.userId never null in authenticated context
- [ ] AuthContext properly typed with TypeScript
- [ ] useAuth() hook provides IntelliSense for userId, isAuthenticated, etc.
- [ ] Server actions cannot be called without withAuth wrapper (enforced at compile time)
- [ ] No `any` types in auth module (except unavoidable external APIs)

### Error Handling
- [ ] All auth failures return appropriate HTTP status (401, 403, 429, etc.)
- [ ] Error messages don't reveal user existence or system details
- [ ] Database errors return generic "try again" message
- [ ] All edge cases documented and tested
- [ ] Graceful handling of concurrent requests

### Documentation
- [ ] README.md includes auth setup instructions
- [ ] Environment variables documented (.env.example)
- [ ] API routes documented (response codes, error cases)
- [ ] Code comments explain security decisions
- [ ] Test cases document expected behaviors

---

## Quick Reference: File Structure After Implementation

```
/Users/manishslal/Desktop/Coding-Projects/Card-Benefits/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── signup/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── logout/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── session/
│   │   │   │   │   └── route.ts
│   │   │   │   └── signup/
│   │   │   │       └── route.ts
│   │   │   └── cron/
│   │   │       └── reset-benefits/
│   │   │           └── route.ts (UPDATED)
│   │   └── layout.tsx (UPDATED)
│   │
│   ├── lib/
│   │   └── auth/
│   │       ├── auth-context.tsx
│   │       ├── with-auth.ts
│   │       ├── with-ownership-check.ts
│   │       ├── ownership-check.ts
│   │       ├── password.ts
│   │       ├── session.ts
│   │       ├── use-auth.ts
│   │       ├── password.test.ts
│   │       ├── session.test.ts
│   │       ├── ownership-check.test.ts
│   │       ├── with-auth.test.ts
│   │       └── with-ownership-check.test.ts
│   │
│   ├── actions/
│   │   ├── auth.ts (NEW)
│   │   ├── wallet.ts (UPDATED)
│   │   ├── benefits.ts (UPDATED)
│   │   └── auth.test.ts (NEW)
│   │
│   ├── components/
│   │   └── auth/
│   │       ├── LoginForm.tsx
│   │       ├── SignupForm.tsx
│   │       └── ProtectedRoute.tsx
│   │
│   ├── middleware.ts (NEW)
│   │
│   └── __tests__/
│       ├── auth-integration.test.ts
│       ├── auth-comprehensive.test.ts
│       └── cron-security.test.ts
│
├── prisma/
│   ├── schema.prisma (UPDATED)
│   └── migrations/
│       └── [date]_add_session_model/
│           └── migration.sql (NEW)
│
├── .env.example (UPDATED)
├── .env.local (NEW, not committed)
├── next.config.js (optional updates)
└── SPECIFICATION_AUTHENTICATION.md (THIS FILE)
```

---

## Environment Variables Required

**Must be set before running:**

```bash
# .env.local (do not commit)
DATABASE_URL="file:./dev.db"
SESSION_SECRET="your-256-bit-secret-key-here-minimum-32-chars"
CRON_SECRET="your-cron-secret-here-minimum-32-chars"

# Optional, for production
NODE_ENV="development" # or "production"
SECURE_COOKIES="false" # set to "true" in production
SESSION_MAX_AGE="2592000" # 30 days in seconds
```

**Generation Commands:**
```bash
# Generate random 32-character secret (run twice, once for SESSION_SECRET, once for CRON_SECRET)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env.local:
SESSION_SECRET=abc123...
CRON_SECRET=def456...
```

---

## Conclusion

This specification provides a complete blueprint for implementing a secure, type-safe authentication and authorization system for the Credit Card Benefits Tracker. The architecture leverages Next.js 15 best practices, Prisma ORM constraints, and industry-standard cryptographic techniques (Argon2, HS256 JWT, timing-safe comparison).

**Key Design Decisions:**
- **JWT-based sessions** for stateless auth (scalable)
- **HTTP-only cookies** for secure session storage (XSS protection)
- **Timing-safe comparisons** for all security-critical operations
- **Ownership boundaries** enforced at middleware and action levels
- **Modular components** enabling parallel development
- **Comprehensive error handling** preventing information leakage

**Ready for Implementation:**
Engineers can begin development immediately with Tasks 1.1-1.3 (schema + utilities), then proceed through phases in order. Clear acceptance criteria ensure quality gates at each checkpoint.

---

**Document Revision History**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-01 | Initial specification draft |

