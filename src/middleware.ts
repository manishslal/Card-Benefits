/**
 * Authentication Middleware
 *
 * Runs on every request to:
 * 1. Extract and verify session cookie
 * 2. Validate JWT signature
 * 3. Check Session.isValid in database (critical for revocation)
 * 4. Store userId in AsyncLocalStorage for server actions
 * 5. Redirect unauthenticated users from protected routes
 *
 * CRITICAL: This middleware must check Session.isValid in database.
 * If we only check JWT expiration, revoked sessions would still be valid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  verifySessionToken,
  isSessionExpired,
} from '@/lib/auth-utils';
import {
  getSessionByToken,
} from '@/lib/auth-server';
import {
  runWithAuthContext,
} from '@/lib/auth-context';

// ============================================================
// Configuration
// ============================================================

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/api/protected',
  '/account',
  '/settings',
];

/**
 * Routes that should redirect authenticated users away
 */
const PUBLIC_AUTH_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
];

// ============================================================
// Middleware Function
// ============================================================

/**
 * Middleware that runs on every request
 *
 * Validates session, stores userId in AsyncLocalStorage,
 * and enforces protected route access.
 *
 * CRITICAL: This must run for every request to provide userId
 * to server actions and API routes.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Try to get session from cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  let userId: string | undefined;

  // Verify session if cookie exists
  if (sessionCookie?.value) {
    try {
      // Step 1: Verify JWT signature
      const payload = verifySessionToken(sessionCookie.value);

      // Step 2: Check if token is expired
      if (!isSessionExpired(payload)) {
        // Step 3: CRITICAL - Check Session.isValid in database
        // This allows revocation of sessions without changing JWT
        const dbSession = await getSessionByToken(sessionCookie.value);
        if (dbSession) {
          userId = payload.userId;
        }
      }
    } catch {
      // JWT verification failed (signature tampering, etc) or session invalid
      // Continue without userId
    }
  }

  // If session is invalid or expired, clear the cookie
  const response = NextResponse.next();
  if (!userId && sessionCookie?.value) {
    response.headers.set(
      'Set-Cookie',
      'session=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict'
    );
  }

  // Route-specific handling
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some(route => pathname.startsWith(route));

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !userId) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from signup/login
  if (isPublicAuthRoute && userId) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Store userId in AsyncLocalStorage for server actions/components
  // This runs synchronously before returning response
  // Note: Due to Next.js architecture, we cannot fully wrap the handler,
  // so this is informational. For server actions, we'll use a wrapper.

  return response;
}

// ============================================================
// Middleware Configuration
// ============================================================

/**
 * Configure which routes trigger the middleware
 *
 * Matches all routes except static files and API routes we want to skip
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};

// ============================================================
// Server Action Wrapper
// ============================================================

/**
 * Wrapper for server actions to provide userId context
 *
 * Usage in server action:
 * ```typescript
 * 'use server';
 *
 * async function myServerAction() {
 *   return withAuth(async () => {
 *     const userId = getAuthUserId();
 *     // Use userId here
 *   });
 * }
 * ```
 *
 * This is called at the top level of server actions
 * to ensure userId is available via getAuthUserId()
 */
export async function withAuth<T>(
  handler: () => Promise<T>
): Promise<T> {
  // Get session from cookies
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  let userId: string | undefined;
  let authError: string | undefined;

  if (sessionCookie?.value) {
    try {
      const payload = verifySessionToken(sessionCookie.value);
      if (!isSessionExpired(payload)) {
        const dbSession = await getSessionByToken(sessionCookie.value);
        if (dbSession) {
          userId = payload.userId;
        }
      }
    } catch (error) {
      authError = 'Invalid session';
    }
  }

  // Run handler within auth context
  return runWithAuthContext(
    { userId, error: authError },
    handler
  );
}
