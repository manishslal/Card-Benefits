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
 * TODO: Implement full session validation
 * For now, just pass through requests to allow development
 */
export async function middleware(request: NextRequest) {
  // For now, allow all requests to pass through
  // This allows the Phase 4 pages to work during development
  // Full auth middleware will be implemented in Phase 5
  return NextResponse.next();
}

// ============================================================
// Middleware Configuration
// ============================================================

/**
 * Configure which routes trigger the middleware
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
