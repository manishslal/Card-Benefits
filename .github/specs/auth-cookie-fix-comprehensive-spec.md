# Cookie Not Being Set Bug Fix - Comprehensive Technical Specification

**Status:** Ready for Implementation  
**Priority:** Critical (Blocking Authentication)  
**Estimated Effort:** Small (2-4 hours)  
**Target Release:** Next patch

---

## Executive Summary & Goals

The authentication system successfully creates user accounts and validates credentials, but fails to deliver session cookies to the browser. This causes all protected route requests to return 401 "Authentication required" errors, rendering the application unusable for authenticated users.

**Root Cause:** The `setSessionCookie()` function in login and signup routes uses `response.headers.set('Set-Cookie', ...)` instead of Next.js's native `response.cookies.set()` API. Next.js does not support setting cookies via the headers API, so browsers never receive the Set-Cookie header.

**Primary Objectives:**
1. ✓ Replace `response.headers.set('Set-Cookie')` with `response.cookies.set()` in login/signup routes
2. ✓ Ensure all security flags (HttpOnly, Secure, SameSite) are preserved
3. ✓ Maintain consistent cookie naming and expiration strategy
4. ✓ Verify middleware correctly reads the cookie from all subsequent requests
5. ✓ Validate end-to-end flow: signup → redirect → protected route access

**Success Criteria:**
- Set-Cookie header is present in login/signup responses (verified in browser DevTools)
- Session cookie is stored in browser cookie cache
- Middleware successfully extracts cookie from subsequent requests
- Protected routes return 200 instead of 401 when user is authenticated
- Logout correctly clears the cookie
- Same security posture maintained (HttpOnly, Secure in prod, SameSite=Strict)

---

## Functional Requirements

### Current System Behavior

**Sign Up Flow:**
1. User submits email, password, name
2. Password validated for strength
3. User record created in database
4. Session record created with expiration
5. JWT token signed
6. Response created with `NextResponse.json()`
7. ⚠️ **BUG:** Cookie header set but NOT delivered to browser
8. Client receives 201, redirect triggered, but no session cookie stored

**Sign In Flow:**
1. User submits email, password
2. Rate limit checked (5 attempts in 15 min)
3. User record looked up by email
4. Password verified (timing-safe comparison)
5. Session created and JWT signed
6. Response created with `NextResponse.json()`
7. ⚠️ **BUG:** Cookie header set but NOT delivered to browser
8. Client receives 200, redirect triggered, but no session cookie stored

**Protected Route Access:**
1. Middleware extracts cookie from request
2. ⚠️ **FAILS:** Cookie never arrived, so extraction returns null
3. Middleware returns 401 "Authentication required"
4. User sees login page instead of requested page

**Logout Flow:**
1. ✓ Uses `response.cookies.delete('session')` correctly
2. ✓ Cookie cleared properly
3. ✓ Works as expected

### Middleware Expectations

The middleware in `src/middleware.ts` expects:
- Cookie name: `'session'` (exact match)
- Cookie format: HTTP-only, signed JWT token
- Cookie delivery: Via Set-Cookie header in response
- Cookie retrieval: `request.cookies.get('session')?.value`

**Current Middleware Code (lines 95-106):**
```typescript
function extractSessionToken(request: NextRequest): string | null {
  try {
    const token = request.cookies.get('session')?.value;  // ← Expects cookie to exist
    return token || null;
  } catch (error) {
    console.error('[Auth Middleware] Error parsing cookies:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}
```

The middleware code is correct—it's the cookie delivery in login/signup that's broken.

### Security Requirements (Non-Negotiable)

All security flags must be preserved:

| Flag | Purpose | Implementation |
|------|---------|-----------------|
| **HttpOnly** | Prevents JavaScript access (XSS protection) | `httpOnly: true` |
| **Secure** | HTTPS-only in production (MitM protection) | `secure: process.env.NODE_ENV === 'production'` |
| **SameSite** | Prevents cross-site request forgery (CSRF) | `sameSite: 'strict'` |
| **Max-Age** | Token expiration (aligns with JWT exp) | `maxAge: getSessionExpirationSeconds()` |
| **Path** | Cookie scope (sent to all app routes) | `path: '/'` |

---

## Root Cause Analysis

### Why `response.headers.set('Set-Cookie')` Fails

Next.js App Router (introduced in Next.js 13) treats the Set-Cookie header specially:

1. **Multiple Cookie Support:** Set-Cookie is the only header that can appear multiple times in HTTP responses
2. **Special Handling:** Next.js provides `response.cookies` API to manage this complexity
3. **Direct Header Setting Ignored:** When you call `response.headers.set('Set-Cookie', ...)`, Next.js:
   - Does NOT pass it through to the response
   - Does NOT deliver it to the browser
   - Silently ignores it (no error thrown)

### Current Broken Implementation

**In `src/app/api/auth/login/route.ts` (lines 235-258):**
```typescript
function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
): void {
  const cookieName = 'session';
  const isProduction = process.env.NODE_ENV === 'production';

  // ⚠️ PROBLEM: Manually building cookie string
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

  // ⚠️ CRITICAL BUG: This does NOT work in Next.js App Router
  response.headers.set('Set-Cookie', cookieOptions.join('; '));
}
```

