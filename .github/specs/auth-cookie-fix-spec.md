# Authentication Cookie Fix Specification

## Problem Statement

Session cookies aren't reaching the browser because the login/signup APIs are using the incorrect Next.js cookie setting API. The code currently uses:

```typescript
response.headers.set('Set-Cookie', cookieOptionsString)
```

This approach constructs the cookie header manually, which bypasses Next.js's cookie handling middleware and can cause issues with proper cookie serialization.

## Solution

Use Next.js's `response.cookies.set()` API instead, which properly integrates with Next.js's cookie handling system and ensures reliable cookie transmission to the browser.

## Changes Required

### 1. File: `src/app/api/auth/login/route.ts`

**Location**: `setSessionCookie()` function (lines 235-258)

**Current Implementation**:
```typescript
function setSessionCookie(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number
): void {
  const cookieName = 'session';
  const isProduction = process.env.NODE_ENV === 'production';

  // Cookie options
  const cookieOptions = [
    `${cookieName}=${token}`,
    `Max-Age=${maxAgeSeconds}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];

  // Add Secure flag in production
  if (isProduction) {
    cookieOptions.push('Secure');
  }

  response.headers.set('Set-Cookie', cookieOptions.join('; '));
}
```

**Required Changes**:
- Replace `response.headers.set()` with `response.cookies.set()`
- Use Next.js cookie options object format
- Keep all security flags:
  - `httpOnly: true` (prevents XSS)
  - `secure: isProduction` (HTTPS only in production)
  - `sameSite: 'strict'` (prevents CSRF)
  - `maxAge: maxAgeSeconds` (session duration)
  - `path: '/'` (cookie available site-wide)

### 2. File: `src/app/api/auth/signup/route.ts`

**Location**: `setSessionCookie()` function (lines 259-282)

**Current Implementation**: Same as login route

**Required Changes**: Apply identical fix as login route

### 3. File: `src/middleware.ts`

**Location**: Line 205 in `createUnauthorizedResponse()` function

**Current Implementation**:
```typescript
response.cookies.delete('sessionToken');
```

**Required Changes**:
- Change cookie name from `'sessionToken'` to `'session'` for consistency
- This ensures the middleware clears the correct cookie on logout

## Security Requirements

All existing security features must be preserved:

- ✅ **HttpOnly Flag**: Prevents JavaScript access (XSS protection)
- ✅ **Secure Flag**: Only sent over HTTPS in production
- ✅ **SameSite=Strict**: Prevents cross-site request forgery (CSRF)
- ✅ **Max-Age**: Session expiration time in seconds
- ✅ **Path=/**: Cookie available for all routes

## Implementation Details

### New Cookie Options Structure

```typescript
response.cookies.set({
  name: 'session',
  value: token,
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  maxAge: maxAgeSeconds,
  path: '/'
});
```

### Consistency Checks

- Cookie name must be `'session'` in all locations:
  - Login route: `setSessionCookie()`
  - Signup route: `setSessionCookie()`
  - Middleware: `response.cookies.delete('session')`
  - Middleware: `request.cookies.get('session')?. value`

- All security flags must match across all locations

## Testing Checklist

- [ ] TypeScript compilation succeeds (`npm run build`)
- [ ] No linting errors (`npm run lint`)
- [ ] No TypeScript errors in auth routes
- [ ] Session cookie is set with correct name
- [ ] HttpOnly flag prevents JavaScript access
- [ ] Secure flag set in production
- [ ] SameSite=Strict prevents CSRF
- [ ] Middleware correctly reads cookie with `request.cookies.get('session')`
- [ ] Middleware correctly deletes cookie with `response.cookies.delete('session')`
- [ ] Cookie is transmitted to browser in Set-Cookie header
- [ ] Cookie persists across page navigation
- [ ] Logout properly clears the cookie

## Commit Message

```
Fix authentication: use response.cookies.set() for session cookie

This fixes a critical bug where session cookies weren't reaching the
browser because the login/signup APIs were using response.headers.set()
instead of Next.js's response.cookies.set() API.

Changes:
- Use response.cookies.set() in login route (src/app/api/auth/login/route.ts)
- Use response.cookies.set() in signup route (src/app/api/auth/signup/route.ts)
- Fix cookie name consistency in middleware (src/middleware.ts)

Security:
- HttpOnly flag prevents XSS attacks
- Secure flag for HTTPS in production
- SameSite=Strict prevents CSRF
- Consistent session cookie name everywhere

Co-authored-by: QA Team <qa@example.com>
```

## Related Files

- `/src/lib/auth-utils.ts` - Session utilities (no changes needed)
- `/src/lib/auth-server.ts` - Database operations (no changes needed)
- `/.env` - Environment configuration (review NODE_ENV setting)