**Same issue in `src/app/api/auth/signup/route.ts` (lines 259-282)**

### Why This Approach Fails

1. **Manual String Building:** Cookie value and options are manually concatenated
2. **Headers API Limitation:** Set-Cookie via headers is not supported by Next.js
3. **No Error Thrown:** Debugging is difficult because Next.js silently ignores the header
4. **Browser Never Sees:** Set-Cookie header never reaches the HTTP response sent to browser

### How Middleware Detects the Problem

When the middleware runs on subsequent requests:
```typescript
// In src/middleware.ts, line 97
const token = request.cookies.get('session')?.value;  // Returns null

if (!sessionToken) {
  // Cookie was never set, so this always triggers
  return createUnauthorizedResponse('Authentication required');
}
```

---

## Solution Design

### Core Strategy

Replace manual Set-Cookie header management with Next.js's native `response.cookies.set()` API.

**Key Principles:**
1. Use `response.cookies` object instead of `headers`
2. Let Next.js handle HTTP-level cookie protocol complexity
3. Maintain all security flags in structured format (not string literals)
4. Cookie name remains `'session'` for consistency
5. Token value and expiration logic unchanged

### Implementation Approach

**Before (Broken):**
```typescript
// ⚠️ Does NOT work
const cookieOptions = ['session=' + token, 'Max-Age=' + maxAge, ...];
response.headers.set('Set-Cookie', cookieOptions.join('; '));
```

**After (Fixed):**
```typescript
// ✓ Works correctly
response.cookies.set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: maxAgeSeconds,
  path: '/',
});
```

### Code Changes Required

#### File 1: `src/app/api/auth/login/route.ts`

**Location:** Lines 235-258 (setSessionCookie function)

**Current Code:**
```typescript
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

**Replacement Code:**
```typescript
function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
): void {
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: maxAgeSeconds,
    path: '/',
  });
}
```

**Changes:**
- Remove manual cookie string building
- Use `response.cookies.set()` method
- Pass cookie name as first parameter
- Pass token as second parameter
- Pass options object as third parameter
- All options remain identical (just different syntax)

#### File 2: `src/app/api/auth/signup/route.ts`

**Location:** Lines 259-282 (setSessionCookie function)

**Current Code:**
```typescript
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

**Replacement Code:**
```typescript
function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
): void {
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: maxAgeSeconds,
    path: '/',
  });
}
```

**Changes:** Identical to login route

#### File 3: `src/app/api/auth/logout/route.ts` (Optional Improvement)

**Location:** Lines 126-141 (clearSessionCookie function)

**Current Code:**
```typescript
function clearSessionCookie(response: NextResponse): void {
  const cookieOptions = [
    'session=',
    'Max-Age=0',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];

  if (process.env.NODE_ENV === 'production') {
    cookieOptions.push('Secure');
  }

  response.headers.set('Set-Cookie', cookieOptions.join('; '));
}
```

**Replacement Code (Recommended):**
```typescript
function clearSessionCookie(response: NextResponse): void {
  // Use delete() for cleaner cookie clearing
  response.cookies.delete('session');
}
```

**Note:** The logout route already uses the correct approach for middleware cleanup. We should use `response.cookies.delete()` which is the idiomatic way and also clears any residual headers.

### No Changes Required

✓ `src/middleware.ts` - Correctly uses `request.cookies.get('session')`  
✓ `src/lib/auth-utils.ts` - JWT creation/verification unchanged  
✓ `src/lib/auth-server.ts` - Database session logic unchanged  
✓ All imports remain the same (NextResponse already imported)

---

## Detailed Implementation Guide

### Step 1: Update Login Route

**File:** `src/app/api/auth/login/route.ts`

1. Locate the `setSessionCookie()` function (around line 235)
2. Replace the entire function with the fixed version above
3. No changes to function signature or callers

**Verification Points:**
- Function still called at line 193: `setSessionCookie(response, token, getSessionExpirationSeconds());`
- No changes needed to that call site
- Compiler will verify no type mismatches

### Step 2: Update Signup Route

**File:** `src/app/api/auth/signup/route.ts`

1. Locate the `setSessionCookie()` function (around line 259)
2. Replace the entire function with the fixed version
3. No changes to function signature or callers

**Verification Points:**
- Function still called at line 136: `setSessionCookie(response, token, getSessionExpirationSeconds());`
- No changes needed to that call site

### Step 3: Update Logout Route (Optional but Recommended)

**File:** `src/app/api/auth/logout/route.ts`

1. Locate the `clearSessionCookie()` function (around line 126)
2. Replace with: `response.cookies.delete('session');`
3. This makes logout consistent with login/signup

**Verification Points:**
- Function called at lines 96 and 114
- No changes needed to call sites

### Step 4: Verify Types

Run TypeScript compiler to ensure no type errors:
```bash
npm run build
# or
npx tsc --noEmit
```

Expected result: No errors (NextResponse.cookies is properly typed in Next.js)

### Step 5: Test Locally

**Prerequisites:**
- Development environment running (`npm run dev`)
- Browser DevTools available

**Test Scenario 1: Sign Up Flow**
1. Navigate to `/signup`
2. Enter email, password, name
3. Submit form
4. Check browser DevTools → Application → Cookies
5. ✓ Should see `session` cookie with JWT value
6. ✓ Should see `HttpOnly` flag (greyed out in DevTools, can't delete manually)
7. ✓ Cookie path should be `/`
8. ✓ Session cookie domain should match current domain

**Test Scenario 2: Login Flow**
1. Navigate to `/login`
2. Enter email and password of existing user
3. Submit form
4. Check browser DevTools → Cookies
5. ✓ Should see `session` cookie
6. Same verification as above

**Test Scenario 3: Protected Route Access**
1. After login, navigate to `/dashboard` (or protected route)
2. Should load successfully (not return 401)
3. Middleware should extract cookie and authenticate request
4. Route component should render

**Test Scenario 4: Logout Flow**
1. While logged in, click logout
2. Check DevTools → Cookies
3. ✓ `session` cookie should disappear
4. ✓ Attempting to access protected route should return 401

**Test Scenario 5: Production Secure Flag**
1. Build for production: `npm run build`
2. Review code: Secure flag only set when `NODE_ENV === 'production'`
3. In production, HTTPS-only cookies prevent MitM attacks

---

## Implementation Phases

### Phase 1: Code Modifications (30 minutes)

**Tasks:**
1. Update `src/app/api/auth/login/route.ts` - setSessionCookie function
2. Update `src/app/api/auth/signup/route.ts` - setSessionCookie function
3. Update `src/app/api/auth/logout/route.ts` - clearSessionCookie function (optional)
4. Run TypeScript compiler to verify types

**Acceptance Criteria:**
- ✓ All three functions updated to use response.cookies API
- ✓ No TypeScript errors
- ✓ No linting errors
- ✓ Code compiles successfully

### Phase 2: Local Testing (45 minutes)

**Tasks:**
1. Start development server
2. Test signup flow with cookie verification
3. Test login flow with cookie verification
4. Test protected route access
5. Test logout flow with cookie clearing
6. Test dev vs production Secure flag

**Acceptance Criteria:**
- ✓ Set-Cookie header present in login/signup responses
- ✓ Session cookie appears in browser cookie storage
- ✓ Cookie is HttpOnly (not accessible via JavaScript)
- ✓ Protected routes load successfully after login
- ✓ Logout clears the cookie
- ✓ All 5 test scenarios pass

### Phase 3: End-to-End Verification (30 minutes)

**Tasks:**
1. Full signup-to-dashboard flow
2. Full login-to-dashboard flow
3. Session persistence across browser refresh
4. Session invalidation after logout
5. Verify middleware logs show successful auth

**Acceptance Criteria:**
- ✓ Complete auth flow works without errors
- ✓ User can access protected routes
- ✓ Session persists across page reloads
- ✓ Middleware middleware logs show "Auth successful" (if enabled)
- ✓ No 401 errors on protected routes

---

## Data & API Flow Diagrams

### Current Broken Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ SIGN UP / LOGIN FLOW (BROKEN)                                   │
└─────────────────────────────────────────────────────────────────┘

Browser                          Server                    Database
  │                                │                           │
  ├─ POST /api/auth/signup ───────>│                           │
  │  email, password               │                           │
  │                                ├─ Validate & Hash ────────>│
  │                                │                           │
  │                                │<─ User Created ───────────┤
  │                                │                           │
  │                                ├─ Create Session ─────────>│
  │                                │                           │
  │                                │<─ Session Created ────────┤
  │                                │                           │
  │                                ├─ Sign JWT Token           │
  │                                │                           │
  │                                ├─ Build NextResponse       │
  │                                │                           │
  │                                ├─ Call headers.set()       │
  │                                │  ("Set-Cookie")           │
  │                                │  ⚠️ IGNORED BY NEXT.JS   │
  │                                │                           │
  │<─ HTTP 201 ────────────────────┤                           │
  │  (no Set-Cookie header)        │                           │
  │                                │                           │
  ├─ Navigate to /dashboard ──────>│                           │
  │  (no cookie in request)        │                           │
  │                                ├─ Check for cookie        │
  │                                ├─ Not found (null)        │
  │                                ├─ Middleware returns 401  │
  │<─ HTTP 401 ────────────────────┤                           │
  │  ("Authentication required")   │                           │
  │                                │                           │
  └─ Redirect to /login            │                           │
     (infinite loop!)              │                           │
```

### Fixed Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ SIGN UP / LOGIN FLOW (FIXED)                                    │
└─────────────────────────────────────────────────────────────────┘

Browser                          Server                    Database
  │                                │                           │
  ├─ POST /api/auth/signup ───────>│                           │
  │  email, password               │                           │
  │                                ├─ Validate & Hash ────────>│
  │                                │                           │
  │                                │<─ User Created ───────────┤
  │                                │                           │
  │                                ├─ Create Session ─────────>│
  │                                │                           │
  │                                │<─ Session Created ────────┤
  │                                │                           │
  │                                ├─ Sign JWT Token           │
  │                                │                           │
  │                                ├─ Build NextResponse       │
  │                                │                           │
  │                                ├─ Call cookies.set()       │
  │                                │  ✓ WORKS IN NEXT.JS      │
  │                                │                           │
  │<─ HTTP 201 ────────────────────┤                           │
  │  Set-Cookie: session=<jwt>...  │                           │
  │                                │                           │
  │  [Store cookie in browser]     │                           │
  │                                │                           │
  ├─ Navigate to /dashboard ──────>│                           │
  │  Cookie: session=<jwt> ────────>│                           │
  │                                ├─ Extract from request    │
  │                                ├─ Verify JWT signature    │
  │                                ├─ Check DB for session   >│
  │                                │                           │
  │                                │<─ Session Valid ─────────┤
  │<─ HTTP 200 ────────────────────┤                           │
  │  [Dashboard rendered]          │                           │
  │                                │                           │
  └─ ✓ Authenticated access        │                           │
```

---

## Edge Cases & Error Handling

### Edge Case 1: Development vs Production

**Scenario:** Cookie security differs between dev and production

**Implementation:**
```typescript
response.cookies.set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',  // ← Conditional
  sameSite: 'strict',
  maxAge: maxAgeSeconds,
  path: '/',
});
```

**Handling:**
- **Development:** Cookies sent over HTTP (localhost), Secure flag omitted
- **Production:** Cookies sent over HTTPS only, Secure flag set
- **Benefit:** Allows local testing; protects production from MitM

**Test Verification:**
- In dev: Browser doesn't require HTTPS, cookie accepted
- In prod: Browser enforces HTTPS, cookie rejected if not Secure

---

### Edge Case 2: Cookie Domain Scope

**Scenario:** Cookie should be sent to all app routes, but not to external domains

**Implementation:**
```typescript
path: '/'  // Sent to all routes under root
// No domain set → Uses request origin (implicit)
```

**Handling:**
- **Path='/':** Cookie sent to `/`, `/login`, `/dashboard`, `/api/protected/*`
- **No Domain:** Cookie only sent to same domain (CSRF protection)
- **SameSite=Strict:** Only sent in same-site requests, not cross-site

**Test Verification:**
- Cookie sent to protected routes ✓
- Cookie NOT sent to external domains ✓
- Cookie NOT sent in cross-origin requests ✓

---

### Edge Case 3: Multiple Set-Cookie Headers

**Scenario:** Login response might set multiple cookies (session + other tracking)

**Current Implementation:**
- Each `response.cookies.set()` call adds one header
- Next.js manages multiple Set-Cookie headers automatically

**Handling:**
```typescript
// Multiple cookies work correctly
response.cookies.set('session', token, {...});
response.cookies.set('other', value, {...});  // Second cookie
// Browser receives both Set-Cookie headers
```

**Not a breaking change:** Current code only sets one cookie, so no multi-header complexity

---

### Edge Case 4: Cookie Overwrite on Rapid Requests

**Scenario:** User clicks login twice rapidly

**Handling:**
- First request: Creates session, sets cookie, returns 200
- Second request: Creates new session (race condition in database)
- Both create valid sessions; last Set-Cookie header wins
- Browser stores the latest cookie
- Middleware validates against database, both tokens are valid
- No critical failure

**No action required:** Application is transaction-safe at database level

---

### Edge Case 5: Expired Token in Cookie

**Scenario:** User has valid cookie, but JWT inside is expired

**Current Implementation:**
- Middleware checks `isSessionExpired(payload)` at line 89 (session route)
- Middleware has no explicit expiration check in protected routes

**Issue:** Vulnerable gap if token expires before max-age

**Handling:**
- Update middleware to verify expiration (if not already done)
- Cookie clears from browser when max-age reached
- Session record has expiresAt field for database-side checks

**Recommendation:** Add expiration check to middleware:
```typescript
if (isSessionExpired(payload)) {
  return createUnauthorizedResponse('Session expired');
}
```

This is **outside the scope** of this cookie fix but recommended in Phase 4

---

### Edge Case 6: Secure Flag Mismatch

**Scenario:** Secure flag set, but request comes over HTTP

**Handling:**
- Browser rejects cookie over HTTP (silently, no error thrown)
- Cookie not stored
- Next request fails authentication

**Prevention:**
- Local dev uses HTTP (Secure flag not set)
- Deployed production uses HTTPS (Secure flag set)
- Mismatch prevented by `NODE_ENV` check

---

### Edge Case 7: SameSite=Strict with Legitimate Cross-Origin

**Scenario:** API call from `www.example.com` to `api.example.com` (same parent domain)

**Current Implementation:**
```typescript
sameSite: 'strict'  // Only same-site requests
```

**Handling:**
- SameSite=Strict only allows same-site, not even same parent domain
- If subdomain separation needed, would require `sameSite: 'lax'`
- Current app is same-origin only (no subdomain architecture)

**Verification:**
- All API calls from same origin
- No cross-subdomain requests
- No breaking change

---

### Edge Case 8: HttpOnly Cookie Doesn't Affect API

**Scenario:** Frontend JavaScript needs to check if user is logged in

**Handling:**
- JavaScript cannot read HttpOnly cookie (intended XSS protection)
- Use `/api/auth/session` endpoint instead (returns JSON)
- Endpoint checks cookie and returns user info
- Frontend calls this endpoint to verify auth status

**Current Implementation:**
- Already supports `/api/auth/session` (line 56 in session/route.ts)
- Returns `{ authenticated: true, userId, email, expiresInSeconds }`

**No changes needed:** Application already handles this correctly

---

### Edge Case 9: Cookie Deleted by Browser Storage Clear

**Scenario:** User clears all cookies/site data

**Handling:**
- Session cookie deleted
- Next protected route request has no cookie
- Middleware returns 401
- User redirected to login
- Normal behavior, not a bug

---

### Edge Case 10: Clock Skew Between Client and Server

**Scenario:** User's device clock is far ahead/behind server

**Handling:**
- JWT expiration based on server time
- max-age in cookie also based on server time
- If client clock is ahead, JWT might be invalid when browser thinks it's valid
- Middleware validates against server time (correct behavior)

**Mitigation:**
- NTP sync recommended on servers (infrastructure concern)
- Client clock sync recommended on user devices (outside app control)
- Not affected by this cookie fix

---

### Edge Case 11: Concurrent Logout Requests

**Scenario:** User submits logout twice rapidly

**Handling:**
```typescript
// logout/route.ts line 84
await invalidateSession(sessionCookie.value);  // Marks isValid = false
// Second request queries database, gets null (already invalidated)
// Returns 400 "Session not found" (expected behavior)
```

**No breaking change:** Idempotent, both responses clear cookie

---

### Edge Case 12: Memory Pressure / Cookie Storage Limits

**Scenario:** User's browser cookie jar is full (unlikely, but possible)

**Handling:**
- Browser refuses new cookie storage
- Set-Cookie header has no effect
- No cookie in subsequent requests
- Middleware returns 401 (correct)
- No infinite loop, user redirected to login
- Not app's responsibility (browser-level issue)

---

## Component Architecture

### System Components

```
┌──────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION SYSTEM                     │
└──────────────────────────────────────────────────────────────┘

┌────────────────────┐
│   LOGIN ROUTE      │  (src/app/api/auth/login/route.ts)
│                    │
│  - Validate creds  │─ FIXED: response.cookies.set()
│  - Create session  │
│  - Sign JWT        │
│  - Set cookie ────────────┐
│                    │      │
└────────────────────┘      │
                            │
┌────────────────────┐      │
│  SIGNUP ROUTE      │  (src/app/api/auth/signup/route.ts)
│                    │      │
│  - Validate email  │      │ FIXED: response.cookies.set()
│  - Hash password   │      │
│  - Create user     │      │
│  - Create session  │      │
│  - Sign JWT        │      │
│  - Set cookie ─────────────┤
│                    │      │
└────────────────────┘      │
                            │
┌────────────────────┐      │
│  LOGOUT ROUTE      │  (src/app/api/auth/logout/route.ts)
│                    │      │
│  - Get cookie      │      │
│  - Invalidate DB   │      │ OPTIONAL FIX: response.cookies.delete()
│  - Clear cookie ───────────┤
│                    │      │
└────────────────────┘      │
                            │
                            ▼
                    ┌─────────────────┐
                    │  SET-COOKIE     │
                    │   HEADER        │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   BROWSER       │
                    │  COOKIE STORE   │
                    └────────┬────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
        ▼                                         ▼
   ┌──────────┐                          ┌──────────────┐
   │ NEXT     │                          │ PROTECTED    │
   │ REQUEST  │                          │ ROUTE        │
   │ (to any  │────────────────────────> │ REQUEST      │
   │ route)   │ "Cookie: session=<jwt>"  │              │
   └──────────┘                          └──────┬───────┘
        │                                        │
        │                                        ▼
        │                                 ┌──────────────────┐
        │                                 │  MIDDLEWARE      │
        │                                 │  (src/middleware.ts)
        │                                 │                  │
        │                                 │ - Extract cookie │
        │                                 │   (request.      │
        │                                 │    cookies.get() │
        │                                 │ - Verify JWT     │
        │                                 │ - Check DB       │
        │                                 │ - Auth OK ✓      │
        │                                 └──────┬───────────┘
        │                                        │
        │                                        ▼
        │                                 ┌──────────────────┐
        │                                 │  ROUTE HANDLER   │
        │                                 │  (Authenticated) │
        │                                 │  Returns 200 ✓   │
        │                                 └──────────────────┘
        │
        └─ Database
           (Session validation)
```

### Component Responsibilities

| Component | File | Responsibility | Status |
|-----------|------|-----------------|--------|
| Login Handler | `src/app/api/auth/login/route.ts` | Authenticate user, create session, **SET COOKIE** | 🔧 TO FIX |
| Signup Handler | `src/app/api/auth/signup/route.ts` | Create user, create session, **SET COOKIE** | 🔧 TO FIX |
| Logout Handler | `src/app/api/auth/logout/route.ts` | Invalidate session, **CLEAR COOKIE** | ✓ Working |
| Middleware | `src/middleware.ts` | **EXTRACT COOKIE**, verify JWT, validate DB session | ✓ Working |
| Auth Utils | `src/lib/auth-utils.ts` | JWT creation, signature verification, expiration checks | ✓ Working |
| Auth Server | `src/lib/auth-server.ts` | Database queries for users and sessions | ✓ Working |
| Session Endpoint | `src/app/api/auth/session/route.ts` | Return current session info from **COOKIE** | ✓ Working |

### Data Flow

1. **Cookie Set (Fixed Components)**
   - Login/Signup handlers call `response.cookies.set()`
   - Next.js delivers Set-Cookie header to browser
   - Browser stores cookie

2. **Cookie Extraction (Already Working)**
   - Middleware calls `request.cookies.get('session')`
   - Next.js extracts from HTTP Cookie header
   - Returns JWT token string

3. **Cookie Validation (Already Working)**
   - Middleware verifies JWT signature
   - Middleware checks database Session record
   - Returns 200 or 401

---

## Security & Compliance Considerations

### Authentication Strategy

**Two-Layer Security Model:**
1. **JWT Signature Verification** (Prevents tampering)
   - HMAC-SHA256 signature prevents modification
   - Invalid signature → token rejected
   
2. **Database Session Validation** (Enables revocation)
   - Session record checked on every request
   - Logout sets isValid=false
   - Token remains cryptographically valid but revoked

**Cookie Transportation:**
```
┌─────────────────────────────────────┐
│  HTTP Response Header               │
│  Set-Cookie: session=<JWT>; ...     │
│  HttpOnly; Secure; SameSite=Strict  │
└─────────────────────────────────────┘
         │                     │
         ▼                     ▼
    [HTTP/HTTPS]          [Security Flags]
    Transport Layer       Cookie Policy
```

### Data Protection

**What's Protected:**
- ✓ JWT token stored in HttpOnly cookie (JavaScript cannot access)
- ✓ HTTPS only in production (Secure flag prevents MitM)
- ✓ Same-site only (SameSite=Strict prevents CSRF)
- ✓ Contains no plaintext passwords or secrets

**What's in the Cookie:**
- JWT claims: `{ userId, sessionId, expiresAt, iat }`
- No PII (Personally Identifiable Information)
- No sensitive data except reference to user
- Signature prevents tampering

### Attack Surface Coverage

| Attack | Mitigation | Status |
|--------|-----------|--------|
| **XSS (JavaScript theft)** | HttpOnly flag prevents JS access | ✓ Protected |
| **CSRF (Cross-site requests)** | SameSite=Strict limits sending | ✓ Protected |
| **MitM (Network interception)** | Secure flag forces HTTPS in prod | ✓ Protected |
| **Session fixation** | New session created per login | ✓ Protected |
| **Token tampering** | JWT signature validates in middleware | ✓ Protected |
| **Replay attacks** | Database checks prevent revoked tokens | ✓ Protected |
| **Timing attacks** | JWT verification uses timing-safe compare | ✓ Protected |

### Compliance Considerations

**OWASP Top 10 Coverage:**
- ✓ **A01:2021 - Broken Access Control**: Middleware validates auth on protected routes
- ✓ **A02:2021 - Cryptographic Failures**: HMAC-SHA256 JWT signature, HTTPS in prod
- ✓ **A03:2021 - Injection**: Password hashing with Argon2id, parameterized DB queries
- ✓ **A07:2021 - XSS**: HttpOnly cookies prevent JavaScript access
- ✓ **A08:2021 - CSRF**: SameSite=Strict prevents cross-site requests

**Best Practices Applied:**
- ✓ Secure cookie flags (HttpOnly, Secure, SameSite)
- ✓ Timing-safe password comparison
- ✓ Rate limiting on login attempts (5 attempts in 15 min)
- ✓ Generic error messages (no user enumeration)
- ✓ Account lockout after failed attempts
- ✓ JWT signature verification
- ✓ Database session revocation

### Audit & Logging

**Security Events Logged:**
- Failed login attempts (email, timestamp)
- Account lockouts (email, locked_until time)
- Session creation (user_id, session_id)
- Session invalidation on logout (user_id)
- Token verification failures (generic, no token details)

**No Changes Required:** Existing logging already in place

---

## Performance & Scalability Considerations

### Cookie Performance

**HTTP Header Size:**
- Cookie name: 7 bytes (`session=`)
- JWT token: ~300-400 bytes (typical HMAC-SHA256)
- Cookie attributes: ~70 bytes (`Max-Age; Path; HttpOnly; ...`)
- **Total:** ~400-500 bytes per cookie

**Impact:**
- Minimal (typical HTTP headers are kilobytes)
- Sent with every request to protected routes
- Negligible performance impact

**Optimization:**
- JWT kept minimal (only userId, sessionId, expiresAt)
- No unnecessary claims added
- No large payloads in token

### Database Query Performance

**Session Validation (Per Protected Request):**
```sql
SELECT * FROM Session WHERE sessionToken = $1;
-- Indexed on sessionToken (fast)
-- Query execution time: ~1-5ms
```

**Recommendation:**
- Add index on `Session.sessionToken` (recommended in schema)
- Add index on `Session.isValid` (if not already present)
- Cache Session.isValid briefly if high QPS (query per second)

### Middleware Performance

**Execution Timeline (Per Protected Request):**
1. Extract cookie from request: ~0.1ms (array lookup)
2. JWT verification (HMAC): ~1-2ms (cryptographic op)
3. Database query: ~1-5ms (indexed lookup)
4. Total: ~2-7ms per request

**Scaling Implications:**
- Linear with request volume (O(n) requests = O(n) DB queries)
- Database connection pooling recommended (already in place with Prisma)
- Redis caching optional for Session.isValid (advanced optimization)

### Current Implementation is Production-Ready

The fix doesn't change performance characteristics:
- Same number of database queries
- Same JWT verification logic
- Same middleware execution
- Only changes cookie delivery mechanism (not performance-sensitive)

---

## Testing Strategy

### Unit Tests

**Test File:** `tests/auth-cookie-fix.test.ts` (create new)

#### Test 1: Cookie Set in Login Response
```typescript
it('should set session cookie in login response', async () => {
  // Given
  const mockUser = { id: 'user-1', email: 'test@example.com', passwordHash: '...' };
  jest.spyOn(authServer, 'getUserByEmail').mockResolvedValue(mockUser);
  jest.spyOn(authUtils, 'verifyPassword').mockResolvedValue(true);

  // When
  const response = await POST(createMockRequest({
    email: 'test@example.com',
    password: 'ValidPassword123',
  }));

  // Then
  expect(response.cookies.get('session')).toBeDefined();
  expect(response.cookies.get('session')).toHaveProperty('value');
  expect(response.cookies.get('session')).toHaveProperty('httpOnly', true);
  expect(response.cookies.get('session')).toHaveProperty('sameSite', 'strict');
  expect(response.cookies.get('session')).toHaveProperty('path', '/');
  expect(response.cookies.get('session')).toHaveProperty('maxAge');
});
```

#### Test 2: Cookie Set in Signup Response
```typescript
it('should set session cookie in signup response', async () => {
  // Given
  jest.spyOn(authServer, 'createUser').mockResolvedValue({ id: 'user-1', email: 'new@example.com' });

  // When
  const response = await POST(createMockRequest({
    email: 'new@example.com',
    password: 'ValidPassword123',
    firstName: 'John',
  }));

  // Then
  expect(response.cookies.get('session')).toBeDefined();
  expect(response.status).toBe(201);
});
```

#### Test 3: Secure Flag in Production
```typescript
it('should set Secure flag when NODE_ENV=production', async () => {
  // Given
  process.env.NODE_ENV = 'production';

  // When
  const response = await POST(createMockRequest({...}));

  // Then
  expect(response.cookies.get('session')).toHaveProperty('secure', true);
});
```

#### Test 4: No Secure Flag in Development
```typescript
it('should not set Secure flag when NODE_ENV=development', async () => {
  // Given
  process.env.NODE_ENV = 'development';

  // When
  const response = await POST(createMockRequest({...}));

  // Then
  expect(response.cookies.get('session')).toHaveProperty('secure', false);
});
```

#### Test 5: Cookie Cleared on Logout
```typescript
it('should delete session cookie on logout', async () => {
  // Given
  const mockSession = { id: 'session-1', userId: 'user-1', isValid: true };
  jest.spyOn(authServer, 'invalidateSession').mockResolvedValue(mockSession);

  // When
  const response = await POST(createMockRequest());

  // Then
  expect(response.cookies.get('session')).toBeUndefined();
});
```

### Integration Tests

**Test File:** `tests/auth-flow.integration.test.ts` (expand existing)

#### Test 6: End-to-End Signup → Protected Route
```typescript
it('should allow access to protected route after signup', async () => {
  // Step 1: Signup
  const signupResponse = await fetch('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'test@example.com', password: 'ValidPassword123' }),
  });
  expect(signupResponse.status).toBe(201);
  
  // Extract Set-Cookie header
  const setCookie = signupResponse.headers.get('Set-Cookie');
  expect(setCookie).toContain('session=');
  expect(setCookie).toContain('HttpOnly');
  expect(setCookie).toContain('SameSite=Strict');

  // Step 2: Access protected route with cookie
  const dashboardResponse = await fetch('/dashboard', {
    headers: { 'Cookie': setCookie },
  });
  expect(dashboardResponse.status).toBe(200);  // Should succeed
});
```

### Manual Testing (Browser DevTools)

**Test 9: Cookie Visible in DevTools**

Steps:
1. Open browser DevTools (F12)
2. Navigate to http://localhost:3000
3. Go to Application tab → Cookies → localhost:3000
4. Click signup, fill form, submit
5. **Verify:** Session cookie appears in list
6. **Verify:** Value shows JWT (long base64 string)
7. **Verify:** HttpOnly column shows "✓" (checkmark)
8. **Verify:** Secure column shows "✗" (empty in dev, "✓" in prod)
9. **Verify:** Path shows "/"
10. **Verify:** SameSite shows "Strict"

Expected result: All flags correct, cookie value present

---

## Implementation Tasks

### Task 1: Update Login Route Cookie Handler

**Task ID:** `auth-cookie-login-fix`  
**Phase:** 1  
**Complexity:** Small  
**Estimated Time:** 15 minutes  
**Dependencies:** None

**Description:**
Replace the `setSessionCookie()` function in `src/app/api/auth/login/route.ts` to use `response.cookies.set()` instead of `response.headers.set('Set-Cookie')`.

**Acceptance Criteria:**
- ✓ Function updated to use native Next.js cookies API
- ✓ All security flags preserved (httpOnly, secure, sameSite, maxAge, path)
- ✓ No changes to function signature or callers
- ✓ TypeScript compilation succeeds with no errors
- ✓ No linting errors

---

### Task 2: Update Signup Route Cookie Handler

**Task ID:** `auth-cookie-signup-fix`  
**Phase:** 1  
**Complexity:** Small  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 1 (same pattern)

**Description:**
Replace the `setSessionCookie()` function in `src/app/api/auth/signup/route.ts` to use `response.cookies.set()`.

**Acceptance Criteria:**
- ✓ Function updated using same pattern as login fix
- ✓ All security flags preserved
- ✓ No changes to function signature or callers
- ✓ TypeScript compilation succeeds
- ✓ No linting errors

---

### Task 3: Update Logout Route Cookie Handler (Optional)

**Task ID:** `auth-cookie-logout-fix`  
**Phase:** 1 (Optional)  
**Complexity:** Small  
**Estimated Time:** 10 minutes  
**Dependencies:** None

**Description:**
Update the `clearSessionCookie()` function in `src/app/api/auth/logout/route.ts` to use `response.cookies.delete()`.

**Acceptance Criteria:**
- ✓ Function simplified to use `response.cookies.delete('session')`
- ✓ Logout flow still clears cookie correctly
- ✓ TypeScript compilation succeeds
- ✓ No linting errors

---

### Task 4: Local Testing - Signup Flow

**Task ID:** `test-signup-cookie`  
**Phase:** 2  
**Complexity:** Small  
**Estimated Time:** 15 minutes  
**Dependencies:** Tasks 1-2

**Description:**
Verify the signup flow creates and delivers the session cookie to the browser.

**Acceptance Criteria:**
- ✓ See Set-Cookie header in Response headers
- ✓ See `session` cookie in DevTools Application tab
- ✓ Cookie has HttpOnly flag
- ✓ Cookie has SameSite=Strict
- ✓ Cookie path is /

---

### Task 5: Local Testing - Login Flow

**Task ID:** `test-login-cookie`  
**Phase:** 2  
**Complexity:** Small  
**Estimated Time:** 15 minutes  
**Dependencies:** Tasks 1-2

**Description:**
Verify the login flow creates and delivers the session cookie.

**Acceptance Criteria:**
- ✓ See Set-Cookie header in response
- ✓ See `session` cookie in DevTools
- ✓ Cookie flags correct (HttpOnly, Strict, /)

---

### Task 6: Local Testing - Protected Route Access

**Task ID:** `test-protected-route`  
**Phase:** 2  
**Complexity:** Small  
**Estimated Time:** 15 minutes  
**Dependencies:** Tasks 1-2, 4-5

**Description:**
Verify that after login/signup, protected routes are accessible (return 200, not 401).

**Acceptance Criteria:**
- ✓ After login, dashboard loads successfully (not 401)
- ✓ Page content is visible
- ✓ No "Authentication required" error

---

### Task 7: End-to-End Test - Full Flow

**Task ID:** `e2e-full-auth-flow`  
**Phase:** 3  
**Complexity:** Medium  
**Estimated Time:** 30 minutes  
**Dependencies:** Tasks 1-6

**Description:**
Complete end-to-end test of signup → cookie delivery → dashboard access → logout.

**Acceptance Criteria:**
- ✓ Signup creates cookie and allows dashboard access
- ✓ Session persists across page refresh
- ✓ Logout clears cookie and denies access
- ✓ No 401 errors on protected routes

---

### Task 8: Verify TypeScript Compilation

**Task ID:** `typescript-check`  
**Phase:** 1  
**Complexity:** Small  
**Estimated Time:** 5 minutes  
**Dependencies:** Tasks 1-3

**Description:**
Ensure all TypeScript changes compile without errors.

**Acceptance Criteria:**
- ✓ `npm run build` succeeds
- ✓ No TypeScript errors
- ✓ No linting errors

---

## Troubleshooting Guide

### Issue: TypeScript Error "Property 'cookies' does not exist"

**Cause:** NextResponse type not updated or incorrect import

**Solution:**
```typescript
// Verify import is correct
import { NextResponse } from 'next/server';

// Verify using response.cookies (not response.headers)
response.cookies.set('name', 'value', {
  httpOnly: true,
});
```

---

### Issue: Cookie Not Appearing in Browser DevTools

**Cause 1:** Set-Cookie header not in response

**Debug Steps:**
1. DevTools → Network tab
2. Click the login/signup request
3. Go to Response tab
4. Look for Set-Cookie header

**Fix:**
```typescript
// Ensure function is called before returning response
const response = NextResponse.json({...});
response.cookies.set('session', token, {...});  // Must be before return
return response;  // Return AFTER setting cookie
```

---

### Issue: 401 Error on Protected Routes After Login

**Cause:** Cookie not being set

**Debug:**
1. Check DevTools for session cookie
2. Verify Set-Cookie header in network response
3. If missing, verify Tasks 1-2 are complete

---

## Success Metrics

After implementing this specification, you should see:

✓ **Signup Page:**
- User signs up successfully
- Browser stores session cookie
- Dashboard loads (no 401)

✓ **Login Page:**
- User logs in successfully
- Browser stores session cookie
- Dashboard loads (no 401)

✓ **Protected Routes:**
- All accessible after login
- Return 200, not 401
- Content renders correctly

✓ **Logout:**
- Logout button works
- Session cookie cleared
- Accessing protected routes returns 401

✓ **Browser DevTools:**
- Session cookie visible
- HttpOnly flag present
- SameSite=Strict set
- Path is /

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Estimated Total Time:** 4-6 hours (including all testing)
